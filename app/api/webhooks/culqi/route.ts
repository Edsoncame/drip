import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";

/**
 * Culqi Webhook Handler
 *
 * Configurar en Culqi Panel → Desarrollo → Webhooks:
 *   URL: https://www.fluxperu.com/api/webhooks/culqi
 *   Eventos: subscription.charge.succeeded, subscription.charge.failed,
 *            charge.succeeded, charge.failed, charge.expired
 *
 * Culqi firma cada webhook con HMAC-SHA256 usando el Webhook Secret del panel.
 * Header: x-culqi-signature  (hex del HMAC-SHA256 del raw body)
 *
 * Variable de entorno requerida:
 *   CULQI_WEBHOOK_SECRET — obtenida en Culqi Panel → Desarrollo → Webhooks → Ver clave
 */

const tag = "[webhook/culqi]";

// ── Signature verification ────────────────────────────────────────────────────

function verifySignature(rawBody: string, xSignature: string): boolean {
  const secret = process.env.CULQI_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(`${tag} CULQI_WEBHOOK_SECRET not set — skipping signature check (UNSAFE in production)`);
    return true; // allow in dev; enforce by setting the env var in prod
  }

  if (!xSignature) {
    console.warn(`${tag} missing x-culqi-signature header`);
    return false;
  }

  // Culqi sends HMAC-SHA256 of the raw body as a hex string
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  try {
    // timingSafeEqual prevents timing attacks
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(xSignature.toLowerCase().replace(/^sha256=/, ""), "hex");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CulqiEvent {
  type: string;
  id: string;
  data: {
    object: string;
    id: string;
    amount?: number;
    currency_code?: string;
    email?: string;
    outcome?: {
      type: string;
      user_message: string;
    };
    subscription_id?: string;
    metadata?: Record<string, string>;
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Read raw body BEFORE parsing JSON (signature is over the raw bytes)
  const rawBody = await req.text();
  const xSignature = req.headers.get("x-culqi-signature") ?? "";

  // Verify signature first — reject before any DB work
  if (!verifySignature(rawBody, xSignature)) {
    console.warn(`${tag} signature verification failed — rejected`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: CulqiEvent;
  try {
    body = JSON.parse(rawBody) as CulqiEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.type ?? "";
  const dataId = body.data?.id ?? body.id ?? "";
  console.log(`${tag} received type=${eventType} id=${dataId}`);

  try {
    switch (eventType) {
      // ── Subscription charge succeeded (recurring payment) ──
      case "subscription.charge.succeeded": {
        const email = body.data?.email;
        if (email) {
          // Check if rental has reached maximum allowed period
          const subs = await query<{
            id: string; months: number; started_at: string;
            customer_name: string; customer_email: string;
            customer_phone: string; product_name: string;
            monthly_price: string;
          }>(
            `SELECT id, months, started_at, customer_name, customer_email,
                    customer_phone, product_name, monthly_price
             FROM subscriptions
             WHERE customer_email = $1 AND status IN ('active', 'delivered')`,
            [email]
          );

          for (const sub of subs.rows) {
            const MAX_MONTHS: Record<number, number> = { 8: 16, 16: 24, 24: 30 };
            const maxAllowed = MAX_MONTHS[sub.months] ?? sub.months + 8;
            const monthsUsed = Math.ceil(
              (Date.now() - new Date(sub.started_at).getTime()) / (30.44 * 86400000)
            );

            if (monthsUsed >= maxAllowed) {
              // Hit the limit — notify that they must buy or return
              console.log(`${tag} rental ${sub.id} hit max ${maxAllowed}m (used ${monthsUsed}m) — forcing decision`);

              // Calculate purchase price
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
                [sub.id, purchasePrice]
              );

              const firstName = sub.customer_name.split(" ")[0];
              sendEmail({
                to: sub.customer_email,
                subject: `${firstName}, tu renta de ${sub.product_name} llegó al límite`,
                html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">${firstName}, tu renta llegó al plazo máximo</h1>
  <p style="color:#666;margin:0 0 16px">Tu <strong>${sub.product_name}</strong> ha cumplido el período máximo de alquiler. Tienes <strong>30 días</strong> para decidir:</p>
  <div style="background:#EEF2FF;border-radius:12px;padding:16px;margin:0 0 12px;display:flex;align-items:center;gap:12px">
    <span style="font-size:24px">💰</span>
    <div>
      <p style="font-weight:700;color:#18191F;margin:0">Comprar tu Mac por $${purchasePrice} USD</p>
      <p style="color:#666;font-size:13px;margin:4px 0 0">El equipo pasa a ser 100% tuyo.</p>
    </div>
  </div>
  <div style="background:#F7F7F7;border-radius:12px;padding:16px;margin:0 0 16px;display:flex;align-items:center;gap:12px">
    <span style="font-size:24px">↩️</span>
    <div>
      <p style="font-weight:700;color:#18191F;margin:0">Devolver el equipo</p>
      <p style="color:#666;font-size:13px;margin:4px 0 0">Sin costo. Coordinamos el recojo.</p>
    </div>
  </div>
  <p style="color:#DC2626;font-size:13px;font-weight:600;margin:0 0 16px">Si no respondes en 30 días, se cobrará automáticamente el valor de compra ($${purchasePrice}).</p>
  <a href="https://www.fluxperu.com/cuenta/rentas" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14px">Ver mis opciones</a>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
              }).catch(() => {});

              sendEmail({
                to: "operaciones@fluxperu.com",
                subject: `[OPS] ⚠️ Renta al límite: ${sub.customer_name} — ${sub.product_name} (${monthsUsed}m/${maxAllowed}m)`,
                html: `<div style="font-family:Inter,sans-serif;padding:24px"><h2 style="color:#DC2626">⚠️ Renta alcanzó límite máximo</h2><p><strong>${sub.customer_name}</strong> (${sub.customer_email}) tiene ${monthsUsed} meses de uso (máximo ${maxAllowed}). Debe comprar ($${purchasePrice}) o devolver en 30 días.</p><p><a href="https://wa.me/51${sub.customer_phone.replace(/\D/g, "").replace(/^51/, "")}">WhatsApp</a></p></div>`,
              }).catch(() => {});
            } else {
              // Normal renewal — extend
              await query(
                `UPDATE subscriptions SET
                  status = 'active',
                  ends_at = GREATEST(ends_at, NOW()) + INTERVAL '1 month',
                  next_billing_at = NOW() + INTERVAL '1 month',
                  updated_at = NOW()
                WHERE id = $1`,
                [sub.id]
              );

              // Create payment record for this charge (visible in /admin/pagos)
              const userIdRow = (await query<{ user_id: string }>(
                `SELECT user_id FROM subscriptions WHERE id = $1`, [sub.id]
              )).rows[0];
              if (userIdRow?.user_id) {
                const monthLabel = new Date().toLocaleDateString("es-PE", { month: "long", year: "numeric" });
                const periodLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
                await query(
                  `INSERT INTO payments (subscription_id, user_id, amount, currency, period_label, due_date, status, payment_method, validated_at)
                   VALUES ($1, $2, $3, 'USD', $4, NOW(), 'validated', 'culqi', NOW())`,
                  [sub.id, userIdRow.user_id, sub.monthly_price, periodLabel]
                );
              }

              console.log(`${tag} recurring charge succeeded for ${email} sub=${sub.id} (${monthsUsed}/${maxAllowed}m) — extended +1 month + payment recorded`);
            }
          }
        }
        break;
      }

      // ── Subscription charge failed (payment failed) ──
      case "subscription.charge.failed": {
        const email = body.data?.email;
        if (email) {
          // Get subscription details
          const sub = await query<{
            id: string; customer_name: string; customer_email: string;
            product_name: string; monthly_price: string;
          }>(
            `SELECT id, customer_name, customer_email, product_name, monthly_price
             FROM subscriptions
             WHERE customer_email = $1 AND status IN ('active', 'delivered')
             ORDER BY started_at DESC LIMIT 1`,
            [email]
          );

          if (sub.rows.length > 0) {
            const row = sub.rows[0];
            const firstName = row.customer_name.split(" ")[0];

            // Notify customer
            sendEmail({
              to: row.customer_email,
              subject: `⚠️ Tu pago de FLUX no pudo procesarse`,
              html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">${firstName}, tu pago no pudo procesarse</h1>
  <p style="color:#666;margin:0 0 16px">El cobro mensual de <strong>$${row.monthly_price}</strong> por tu <strong>${row.product_name}</strong> fue rechazado.</p>
  <p style="color:#666;margin:0 0 16px">Esto puede pasar si tu tarjeta expiró, no tiene fondos suficientes, o el banco lo bloqueó.</p>
  <p style="color:#666;margin:0 0 24px"><strong>Tienes 5 días hábiles para regularizar el pago.</strong> Después de ese plazo podemos suspender tu servicio.</p>
  <a href="https://wa.me/51932648702" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14px">Contactar soporte</a>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
            }).catch(() => {});

            // Notify ops
            sendEmail({
              to: "operaciones@fluxperu.com",
              subject: `[OPS] Pago fallido: ${row.customer_name} — ${row.product_name}`,
              html: `
<div style="font-family:Inter,sans-serif;padding:24px">
  <h2 style="color:#DC2626">⚠️ Pago rechazado</h2>
  <p><strong>${row.customer_name}</strong> (${row.customer_email})</p>
  <p>Producto: ${row.product_name} — $${row.monthly_price}/mes</p>
  <p>Acción: contactar al cliente en 5 días hábiles si no regulariza.</p>
</div>`,
            }).catch(() => {});

            console.log(`${tag} recurring charge FAILED for ${email} — notifications sent`);
          }
        }
        break;
      }

      // ── One-time charge events ──
      case "charge.succeeded":
        console.log(`${tag} charge succeeded id=${dataId}`);
        break;

      case "charge.failed":
      case "charge.expired":
        console.log(`${tag} charge ${eventType} id=${dataId}`);
        break;

      default:
        console.log(`${tag} unhandled event type=${eventType}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} error processing event`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
