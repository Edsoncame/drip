import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendEmail, safeSend } from "@/lib/email";
import { fireSyncToDropchat } from "@/lib/dropchat-sync";

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { paymentId, action, note } = await req.json() as {
    paymentId: string;
    action: "validate" | "reject";
    note?: string;
  };

  const payment = (await query<{
    id: string; user_id: string; amount: string; period_label: string;
  }>("SELECT id, user_id, amount, period_label FROM payments WHERE id = $1", [paymentId])).rows[0];

  if (!payment) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

  const user = (await query<{ name: string; email: string }>(
    "SELECT name, email FROM users WHERE id = $1", [payment.user_id]
  )).rows[0];

  if (action === "validate") {
    await query(
      `UPDATE payments SET status = 'validated', validated_at = NOW(), validated_by = $2, admin_note = $3 WHERE id = $1`,
      [paymentId, session.email, note ?? null]
    );

    // Drop Chat sync — LTV cambia al validar un pago
    fireSyncToDropchat(payment.user_id);

    if (user) {
      void safeSend("admin_payment_validated", () => sendEmail({
        to: user.email,
        subject: `✅ Pago validado — ${payment.period_label}`,
        html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#2D7D46;margin:0 0 8px">✅ Pago validado</h1>
  <p style="color:#666;margin:0 0 16px">Tu pago de <strong>$${payment.amount} USD</strong> por <strong>${payment.period_label}</strong> fue validado exitosamente.</p>
  <a href="https://www.fluxperu.com/cuenta/pagos" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;font-size:14px">Ver mis pagos</a>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
      }));
    }
  } else {
    await query(
      `UPDATE payments SET status = 'pending', receipt_url = NULL, admin_note = $2 WHERE id = $1`,
      [paymentId, note ?? "Comprobante rechazado — por favor sube uno válido"]
    );

    if (user) {
      void safeSend("admin_payment_rejected", () => sendEmail({
        to: user.email,
        subject: `⚠️ Comprobante rechazado — ${payment.period_label}`,
        html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#DC2626;margin:0 0 8px">Comprobante rechazado</h1>
  <p style="color:#666;margin:0 0 16px">El comprobante que subiste para <strong>${payment.period_label}</strong> no pudo ser validado.</p>
  ${note ? `<p style="color:#666;margin:0 0 16px"><strong>Motivo:</strong> ${note}</p>` : ""}
  <p style="color:#666;margin:0 0 24px">Por favor sube un nuevo comprobante desde tu panel.</p>
  <a href="https://www.fluxperu.com/cuenta/pagos" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;font-size:14px">Subir nuevo comprobante</a>
  <p style="color:#999;font-size:12px;margin-top:24px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
      }));
    }
  }

  console.log(`[admin/payments] ${session.email} ${action} payment=${paymentId}`);
  return NextResponse.json({ ok: true });
}
