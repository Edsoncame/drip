import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { ingestDni } from "@/lib/kyc/pipeline/ingest-dni";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Handler del flujo humano. La orquestación (upload + OCR + validaciones +
 * persist) vive en `lib/kyc/pipeline/ingest-dni.ts`. Este handler solo:
 *   - Parsea el FormData
 *   - Llama a ingestDni()
 *   - Mapea el resultado estructurado a la respuesta HTTP apropiada
 */
export async function POST(req: NextRequest) {
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

  const anversoBuffer = Buffer.from(await anverso.arrayBuffer());
  const reversoBuffer =
    reverso && reverso.size > 0 ? Buffer.from(await reverso.arrayBuffer()) : null;

  const result = await ingestDni({
    correlationId,
    userId,
    anversoBuffer,
    anversoContentType: anverso.type || "image/jpeg",
    reversoBuffer,
    reversoContentType: reverso?.type,
    captureMode: captureMode === "manual" ? "manual" : "auto",
  });

  if (result.status === "ok") {
    return NextResponse.json({
      scan_id: result.scan_id,
      correlation_id: result.correlation_id,
      confidence: result.confidence,
      quality_issues: result.quality_issues,
      mrz_detected: result.mrz_detected,
      mrz_ok: result.mrz_ok,
    });
  }

  if (result.status === "blocked") {
    if (result.reason === "max_attempts") {
      return NextResponse.json(
        {
          error:
            "Alcanzaste el máximo de intentos. Contactanos por WhatsApp para verificar manualmente.",
          blocked: true,
        },
        { status: 429 },
      );
    }
    // fake_suspect
    return NextResponse.json(
      {
        error:
          "Este documento no parece un DNI peruano. Si crees que es un error, contáctanos por WhatsApp.",
        blocked: true,
      },
      { status: 422 },
    );
  }

  if (result.status === "low_quality") {
    if (result.reason === "low_confidence") {
      return NextResponse.json(
        {
          error:
            "No pudimos leer el DNI con claridad. Vuelve a capturarlo con buena luz, enfocando el frente completo sin reflejos.",
          correlation_id: correlationId,
          quality_issues: result.quality_issues,
        },
        { status: 422 },
      );
    }
    // invalid_dni_format
    return NextResponse.json(
      {
        error: "No pudimos leer los 8 dígitos del DNI. Vuelve a capturarlo enfocando bien.",
        correlation_id: correlationId,
      },
      { status: 422 },
    );
  }

  // result.status === 'error'
  const status =
    result.category === "ocr"
      ? 503
      : result.category === "network"
      ? 504
      : result.category === "db"
      ? 503
      : 500;
  return NextResponse.json(
    {
      error: result.message,
      category: result.category,
      correlation_id: correlationId,
      ...(result.debug ? { debug: result.debug } : {}),
    },
    { status },
  );
}
