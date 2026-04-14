/**
 * Cron diario: recordatorios de pago automáticos.
 *
 * Se ejecuta todos los días a las 14:00 UTC (09:00 Lima — buena hora para
 * que los clientes los lean al inicio del día).
 *
 * Reglas:
 *   - 3 días antes del vencimiento: email amigable "Tu pago vence en 3 días"
 *   - El día del vencimiento: email recordatorio + link a /cuenta/pagos
 *   - 5 días después del vencimiento (estado overdue): email serio
 *
 * Marca cada pago con `last_reminder_at` para no enviar más de un recordatorio
 * por día.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const tag = "[cron/payment-reminders]";

interface PendingPayment {
  id: string;
  amount: string;
  period_label: string;
  due_date: string;
  status: string;
  user_email: string;
  user_name: string;
  last_reminder_at: string | null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`${tag} Starting reminder run`);

  // Asegurar que la columna existe (idempotente)
  await query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz`);

  // Pagos pendientes o por vencer (próximos 5 días) o vencidos hace 5 días
  const result = await query<PendingPayment>(`
    SELECT p.id, p.amount, p.period_label, p.due_date, p.status,
           p.last_reminder_at,
           u.email AS user_email, u.name AS user_name
    FROM payments p
    JOIN users u ON u.id = p.user_id
    WHERE p.status IN ('upcoming', 'pending', 'overdue')
      AND p.due_date BETWEEN NOW() - INTERVAL '7 days' AND NOW() + INTERVAL '7 days'
      AND (p.last_reminder_at IS NULL OR p.last_reminder_at < NOW() - INTERVAL '20 hours')
  `);

  let sent = 0;

  for (const p of result.rows) {
    const dueDate = new Date(p.due_date);
    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);

    let subject = "";
    let body = "";

    if (daysUntilDue === 3) {
      subject = `Tu pago de ${p.period_label} vence en 3 días`;
      body = `Hola ${p.user_name.split(" ")[0]}, te recordamos que tu cuota de FLUX para ${p.period_label} por $${p.amount} USD vence el ${dueDate.toLocaleDateString("es-PE")}. Puedes pagar desde tu panel.`;
    } else if (daysUntilDue === 0) {
      subject = `Tu pago de ${p.period_label} vence hoy`;
      body = `Hola ${p.user_name.split(" ")[0]}, hoy es el último día para pagar tu cuota de FLUX de ${p.period_label} ($${p.amount} USD). Si ya pagaste, ignora este mensaje.`;
    } else if (daysUntilDue === -5) {
      subject = `[Importante] Tu pago de ${p.period_label} está vencido`;
      body = `Hola ${p.user_name.split(" ")[0]}, tu cuota de FLUX de ${p.period_label} venció hace 5 días. Por favor regulariza tu pago para evitar la suspensión del servicio.`;
    } else {
      continue;
    }

    try {
      await sendEmail({
        to: p.user_email,
        subject,
        html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#fff;padding:32px 24px;border-radius:16px">
  <h1 style="font-size:22px;font-weight:900;color:#18191F;margin:0 0 16px">${subject}</h1>
  <p style="color:#666;line-height:1.5;margin:0 0 16px">${body}</p>
  <a href="https://www.fluxperu.com/cuenta/pagos" style="display:inline-block;background:#1B4FFF;color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14px">Ver mi pago</a>
  <p style="color:#999;font-size:12px;margin-top:24px">¿Dudas? Responde a este correo o escríbenos al WhatsApp +51 932 648 703</p>
  <p style="color:#999;font-size:11px;margin-top:8px">© 2026 FLUX — Tika Services S.A.C.</p>
</div>`,
      });

      await query(`UPDATE payments SET last_reminder_at = NOW() WHERE id = $1`, [p.id]);
      sent++;
    } catch (err) {
      console.error(`${tag} Failed to send reminder for ${p.id}:`, err);
    }
  }

  // Marcar pagos vencidos automáticamente
  await query(`
    UPDATE payments SET status = 'overdue'
    WHERE status IN ('upcoming', 'pending')
      AND due_date < NOW() - INTERVAL '1 day'
  `);

  console.log(`${tag} Sent ${sent} reminders`);
  return NextResponse.json({ ok: true, sent, evaluated: result.rows.length });
}
