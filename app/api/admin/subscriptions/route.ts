import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());
const tag = "[admin/subscriptions]";

const ALLOWED_STATUSES = ["active", "paused", "cancelled", "completed", "delivered", "shipped"];

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_EMAILS.includes(session.email.toLowerCase())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, status, note, tracking_number, equipment_code } = await req.json() as {
    id: string;
    status: string;
    note?: string;
    tracking_number?: string;
    equipment_code?: string;
  };

  if (!id || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Build dynamic SET clause
  const sets: string[] = ["status = $1", "updated_at = NOW()"];
  const vals: (string | null)[] = [status];
  let idx = 2;

  if (note !== undefined) {
    sets.push(`admin_note = $${idx}`);
    vals.push(note ?? null);
    idx++;
  }

  if (tracking_number !== undefined) {
    sets.push(`tracking_number = $${idx}`);
    vals.push(tracking_number ?? null);
    idx++;
  }

  if (status === "shipped") {
    sets.push(`shipped_at = NOW()`);
  }

  if (status === "delivered") {
    sets.push(`delivered_at = NOW()`);
  }

  vals.push(id);
  await query(`UPDATE subscriptions SET ${sets.join(", ")} WHERE id = $${idx}`, vals);

  // Auto-assign equipment if code provided
  if (equipment_code) {
    await query(
      `UPDATE equipment SET estado_actual = 'Arrendada', updated_at = NOW() WHERE codigo_interno = $1`,
      [equipment_code]
    );
    console.log(`${tag} assigned equipment ${equipment_code} to subscription ${id}`);
  }

  // Send email notifications based on status change
  const sub = (await query<{
    customer_name: string; customer_email: string; product_name: string;
    delivery_method: string | null; delivery_address: string | null;
    delivery_distrito: string | null; tracking_number: string | null;
  }>(`SELECT customer_name, customer_email, product_name, delivery_method, delivery_address, delivery_distrito, tracking_number FROM subscriptions WHERE id = $1`, [id])).rows[0];

  if (sub) {
    const firstName = sub.customer_name.split(" ")[0];

    if (status === "shipped" && sub.customer_email) {
      sendEmail({
        to: sub.customer_email,
        subject: `🚚 Tu ${sub.product_name} está en camino`,
        html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">¡${firstName}, tu Mac va en camino! 🎉</h1>
  <p style="color:#666;margin:0 0 16px">Tu <strong>${sub.product_name}</strong> ha sido despachada y llegará a tu dirección en las próximas 24-48 horas.</p>
  ${(tracking_number || sub.tracking_number) ? `<div style="background:#F7F7F7;border-radius:12px;padding:16px;margin:0 0 16px"><p style="color:#999;font-size:12px;margin:0 0 4px">Número de seguimiento</p><p style="font-weight:700;color:#18191F;font-size:18px;margin:0">${tracking_number || sub.tracking_number}</p></div>` : ""}
  <div style="background:#F7F7F7;border-radius:12px;padding:16px;margin:0 0 16px">
    <p style="color:#999;font-size:12px;margin:0 0 4px">Dirección de entrega</p>
    <p style="color:#333;font-size:14px;margin:0">${sub.delivery_address ?? "—"}, ${sub.delivery_distrito ?? ""}</p>
  </div>
  <p style="color:#666;font-size:13px">¿Tienes dudas? Escríbenos a <a href="https://wa.me/51932648702" style="color:#1B4FFF">WhatsApp</a> o a <a href="mailto:hola@fluxperu.com" style="color:#1B4FFF">hola@fluxperu.com</a>.</p>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
      }).catch(() => {});
    }

    if (status === "shipped" && sub.delivery_method === "pickup" && sub.customer_email) {
      sendEmail({
        to: sub.customer_email,
        subject: `🏢 Tu ${sub.product_name} está listo para recoger`,
        html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">¡${firstName}, tu Mac está lista! 🎉</h1>
  <p style="color:#666;margin:0 0 16px">Tu <strong>${sub.product_name}</strong> está lista para que la recojas en nuestra oficina.</p>
  <div style="background:#F7F7F7;border-radius:12px;padding:16px;margin:0 0 16px">
    <p style="color:#999;font-size:12px;margin:0 0 4px">Horario de recojo</p>
    <p style="color:#333;font-size:14px;margin:0">Lunes a viernes · 9:00 a.m. – 6:00 p.m.</p>
    <p style="color:#999;font-size:12px;margin:8px 0 0">Te enviaremos la dirección exacta por WhatsApp.</p>
  </div>
  <p style="color:#666;font-size:13px">Coordina tu recojo: <a href="https://wa.me/51932648702" style="color:#1B4FFF">WhatsApp +51 932 648 702</a></p>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
      }).catch(() => {});
    }
  }

  console.log(`${tag} ${session.email} updated subscription id=${id} status=${status}${tracking_number ? ` tracking=${tracking_number}` : ""}`);
  return NextResponse.json({ ok: true });
}
