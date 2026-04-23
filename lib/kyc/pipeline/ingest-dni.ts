/**
 * DNI ingest pipeline — upload blob + OCR + validate + persist.
 *
 * Reutilizado por `/api/kyc/dni` (flujo humano) y `/api/kyc/sdk/finalize`
 * (flujo SDK multi-tenant). Devuelve un resultado estructurado que el caller
 * mapea a la respuesta apropiada (HTTP para web, JSON embebido en finalize).
 *
 * El helper incluye:
 *   - Rate-limit por correlation_id (3 fails → blocked)
 *   - Upload a Vercel Blob (anverso + reverso opcional)
 *   - OCR Claude Vision
 *   - Validaciones de calidad (confidence, fake-suspect, formato DNI 8 dig)
 *   - Parser MRZ con check digits
 *   - Persistencia en kyc_dni_scans
 *   - logAttempt en cada outcome
 *   - Categorización de errores (storage/ocr/network/db/config/unknown)
 */

import { query } from "../../db";
import {
  ensureKycSchema,
  logAttempt,
  countAttemptsForStep,
} from "../db";
import { uploadKycImage } from "../blob";
import { extractDniFields } from "../ocr";
import { parseTd1 } from "../mrz";

const tag = "[kyc/pipeline/ingest-dni]";
const MAX_ATTEMPTS = 3;
const MIN_CONFIDENCE = 0.6;

export interface IngestDniInput {
  correlationId: string;
  userId: string | null;
  anversoBuffer: Buffer;
  anversoContentType: string;
  reversoBuffer?: Buffer | null;
  reversoContentType?: string;
  captureMode: "auto" | "manual";
}

export type IngestDniResult =
  | {
      status: "ok";
      scan_id: number;
      correlation_id: string;
      confidence: number;
      quality_issues: string[];
      mrz_detected: boolean;
      mrz_ok: boolean | null;
    }
  | {
      status: "blocked";
      reason: "max_attempts" | "fake_suspect";
    }
  | {
      status: "low_quality";
      reason: "low_confidence" | "invalid_dni_format";
      confidence?: number;
      quality_issues?: string[];
    }
  | {
      status: "error";
      category: "storage" | "ocr" | "network" | "db" | "config" | "unknown";
      message: string;
      debug?: { original: string; stack: string };
    };

function categorizeError(err: unknown): {
  category: "storage" | "ocr" | "network" | "db" | "config" | "unknown";
  userMessage: string;
} {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? "" : "";
  const lower = msg.toLowerCase();
  const lowerStack = stack.toLowerCase();

  if (
    lower.includes("blob") ||
    lower.includes("bloburl") ||
    lowerStack.includes("@vercel/blob") ||
    lower.includes("token") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden")
  ) {
    return {
      category: "storage",
      userMessage: "No pudimos guardar tu foto. Revisa tu conexión e intenta de nuevo.",
    };
  }
  if (
    lower.includes("anthropic") ||
    lower.includes("claude") ||
    lower.includes("ai_") ||
    lowerStack.includes("@ai-sdk/anthropic") ||
    lowerStack.includes("@anthropic-ai") ||
    lower.includes("api key") ||
    lower.includes("api_key") ||
    lower.includes("apikey") ||
    lower.includes("x-api-key") ||
    lower.includes("rate limit") ||
    lower.includes("overloaded") ||
    lower.includes("529")
  ) {
    return {
      category: "ocr",
      userMessage:
        "Claude no pudo leer tu DNI. Verificá ANTHROPIC_API_KEY en Vercel (o probá en un minuto si es rate-limit).",
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
      userMessage: "La conexión al servicio falló. Revisa tu internet o prueba en un minuto.",
    };
  }
  if (
    lower.includes('relation "') ||
    lower.includes("does not exist") ||
    lower.includes("column ") ||
    lower.includes("schema")
  ) {
    return {
      category: "db",
      userMessage: "Estamos terminando una actualización del sistema. Prueba en 1 minuto.",
    };
  }
  if (
    lower.includes("envfile") ||
    lower.includes("is not defined") ||
    lower.includes("undefined")
  ) {
    return {
      category: "config",
      userMessage: "Falta una variable de entorno en el servidor. Avísale al equipo.",
    };
  }
  return {
    category: "unknown",
    userMessage: "Tuvimos un problema al procesar tu DNI. Intenta nuevamente.",
  };
}

export async function ingestDni(input: IngestDniInput): Promise<IngestDniResult> {
  await ensureKycSchema();
  const {
    correlationId,
    userId,
    anversoBuffer,
    anversoContentType,
    reversoBuffer,
    reversoContentType,
    captureMode,
  } = input;

  const failedAttempts = await countAttemptsForStep(correlationId, "ocr");
  if (failedAttempts >= MAX_ATTEMPTS) {
    await logAttempt({
      userId,
      correlationId,
      step: "ocr",
      outcome: "blocked",
      reason: "max_attempts_reached",
    });
    return { status: "blocked", reason: "max_attempts" };
  }

  try {
    const anversoBlob = await uploadKycImage({
      correlationId,
      kind: "dni-anverso",
      bytes: anversoBuffer,
      contentType: anversoContentType,
    });

    let reversoBlob = null;
    if (reversoBuffer && reversoBuffer.length > 0) {
      reversoBlob = await uploadKycImage({
        correlationId,
        kind: "dni-reverso",
        bytes: reversoBuffer,
        contentType: reversoContentType ?? "image/jpeg",
      });
    }

    const ocr = await extractDniFields(anversoBuffer, anversoContentType);
    console.log(
      `${tag} OCR ok corr=${correlationId} confidence=${ocr.confidence} issues=${ocr.quality_issues.join(",")}`,
    );

    if (ocr.confidence < MIN_CONFIDENCE) {
      await logAttempt({
        userId,
        correlationId,
        step: "ocr",
        outcome: "fail",
        reason: "low_confidence",
        payload: { confidence: ocr.confidence, issues: ocr.quality_issues },
      });
      return {
        status: "low_quality",
        reason: "low_confidence",
        confidence: ocr.confidence,
        quality_issues: ocr.quality_issues,
      };
    }

    if (ocr.quality_issues.includes("fake-suspect")) {
      await logAttempt({
        userId,
        correlationId,
        step: "ocr",
        outcome: "blocked",
        reason: "fake_suspect",
      });
      return { status: "blocked", reason: "fake_suspect" };
    }

    if (!/^\d{8}$/.test(ocr.dni_number)) {
      await logAttempt({
        userId,
        correlationId,
        step: "ocr",
        outcome: "fail",
        reason: "invalid_dni_format",
        payload: { dni_number: ocr.dni_number },
      });
      return { status: "low_quality", reason: "invalid_dni_format" };
    }

    const mrzParsed = ocr.mrz_raw ? parseTd1(ocr.mrz_raw) : null;
    if (mrzParsed && !mrzParsed.checksOk) {
      console.warn(`${tag} MRZ checks failed corr=${correlationId}`);
    }

    const insertRes = await query<{ id: number }>(
      `INSERT INTO kyc_dni_scans (
        user_id, correlation_id, raw_ocr_json,
        dni_number, apellido_paterno, apellido_materno, prenombres,
        fecha_nacimiento, sexo, fecha_emision, fecha_caducidad,
        mrz_raw, mrz_parsed,
        imagen_anverso_key, imagen_reverso_key,
        capture_mode, provider, ocr_confidence,
        retention_until
       ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        NOW() + INTERVAL '180 days'
       ) RETURNING id`,
      [
        userId,
        correlationId,
        JSON.stringify(ocr),
        ocr.dni_number,
        ocr.apellido_paterno,
        ocr.apellido_materno,
        ocr.prenombres,
        ocr.fecha_nacimiento || null,
        ocr.sexo,
        ocr.fecha_emision || null,
        ocr.fecha_caducidad || null,
        ocr.mrz_raw || null,
        mrzParsed ? JSON.stringify(mrzParsed) : null,
        anversoBlob.url,
        reversoBlob?.url ?? null,
        captureMode === "manual" ? "manual" : "auto",
        "claude",
        ocr.confidence,
      ],
    );

    await logAttempt({
      userId,
      correlationId,
      step: "ocr",
      outcome: "ok",
      payload: { scan_id: insertRes.rows[0].id, confidence: ocr.confidence },
    });

    return {
      status: "ok",
      scan_id: insertRes.rows[0].id,
      correlation_id: correlationId,
      confidence: ocr.confidence,
      quality_issues: ocr.quality_issues,
      mrz_detected: !!mrzParsed,
      mrz_ok: mrzParsed?.checksOk ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? "" : "";
    console.error(`${tag} error corr=${correlationId}`, err);
    await logAttempt({
      userId,
      correlationId,
      step: "ocr",
      outcome: "fail",
      reason: `internal: ${msg.slice(0, 200)}`,
    });
    const { category, userMessage } = categorizeError(err);
    console.log(
      `${tag} error_category=${category} corr=${correlationId} original="${msg.slice(0, 200)}"`,
    );
    return {
      status: "error",
      category,
      message: userMessage,
      debug:
        category === "unknown"
          ? { original: msg.slice(0, 500), stack: stack.slice(0, 800) }
          : undefined,
    };
  }
}
