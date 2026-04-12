import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { cancelSubscription as cancelCulqiSubscription } from "@/lib/culqi";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tag = "[subscriptions/cancel]";
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    console.log(`${tag} request user=${session.userId} subscription=${id}`);

    // Verify ownership
    const result = await query<{
      id: string; status: string; mp_subscription_id: string | null;
      product_name: string; customer_name: string; customer_email: string;
    }>(
      `SELECT id, status, mp_subscription_id, product_name, customer_name, customer_email
       FROM subscriptions WHERE id = $1 AND user_id = $2`,
      [id, session.userId]
    );

    if (result.rows.length === 0) {
      console.warn(`${tag} not found id=${id} user=${session.userId}`);
      return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });
    }

    const sub = result.rows[0];

    if (sub.status === "cancelled") {
      return NextResponse.json({ error: "Esta renta ya está cancelada" }, { status: 400 });
    }

    // Cancel in Culqi
    if (sub.mp_subscription_id && sub.mp_subscription_id.startsWith("sxn_")) {
      try {
        await cancelCulqiSubscription(sub.mp_subscription_id);
        console.log(`${tag} Culqi subscription cancelled id=${sub.mp_subscription_id}`);
      } catch (cancelErr) {
        console.error(`${tag} Culqi cancel failed id=${sub.mp_subscription_id}`, cancelErr);
        // Continue — still cancel locally
      }
    }

    // Update DB
    await query(`UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
    console.log(`${tag} cancelled id=${id} user=${session.userId}`);

    // Send cancellation email to user
    const firstName = sub.customer_name.split(" ")[0];
    sendEmail({
      to: sub.customer_email,
      subject: `Tu renta de ${sub.product_name} fue cancelada`,
      html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">Hola ${firstName}, tu renta fue cancelada</h1>
  <p style="color:#666;margin:0 0 16px">Tu suscripción de <strong>${sub.product_name}</strong> ha sido cancelada.</p>
  <p style="color:#666;margin:0 0 16px">En los próximos 30 días nuestro equipo coordinará contigo la devolución del equipo.</p>
  <p style="color:#666;margin:0 0 24px">Si crees que esto fue un error, contáctanos:</p>
  <a href="https://wa.me/51932648702" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;font-size:14px">Contactar soporte</a>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
    }).catch(() => {});

    // Notify ops
    sendEmail({
      to: "operaciones@fluxperu.com",
      subject: `[OPS] Cancelación por usuario: ${sub.customer_name} — ${sub.product_name}`,
      html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h2 style="color:#18191F">⚠️ Renta cancelada por usuario</h2>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Cliente</td><td style="font-weight:600">${sub.customer_name}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Email</td><td>${sub.customer_email}</td></tr>
    <tr style="border-bottom:1px solid #eee"><td style="padding:8px 0;color:#999">Producto</td><td style="font-weight:600">${sub.product_name}</td></tr>
    <tr><td style="padding:8px 0;color:#999">MP ID</td><td style="font-size:12px;color:#999">${sub.mp_subscription_id ?? "N/A"}</td></tr>
  </table>
  <p style="color:#999;font-size:12px;margin-top:24px">Coordinar devolución en 30 días.</p>
</div>`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
