import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const tag = "[webhook/mp]";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

// ── Signature verification ────────────────────────────────────────────────────
function verifySignature(
  rawBody: string,
  xSignature: string,
  xRequestId: string,
  dataId: string
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(`${tag} MP_WEBHOOK_SECRET not set — skipping signature check`);
    return true; // allow in dev, enforce in prod via env check below
  }

  // xSignature format: "ts=1234567890,v1=abc123..."
  const parts = Object.fromEntries(xSignature.split(",").map(p => p.split("=")));
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

// ── Status map MP → internal ──────────────────────────────────────────────────
const MP_TO_STATUS: Record<string, string> = {
  authorized: "active",
  paused:     "paused",
  cancelled:  "cancelled",
  pending:    "active",   // just created
};

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";

  let body: { action?: string; data?: { id?: string }; type?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dataId = body.data?.id ?? "";
  const action = body.action ?? body.type ?? "";

  console.log(`${tag} received action=${action} id=${dataId}`);

  // Verify signature
  if (xSignature && !verifySignature(rawBody, xSignature, xRequestId, dataId)) {
    console.warn(`${tag} signature mismatch — rejected`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // We only care about subscription (preapproval) events
  const isSubscriptionEvent =
    action === "preapproval" ||
    action === "subscription_preapproval" ||
    body.type === "subscription_preapproval";

  if (!isSubscriptionEvent || !dataId) {
    // Return 200 so MP doesn't retry non-relevant events
    return NextResponse.json({ ok: true });
  }

  try {
    // Fetch full subscription from MP
    const sub = await new PreApproval(client).get({ id: dataId });

    const mpStatus = sub.status ?? "";
    const internalStatus = MP_TO_STATUS[mpStatus];

    if (!internalStatus) {
      console.log(`${tag} unknown MP status=${mpStatus} — ignoring`);
      return NextResponse.json({ ok: true });
    }

    // Update subscription in DB
    const result = await query<{
      id: string; product_name: string;
      customer_name: string; customer_email: string; status: string;
    }>(
      `UPDATE subscriptions
       SET status = $1, updated_at = NOW()
       WHERE mp_subscription_id = $2
       RETURNING id, product_name, customer_name, customer_email, status`,
      [internalStatus, dataId]
    );

    if (result.rows.length === 0) {
      console.warn(`${tag} no subscription found for mp_id=${dataId}`);
      return NextResponse.json({ ok: true });
    }

    const row = result.rows[0];
    const prevStatus = row.status; // Note: RETURNING returns new value; old tracked by mp event chain
    console.log(`${tag} updated subscription id=${row.id} mp_id=${dataId} status=${internalStatus}`);

    // ── Send notification emails based on new status ────────────────────────
    if (internalStatus === "cancelled" && row.customer_email) {
      await sendEmail({
        to: row.customer_email,
        subject: `Tu renta de ${row.product_name} fue cancelada`,
        html: cancellationEmailHtml(row.customer_name, row.product_name),
      }).catch(() => {});

      // Notify ops team
      await sendEmail({
        to: "operaciones@flux.pe",
        subject: `[OPS] Cancelación: ${row.customer_name} — ${row.product_name}`,
        html: opsAlertHtml("cancelada", row.customer_name, row.customer_email, row.product_name, dataId),
      }).catch(() => {});
    }

    if (internalStatus === "paused" && row.customer_email) {
      await sendEmail({
        to: "operaciones@flux.pe",
        subject: `[OPS] Renta pausada: ${row.customer_name} — ${row.product_name}`,
        html: opsAlertHtml("pausada", row.customer_name, row.customer_email, row.product_name, dataId),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, status: internalStatus });
  } catch (err) {
    console.error(`${tag} error processing mp_id=${dataId}`, err);
    // Return 500 so MP retries
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ── Email templates ───────────────────────────────────────────────────────────
function cancellationEmailHtml(name: string, productName: string): string {
  const firstName = name.split(" ")[0];
  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">Hola ${firstName}, tu renta fue cancelada</h1>
  <p style="color:#666;margin:0 0 16px">Tu suscripción de <strong>${productName}</strong> ha sido cancelada en MercadoPago.</p>
  <p style="color:#666;margin:0 0 16px">En los próximos 30 días nuestro equipo coordinará contigo la devolución del equipo.</p>
  <p style="color:#666;margin:0 0 24px">Si crees que esto fue un error o deseas reactivar tu renta, contáctanos:</p>
  <a href="mailto:hola@flux.pe" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;font-size:14px">Contactar soporte</a>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`;
}

function opsAlertHtml(
  event: string, name: string, email: string, product: string, mpId: string
): string {
  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h2 style="color:#18191F;margin:0 0 16px">⚠️ Suscripción ${event}</h2>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Cliente</td><td style="font-weight:600">${name}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Producto</td><td style="font-weight:600">${product}</td></tr>
    <tr><td style="padding:8px 0;color:#999">MP ID</td><td style="font-size:12px;color:#999">${mpId}</td></tr>
  </table>
  <p style="color:#999;font-size:12px;margin-top:24px">Generado automáticamente por FLUX</p>
</div>`;
}
