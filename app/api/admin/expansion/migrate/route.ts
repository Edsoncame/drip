import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * POST /api/admin/expansion/migrate
 * ---------------------------------
 * Migración one-shot para crear la tabla `expansion_opportunities` + índices.
 *
 * Idempotente: TODO usa `IF NOT EXISTS` → se puede ejecutar N veces sin efecto
 * secundario. Protegido por `requireAdmin()`.
 *
 * Ejecutar una vez desde el admin (o con curl + cookie flux_session) y listo.
 * Después del success, este endpoint puede quedar vivo sin riesgo o removerse
 * en un commit de limpieza futuro.
 *
 * GET devuelve el estado (si la tabla existe y cuántas filas tiene).
 */

const tag = "[admin/expansion/migrate]";

const DDL = /* sql */ `
  CREATE TABLE IF NOT EXISTS expansion_opportunities (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score               INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    temperature         TEXT NOT NULL CHECK (temperature IN ('hot','warm','cold')),
    play_type           TEXT NOT NULL CHECK (play_type IN (
                          'UPGRADE_TIER','BUNDLE_IPAD','ADD_SEAT','TIER_REFRESH','CHECK_IN'
                        )),
    play_reason         TEXT NOT NULL,
    signals             JSONB NOT NULL DEFAULT '{}'::jsonb,
    suggested_mrr_delta NUMERIC(10,2),
    status              TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','contacted','in_conversation','won','lost','snoozed')),
    contacted_at        TIMESTAMPTZ,
    won_at              TIMESTAMPTZ,
    lost_reason         TEXT,
    snoozed_until       TIMESTAMPTZ,
    admin_notes         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_exp_opps_status ON expansion_opportunities(status)`,
  `CREATE INDEX IF NOT EXISTS idx_exp_opps_user   ON expansion_opportunities(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_exp_opps_score_desc
     ON expansion_opportunities(score DESC) WHERE status = 'new'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_exp_opp
     ON expansion_opportunities(user_id, play_type)
     WHERE status IN ('new','contacted','in_conversation')`,
];

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    await query(DDL);
    for (const idx of INDEXES) {
      await query(idx);
    }

    const { rows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM expansion_opportunities`
    );

    console.log(`${tag} ${session.email} ran migration — rows=${rows[0]?.count ?? 0}`);
    return NextResponse.json({
      ok: true,
      table: "expansion_opportunities",
      rows: Number(rows[0]?.count ?? 0),
      indexes_created: INDEXES.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} migration failed:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const existsRes = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'expansion_opportunities'
       ) AS exists`
    );
    const exists = existsRes.rows[0]?.exists ?? false;

    if (!exists) {
      return NextResponse.json({ ok: true, table_exists: false, rows: 0 });
    }

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM expansion_opportunities`
    );
    return NextResponse.json({
      ok: true,
      table_exists: true,
      rows: Number(countRes.rows[0]?.count ?? 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
