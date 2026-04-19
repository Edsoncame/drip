import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { cancelSubscription as cancelStripeSubscription } from "@/lib/stripe";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tag = "[subscriptions/cancel]";
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    console.log(`${tag} request user=${session.userId} subscription=${id}`);

    const result = await query<{
      id: string;
      status: string;
      external_subscription_id: string | null;
      product_name: string;
      billing_name: string;
      billing_email: string;
    }>(
      `SELECT id, status, external_subscription_id, product_name, billing_name, billing_email
       FROM subscriptions WHERE id = $1 AND user_id = $2`,
      [id, session.userId],
    );

    if (result.rows.length === 0) {
      console.warn(`${tag} not found id=${id} user=${session.userId}`);
      return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });
    }

    const sub = result.rows[0];
    if (sub.status === "cancelled") {
      return NextResponse.json({ error: "Esta renta ya está cancelada" }, { status: 400 });
    }

    // Cancelar en Stripe si el id es una suscripción de Stripe.
    // Stripe IDs arrancan con "sub_" (ej. sub_1N4h2eLkd...). Culqi legacy era
    // "sxn_" o prefijos generados manualmente. Tratamos ambos por retrocompat.
    if (sub.external_subscription_id?.startsWith("sub_")) {
      try {
        await cancelStripeSubscription(sub.external_subscription_id);
        console.log(`${tag} Stripe subscription cancelled id=${sub.external_subscription_id}`);
      } catch (cancelErr) {
        console.error(`${tag} Stripe cancel failed id=${sub.external_subscription_id}`, cancelErr);
        // No bloqueamos — marcamos como cancelada localmente igual
      }
    }

    await query(`UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
    console.log(`${tag} cancelled id=${id} user=${session.userId}`);

    const firstName = sub.billing_name.split(" ")[0];
    sendEmail({
      to: sub.billing_email,
      subject: `Tu renta de ${sub.product_name} fue cancelada`,
      html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 8px">Hola ${firstName}, tu renta fue cancelada</h1>
  <p style="color:#666;margin:0 0 16px">Tu suscripción de <strong>${sub.product_name}</strong> ha sido cancelada.</p>
  <p style="color:#666;margin:0 0 16px">En los próximos 30 días nuestro equipo coordinará la devolución del equipo.</p>
  <p style="color:#666;margin:0 0 24px">Si crees que esto fue un error, contáctanos:</p>
  <a href="https://wa.me/51900164769" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;font-size:14px">Contactar soporte</a>
</div>`,
    }).catch(() => {});

    sendEmail({
      to: "operaciones@fluxperu.com",
      subject: `[OPS] Cancelación por usuario: ${sub.billing_name} — ${sub.product_name}`,
      html: `<div style="font-family:Inter,sans-serif;padding:24px"><h2>⚠️ Renta cancelada por usuario</h2><p><strong>${sub.billing_name}</strong> (${sub.billing_email}) — ${sub.product_name}</p><p>Stripe ID: ${sub.external_subscription_id ?? "N/A"}</p><p>Coordinar devolución en 30 días.</p></div>`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
