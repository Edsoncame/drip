import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * POST /api/admin/meta-ads/migrate
 * --------------------------------
 * Migración one-shot para crear `meta_campaigns` + `meta_campaign_runs`.
 *
 * `meta_campaigns`     — una fila por campaña real creada en Meta. Trackea
 *                        IDs (campaign_id, adset_ids[], ad_ids[], creative_ids[])
 *                        + presupuesto + métricas que el data-analyst rellena.
 *
 * `meta_campaign_runs` — auditoría de cada intento de creación (incluye dryRun).
 *                        Útil para entender qué se mandó a Meta y qué respondió.
 *
 * Idempotente (todo IF NOT EXISTS). Protegido por requireAdmin.
 */

const tag = "[admin/meta-ads/migrate]";

const DDL_CAMPAIGNS = /* sql */ `
  CREATE TABLE IF NOT EXISTS meta_campaigns (
    id                       BIGSERIAL PRIMARY KEY,
    campaign_id              TEXT NOT NULL UNIQUE,
    name                     TEXT NOT NULL,
    objective                TEXT NOT NULL,
    status                   TEXT NOT NULL DEFAULT 'PAUSED',
    daily_budget_usd         NUMERIC(10,2),
    total_budget_cap_usd     NUMERIC(10,2),
    start_date               DATE,
    end_date                 DATE,
    adset_ids                TEXT[] NOT NULL DEFAULT '{}',
    ad_ids                   TEXT[] NOT NULL DEFAULT '{}',
    creative_ids             TEXT[] NOT NULL DEFAULT '{}',
    pixel_id                 TEXT,
    page_id                  TEXT,
    instagram_actor_id       TEXT,
    -- métricas que rellena el cron del data-analyst
    total_spend_usd          NUMERIC(10,2) NOT NULL DEFAULT 0,
    impressions              BIGINT NOT NULL DEFAULT 0,
    clicks                   BIGINT NOT NULL DEFAULT 0,
    leads_count              BIGINT NOT NULL DEFAULT 0,
    last_synced_at           TIMESTAMPTZ,
    -- meta
    created_by               UUID REFERENCES users(id) ON DELETE SET NULL,
    plan_file_path           TEXT,
    raw_payload              JSONB,
    raw_response             JSONB,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const DDL_RUNS = /* sql */ `
  CREATE TABLE IF NOT EXISTS meta_campaign_runs (
    id                BIGSERIAL PRIMARY KEY,
    campaign_id       TEXT,
    dry_run           BOOLEAN NOT NULL DEFAULT FALSE,
    status            TEXT NOT NULL CHECK (status IN ('success','failed','partial')),
    error_message     TEXT,
    payload           JSONB NOT NULL,
    response          JSONB,
    logs              JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status   ON meta_campaigns(status)`,
  `CREATE INDEX IF NOT EXISTS idx_meta_campaigns_created  ON meta_campaigns(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_meta_runs_created       ON meta_campaign_runs(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_meta_runs_campaign      ON meta_campaign_runs(campaign_id)`,
];

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    await query(DDL_CAMPAIGNS);
    await query(DDL_RUNS);
    for (const idx of INDEXES) await query(idx);

    const campaigns = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM meta_campaigns`,
    );
    const runs = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM meta_campaign_runs`,
    );

    console.log(`${tag} ${session.email} ran migration`);
    return NextResponse.json({
      ok: true,
      tables: ["meta_campaigns", "meta_campaign_runs"],
      campaigns_rows: Number(campaigns.rows[0]?.count ?? 0),
      runs_rows: Number(runs.rows[0]?.count ?? 0),
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
    const existsRes = await query<{ campaigns: boolean; runs: boolean }>(
      `SELECT
         EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='meta_campaigns') AS campaigns,
         EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='meta_campaign_runs') AS runs`,
    );
    return NextResponse.json({ ok: true, ...existsRes.rows[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
