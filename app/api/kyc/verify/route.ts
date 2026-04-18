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
import { arbitrateKyc } from "@/lib/kyc/arbiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El arbiter con Claude agrega ~3s; dejamos 30s de margen.
export const maxDuration = 30;

const tag = "[kyc/verify]";

/**
 * Orquestador — lee los resultados de OCR + match + face compare y decide
 * el estado final de KYC. Actualiza users.kyc_status y devuelve el veredicto.
 *
 * Política actual (sin estado `review`):
 *   verified: DNI leído + match nombres >= 0.90 + face score >= 85 + liveness ok
 *   rejected: cualquier mismatch duro (face no coincide, liveness falló,
 *             nombre muy distinto, etc.)
 *
 * Casos borderline (nombre 0.80-0.90 o face score medio) — en vez de dejarlos
 * en `review` esperando humano, los pasamos por un arbiter con Claude Opus
 * que mira DNI + selfie + datos y decide verified o rejected. El usuario
 * siempre recibe un veredicto claro en tiempo real.
 */
export async function POST(req: NextRequest) {
  await ensureKycSchema();
  const session = await getSession();
  const userId = session?.userId ?? null;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

  const { correlation_id, name_score, form_name, form_dni } = body as {
    correlation_id?: string;
    name_score?: number;
    form_name?: string;
    form_dni?: string;
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

  // Paso 1 — Decisión clásica por umbrales
  let status: KycStatus = "rejected";
  let reason = "";
  let arbiterUsed = false;
  let arbiterConfidence: number | null = null;

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
    // Paso 2 — Caso borderline → arbiter IA
    status = "review"; // temporal, el arbiter lo resuelve
    reason = "name_similarity_borderline";
  } else {
    status = "verified";
    reason = "all_checks_passed";
  }

  // Si quedamos en review, consultamos al arbiter
  if (status === "review") {
    try {
      const dniUrl = scan.imagen_anverso_key;
      const selfieUrl = face.selfie_key;
      // Solo arbitramos si ambas URLs son absolutas (esquema nuevo)
      if (dniUrl?.startsWith("http") && selfieUrl?.startsWith("http")) {
        const verdict = await arbitrateKyc({
          formName: form_name ?? "",
          formDniNumber: form_dni ?? "",
          scanApellidoPaterno: scan.apellido_paterno,
          scanApellidoMaterno: scan.apellido_materno,
          scanPrenombres: scan.prenombres,
          scanDniNumber: scan.dni_number,
          nameScore: typeof name_score === "number" ? name_score : 0,
          faceScore: parseFloat(String(face.score)) || 0,
          livenessPassed: face.liveness_passed,
          dniImageUrl: dniUrl,
          selfieImageUrl: selfieUrl,
        });
        arbiterUsed = true;
        arbiterConfidence = verdict.confidence;
        status = verdict.verdict;
        reason = `arbiter: ${verdict.reason}`;
        console.log(
          `${tag} arbiter corr=${correlation_id} verdict=${verdict.verdict} confidence=${verdict.confidence.toFixed(2)} checks=${JSON.stringify(verdict.checks)}`,
        );
      } else {
        // Sin URLs absolutas no podemos arbitrar — conservador: rechazar
        status = "rejected";
        reason = "borderline_no_arbiter";
      }
    } catch (err) {
      // Si el arbiter falla, somos conservadores: rechazamos.
      // El user puede reintentar y probablemente esta vez las imágenes
      // serán más claras.
      console.error(`${tag} arbiter error corr=${correlation_id}`, err);
      status = "rejected";
      reason = `arbiter_error: ${err instanceof Error ? err.message.slice(0, 100) : "unknown"}`;
    }
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
    outcome: status === "verified" ? "ok" : "fail",
    reason,
    payload: {
      name_score,
      face_score: face.score,
      liveness: face.liveness_passed,
      arbiter_used: arbiterUsed,
      arbiter_confidence: arbiterConfidence,
    },
  });

  console.log(
    `${tag} corr=${correlation_id} status=${status} reason=${reason} face=${face.score} name=${name_score} arbiter=${arbiterUsed}`,
  );

  return NextResponse.json({
    status,
    reason,
    correlation_id,
    identity_verified: status === "verified",
    arbiter_used: arbiterUsed,
  });
}
