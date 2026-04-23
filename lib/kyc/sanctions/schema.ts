/**
 * Schema para listas de sanciones (UIF Perú, OFAC SDN, UN Consolidated).
 *
 * Dos tablas:
 *   - sanctions_list: entradas canónicas de cada fuente (upsert por source+source_id)
 *   - sanctions_fetches: log de cada corrida del cron (monitoreo y auditoría)
 *
 * Idempotente — seguro de correr N veces, mismo patrón que `lib/kyc/db.ts`.
 */

import { query } from "../../db";

let ensured = false;

export async function ensureSanctionsSchema(): Promise<void> {
  if (ensured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS sanctions_list (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      aka_names JSONB NOT NULL DEFAULT '[]'::jsonb,
      doc_type TEXT,
      doc_number TEXT,
      date_of_birth DATE,
      nationality TEXT,
      list_type TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      active BOOLEAN NOT NULL DEFAULT true,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT sanctions_list_unique_source_id UNIQUE (source, source_id)
    )
  `);

  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'sanctions_list_source_check'
      ) THEN
        ALTER TABLE sanctions_list
          ADD CONSTRAINT sanctions_list_source_check
          CHECK (source IN ('UIF_PE', 'OFAC_SDN', 'UN_CONSOLIDATED'));
      END IF;
    END $$;
  `);

  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'sanctions_list_type_check'
      ) THEN
        ALTER TABLE sanctions_list
          ADD CONSTRAINT sanctions_list_type_check
          CHECK (list_type IN ('PEP', 'SANCTION', 'TERRORISM', 'AML', 'OTHER'));
      END IF;
    END $$;
  `);

  await query(
    `CREATE INDEX IF NOT EXISTS idx_sanctions_doc
       ON sanctions_list(doc_number)
       WHERE doc_number IS NOT NULL AND active = true`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_sanctions_name_upper
       ON sanctions_list((UPPER(full_name)))
       WHERE active = true`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_sanctions_source_active
       ON sanctions_list(source, active)`,
  );

  await query(`
    CREATE TABLE IF NOT EXISTS sanctions_fetches (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'ok',
      records_inserted INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      records_deactivated INTEGER NOT NULL DEFAULT 0,
      error TEXT
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_sanctions_fetches_source_time
       ON sanctions_fetches(source, started_at DESC)`,
  );

  ensured = true;
}

export interface DbSanctionsEntry {
  id: number;
  source: string;
  source_id: string;
  full_name: string;
  aka_names: string[];
  doc_type: string | null;
  doc_number: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  list_type: string;
  metadata: Record<string, unknown>;
  active: boolean;
  fetched_at: Date;
  updated_at: Date;
}
