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

  // Branding del tenant — logo + colores + brand name para personalizar el
  // hosted flow (/kyc/s/[session]). Se agrega separado para que los tenants
  // existentes no tengan que rotar nada; sin este field usan DEFAULT_BRANDING.
  await query(
    `ALTER TABLE kyc_tenants ADD COLUMN IF NOT EXISTS branding_json JSONB`,
  );

  // Policy de manual review del tenant. Tres modos:
  //   'never'           — nunca mandar a review (default, comportamiento actual)
  //   'low_confidence'  — review cuando arbiter_confidence < 0.7
  //   'all_borderline'  — review cada vez que el pipeline clásico devuelve 'review'
  //                        (antes que corra el arbiter, o cuando arbiter da review)
  await query(
    `ALTER TABLE kyc_tenants ADD COLUMN IF NOT EXISTS manual_review_policy TEXT NOT NULL DEFAULT 'never'`,
  );

  // Columnas de manual review en kyc_sdk_sessions. Idempotentes.
  // session.status='review' + webhook_fired_at NULL indica que está en cola.
  // Al aprobar/rechazar, reviewed_by/at se populan y el webhook se dispara.
  await query(
    `ALTER TABLE kyc_sdk_sessions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES kyc_tenant_users(id) ON DELETE SET NULL`,
  );
  await query(
    `ALTER TABLE kyc_sdk_sessions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`,
  );
  await query(
    `ALTER TABLE kyc_sdk_sessions ADD COLUMN IF NOT EXISTS review_notes TEXT`,
  );
  await query(
    `ALTER TABLE kyc_sdk_sessions ADD COLUMN IF NOT EXISTS review_action TEXT`,
  );
  await query(
    `ALTER TABLE kyc_sdk_sessions ADD COLUMN IF NOT EXISTS webhook_fired_at TIMESTAMPTZ`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_sdk_sessions_review_queue
       ON kyc_sdk_sessions(tenant_id, created_at DESC)
       WHERE status = 'review' AND reviewed_at IS NULL`,
  );

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

  // ══════════════════════════════════════════════════════════════════════════
  // kyc_tenant_users — usuarios humanos del dashboard del tenant.
  // Separados de `users` de Flux (aplicación distinta, scope de tenant único).
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS kyc_tenant_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL REFERENCES kyc_tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      active BOOLEAN NOT NULL DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT kyc_tenant_users_email_unique UNIQUE (email)
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON kyc_tenant_users(tenant_id)`,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // kyc_tenant_invitations — invites que un admin del tenant genera para
  // sumar más users a su team. El invitado visita /tenant/accept/<token>
  // y completa password + name para activar su cuenta.
  //
  // Sin email automático por ahora — el admin copia el URL y lo comparte
  // por su canal preferido (1Password, Slack privado, etc). V2 puede agregar
  // SMTP/Resend cuando haya más volumen.
  // ══════════════════════════════════════════════════════════════════════════
  await query(`
    CREATE TABLE IF NOT EXISTS kyc_tenant_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL REFERENCES kyc_tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      token TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_by UUID REFERENCES kyc_tenant_users(id) ON DELETE SET NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      accepted_by UUID REFERENCES kyc_tenant_users(id) ON DELETE SET NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT kyc_tenant_invitations_token_unique UNIQUE (token)
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant ON kyc_tenant_invitations(tenant_id, created_at DESC)`,
  );

  ensured = true;
}

export interface DbTenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  token: string;
  role: string;
  created_by: string | null;
  expires_at: Date;
  accepted_at: Date | null;
  accepted_by: string | null;
  revoked_at: Date | null;
  created_at: Date;
}

export interface DbTenantUser {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: string;
  active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
