/**
 * Cron diario: generación automática de cuotas mensuales.
 *
 * Se ejecuta todos los días a las 06:00 UTC (01:00 Lima).
 *
 * Para cada suscripción activa que NO tenga aún un pago `upcoming` o `pending`
 * para el mes actual, crea una nueva fila en `payments` con la fecha de
 * vencimiento correspondiente.
 *
 * La fecha de vencimiento se calcula como: día de inicio de la suscripción
 * + N meses, donde N es el número de cuotas ya generadas (incluida la nueva).
 *
 * Seguridad: solo Vercel Cron puede invocar este endpoint. Vercel envía un
 * header `Authorization: Bearer <CRON_SECRET>` que validamos contra la
 * variable de entorno `CRON_SECRET` (configurada en Vercel).
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

const tag = "[cron/generate-payments]";

interface ActiveSubscription {
  id: string;
  user_id: string;
  monthly_price: string;
  months: number;
  started_at: string;
  generated_payments: number;
}

export async function GET(req: NextRequest) {
  // Verificación de autenticidad — solo Vercel Cron debería llamar este endpoint
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`${tag} Starting payment generation`);

  // Suscripciones activas con conteo de cuotas ya generadas
  const subs = await query<ActiveSubscription>(`
    SELECT
      s.id,
      s.user_id,
      s.monthly_price,
      s.months,
      s.started_at,
      COUNT(p.id)::int AS generated_payments
    FROM subscriptions s
    LEFT JOIN payments p ON p.subscription_id = s.id
    WHERE s.status IN ('preparing', 'shipped', 'delivered', 'active')
    GROUP BY s.id
    HAVING COUNT(p.id) < s.months
  `);

  let created = 0;

  for (const sub of subs.rows) {
    const nextNumber = sub.generated_payments + 1;

    // Fecha de vencimiento: started_at + nextNumber meses
    const startDate = new Date(sub.started_at);
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + nextNumber);

    // Solo generar si la fecha de vencimiento es dentro de los próximos 35 días
    // (evita crear cuotas demasiado adelantadas y permite que el cron diario
    // las cree justo a tiempo)
    const daysUntilDue = (dueDate.getTime() - Date.now()) / 86400000;
    if (daysUntilDue > 35 || daysUntilDue < -1) continue;

    const periodLabel = dueDate.toLocaleDateString("es-PE", {
      month: "long",
      year: "numeric",
    });

    try {
      await query(
        `INSERT INTO payments (subscription_id, user_id, amount, period_label, due_date, status)
         VALUES ($1, $2, $3, $4, $5, 'upcoming')
         ON CONFLICT DO NOTHING`,
        [sub.id, sub.user_id, sub.monthly_price, periodLabel, dueDate.toISOString()]
      );
      created++;
    } catch (err) {
      console.error(`${tag} Failed to create payment for sub ${sub.id}:`, err);
    }
  }

  console.log(`${tag} Generated ${created} new payments from ${subs.rows.length} active subs`);
  return NextResponse.json({ ok: true, created, totalSubs: subs.rows.length });
}
