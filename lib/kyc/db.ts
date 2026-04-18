/**
 * KYC schema — tablas para DNI scans + face matches + extensiones a users.
 *
 * Retención:
 *   - imágenes se guardan en Vercel Blob (bucket privado), no en DB
 *   - DB guarda solo el pathname/url y metadata
 *   - `retention_until` marca cuándo purgar la evidencia (GDPR-like)
 */

import { query } from "../db";

let ensured = false;

export async function ensureKycSchema(): Promise<void> {
  if (ensured) return;

  // Extend users con campos KYC — idempotente
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'DNI',
      ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS kyc_correlation_id TEXT,
      ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kyc_attempts INTEGER DEFAULT 0
  `);

  // CHECK constraint solo DNI por ahora (se puede relajar en el futuro)
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'users_document_type_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_document_type_check
          CHECK (document_type IN ('DNI'));
      END IF;
    END $$;
  `);

  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'users_kyc_status_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_kyc_status_check
          CHECK (kyc_status IN ('pending', 'capturing', 'review', 'verified', 'rejected', 'blocked'));
      END IF;
    END $$;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS kyc_dni_scans (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      correlation_id TEXT NOT NULL,
      raw_ocr_json JSONB,
      dni_number TEXT,
      apellido_paterno TEXT,
      apellido_materno TEXT,
      prenombres TEXT,
      fecha_nacimiento DATE,
      sexo TEXT,
      fecha_emision DATE,
      fecha_caducidad DATE,
      mrz_raw TEXT,
      mrz_parsed JSONB,
      imagen_anverso_key TEXT,
      imagen_reverso_key TEXT,
      capture_mode TEXT NOT NULL DEFAULT 'auto',
      provider TEXT NOT NULL DEFAULT 'claude',
      blur_score NUMERIC,
      ocr_confidence NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      retention_until TIMESTAMPTZ
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_kyc_dni_user ON kyc_dni_scans(user_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_kyc_dni_corr ON kyc_dni_scans(correlation_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS kyc_face_matches (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      correlation_id TEXT NOT NULL,
      dni_scan_id BIGINT REFERENCES kyc_dni_scans(id) ON DELETE SET NULL,
      score NUMERIC NOT NULL,
      provider TEXT NOT NULL DEFAULT 'aws-rekognition',
      passed BOOLEAN NOT NULL,
      selfie_key TEXT NOT NULL,
      liveness_passed BOOLEAN NOT NULL DEFAULT false,
      liveness_detail JSONB,
      rekognition_response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      retention_until TIMESTAMPTZ
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_kyc_face_user ON kyc_face_matches(user_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_kyc_face_corr ON kyc_face_matches(correlation_id)`);

  // Tabla de intentos para rate-limit y ticket de revisión manual
  await query(`
    CREATE TABLE IF NOT EXISTS kyc_attempts (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      correlation_id TEXT NOT NULL,
      step TEXT NOT NULL,
      outcome TEXT NOT NULL,
      reason TEXT,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_kyc_attempts_user ON kyc_attempts(user_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_kyc_attempts_corr ON kyc_attempts(correlation_id)`);

  ensured = true;
}

export type KycStatus = "pending" | "capturing" | "review" | "verified" | "rejected" | "blocked";

export interface DbKycDniScan {
  id: number;
  user_id: string | null;
  correlation_id: string;
  raw_ocr_json: unknown;
  dni_number: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  prenombres: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  fecha_emision: string | null;
  fecha_caducidad: string | null;
  mrz_raw: string | null;
  mrz_parsed: unknown;
  imagen_anverso_key: string | null;
  imagen_reverso_key: string | null;
  capture_mode: "auto" | "manual";
  provider: string;
  blur_score: string | null;
  ocr_confidence: string | null;
  created_at: Date;
  retention_until: Date | null;
}

export interface DbKycFaceMatch {
  id: number;
  user_id: string | null;
  correlation_id: string;
  dni_scan_id: number | null;
  score: string;
  provider: string;
  passed: boolean;
  selfie_key: string;
  liveness_passed: boolean;
  liveness_detail: unknown;
  rekognition_response: unknown;
  created_at: Date;
  retention_until: Date | null;
}

export interface DbKycAttempt {
  id: number;
  user_id: string | null;
  correlation_id: string;
  step: string;
  outcome: string;
  reason: string | null;
  payload: unknown;
  created_at: Date;
}

export async function logAttempt(params: {
  userId?: string | null;
  correlationId: string;
  step: "capture" | "ocr" | "match" | "selfie" | "face-compare" | "verify";
  outcome: "ok" | "fail" | "review" | "blocked";
  reason?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await ensureKycSchema();
  await query(
    `INSERT INTO kyc_attempts (user_id, correlation_id, step, outcome, reason, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.userId ?? null,
      params.correlationId,
      params.step,
      params.outcome,
      params.reason ?? null,
      params.payload ? JSON.stringify(params.payload) : null,
    ],
  );
}

export async function countAttemptsForStep(
  correlationId: string,
  step: string,
): Promise<number> {
  await ensureKycSchema();
  const res = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM kyc_attempts
     WHERE correlation_id = $1 AND step = $2 AND outcome = 'fail'`,
    [correlationId, step],
  );
  return parseInt(res.rows[0]?.n ?? "0", 10);
}
