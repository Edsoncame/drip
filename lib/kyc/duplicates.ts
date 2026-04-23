/**
 * Cross-user duplicates — detecta si un DNI number ya fue usado por otro
 * user_id en intentos de KYC previos. Señal fuerte de fraude: un DNI real
 * legítimo solo pertenece a una persona.
 *
 * Modo actual (2026-04-22): solo implementado el chequeo por dni_number.
 * La similitud cross-user de selfies (vía Rekognition Collection + SearchFaces)
 * está explícitamente stub por decisión del usuario — ver
 * KYC_SELFIE_DUPLICATE_CHECK env var ('off' por default).
 *
 * Cuando quiera implementarse, agregar Collection AWS + columnas
 * rekognition_face_id / perceptual_hash en kyc_face_matches. Por ahora
 * selfie_similar_to_other_user siempre retorna false.
 */

export interface DuplicateCheckParams {
  correlation_id: string;
  user_id: string | null;
  dni_number: string | null;
}

export interface DuplicateCheckResult {
  dni_reused_by_other_user: boolean;
  other_user_ids: string[];
  selfie_similar_to_other_user: boolean;
  similar_user_ids: string[];
  risk_score: number;
}

/**
 * Firma mínima de un cliente pg para duplicate checks. El test la mockeá.
 * Retorna `{ rows: [{ user_id: string }, ...] }` para queries.
 */
export type DuplicateQueryFn = (
  sql: string,
  params: unknown[],
) => Promise<{ rows: Array<{ user_id: string | null }> }>;

export async function checkDuplicates(
  params: DuplicateCheckParams,
  queryFn: DuplicateQueryFn,
): Promise<DuplicateCheckResult> {
  const base: DuplicateCheckResult = {
    dni_reused_by_other_user: false,
    other_user_ids: [],
    selfie_similar_to_other_user: false,
    similar_user_ids: [],
    risk_score: 0,
  };

  if (!params.dni_number) return base;

  try {
    const res = await queryFn(
      `SELECT DISTINCT user_id FROM kyc_dni_scans
       WHERE dni_number = $1
         AND user_id IS NOT NULL
         AND ($2::text IS NULL OR user_id::text <> $2::text)
       LIMIT 20`,
      [params.dni_number, params.user_id],
    );
    const otherUsers = res.rows.map((r) => r.user_id).filter((x): x is string => !!x);
    if (otherUsers.length > 0) {
      base.dni_reused_by_other_user = true;
      base.other_user_ids = otherUsers;
      base.risk_score = 1.0;
    }
  } catch (err) {
    console.error(
      "[kyc/duplicates] query failed:",
      err instanceof Error ? err.message : err,
    );
    // falla DB → no flag, retornamos base
  }

  // Selfie similarity check — stub explícito
  if (process.env.KYC_SELFIE_DUPLICATE_CHECK === "on") {
    // TODO(P3): implementar cuando exista Rekognition Collection +
    // columnas rekognition_face_id / perceptual_hash. Por ahora no-op.
  }

  return base;
}
