import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, PreApprovalPlan, PreApproval } from "mercadopago";
import { getProduct } from "@/lib/products";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendConfirmationEmail, sendEmail } from "@/lib/email";

/**
 * MercadoPago Checkout — Suscripciones recurrentes
 *
 * Variables de entorno requeridas:
 *   MP_ACCESS_TOKEN        — Access token de producción (mercadopago.com → Tu negocio → Credenciales)
 *   NEXT_PUBLIC_MP_PUBLIC_KEY — Public key de producción (para Card Brick en frontend)
 *   MP_WEBHOOK_SECRET      — Clave secreta del webhook (Configuración → Webhooks → Clave secreta)
 *   NEXT_PUBLIC_APP_URL    — URL base (https://www.fluxperu.com)
 *
 * Configurar en el dashboard de MercadoPago:
 *   1. Ir a mercadopago.com → Tu negocio → Configuración → Webhooks
 *   2. URL de notificación: https://www.fluxperu.com/api/webhooks/mercadopago
 *   3. Eventos: subscription_preapproval, payment
 *   4. Copiar la clave secreta → VERCEL env MP_WEBHOOK_SECRET
 */

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});

const tag = "[checkout]";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, months, cardToken, customer, quantity = 1, appleCare = false, delivery } = body as {
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

    const plan = product.pricing.find((p) => p.months === months);
    if (!plan) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    const qty = Math.max(1, Math.min(20, Math.floor(quantity)));
    const APPLECARE_PRICE = 12;
    const totalMonthly = (plan.price + (appleCare ? APPLECARE_PRICE : 0)) * qty;

    // 1 — Create a subscription plan (one per checkout)
    const preApprovalPlan = await new PreApprovalPlan(client).create({
      body: {
        reason: `FLUX — ${product.name}${qty > 1 ? ` ×${qty}` : ""} · ${months} meses`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          repetitions: months,
          billing_day: new Date().getDate(),
          transaction_amount: totalMonthly,
          currency_id: "USD",
        },
        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success`,
      },
    });

    if (!preApprovalPlan.id) {
      throw new Error("No se pudo crear el plan de suscripción");
    }

    // 2 — Subscribe the customer using the card token from the frontend
    const preApproval = await new PreApproval(client).create({
      body: {
        preapproval_plan_id: preApprovalPlan.id,
        payer_email: customer.email,
        card_token_id: cardToken,
        status: "authorized",
      },
    });

    // 3 — Save subscription to DB
    const session = await getSession();
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);

    await query(
      `INSERT INTO subscriptions
        (user_id, product_slug, product_name, months, monthly_price, status, started_at, ends_at, mp_subscription_id, customer_name, customer_email, customer_phone, customer_company, customer_ruc, apple_care, delivery_method, delivery_address, delivery_distrito, delivery_reference)
       VALUES ($1,$2,$3,$4,$5,'active',NOW(),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT DO NOTHING`,
      [
        session?.userId ?? null,
        product.slug,
        product.name,
        months,
        totalMonthly,
        endsAt,
        preApproval.id ?? null,
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
      ]
    );

    // 4 — Auto-assign equipment from inventory
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
        // Alert admin
        sendEmail({
          to: "operaciones@fluxperu.com",
          subject: `⚠️ SIN STOCK: ${product.name} — pedido de ${customer.name}`,
          html: `<div style="font-family:Inter,sans-serif;padding:24px"><h2 style="color:#DC2626">⚠️ Sin stock disponible</h2><p><strong>${customer.name}</strong> (${customer.email}) acaba de pagar por <strong>${product.name}</strong> pero no hay equipos disponibles en inventario.</p><p>Acción requerida: asignar equipo manualmente desde el panel admin.</p></div>`,
        }).catch(() => {});
      }
    }

    // 5 — Send confirmation email (non-blocking)
    sendConfirmationEmail({
      to: customer.email,
      name: customer.name,
      productName: product.name,
      months,
      price: totalMonthly,
      endsAt,
    }).catch(() => {});

    console.log(`${tag} subscription created mp_id=${preApproval.id} product=${slug} months=${months} user=${session?.userId ?? "guest"}`);

    return NextResponse.json({
      subscriptionId: preApproval.id,
      status: preApproval.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar el pago";
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
