import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/stripe";
import { query } from "@/lib/db";
import { sendConfirmationEmail, sendEmail } from "@/lib/email";

/**
 * Stripe Webhook Handler
 *
 * Configurar en Stripe Dashboard → Developers → Webhooks:
 *   URL: https://www.fluxperu.com/api/webhooks/stripe
 *   Eventos: checkout.session.completed, invoice.paid, invoice.payment_failed,
 *            customer.subscription.deleted, customer.subscription.updated
 *
 * Env vars:
 *   STRIPE_WEBHOOK_SECRET — whsec_... (copiado al crear el endpoint)
 *
 * Idempotencia:
 *   - checkout.session.completed → dedupe por mp_subscription_id (subscription.id)
 *   - invoice.paid → dedupe por invoice.id en payments (vía subscription + period_label)
 */

const tag = "[webhook/stripe]";

/**
 * En Stripe API v2026-03-25, `invoice.subscription` fue reemplazado por
 * `invoice.parent.subscription_details.subscription`. Este helper lee ambos
 * para ser robusto ante cambios futuros.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = invoice as any;
  const fromParent = inv.parent?.subscription_details?.subscription;
  if (typeof fromParent === "string") return fromParent;
  if (fromParent?.id) return fromParent.id;
  const fromLines = inv.lines?.data?.[0]?.subscription;
  if (typeof fromLines === "string") return fromLines;
  if (fromLines?.id) return fromLines.id;
  return null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.warn(`${tag} signature verification failed`, err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.log(`${tag} received type=${event.type} id=${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "customer.subscription.updated":
        // Por ahora solo log — la info relevante viene por invoice.*
        console.log(`${tag} subscription updated id=${(event.data.object as Stripe.Subscription).id}`);
        break;

      default:
        console.log(`${tag} unhandled event type=${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`${tag} error processing ${event.type}`, err);
    // 200 para no triggerear retries — ya loggeamos el error
    return NextResponse.json({ received: true, error: String(err) });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// checkout.session.completed — primer cobro + setup
// ═══════════════════════════════════════════════════════════════════════════

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!stripeSubscriptionId) {
    console.warn(`${tag} checkout.completed sin subscription id=${session.id}`);
    return;
  }

  const meta = session.metadata ?? {};
  const customerEmail = (session.customer_email ?? meta.customer_email ?? "").toLowerCase();
  if (!customerEmail) {
    console.warn(`${tag} checkout.completed sin email session=${session.id}`);
    return;
  }

  // Dedupe: si ya procesamos esta subscription antes, salimos.
  const existing = await query<{ id: string }>(
    `SELECT id FROM subscriptions WHERE mp_subscription_id = $1 LIMIT 1`,
    [stripeSubscriptionId],
  );
  if (existing.rows.length > 0) {
    console.log(`${tag} already processed sub=${stripeSubscriptionId}`);
    return;
  }

  const slug = meta.product_slug ?? "";
  const productName = meta.product_name ?? "";
  const months = parseInt(meta.months ?? "0", 10);
  const quantity = parseInt(meta.quantity ?? "1", 10);
  const appleCare = meta.apple_care === "true";
  const monthlyPrice = parseFloat(meta.monthly_price ?? "0");

  // ── Ensure user exists ──
  let userId: string | null = null;
  const existingUser = await query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [customerEmail],
  );

  if (existingUser.rows.length > 0) {
    userId = existingUser.rows[0].id;
  } else {
    const { generateUniqueReferralCode } = await import("@/lib/referrals");
    const referralCode = await generateUniqueReferralCode();
    const created = await query<{ id: string }>(
      `INSERT INTO users (name, email, phone, company, ruc, dni_number, referral_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        meta.customer_name ?? "",
        customerEmail,
        meta.customer_phone ?? "",
        meta.customer_company ?? "",
        meta.customer_ruc || null,
        meta.dni_number || null,
        referralCode,
      ],
    );
    userId = created.rows[0].id;
    console.log(`${tag} auto-created user id=${userId} email=${customerEmail}`);

    const { signToken } = await import("@/lib/auth");
    const resetToken = await signToken({
      userId,
      email: customerEmail,
      name: meta.customer_name ?? customerEmail,
    });
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
    const firstName = (meta.customer_name ?? "").split(" ")[0] || "";
    sendEmail({
      to: customerEmail,
      subject: "Bienvenido a FLUX — Configura tu contraseña",
      html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">Bienvenido a FLUX, ${firstName}</h1>
  <p style="color:#666;margin:0 0 16px">Tu renta de <strong>${productName}</strong> está confirmada. Creamos una cuenta para vos.</p>
  <p style="color:#666;margin:0 0 24px">Configurá tu contraseña para acceder a tu panel:</p>
  <a href="${APP_URL}/auth/nueva-password?token=${resetToken}" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14px">Crear mi contraseña</a>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Flux Peru, LLC</p>
</div>`,
    }).catch(() => {});
  }

  // ── Hidratar URLs de imágenes desde KYC (si vino kyc_correlation_id) ──
  // Las fotos ya no viajan en metadata — buscamos las URLs reales en las
  // tablas kyc_*. Si no hay corr_id (usuario ya verificado previamente),
  // las columnas snapshot quedan null — el admin igual puede consultar el
  // historial en /admin/kyc o en las tablas kyc_*.
  let dniPhotoUrl: string | null = null;
  let selfieUrl: string | null = null;
  const kycCorrId = meta.kyc_correlation_id;
  if (kycCorrId) {
    const scanRow = await query<{ imagen_anverso_key: string | null }>(
      `SELECT imagen_anverso_key FROM kyc_dni_scans
       WHERE correlation_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [kycCorrId],
    );
    const faceRow = await query<{ selfie_key: string | null }>(
      `SELECT selfie_key FROM kyc_face_matches
       WHERE correlation_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [kycCorrId],
    );
    dniPhotoUrl = scanRow.rows[0]?.imagen_anverso_key ?? null;
    selfieUrl = faceRow.rows[0]?.selfie_key ?? null;
  }

  // ── Create subscription row ──
  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + months);

  const subResult = await query<{ id: string }>(
    `INSERT INTO subscriptions
      (user_id, product_slug, product_name, months, monthly_price, status,
       started_at, ends_at, mp_subscription_id,
       customer_name, customer_email, customer_phone, customer_company, customer_ruc,
       apple_care, delivery_method, delivery_address, delivery_distrito, delivery_reference,
       dni_number, dni_photo_url, selfie_url, payment_method)
     VALUES ($1,$2,$3,$4,$5,'active',NOW(),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'stripe')
     RETURNING id`,
    [
      userId,
      slug,
      productName,
      months,
      monthlyPrice,
      endsAt,
      stripeSubscriptionId,
      meta.customer_name ?? "",
      customerEmail,
      meta.customer_phone ?? "",
      meta.customer_company ?? "",
      meta.customer_ruc || null,
      appleCare,
      meta.delivery_method ?? "shipping",
      meta.delivery_address || null,
      meta.delivery_distrito || null,
      meta.delivery_reference || null,
      meta.dni_number || null,
      dniPhotoUrl,
      selfieUrl,
    ],
  );
  const dbSubscriptionId = subResult.rows[0].id;

  // ── Update user profile (phone/company/ruc/dni) ──
  if (userId) {
    await query(
      `UPDATE users SET
        phone = COALESCE(NULLIF($2, ''), phone),
        company = COALESCE(NULLIF($3, ''), company),
        ruc = COALESCE(NULLIF($4, ''), ruc),
        dni_number = COALESCE(NULLIF($5, ''), dni_number),
        updated_at = NOW()
      WHERE id = $1`,
      [userId, meta.customer_phone ?? "", meta.customer_company ?? "", meta.customer_ruc ?? "", meta.dni_number ?? ""],
    );
  }

  // ── Auto-assign equipment ──
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
      [`%${modelPattern}%`],
    );
    if (eqResult.rows.length > 0) {
      console.log(`${tag} auto-assigned equipment ${eqResult.rows[0].codigo_interno} to ${customerEmail}`);
    } else {
      console.warn(`${tag} NO STOCK for ${slug} — manual assignment needed`);
      sendEmail({
        to: "operaciones@fluxperu.com",
        subject: `⚠️ SIN STOCK: ${productName} — pedido de ${meta.customer_name ?? customerEmail}`,
        html: `<div style="font-family:Inter,sans-serif;padding:24px"><h2 style="color:#DC2626">⚠️ Sin stock disponible</h2><p><strong>${meta.customer_name ?? customerEmail}</strong> (${customerEmail}) acaba de pagar por <strong>${productName}</strong> pero no hay equipos disponibles en inventario.</p><p>Acción: asignar equipo manualmente desde /admin.</p></div>`,
      }).catch(() => {});
    }
  }

  // ── First payment record (Stripe charge covers month 1) ──
  if (userId) {
    const monthLabel = new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    const periodLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    await query(
      `INSERT INTO payments (subscription_id, user_id, amount, currency, period_label, due_date, status, payment_method, validated_at)
       VALUES ($1, $2, $3, 'USD', $4, NOW(), 'validated', 'stripe', NOW())`,
      [dbSubscriptionId, userId, monthlyPrice, periodLabel],
    );
  }

  // ── Confirmation email ──
  sendConfirmationEmail({
    to: customerEmail,
    name: meta.customer_name ?? customerEmail,
    productName,
    months,
    price: monthlyPrice,
    endsAt,
  }).catch(() => {});

  console.log(
    `${tag} subscription bootstrapped sub=${stripeSubscriptionId} db=${dbSubscriptionId} user=${userId}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// invoice.paid — cobro recurrente mensual
// ═══════════════════════════════════════════════════════════════════════════

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const stripeSubscriptionId = subscriptionIdFromInvoice(invoice);
  if (!stripeSubscriptionId) {
    console.log(`${tag} invoice.paid sin subscription (one-off) invoice=${invoice.id}`);
    return;
  }

  // Primer invoice lo cubre checkout.session.completed — acá solo procesamos
  // los recurrentes. billing_reason nos dice cuál es.
  if (invoice.billing_reason === "subscription_create") {
    console.log(`${tag} invoice.paid (primer cobro) ignorado — ya lo maneja checkout.session.completed`);
    return;
  }

  const subRow = await query<{
    id: string;
    user_id: string;
    months: number;
    started_at: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    product_name: string;
    monthly_price: string;
  }>(
    `SELECT id, user_id, months, started_at, customer_name, customer_email,
            customer_phone, product_name, monthly_price
     FROM subscriptions
     WHERE mp_subscription_id = $1 AND status IN ('active', 'shipped', 'delivered')
     LIMIT 1`,
    [stripeSubscriptionId],
  );

  if (subRow.rows.length === 0) {
    console.warn(`${tag} invoice.paid no match sub=${stripeSubscriptionId}`);
    return;
  }
  const sub = subRow.rows[0];

  // Max rental check — misma heurística que Culqi
  const MAX_MONTHS: Record<number, number> = { 8: 16, 16: 24, 24: 30 };
  const maxAllowed = MAX_MONTHS[sub.months] ?? sub.months + 8;
  const monthsUsed = Math.ceil(
    (Date.now() - new Date(sub.started_at).getTime()) / (30.44 * 86400000),
  );

  if (monthsUsed >= maxAllowed) {
    const RESIDUAL: Record<number, number> = { 8: 0.775, 16: 0.55, 24: 0.325 };
    const residualPct = RESIDUAL[sub.months] ?? 0.325;
    const estimatedValue = parseFloat(sub.monthly_price) * sub.months * 1.4;
    const purchasePrice = Math.round(estimatedValue * residualPct);

    await query(
      `UPDATE subscriptions SET
        end_action = 'max_reached',
        purchase_price_usd = $2,
        updated_at = NOW()
      WHERE id = $1`,
      [sub.id, purchasePrice],
    );

    const firstName = sub.customer_name.split(" ")[0];
    sendEmail({
      to: sub.customer_email,
      subject: `${firstName}, tu renta de ${sub.product_name} llegó al límite`,
      html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px"><h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">${firstName}, tu renta llegó al plazo máximo</h1><p style="color:#666;margin:0 0 16px">Tu <strong>${sub.product_name}</strong> cumplió el período máximo de alquiler. Tenés <strong>30 días</strong> para decidir:</p><div style="background:#EEF2FF;border-radius:12px;padding:16px;margin:0 0 12px"><p style="font-weight:700;color:#18191F;margin:0">💰 Comprar tu Mac por $${purchasePrice} USD</p></div><div style="background:#F7F7F7;border-radius:12px;padding:16px;margin:0 0 16px"><p style="font-weight:700;color:#18191F;margin:0">↩️ Devolver el equipo (sin costo)</p></div><p style="color:#DC2626;font-size:13px;font-weight:600;margin:0 0 16px">Si no respondés en 30 días, se cobra automáticamente el valor de compra ($${purchasePrice}).</p><a href="https://www.fluxperu.com/cuenta/rentas" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14px">Ver mis opciones</a></div>`,
    }).catch(() => {});

    sendEmail({
      to: "operaciones@fluxperu.com",
      subject: `[OPS] ⚠️ Renta al límite: ${sub.customer_name} — ${sub.product_name} (${monthsUsed}m/${maxAllowed}m)`,
      html: `<div style="font-family:Inter,sans-serif;padding:24px"><h2 style="color:#DC2626">⚠️ Renta alcanzó límite máximo</h2><p><strong>${sub.customer_name}</strong> (${sub.customer_email}) tiene ${monthsUsed} meses de uso (máximo ${maxAllowed}). Debe comprar ($${purchasePrice}) o devolver en 30 días.</p></div>`,
    }).catch(() => {});
    return;
  }

  // Normal extension
  await query(
    `UPDATE subscriptions SET
      status = 'active',
      ends_at = GREATEST(ends_at, NOW()) + INTERVAL '1 month',
      next_billing_at = NOW() + INTERVAL '1 month',
      updated_at = NOW()
    WHERE id = $1`,
    [sub.id],
  );

  // Payment record (dedupe: invoice.id puede venir múltiples veces)
  const amount = (invoice.amount_paid ?? 0) / 100;
  const monthLabel = new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const periodLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Dedupe por invoice.id usando upsert — agregamos stripe_invoice_id a payments
  // si no existe la columna, hacemos INSERT normal (idempotencia débil por fecha).
  await query(
    `INSERT INTO payments (subscription_id, user_id, amount, currency, period_label, due_date, status, payment_method, validated_at)
     SELECT $1, $2, $3, 'USD', $4, NOW(), 'validated', 'stripe', NOW()
     WHERE NOT EXISTS (
       SELECT 1 FROM payments
       WHERE subscription_id = $1 AND period_label = $4 AND status = 'validated'
     )`,
    [sub.id, sub.user_id, amount, periodLabel],
  );

  console.log(`${tag} recurring charge for sub=${sub.id} amount=$${amount} (${monthsUsed}/${maxAllowed}m)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// invoice.payment_failed — cobro recurrente falló
// ═══════════════════════════════════════════════════════════════════════════

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const stripeSubscriptionId = subscriptionIdFromInvoice(invoice);
  if (!stripeSubscriptionId) return;

  const subRow = await query<{
    id: string;
    customer_name: string;
    customer_email: string;
    product_name: string;
    monthly_price: string;
  }>(
    `SELECT id, customer_name, customer_email, product_name, monthly_price
     FROM subscriptions
     WHERE mp_subscription_id = $1 AND status IN ('active', 'shipped', 'delivered')
     LIMIT 1`,
    [stripeSubscriptionId],
  );
  if (subRow.rows.length === 0) return;
  const row = subRow.rows[0];
  const firstName = row.customer_name.split(" ")[0];

  sendEmail({
    to: row.customer_email,
    subject: `⚠️ Tu pago de FLUX no pudo procesarse`,
    html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px"><h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">${firstName}, tu pago no pudo procesarse</h1><p style="color:#666;margin:0 0 16px">El cobro mensual de <strong>$${row.monthly_price}</strong> por tu <strong>${row.product_name}</strong> fue rechazado.</p><p style="color:#666;margin:0 0 16px">Puede ser porque tu tarjeta expiró, no tiene fondos, o el banco bloqueó el cargo.</p><p style="color:#666;margin:0 0 24px"><strong>Tenés 5 días hábiles para regularizar.</strong> Después podemos suspender el servicio.</p><a href="https://wa.me/51900164769" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14px">Contactar soporte</a></div>`,
  }).catch(() => {});

  sendEmail({
    to: "operaciones@fluxperu.com",
    subject: `[OPS] Pago fallido: ${row.customer_name} — ${row.product_name}`,
    html: `<div style="font-family:Inter,sans-serif;padding:24px"><h2 style="color:#DC2626">⚠️ Pago rechazado</h2><p><strong>${row.customer_name}</strong> (${row.customer_email})</p><p>Producto: ${row.product_name} — $${row.monthly_price}/mes</p></div>`,
  }).catch(() => {});

  console.log(`${tag} invoice.payment_failed for sub=${row.id}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// customer.subscription.deleted — cancelación (Stripe dashboard o API)
// ═══════════════════════════════════════════════════════════════════════════

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  await query(
    `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
     WHERE mp_subscription_id = $1 AND status != 'cancelled'`,
    [sub.id],
  );
  console.log(`${tag} subscription cancelled via Stripe sub=${sub.id}`);
}
