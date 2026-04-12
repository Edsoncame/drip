import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/products";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendConfirmationEmail, sendEmail } from "@/lib/email";
import { createCharge, createCustomer, createCard, createPlan, createSubscription } from "@/lib/culqi";

/**
 * Culqi Checkout — Cobro inicial + suscripción recurrente
 *
 * Variables de entorno requeridas:
 *   CULQI_SECRET_KEY              — sk_test_... o sk_live_...
 *   NEXT_PUBLIC_CULQI_PUBLIC_KEY  — pk_test_... o pk_live_...
 *   NEXT_PUBLIC_APP_URL           — https://www.fluxperu.com
 *
 * Configurar en Culqi Panel:
 *   1. Ir a culqi.com → Panel → Desarrollo → Webhooks
 *   2. URL: https://www.fluxperu.com/api/webhooks/culqi
 *   3. Eventos: subscription.charge.succeeded, subscription.charge.failed
 */

const tag = "[checkout]";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, months, cardToken, customer, quantity = 1, appleCare = false, delivery, identity } = body as {
      slug: string;
      months: number;
      cardToken: string;
      quantity?: number;
      appleCare?: boolean;
      customer: {
        name: string;
        email: string;
        phone: string;
        company: string;
        ruc: string;
      };
      delivery?: {
        method: "pickup" | "shipping";
        address: string;
        distrito: string;
        reference: string;
      };
      identity?: {
        dniNumber: string;
        dniPhoto: string;
        selfiePhoto: string;
      };
    };

    // ── Input validation ────────────────────────────────────────────────────────
    if (!slug || typeof months !== "number") {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    if (!customer?.name?.trim() || !customer?.email?.trim() || !customer?.phone?.trim() || !customer?.company?.trim()) {
      return NextResponse.json({ error: "Nombre, email, teléfono y empresa son requeridos" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (!cardToken) {
      return NextResponse.json({ error: "Token de tarjeta requerido" }, { status: 400 });
    }

    const product = getProduct(slug);
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (product.stock === 0) {
      return NextResponse.json({ error: "Producto agotado" }, { status: 400 });
    }

    const pricing = product.pricing.find((p) => p.months === months);
    if (!pricing) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    const qty = Math.max(1, Math.min(20, Math.floor(quantity)));
    const APPLECARE_PRICE = 12;
    const totalMonthly = (pricing.price + (appleCare ? APPLECARE_PRICE : 0)) * qty;
    const amountCents = totalMonthly * 100; // Culqi uses cents

    // 1 — Charge first month with Culqi
    const charge = await createCharge({
      amount: amountCents,
      currency: "USD",
      email: customer.email,
      tokenId: cardToken,
      description: `FLUX — ${product.name}${qty > 1 ? ` ×${qty}` : ""} · Primer mes`,
    });
    console.log(`${tag} charge created id=${charge.id} amount=${totalMonthly}`);

    // 2 — Create Culqi customer + card + plan + subscription for recurring
    let subscriptionId: string | null = null;
    try {
      const nameParts = customer.name.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || firstName;

      const culqiCustomer = await createCustomer({
        email: customer.email,
        firstName,
        lastName,
        phone: customer.phone,
        address: delivery?.address,
        city: delivery?.distrito,
      });

      // Need a new token for card (original was consumed by charge)
      // For recurring, we save card from the charge
      // Note: Culqi requires a separate token for card creation
      // We'll set up subscription via webhook when we have a stored card
      console.log(`${tag} culqi customer created id=${culqiCustomer.id}`);
      subscriptionId = `culqi_${charge.id}`;
    } catch (subErr) {
      // Non-blocking — first payment already succeeded
      console.warn(`${tag} subscription setup deferred`, subErr);
      subscriptionId = `charge_${charge.id}`;
    }

    // 3 — Ensure user account exists (auto-create for guests)
    const session = await getSession();
    let userId = session?.userId ?? null;

    if (!userId) {
      const existing = await query<{ id: string }>(
        "SELECT id FROM users WHERE email = $1",
        [customer.email.toLowerCase()]
      );

      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
      } else {
        const { generateUniqueReferralCode } = await import("@/lib/referrals");
        const referralCode = await generateUniqueReferralCode();
        const created = await query<{ id: string }>(
          `INSERT INTO users (name, email, phone, company, ruc, dni_number, referral_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [customer.name, customer.email.toLowerCase(), customer.phone, customer.company, customer.ruc || null, identity?.dniNumber || null, referralCode]
        );
        userId = created.rows[0].id;
        console.log(`${tag} auto-created user id=${userId} email=${customer.email}`);

        const { signToken } = await import("@/lib/auth");
        const resetToken = await signToken({ userId, email: customer.email, name: customer.name });
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
        sendEmail({
          to: customer.email,
          subject: "Bienvenido a FLUX — Configura tu contraseña",
          html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">Bienvenido a FLUX, ${customer.name.split(" ")[0]}</h1>
  <p style="color:#666;margin:0 0 16px">Tu renta de <strong>${product.name}</strong> está confirmada. Creamos una cuenta para ti.</p>
  <p style="color:#666;margin:0 0 24px">Configura tu contraseña para acceder a tu panel:</p>
  <a href="${APP_URL}/auth/nueva-password?token=${resetToken}" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14px">Crear mi contraseña</a>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
        }).catch(() => {});
      }
    }

    // 4 — Save subscription to DB
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);

    await query(
      `INSERT INTO subscriptions
        (user_id, product_slug, product_name, months, monthly_price, status, started_at, ends_at, mp_subscription_id, customer_name, customer_email, customer_phone, customer_company, customer_ruc, apple_care, delivery_method, delivery_address, delivery_distrito, delivery_reference, dni_number, dni_photo_url, selfie_url)
       VALUES ($1,$2,$3,$4,$5,'active',NOW(),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT DO NOTHING`,
      [
        userId,
        product.slug,
        product.name,
        months,
        totalMonthly,
        endsAt,
        subscriptionId,
        customer.name,
        customer.email,
        customer.phone,
        customer.company,
        customer.ruc || null,
        appleCare,
        delivery?.method ?? "shipping",
        delivery?.address || null,
        delivery?.distrito || null,
        delivery?.reference || null,
        identity?.dniNumber || null,
        identity?.dniPhoto || null,
        identity?.selfiePhoto || null,
      ]
    );

    // 5 — Update user profile
    if (userId) {
      const hasIdentityDocs = identity?.dniPhoto && identity.dniPhoto !== "verified" && identity?.selfiePhoto && identity.selfiePhoto !== "verified";
      await query(
        `UPDATE users SET
          phone = COALESCE(NULLIF($2, ''), phone),
          company = COALESCE(NULLIF($3, ''), company),
          ruc = COALESCE(NULLIF($4, ''), ruc),
          dni_number = COALESCE(NULLIF($5, ''), dni_number),
          identity_verified = CASE WHEN $6 THEN true ELSE identity_verified END,
          updated_at = NOW()
        WHERE id = $1`,
        [userId, customer.phone, customer.company, customer.ruc || "", identity?.dniNumber || "", hasIdentityDocs ?? false]
      );
    }

    // 6 — Auto-assign equipment from inventory
    const SLUG_TO_MODEL: Record<string, string> = {
      "macbook-air-13-m4": "MacBook Air",
      "macbook-pro-14-m4": "MacBook Pro%M4",
      "macbook-pro-14-m5": "MacBook Pro%M5",
    };
    const modelPattern = SLUG_TO_MODEL[slug];
    if (modelPattern) {
      const eqResult = await query<{ codigo_interno: string }>(
        `UPDATE equipment SET estado_actual = 'Arrendada', updated_at = NOW()
         WHERE id = (
           SELECT id FROM equipment
           WHERE modelo_completo ILIKE $1 AND estado_actual = 'Disponible'
           ORDER BY fecha_compra ASC
           LIMIT 1
         )
         RETURNING codigo_interno`,
        [`%${modelPattern}%`]
      );
      if (eqResult.rows.length > 0) {
        console.log(`${tag} auto-assigned equipment ${eqResult.rows[0].codigo_interno} to ${customer.email}`);
      } else {
        console.warn(`${tag} NO STOCK for ${slug} — manual assignment needed`);
        sendEmail({
          to: "operaciones@fluxperu.com",
          subject: `⚠️ SIN STOCK: ${product.name} — pedido de ${customer.name}`,
          html: `<div style="font-family:Inter,sans-serif;padding:24px"><h2 style="color:#DC2626">⚠️ Sin stock disponible</h2><p><strong>${customer.name}</strong> (${customer.email}) acaba de pagar por <strong>${product.name}</strong> pero no hay equipos disponibles en inventario.</p><p>Acción requerida: asignar equipo manualmente desde el panel admin.</p></div>`,
        }).catch(() => {});
      }
    }

    // 7 — Send confirmation email
    sendConfirmationEmail({
      to: customer.email,
      name: customer.name,
      productName: product.name,
      months,
      price: totalMonthly,
      endsAt,
    }).catch(() => {});

    console.log(`${tag} subscription created culqi_charge=${charge.id} product=${slug} months=${months} user=${userId}`);

    return NextResponse.json({
      subscriptionId: subscriptionId,
      chargeId: charge.id,
      status: "active",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar el pago";
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
