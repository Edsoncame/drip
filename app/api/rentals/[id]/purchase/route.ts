import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendEmail, safeSend } from "@/lib/email";

const tag = "[rentals/purchase]";

const RESIDUAL: Record<number, number> = { 8: 0.775, 16: 0.55, 24: 0.325 };

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;

    const result = await query<{
      id: string; user_id: string; product_name: string; product_slug: string;
      months: number; monthly_price: string; status: string;
      billing_name: string; billing_email: string; billing_phone: string;
    }>(
      `SELECT id, user_id, product_name, product_slug, months, monthly_price,
              status, billing_name, billing_email, billing_phone
       FROM subscriptions WHERE id = $1 AND user_id = $2`,
      [id, session.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Renta no encontrada" }, { status: 404 });
    }

    const sub = result.rows[0];
    const residualPct = RESIDUAL[sub.months] ?? 0.55;
    const totalPaid = parseFloat(sub.monthly_price) * sub.months;
    const estimatedValue = totalPaid * 1.4;
    const purchasePrice = Math.round(estimatedValue * residualPct);

    await query(
      `UPDATE subscriptions SET
        end_action = 'purchase',
        purchase_requested_at = NOW(),
        purchase_price_usd = $2,
        updated_at = NOW()
      WHERE id = $1`,
      [id, purchasePrice]
    );

    const firstName = sub.billing_name.split(" ")[0];

    // Email to customer
    void safeSend("rental_purchase_customer", () => sendEmail({
      to: sub.billing_email,
      subject: `Solicitud de compra de tu ${sub.product_name}`,
      html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">${firstName}, recibimos tu solicitud de compra</h1>
  <p style="color:#666;margin:0 0 16px">Quieres comprar tu <strong>${sub.product_name}</strong>. Estos son los detalles:</p>
  <div style="background:#EEF2FF;border-radius:12px;padding:20px;margin:0 0 16px;text-align:center">
    <p style="color:#666;font-size:12px;margin:0 0 4px">Precio de compra</p>
    <p style="font-weight:900;color:#1B4FFF;font-size:28px;margin:0">$${purchasePrice} USD</p>
  </div>
  <p style="color:#666;font-size:13px;margin:0 0 16px">Nuestro equipo te contactará por WhatsApp para coordinar el pago y la transferencia de propiedad del equipo.</p>
  <p style="color:#666;font-size:13px"><strong>Una vez confirmado el pago:</strong></p>
  <ul style="color:#666;font-size:13px;padding-left:20px;margin:8px 0 16px">
    <li>Removemos el MDM del equipo</li>
    <li>El equipo pasa a ser 100% tuyo</li>
    <li>Recibirás factura de venta</li>
  </ul>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
    }));

    // Alert ops
    void safeSend("rental_purchase_ops", () => sendEmail({
      to: "operaciones@fluxperu.com",
      subject: `[OPS] 💰 Compra solicitada: ${sub.billing_name} — ${sub.product_name} — $${purchasePrice}`,
      html: `
<div style="font-family:Inter,sans-serif;padding:24px">
  <h2 style="color:#18191F">💰 Solicitud de compra</h2>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Cliente</td><td style="font-weight:600">${sub.billing_name}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Teléfono</td><td><a href="https://wa.me/51${sub.billing_phone.replace(/\D/g, "").replace(/^51/, "")}">${sub.billing_phone}</a></td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Producto</td><td style="font-weight:600">${sub.product_name}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Precio compra</td><td style="font-weight:900;color:#1B4FFF;font-size:18px">$${purchasePrice} USD</td></tr>
    <tr><td style="padding:8px 0;color:#999">Plan original</td><td>${sub.months}m · $${sub.monthly_price}/mes</td></tr>
  </table>
  <p style="color:#666;font-size:13px;margin-top:16px"><strong>Acción:</strong> Contactar cliente, coordinar pago, remover MDM, emitir factura de venta.</p>
</div>`,
    }));

    console.log(`${tag} purchase requested id=${id} price=$${purchasePrice} user=${session.userId}`);

    return NextResponse.json({ ok: true, purchasePrice });
  } catch (err) {
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}
