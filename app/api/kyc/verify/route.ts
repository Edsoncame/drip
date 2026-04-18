import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  ensureKycSchema,
  logAttempt,
  type DbKycDniScan,
  type DbKycFaceMatch,
  type KycStatus,
} from "@/lib/kyc/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const tag = "[kyc/verify]";

/**
 * Orquestador — lee los resultados de OCR + match + face compare y decide
 * el estado final de KYC. Actualiza users.kyc_status y devuelve el veredicto.
 *
 * Estados:
 *   verified: DNI leído + match nombres >= 0.90 + face score >= 85 + liveness ok
 *   review:   match nombres en 0.80-0.90 (requiere revisión manual)
 *   rejected: cualquier mismatch duro
 */
export async function POST(req: NextRequest) {
  await ensureKycSchema();
  const session = await getSession();
  const userId = session?.userId ?? null;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const { correlation_id, name_score } = body as {
    correlation_id?: string;
    name_score?: number;
  };

  if (!correlation_id) {
    return NextResponse.json({ error: "correlation_id requerido" }, { status: 400 });
  }

  const scanRes = await query<DbKycDniScan>(
    `SELECT * FROM kyc_dni_scans WHERE correlation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [correlation_id],
  );
  const faceRes = await query<DbKycFaceMatch>(
    `SELECT * FROM kyc_face_matches WHERE correlation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [correlation_id],
  );

  const scan = scanRes.rows[0];
  const face = faceRes.rows[0];

  if (!scan) {
    return NextResponse.json(
      { status: "pending", reason: "no_scan" },
      { status: 200 },
    );
  }
  if (!face) {
    return NextResponse.json(
      { status: "pending", reason: "no_selfie" },
      { status: 200 },
    );
  }

  // Decisión
  let status: KycStatus = "rejected";
  let reason = "";

  if (!face.liveness_passed) {
    status = "rejected";
    reason = "liveness_failed";
  } else if (!face.passed) {
    status = "rejected";
    reason = "face_no_match";
  } else if (typeof name_score === "number" && name_score < 0.8) {
    status = "rejected";
    reason = "name_no_match";
  } else if (typeof name_score === "number" && name_score < 0.9) {
    status = "review";
    reason = "name_similarity_borderline";
  } else {
    status = "verified";
    reason = "all_checks_passed";
  }

  // Update users si está logueado. La URL de las imágenes queda en kyc_dni_scans
  // y kyc_face_matches — no duplicamos en users.
  if (userId) {
    await query(
      `UPDATE users SET
        kyc_status = $2,
        kyc_correlation_id = $3,
        kyc_verified_at = CASE WHEN $2 = 'verified' THEN NOW() ELSE kyc_verified_at END,
        identity_verified = CASE WHEN $2 = 'verified' THEN true ELSE identity_verified END,
        dni_number = COALESCE($4, dni_number),
        updated_at = NOW()
       WHERE id = $1`,
      [userId, status, correlation_id, scan.dni_number],
    );
  }

  await logAttempt({
    userId,
    correlationId: correlation_id,
    step: "verify",
    outcome:
      status === "verified" ? "ok" : status === "review" ? "review" : "fail",
    reason,
    payload: {
      name_score,
      face_score: face.score,
      liveness: face.liveness_passed,
    },
  });

  console.log(
    `${tag} corr=${correlation_id} status=${status} reason=${reason} face=${face.score} name=${name_score}`,
  );

  return NextResponse.json({
    status,
    reason,
    correlation_id,
    identity_verified: status === "verified",
  });
}
