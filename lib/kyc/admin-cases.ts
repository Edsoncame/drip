/**
 * Casos que muestra el panel /admin/kyc.
 *
 * Hay DOS lugares donde se guardan verificaciones y el panel tiene que leer
 * de los dos SIEMPRE, sin depender de qué flag esté prendido:
 *
 *   - "legacy": pipeline propio de Flux (tablas kyc_dni_scans + kyc_face_matches).
 *   - "drop_validation": checkout proxeado a Drop Validation desde may-2026
 *     (tabla drop_validation_session_map, con el veredicto que guardan el
 *     finalize y el webhook).
 *
 * Hasta el 21-oct-2026 el panel solo leía "legacy" y quedó congelado en abril
 * mientras todas las verificaciones nuevas iban a Drop Validation. Si se agrega
 * otro pipeline de KYC, se suma a KYC_CASE_SOURCES y a la consulta; el test
 * lib/__tests__/kyc-admin-cases.test.ts falla si alguna fuente queda fuera.
 */
import { query } from "@/lib/db";
import { ensureKycSchema } from "@/lib/kyc/db";
import { ensureMapSchema } from "@/lib/drop-validation/session-map";

export const KYC_CASE_SOURCES = {
  legacy: "kyc_dni_scans",
  drop_validation: "drop_validation_session_map",
} as const;

export type KycCaseSource = keyof typeof KYC_CASE_SOURCES;

export interface KycCase {
  source: KycCaseSource;
  /** Estado de ESTE intento (legacy: el del usuario; Drop Validation: el veredicto de la sesión). */
  case_status: string;
  external_session_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  user_kyc_status: string | null;
  correlation_id: string;
  dni_number: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  prenombres: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  confidence: string | null;
  imagen_anverso_key: string | null;
  capture_mode: string;
  scan_created_at: string;
  face_score: string | null;
  face_passed: boolean | null;
  liveness_passed: boolean | null;
  selfie_key: string | null;
  verdict_reason: string | null;
}

export const KYC_CASES_SQL = `
  WITH casos AS (
    SELECT
      'legacy'::text AS source,
      COALESCE(u.kyc_status, 'pending') AS case_status,
      NULL::text AS external_session_id,
      u.id::text AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
      u.kyc_status AS user_kyc_status,
      s.correlation_id,
      s.dni_number, s.apellido_paterno, s.apellido_materno, s.prenombres,
      s.fecha_nacimiento::text AS fecha_nacimiento, s.sexo,
      s.ocr_confidence::text AS confidence,
      s.imagen_anverso_key, s.capture_mode,
      s.created_at AS created_at,
      f.score::text AS face_score, f.passed AS face_passed,
      f.liveness_passed, f.selfie_key,
      NULL::text AS verdict_reason
    FROM ${KYC_CASE_SOURCES.legacy} s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN LATERAL (
      SELECT score, passed, liveness_passed, selfie_key
      FROM kyc_face_matches fm
      WHERE fm.correlation_id = s.correlation_id
      ORDER BY fm.created_at DESC LIMIT 1
    ) f ON true

    UNION ALL

    SELECT
      'drop_validation'::text AS source,
      COALESCE(m.verdict_status, 'capturing') AS case_status,
      m.external_session_id,
      u.id::text, u.name, u.email, u.phone,
      u.kyc_status,
      m.correlation_id,
      u.dni_number, u.legal_apellido_paterno, u.legal_apellido_materno, u.legal_prenombres,
      u.fecha_nacimiento::text, u.sexo,
      NULL::text, NULL::text, 'drop_validation'::text,
      m.created_at,
      m.face_score::text,
      CASE WHEN m.face_score IS NULL THEN NULL ELSE m.face_score >= 85 END,  -- umbral KYC_FACE_MATCH_MIN de Drop Validation
      CASE WHEN m.verdict_reason ILIKE '%liveness%' OR m.verdict_reason ILIKE '%head_pose%' THEN false
           WHEN m.face_score IS NOT NULL THEN true ELSE NULL END,
      NULL::text,
      m.verdict_reason
    FROM ${KYC_CASE_SOURCES.drop_validation} m
    LEFT JOIN users u ON u.id::text = m.user_id
    WHERE m.correlation_id NOT LIKE 'claude-%' AND m.correlation_id NOT LIKE 'smoke_%'
  )
  SELECT *, created_at::text AS scan_created_at
  FROM casos
  ORDER BY
    CASE case_status
      WHEN 'review'    THEN 0
      WHEN 'rejected'  THEN 1
      WHEN 'blocked'   THEN 2
      WHEN 'capturing' THEN 3
      WHEN 'pending'   THEN 4
      WHEN 'verified'  THEN 5
      ELSE 6
    END,
    created_at DESC
  LIMIT 200
`;

export async function listKycCases(): Promise<KycCase[]> {
  await ensureKycSchema();
  await ensureMapSchema();
  const res = await query<KycCase>(KYC_CASES_SQL);
  return res.rows;
}
