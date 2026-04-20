/**
 * Cron semanal: refresh del Account Expansion Engine.
 *
 * Se ejecuta lunes 11:00 UTC (06:00 Lima), antes del inicio del día laboral.
 *
 * Responsabilidades:
 *  1. "Despertar" oportunidades snoozed cuyo `snoozed_until` ya venció
 *     → vuelven a status='new' y quedan visibles en el tablero.
 *  2. Recalcular señales sobre toda la base activa
 *     → upsert sobre el índice único parcial (user_id, play_type)
 *       para oportunidades ABIERTAS. Las cerradas (won/lost) quedan intactas.
 *
 * Si la tabla todavía no fue creada (primer uso), responde 200 con
 * `tableMissing:true` en vez de 500 → el cron no falla ruidosamente antes de
 * que Edson corra la migración inicial desde /admin/expansion.
 *
 * Seguridad: header `Authorization: Bearer $CRON_SECRET`.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { refreshExpansionOpportunities } from "@/lib/expansion-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const tag = "[cron/expansion-refresh]";

function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /relation .* does not exist/i.test(msg) || /42P01/.test(msg);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  // 1) Despertar snoozed vencidas
  let awakened = 0;
  try {
    const { rows } = await query<{ id: string }>(
      `
      UPDATE expansion_opportunities
         SET status = 'new',
             snoozed_until = NULL,
             updated_at = NOW()
       WHERE status = 'snoozed'
         AND snoozed_until IS NOT NULL
         AND snoozed_until <= NOW()
      RETURNING id::text
      `
    );
    awakened = rows.length;
  } catch (err) {
    if (isMissingTable(err)) {
      console.log(`${tag} table missing — skipping (run migration from /admin/expansion first)`);
      return NextResponse.json({
        ok: true,
        tableMissing: true,
        hint: "POST /api/admin/expansion/migrate to create the table",
      });
    }
    console.error(`${tag} awaken step failed:`, err);
    return NextResponse.json(
      { ok: false, step: "awaken", error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  // 2) Recalcular sobre base activa
  let detected = 0;
  let inserted = 0;
  let updated = 0;
  try {
    const res = await refreshExpansionOpportunities();
    detected = res.detected;
    inserted = res.inserted;
    updated = res.updated;
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({
        ok: true,
        tableMissing: true,
        awakened,
        hint: "POST /api/admin/expansion/migrate to create the table",
      });
    }
    console.error(`${tag} refresh step failed:`, err);
    return NextResponse.json(
      { ok: false, step: "refresh", awakened, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `${tag} OK — awakened=${awakened} detected=${detected} inserted=${inserted} updated=${updated} in ${durationMs}ms`
  );

  return NextResponse.json({
    ok: true,
    awakened,
    detected,
    inserted,
    updated,
    durationMs,
  });
}
