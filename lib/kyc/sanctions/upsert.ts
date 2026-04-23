/**
 * Upsert + deactivate-stale para sanctions_list.
 *
 * Estrategia (sin transaction explícita):
 *   1. Marcar `startedAt = NOW()` antes de empezar.
 *   2. Upsert cada registro: INSERT ... ON CONFLICT (source, source_id) DO UPDATE
 *      seteando `active=true`, `updated_at=NOW()`. Esto "resucita" entradas que
 *      siguen vivas en la fuente.
 *   3. Después de todos los upserts: UPDATE SET active=false donde
 *      `updated_at < startedAt` AND `source = X`. Esas son entradas que la
 *      fuente ya no publica → las desactivamos sin borrarlas (auditable).
 *
 * Si la corrida falla a mitad, los upserts parciales quedan persistidos y la
 * próxima corrida termina el trabajo. Los contadores se devuelven para
 * auditoría en `sanctions_fetches`.
 */

import { query } from "../../db";
import type { SanctionsRecord, SanctionsSource } from "./types";

export interface UpsertSummary {
  inserted: number;
  updated: number;
  deactivated: number;
}

export async function upsertSanctions(
  source: SanctionsSource,
  records: SanctionsRecord[],
): Promise<UpsertSummary> {
  const startedAt = new Date();
  let inserted = 0;
  let updated = 0;

  for (const r of records) {
    if (r.source !== source) continue;
    const res = await query<{ inserted: boolean }>(
      `INSERT INTO sanctions_list
         (source, source_id, full_name, aka_names, doc_type, doc_number,
          date_of_birth, nationality, list_type, metadata, active, fetched_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::date, $8, $9, $10::jsonb, true, NOW(), NOW())
       ON CONFLICT (source, source_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         aka_names = EXCLUDED.aka_names,
         doc_type = EXCLUDED.doc_type,
         doc_number = EXCLUDED.doc_number,
         date_of_birth = EXCLUDED.date_of_birth,
         nationality = EXCLUDED.nationality,
         list_type = EXCLUDED.list_type,
         metadata = EXCLUDED.metadata,
         active = true,
         updated_at = NOW()
       RETURNING (xmax = 0) AS inserted`,
      [
        r.source,
        r.source_id,
        r.full_name,
        JSON.stringify(r.aka_names),
        r.doc_type,
        r.doc_number,
        r.date_of_birth,
        r.nationality,
        r.list_type,
        JSON.stringify(r.metadata),
      ],
    );
    if (res.rows[0]?.inserted) inserted++;
    else updated++;
  }

  const deactivateRes = await query<{ count: string }>(
    `WITH updated AS (
       UPDATE sanctions_list SET active = false
       WHERE source = $1 AND active = true AND updated_at < $2
       RETURNING 1
     )
     SELECT COUNT(*)::text AS count FROM updated`,
    [source, startedAt.toISOString()],
  );
  const deactivated = parseInt(deactivateRes.rows[0]?.count ?? "0", 10);

  return { inserted, updated, deactivated };
}

export async function logFetch(params: {
  source: SanctionsSource;
  startedAt: Date;
  finishedAt: Date;
  status: "ok" | "partial" | "failed";
  summary: UpsertSummary | null;
  error: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO sanctions_fetches
       (source, started_at, finished_at, status, records_inserted, records_updated, records_deactivated, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.source,
      params.startedAt.toISOString(),
      params.finishedAt.toISOString(),
      params.status,
      params.summary?.inserted ?? 0,
      params.summary?.updated ?? 0,
      params.summary?.deactivated ?? 0,
      params.error,
    ],
  );
}
