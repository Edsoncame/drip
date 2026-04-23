#!/usr/bin/env node
/**
 * Replay manual de un evento de Stripe checkout.session.completed.
 * Uso: node scripts/webhook-replay.mjs cs_live_xxx
 *
 * Ejecuta handleCheckoutCompleted con la session real, bypasseando la
 * verificación de firma. Muestra el error REAL si el webhook falla.
 */

import fs from "node:fs";
import path from "node:path";

// Cargar .env.vercel + .env.local
for (const f of [".env.vercel", ".env.local"]) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("Uso: node scripts/webhook-replay.mjs cs_live_xxx");
  process.exit(1);
}

const { default: Stripe } = await import("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-03-25.dahlia",
});

console.log(`Fetching session ${sessionId}...`);
const session = await stripe.checkout.sessions.retrieve(sessionId);
console.log(`session: ${session.id} status=${session.status} payment=${session.payment_status} sub=${session.subscription}`);

// Importar el handler del webhook
process.env.DATABASE_URL = process.env.DATABASE_URL;

// Importar query y email — este script no invoca POST() directamente del
// route handler (demasiadas deps de Next), sino que replica el flujo inline.
const { query } = await import("../lib/db.ts");
const { sendConfirmationEmail } = await import("../lib/email.ts");
console.log("Simulando flujo interno sin firma (direct call)...");

// Replicar el flujo del handler
async function runHandler(session) {
  try {
    const stripeSubscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    console.log(`[1/8] start session=${session.id} sub=${stripeSubscriptionId}`);
    if (!stripeSubscriptionId) throw new Error("no subscription id in session");

    const meta = session.metadata ?? {};
    const customerEmail = (session.customer_email ?? meta.customer_email ?? "").toLowerCase();
    console.log(`[2/8] dedupe check email=${customerEmail}`);
    const existing = await query(
      `SELECT id FROM subscriptions WHERE mp_subscription_id = $1 LIMIT 1`,
      [stripeSubscriptionId],
    );
    if (existing.rows.length > 0) {
      console.log(`DEDUPE HIT — subscription ya existe (${existing.rows[0].id})`);
      return;
    }

    const slug = meta.product_slug ?? "";
    const productName = meta.product_name ?? "";
    const months = parseInt(meta.months ?? "0", 10);
    const appleCare = meta.apple_care === "true";
    const monthlyPrice = parseFloat(meta.monthly_price ?? "0");

    console.log(`[3/8] ensure user`);
    let userId = null;
    const existingUser = await query(
      `SELECT id FROM users WHERE email = $1`,
      [customerEmail],
    );
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log(`  user existe id=${userId}`);
    } else {
      console.log(`  user NO existe, creando...`);
      const created = await query(
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
          "REF" + Math.random().toString(36).slice(2, 10),
        ],
      );
      userId = created.rows[0].id;
      console.log(`  user creado id=${userId}`);
    }

    console.log(`[4/8] hydrate KYC corr=${meta.kyc_correlation_id}`);
    let dniPhotoUrl = null, selfieUrl = null;
    if (meta.kyc_correlation_id) {
      const scanRow = await query(
        `SELECT imagen_anverso_key FROM kyc_dni_scans
         WHERE correlation_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [meta.kyc_correlation_id],
      );
      const faceRow = await query(
        `SELECT selfie_key FROM kyc_face_matches
         WHERE correlation_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [meta.kyc_correlation_id],
      );
      dniPhotoUrl = scanRow.rows[0]?.imagen_anverso_key ?? null;
      selfieUrl = faceRow.rows[0]?.selfie_key ?? null;
      console.log(`  dniPhotoUrl=${dniPhotoUrl ? "yes" : "no"} selfieUrl=${selfieUrl ? "yes" : "no"}`);
    }

    console.log(`[5/8] insert subscription`);
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);
    const shippingCostPen = parseFloat(meta.shipping_cost_pen ?? "0") || 0;
    const shippingLat = meta.shipping_lat ? parseFloat(meta.shipping_lat) : null;
    const shippingLng = meta.shipping_lng ? parseFloat(meta.shipping_lng) : null;

    const subResult = await query(
      `INSERT INTO subscriptions
        (user_id, product_slug, product_name, months, monthly_price, status,
         started_at, ends_at, mp_subscription_id,
         customer_name, customer_email, customer_phone, customer_company, customer_ruc,
         apple_care, delivery_method, delivery_address, delivery_distrito, delivery_reference,
         delivery_place_type, delivery_apartment, delivery_floor,
         shipping_cost_pen, shipping_lat, shipping_lng,
         dni_number, dni_photo_url, selfie_url, payment_method)
       VALUES ($1,$2,$3,$4,$5,'active',NOW(),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'stripe')
       RETURNING id`,
      [
        userId, slug, productName, months, monthlyPrice, endsAt, stripeSubscriptionId,
        meta.customer_name ?? "", customerEmail, meta.customer_phone ?? "",
        meta.customer_company ?? "", meta.customer_ruc || null, appleCare,
        meta.delivery_method ?? "shipping", meta.delivery_address || null,
        meta.delivery_distrito || null, meta.delivery_reference || null,
        meta.delivery_place_type || null, meta.delivery_apartment || null,
        meta.delivery_floor || null, shippingCostPen, shippingLat, shippingLng,
        meta.dni_number || null, dniPhotoUrl, selfieUrl,
      ],
    );
    const dbSubscriptionId = subResult.rows[0].id;
    console.log(`  subscription insertada id=${dbSubscriptionId}`);

    console.log(`[6/8] update user profile`);
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

    console.log(`[7/8] insert first payment`);
    const monthLabel = new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    const periodLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    await query(
      `INSERT INTO payments (subscription_id, user_id, amount, currency, period_label, due_date, status, payment_method, validated_at)
       VALUES ($1, $2, $3, 'USD', $4, NOW(), 'validated', 'stripe', NOW())`,
      [dbSubscriptionId, userId, monthlyPrice, periodLabel],
    );

    console.log(`[8/8] send confirmation email to ${customerEmail}`);
    await sendConfirmationEmail({
      to: customerEmail,
      name: meta.customer_name ?? customerEmail,
      productName, months, price: monthlyPrice, endsAt,
    });
    console.log(`  email enviado`);

    console.log(`\n✅ TODOS LOS PASOS OK. sub db=${dbSubscriptionId}`);
  } catch (e) {
    console.error(`\n❌ FALLÓ EN UN PASO:`);
    console.error(e);
    if (e.cause) console.error("CAUSE:", e.cause);
  }
}

await runHandler(session);
process.exit(0);
