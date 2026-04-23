/**
 * Schema para el SDK multi-tenant de KYC.
 *
 * Dos tablas:
 *   - kyc_tenants: clientes del SDK (Flux, Securex, etc). Cada uno tiene su
 *     api_key_hash (bcrypt) y configuración default de captura.
 *   - kyc_sdk_sessions: cada intento de KYC iniciado vía SDK. Contiene
 *     correlation_id interno + status + verdict final. Webhook_secret se
 *     guarda en plano porque lo usamos para firmar el payload saliente.
 */

import { query } from "../../db";

let ensured = false;

export async function ensureSdkSchema(): Promise<void> {
  if (ensured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS kyc_tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key_hash TEXT NOT NULL,
      default_webhook_url TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS kyc_sdk_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL REFERENCES kyc_tenants(id) ON DELETE RESTRICT,
      external_user_id TEXT,
      external_reference TEXT,
      correlation_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      webhook_url TEXT,
      webhook_secret TEXT,
      verdict JSONB,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ
    )
  `);

  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'kyc_sdk_sessions_status_check'
      ) THEN
        ALTER TABLE kyc_sdk_sessions
          ADD CONSTRAINT kyc_sdk_sessions_status_check
          CHECK (status IN ('pending','capturing','processing','completed','expired','failed'));
      END IF;
    END $$;
  `);

  await query(
    `CREATE INDEX IF NOT EXISTS idx_sdk_sessions_tenant ON kyc_sdk_sessions(tenant_id, created_at DESC)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_sdk_sessions_corr ON kyc_sdk_sessions(correlation_id)`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_sdk_sessions_external ON kyc_sdk_sessions(tenant_id, external_user_id)
       WHERE external_user_id IS NOT NULL`,
  );

  ensured = true;
}

export type SdkSessionStatus =
  | "pending"
  | "capturing"
  | "processing"
  | "completed"
  | "expired"
  | "failed";

export interface DbSdkSession {
  id: string;
  tenant_id: string;
  external_user_id: string | null;
  external_reference: string | null;
  correlation_id: string;
  status: SdkSessionStatus;
  webhook_url: string | null;
  webhook_secret: string | null;
  verdict: unknown;
  metadata: Record<string, unknown>;
  created_at: Date;
  expires_at: Date;
  completed_at: Date | null;
}

export interface DbSdkTenant {
  id: string;
  name: string;
  api_key_hash: string;
  default_webhook_url: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
