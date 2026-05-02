/**
 * Session map: correlation_id (Flux internal) → external Drop Validation
 * session_id + session_token. Permite que /api/kyc/dni cree la session
 * externa y /api/kyc/{selfie,verify} reusen el mismo session_token sin
 * crear duplicados.
 *
 * El session_token JWT expira a 15 min — coincide con el flow KYC del
 * checkout que es de pocos minutos, no necesitamos refresh.
 */
import { query } from '@/lib/db';

let ensured = false;
async function ensureMapSchema(): Promise<void> {
  if (ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS drop_validation_session_map (
      correlation_id     TEXT PRIMARY KEY,
      external_session_id TEXT NOT NULL,
      session_token      TEXT NOT NULL,
      expires_at         TIMESTAMPTZ NOT NULL,
      user_id            TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_dvsm_external ON drop_validation_session_map(external_session_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_dvsm_user ON drop_validation_session_map(user_id) WHERE user_id IS NOT NULL`);
  ensured = true;
}

export interface MappedSession {
  correlation_id: string;
  external_session_id: string;
  session_token: string;
  expires_at: Date;
  user_id: string | null;
}

export async function getMappedSession(correlationId: string): Promise<MappedSession | null> {
  await ensureMapSchema();
  const r = await query<MappedSession>(
    `SELECT correlation_id, external_session_id, session_token, expires_at, user_id
       FROM drop_validation_session_map
      WHERE correlation_id = $1`,
    [correlationId],
  );
  const row = r.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

export async function storeMappedSession(input: {
  correlationId: string;
  externalSessionId: string;
  sessionToken: string;
  expiresAt: Date;
  userId: string | null;
}): Promise<void> {
  await ensureMapSchema();
  await query(
    `INSERT INTO drop_validation_session_map
       (correlation_id, external_session_id, session_token, expires_at, user_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (correlation_id) DO UPDATE
       SET external_session_id = EXCLUDED.external_session_id,
           session_token = EXCLUDED.session_token,
           expires_at = EXCLUDED.expires_at,
           user_id = COALESCE(EXCLUDED.user_id, drop_validation_session_map.user_id)`,
    [input.correlationId, input.externalSessionId, input.sessionToken, input.expiresAt, input.userId],
  );
}
