import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendEmail, safeSend } from "@/lib/email";

const tag = "[rentals/return]";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { method, address } = body as {
      method: "pickup" | "office";
      address?: string;
    };

    // Verify ownership
    const result = await query<{
      id: string; user_id: string; product_name: string; status: string;
      billing_name: string; billing_email: string; billing_phone: string;
      delivery_address: string | null; delivery_distrito: string | null;
    }>(
      `SELECT id, user_id, product_name, status, billing_name, billing_email,
              billing_phone, delivery_address, delivery_distrito
       FROM subscriptions WHERE id = $1 AND user_id = $2`,
      [id, session.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Renta no encontrada" }, { status: 404 });
    }

    const sub = result.rows[0];
    const returnAddress = method === "pickup"
      ? (address || sub.delivery_address || "")
      : "Oficina FLUX";

    // Update subscription
    await query(
      `UPDATE subscriptions SET
        end_action = 'return',
        return_requested_at = NOW(),
        return_method = $2,
        return_address = $3,
        updated_at = NOW()
      WHERE id = $1`,
      [id, method, returnAddress]
    );

    const firstName = sub.billing_name.split(" ")[0];

    // Email to customer
    void safeSend("rental_return_customer", () => sendEmail({
      to: sub.billing_email,
      subject: `Tu devolución de ${sub.product_name} está en proceso`,
      html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">${firstName}, recibimos tu solicitud</h1>
  <p style="color:#666;margin:0 0 16px">Vamos a coordinar la devolución de tu <strong>${sub.product_name}</strong>.</p>
  <div style="background:#F7F7F7;border-radius:12px;padding:16px;margin:0 0 16px">
    <p style="color:#999;font-size:12px;margin:0 0 4px">Método de devolución</p>
    <p style="font-weight:700;color:#18191F;margin:0">${method === "pickup" ? "Recojo a domicilio" : "Entrega en oficina FLUX"}</p>
    ${method === "pickup" ? `<p style="color:#666;font-size:13px;margin:8px 0 0">Dirección: ${returnAddress}</p>` : `<p style="color:#666;font-size:13px;margin:8px 0 0">Horario: Lunes a viernes, 9am – 6pm</p>`}
  </div>
  <p style="color:#666;margin:0 0 8px"><strong>Antes de devolver, asegúrate de:</strong></p>
  <ul style="color:#666;font-size:13px;padding-left:20px;margin:0 0 16px">
    <li>Hacer un respaldo de tu información</li>
    <li>Cerrar sesión en todas tus cuentas</li>
    <li>Desactivar "Buscar mi Mac" (Ajustes → Apple ID → iCloud)</li>
    <li>Restaurar de fábrica (Ajustes → General → Transferir o restablecer)</li>
    <li>Incluir el cargador y cable original</li>
  </ul>
  <p style="color:#666;font-size:13px">Te contactaremos por WhatsApp para coordinar el día y hora exactos.</p>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
    }));

    // Alert ops
    void safeSend("rental_return_ops", () => sendEmail({
      to: "operaciones@fluxperu.com",
      subject: `[OPS] Devolución solicitada: ${sub.billing_name} — ${sub.product_name}`,
      html: `
<div style="font-family:Inter,sans-serif;padding:24px">
  <h2 style="color:#18191F">📦 Devolución solicitada</h2>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Cliente</td><td style="font-weight:600">${sub.billing_name}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Teléfono</td><td><a href="https://wa.me/51${sub.billing_phone.replace(/\D/g, "").replace(/^51/, "")}">${sub.billing_phone}</a></td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Producto</td><td style="font-weight:600">${sub.product_name}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Método</td><td>${method === "pickup" ? "🚚 Recojo a domicilio" : "🏢 Entrega en oficina"}</td></tr>
    <tr><td style="padding:8px 0;color:#999">Dirección</td><td>${returnAddress}</td></tr>
  </table>
  <p style="color:#666;font-size:13px;margin-top:16px"><strong>Acción:</strong> Contactar al cliente por WhatsApp para coordinar fecha y hora.</p>
</div>`,
    }));

    console.log(`${tag} return requested id=${id} method=${method} user=${session.userId}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}
