/**
 * Legal acceptance audit log — registra cada aceptación de Términos +
 * autorización del pagaré incompleto + firma digital del Usuario.
 *
 * Esta evidencia es la columna vertebral para defender el contrato ante:
 *  - INDECOPI (consumidor final argumenta que no aceptó / no leyó)
 *  - Juzgados civiles (en proceso ejecutivo del pagaré)
 *  - SBS / centrales de riesgo (al reportar mora)
 *
 * Conserva: nombre legal, documento, IP, user-agent, versión de TyC,
 * timestamp UTC, y flag de scroll completado (prueba de lectura).
 *
 * Schema bootstrap idempotente — primera escritura crea la tabla.
 */

import { query } from "./db";

let schemaReady = false;

export async function ensureLegalSchema(): Promise<void> {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS legal_acceptances (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      terms_version TEXT NOT NULL,
      signature_name TEXT NOT NULL,
      signature_document TEXT,
      scroll_completed BOOLEAN NOT NULL DEFAULT FALSE,
      pagare_authorized BOOLEAN NOT NULL DEFAULT FALSE,
      ip_address TEXT,
      user_agent TEXT,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user
     ON legal_acceptances(user_id, signed_at DESC);`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_legal_acceptances_version
     ON legal_acceptances(terms_version, signed_at DESC);`,
  );
  schemaReady = true;
}

export interface LegalAcceptanceInput {
  userId: string;
  termsVersion: string;
  signatureName: string;
  signatureDocument: string | null;
  scrollCompleted: boolean;
  pagareAuthorized: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  signedAt: Date;
}

export async function recordLegalAcceptance(
  input: LegalAcceptanceInput,
): Promise<{ id: string }> {
  const res = await query<{ id: string }>(
    `INSERT INTO legal_acceptances (
       user_id, terms_version, signature_name, signature_document,
       scroll_completed, pagare_authorized, ip_address, user_agent, signed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id::text`,
    [
      input.userId,
      input.termsVersion,
      input.signatureName.trim(),
      input.signatureDocument?.trim() || null,
      input.scrollCompleted,
      input.pagareAuthorized,
      input.ipAddress,
      input.userAgent,
      input.signedAt.toISOString(),
    ],
  );
  return { id: res.rows[0].id };
}

export async function getLatestAcceptanceForUser(userId: string) {
  await ensureLegalSchema();
  const r = await query(
    `SELECT id, terms_version, signature_name, signature_document,
            scroll_completed, pagare_authorized, ip_address, signed_at
     FROM legal_acceptances
     WHERE user_id = $1
     ORDER BY signed_at DESC
     LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}
