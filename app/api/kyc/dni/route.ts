import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureKycSchema, logAttempt, countAttemptsForStep } from "@/lib/kyc/db";
import { uploadKycImage } from "@/lib/kyc/blob";
import { extractDniFields } from "@/lib/kyc/ocr";
import { parseTd1 } from "@/lib/kyc/mrz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const tag = "[kyc/dni]";

const MAX_ATTEMPTS = 3;
const MIN_CONFIDENCE = 0.6;

export async function POST(req: NextRequest) {
  await ensureKycSchema();
  const session = await getSession();
  const userId = session?.userId ?? null;

  const form = await req.formData();
  const anverso = form.get("anverso") as File | null;
  const reverso = form.get("reverso") as File | null;
  const captureMode = (form.get("capture_mode") as string) ?? "auto";
  const correlationId =
    (form.get("correlation_id") as string) || randomUUID();

  if (!anverso) {
    return NextResponse.json(
      { error: "La foto del DNI (anverso) es requerida" },
      { status: 400 },
    );
  }
  if (anverso.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Archivo demasiado grande (máx 15MB)" }, { status: 400 });
  }

  // Rate-limit: 3 intentos fallidos antes de bloquear
  const failedAttempts = await countAttemptsForStep(correlationId, "ocr");
  if (failedAttempts >= MAX_ATTEMPTS) {
    await logAttempt({
      userId,
      correlationId,
      step: "ocr",
      outcome: "blocked",
      reason: "max_attempts_reached",
    });
    return NextResponse.json(
      {
        error:
          "Alcanzaste el máximo de intentos. Contactanos por WhatsApp para verificar manualmente.",
        blocked: true,
      },
      { status: 429 },
    );
  }

  try {
    // 1. Subir imagen anverso a Blob
    const anversoBytes = Buffer.from(await anverso.arrayBuffer());
    const anversoBlob = await uploadKycImage({
      correlationId,
      kind: "dni-anverso",
      bytes: anversoBytes,
      contentType: anverso.type || "image/jpeg",
    });

    let reversoBlob = null;
    if (reverso && reverso.size > 0) {
      const reversoBytes = Buffer.from(await reverso.arrayBuffer());
      reversoBlob = await uploadKycImage({
        correlationId,
        kind: "dni-reverso",
        bytes: reversoBytes,
        contentType: reverso.type || "image/jpeg",
      });
    }

    // 2. OCR con Claude vision
    const ocr = await extractDniFields(anversoBytes, anverso.type || "image/jpeg");
    console.log(
      `${tag} OCR ok corr=${correlationId} confidence=${ocr.confidence} issues=${ocr.quality_issues.join(",")}`,
    );

    // 3. Validaciones de calidad
    if (ocr.confidence < MIN_CONFIDENCE) {
      await logAttempt({
        userId,
        correlationId,
        step: "ocr",
        outcome: "fail",
        reason: "low_confidence",
        payload: { confidence: ocr.confidence, issues: ocr.quality_issues },
      });
      return NextResponse.json(
        {
          error:
            "No pudimos leer el DNI con claridad. Volvé a capturarlo con buena luz, enfocando el frente completo sin reflejos.",
          correlation_id: correlationId,
          quality_issues: ocr.quality_issues,
        },
        { status: 422 },
      );
    }

    if (ocr.quality_issues.includes("fake-suspect")) {
      await logAttempt({
        userId,
        correlationId,
        step: "ocr",
        outcome: "blocked",
        reason: "fake_suspect",
      });
      return NextResponse.json(
        {
          error:
            "Este documento no parece un DNI peruano. Si creés que es un error, contactanos por WhatsApp.",
          blocked: true,
        },
        { status: 422 },
      );
    }

    // 4. Validación formato DNI (8 dígitos)
    if (!/^\d{8}$/.test(ocr.dni_number)) {
      await logAttempt({
        userId,
        correlationId,
        step: "ocr",
        outcome: "fail",
        reason: "invalid_dni_format",
        payload: { dni_number: ocr.dni_number },
      });
      return NextResponse.json(
        {
          error: "No pudimos leer los 8 dígitos del DNI. Volvé a capturarlo enfocando bien.",
          correlation_id: correlationId,
        },
        { status: 422 },
      );
    }

    // 5. Parsear MRZ si vino (cross-check)
    const mrzParsed = ocr.mrz_raw ? parseTd1(ocr.mrz_raw) : null;
    if (mrzParsed && !mrzParsed.checksOk) {
      console.warn(`${tag} MRZ checks failed corr=${correlationId}`);
      // No bloqueamos por MRZ inválida — puede ser error de lectura.
      // Pero marcamos para revisión.
    }

    // 6. Persistir scan
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
        anversoBlob.pathname,
        reversoBlob?.pathname ?? null,
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

    // 7. Response — nunca devolvemos el OCR completo al cliente (solo flags)
    return NextResponse.json({
      scan_id: insertRes.rows[0].id,
      correlation_id: correlationId,
      confidence: ocr.confidence,
      quality_issues: ocr.quality_issues,
      mrz_detected: !!mrzParsed,
      mrz_ok: mrzParsed?.checksOk ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} error corr=${correlationId}`, err);
    await logAttempt({
      userId,
      correlationId,
      step: "ocr",
      outcome: "fail",
      reason: `internal: ${msg.slice(0, 200)}`,
    });

    // Categorizar error para dar pista útil al usuario
    const lower = msg.toLowerCase();
    let userMessage = "Tuvimos un problema al procesar tu DNI. Intentá nuevamente.";
    let category = "unknown";
    let status = 500;

    if (
      lower.includes("blob") ||
      lower.includes("token") ||
      lower.includes("unauthorized") ||
      lower.includes("forbidden")
    ) {
      category = "storage";
      userMessage =
        "No pudimos guardar tu foto en este momento. Revisá tu conexión e intentá de nuevo.";
    } else if (
      lower.includes("anthropic") ||
      lower.includes("api key") ||
      lower.includes("api_key") ||
      lower.includes("rate limit") ||
      lower.includes("overloaded") ||
      lower.includes("529")
    ) {
      category = "ocr";
      userMessage =
        "Nuestro servicio de lectura está ocupado. Probá de nuevo en un minuto.";
      status = 503;
    } else if (
      lower.includes("timeout") ||
      lower.includes("aborted") ||
      lower.includes("fetch failed") ||
      lower.includes("network")
    ) {
      category = "network";
      userMessage =
        "La conexión se cortó. Revisá tu internet e intentá nuevamente.";
      status = 504;
    } else if (
      lower.includes('relation "') ||
      lower.includes("does not exist") ||
      lower.includes("column ")
    ) {
      category = "db";
      userMessage =
        "Estamos terminando una actualización del sistema. Probá de nuevo en 1 minuto.";
      status = 503;
    }

    console.log(
      `${tag} error_category=${category} corr=${correlationId} original="${msg.slice(0, 120)}"`,
    );

    return NextResponse.json(
      {
        error: userMessage,
        category,
        correlation_id: correlationId,
      },
      { status },
    );
  }
}
