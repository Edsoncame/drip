/**
 * Selfie + liveness ingest pipeline.
 *
 * Reutilizado por `/api/kyc/selfie` (flujo humano) y el SDK.
 * Toma los 3 frames de liveness + el scan DNI ya ingestado previamente
 * para el mismo correlation_id, y corre:
 *   - Rate-limit por correlation_id (3 fails → blocked)
 *   - Liveness con los 3 frames (yaw check + face presence)
 *   - Upload del frame central como selfie oficial
 *   - Descarga del DNI blob
 *   - AWS Rekognition CompareFaces
 *   - Persistencia en kyc_face_matches
 *   - logAttempt en cada outcome
 *   - Categorización de errores (rekognition/storage/network/no_face/unknown)
 */

import { query } from "../../db";
import {
  ensureKycSchema,
  logAttempt,
  countAttemptsForStep,
  type DbKycDniScan,
} from "../db";
import { uploadKycImage } from "../blob";
import { checkLiveness, compareFaces, FACE_MATCH_MIN } from "../face";

const tag = "[kyc/pipeline/ingest-selfie]";
const MAX_ATTEMPTS = 3;

export interface IngestSelfieInput {
  correlationId: string;
  userId: string | null;
  /** 3 frames de liveness, el [0] se toma como selfie oficial. */
  frames: Buffer[];
}

export type IngestSelfieResult =
  | {
      status: "ok";
      passed: true;
      liveness_passed: true;
      score: number;
      threshold: number;
    }
  | {
      status: "face_mismatch";
      passed: false;
      liveness_passed: true;
      score: number;
      message: string;
    }
  | {
      status: "liveness_fail";
      passed: false;
      liveness_passed: false;
      reason: string;
      message: string;
    }
  | {
      status: "blocked";
      reason: "max_attempts";
    }
  | {
      status: "precondition_fail";
      reason: "no_scan" | "no_anverso_key" | "legacy_blob_key" | "missing_frame";
      detail?: string;
    }
  | {
      status: "error";
      category:
        | "rekognition"
        | "storage"
        | "network"
        | "no_face"
        | "unknown";
      message: string;
      debug: { original: string; stack: string };
    };

function flattenError(e: unknown, depth = 0): string {
  if (depth > 4 || !e) return "";
  if (e instanceof Error) {
    const cause = (e as Error & { cause?: unknown }).cause;
    return `${e.name}: ${e.message}${cause ? " → " + flattenError(cause, depth + 1) : ""}`;
  }
  return String(e);
}

function categorizeError(err: unknown): {
  category: "rekognition" | "storage" | "network" | "no_face" | "unknown";
  userMessage: string;
} {
  const msg = flattenError(err);
  const stack = err instanceof Error ? err.stack ?? "" : "";
  const lower = msg.toLowerCase();
  const lowerStack = stack.toLowerCase();

  if (
    lower.includes("aws") ||
    lower.includes("rekognition") ||
    lowerStack.includes("@aws-sdk") ||
    lower.includes("credentials") ||
    lower.includes("signaturedoesnotmatch") ||
    lower.includes("accessdenied") ||
    lower.includes("invalidaccesskeyid") ||
    lower.includes("is not authorized")
  ) {
    return {
      category: "rekognition",
      userMessage:
        "El servicio de validación facial no está disponible. Verifica las credenciales de AWS en Vercel.",
    };
  }
  if (
    lower.includes("blob") ||
    lowerStack.includes("@vercel/blob") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  ) {
    return {
      category: "storage",
      userMessage: "No pudimos guardar la selfie. Revisa tu conexión e intenta de nuevo.",
    };
  }
  if (
    lower.includes("timeout") ||
    lower.includes("aborted") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused")
  ) {
    return {
      category: "network",
      userMessage: "La conexión se cortó. Revisa tu internet e intenta nuevamente.",
    };
  }
  if (
    lower.includes("no face") ||
    lower.includes("nofacedetected") ||
    lower.includes("face not found")
  ) {
    return {
      category: "no_face",
      userMessage:
        "No detectamos tu rostro en la foto. Asegúrate de estar de frente con buena luz.",
    };
  }
  return {
    category: "unknown",
    userMessage: "Tuvimos un problema al verificar tu rostro. Intenta nuevamente.",
  };
}

export async function ingestSelfie(
  input: IngestSelfieInput,
): Promise<IngestSelfieResult> {
  await ensureKycSchema();
  const { correlationId, userId, frames } = input;

  if (frames.length < 3 || frames.some((f) => !f || f.length === 0)) {
    return {
      status: "precondition_fail",
      reason: "missing_frame",
      detail: `received ${frames.length}/3 non-empty frames`,
    };
  }

  const failed = await countAttemptsForStep(correlationId, "face-compare");
  if (failed >= MAX_ATTEMPTS) {
    await logAttempt({
      userId,
      correlationId,
      step: "face-compare",
      outcome: "blocked",
      reason: "max_attempts",
    });
    return { status: "blocked", reason: "max_attempts" };
  }

  const scanRes = await query<DbKycDniScan>(
    `SELECT * FROM kyc_dni_scans WHERE correlation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [correlationId],
  );
  if (scanRes.rows.length === 0) {
    return { status: "precondition_fail", reason: "no_scan" };
  }
  const scan = scanRes.rows[0];
  if (!scan.imagen_anverso_key) {
    return { status: "precondition_fail", reason: "no_anverso_key" };
  }
  if (!scan.imagen_anverso_key.startsWith("http")) {
    return { status: "precondition_fail", reason: "legacy_blob_key" };
  }

  try {
    const liveness = await checkLiveness(frames);
    console.log(
      `${tag} liveness corr=${correlationId} passed=${liveness.passed} yaws=${liveness.yaws.map((y) => y.toFixed(1)).join(",")}`,
    );

    if (!liveness.passed) {
      await logAttempt({
        userId,
        correlationId,
        step: "face-compare",
        outcome: "fail",
        reason: `liveness_fail: ${liveness.reason}`,
        payload: { yaws: liveness.yaws, faces: liveness.faces_detected },
      });
      const message =
        liveness.reason === "face_missing_in_frame"
          ? "No pudimos detectar tu cara en una de las capturas. Asegurate de estar frente a la cámara en toda la secuencia."
          : liveness.reason === "head_pose_static"
            ? "Parece que no giraste la cabeza como te pedimos. Vuelve a intentarlo siguiendo las instrucciones."
            : "No pudimos validar la captura. Vuelve a intentarlo con buena luz.";
      return {
        status: "liveness_fail",
        passed: false,
        liveness_passed: false,
        reason: liveness.reason ?? "unknown",
        message,
      };
    }

    const selfieBlob = await uploadKycImage({
      correlationId,
      kind: "selfie",
      bytes: frames[0],
      contentType: "image/jpeg",
    });

    const dniResp = await fetch(scan.imagen_anverso_key);
    if (!dniResp.ok) {
      throw new Error(`No pudimos recuperar la imagen del DNI: ${dniResp.status}`);
    }
    const dniBytes = Buffer.from(await dniResp.arrayBuffer());

    const match = await compareFaces(dniBytes, frames[0]);
    const passed = match.matched;

    console.log(
      `${tag} match corr=${correlationId} similarity=${match.similarity.toFixed(2)} passed=${passed}`,
    );

    await query(
      `INSERT INTO kyc_face_matches (
        user_id, correlation_id, dni_scan_id,
        score, provider, passed, selfie_key, liveness_passed, liveness_detail,
        rekognition_response, retention_until
       ) VALUES (
        $1, $2, $3, $4, 'aws-rekognition', $5, $6, $7, $8, $9, NOW() + INTERVAL '180 days'
       )`,
      [
        userId,
        correlationId,
        scan.id,
        match.similarity,
        passed,
        selfieBlob.url,
        liveness.passed,
        JSON.stringify({ yaws: liveness.yaws, faces: liveness.faces_detected }),
        JSON.stringify(match.raw),
      ],
    );

    if (!passed) {
      await logAttempt({
        userId,
        correlationId,
        step: "face-compare",
        outcome: "fail",
        reason: "low_similarity",
        payload: { similarity: match.similarity },
      });
      return {
        status: "face_mismatch",
        passed: false,
        liveness_passed: true,
        score: match.similarity,
        message:
          match.similarity < 40
            ? "No pudimos reconocer tu rostro con claridad. Asegurate de tener buena iluminación, sin lentes ni gorra, y mirando de frente a la cámara."
            : "La foto de tu DNI y tu selfie no coinciden con suficiente confianza. Vuelve a capturar el DNI enfocando bien la foto del titular.",
      };
    }

    await logAttempt({
      userId,
      correlationId,
      step: "face-compare",
      outcome: "ok",
      payload: { similarity: match.similarity },
    });

    return {
      status: "ok",
      passed: true,
      liveness_passed: true,
      score: match.similarity,
      threshold: FACE_MATCH_MIN,
    };
  } catch (err) {
    const msg = flattenError(err);
    const stack = err instanceof Error ? err.stack ?? "" : "";
    console.error(`${tag} error corr=${correlationId}`, msg, err);
    await logAttempt({
      userId,
      correlationId,
      step: "face-compare",
      outcome: "fail",
      reason: `internal: ${msg.slice(0, 400)}`,
    });
    const { category, userMessage } = categorizeError(err);
    console.log(
      `${tag} error_category=${category} corr=${correlationId} original="${msg.slice(0, 200)}"`,
    );
    return {
      status: "error",
      category,
      message: userMessage,
      debug: { original: msg.slice(0, 500), stack: stack.slice(0, 800) },
    };
  }
}
