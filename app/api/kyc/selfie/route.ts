import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ingestSelfie } from "@/lib/kyc/pipeline/ingest-selfie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * Handler del flujo humano. La orquestación (liveness + upload + compareFaces +
 * persist) vive en `lib/kyc/pipeline/ingest-selfie.ts`. Este handler solo:
 *   - Parsea FormData (correlation_id + frame_0/1/2)
 *   - Llama a ingestSelfie()
 *   - Mapea cada variante de IngestSelfieResult a la respuesta HTTP apropiada
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const userId = session?.userId ?? null;

  const form = await req.formData();
  const correlationId = form.get("correlation_id") as string;
  if (!correlationId) {
    return NextResponse.json({ error: "correlation_id requerido" }, { status: 400 });
  }

  const frames: Buffer[] = [];
  for (let i = 0; i < 3; i++) {
    const f = form.get(`frame_${i}`) as File | null;
    if (!f) {
      return NextResponse.json(
        { error: `Falta frame_${i}. Reintenta la captura.` },
        { status: 400 },
      );
    }
    frames.push(Buffer.from(await f.arrayBuffer()));
  }

  const result = await ingestSelfie({ correlationId, userId, frames });

  if (result.status === "ok") {
    return NextResponse.json({
      passed: true,
      liveness_passed: true,
      score: result.score,
      threshold: result.threshold,
    });
  }

  if (result.status === "face_mismatch") {
    return NextResponse.json({
      passed: false,
      liveness_passed: true,
      score: result.score,
      message: result.message,
    });
  }

  if (result.status === "liveness_fail") {
    return NextResponse.json(
      {
        passed: false,
        liveness_passed: false,
        message: result.message,
      },
      { status: 422 },
    );
  }

  if (result.status === "blocked") {
    return NextResponse.json(
      {
        error: "Alcanzaste el máximo de intentos. Contactanos por WhatsApp.",
        blocked: true,
      },
      { status: 429 },
    );
  }

  if (result.status === "precondition_fail") {
    if (result.reason === "no_scan" || result.reason === "no_anverso_key") {
      return NextResponse.json(
        {
          error:
            "No encontramos tu DNI cargado. Vuelve al paso anterior y cárgalo primero.",
        },
        { status: 400 },
      );
    }
    if (result.reason === "legacy_blob_key") {
      return NextResponse.json(
        {
          error:
            "El DNI guardado tiene formato viejo. Vuelve a capturar la foto del DNI en el paso anterior.",
          category: "legacy_blob_key",
        },
        { status: 400 },
      );
    }
    // missing_frame: aunque ya validamos arriba, es defensivo
    return NextResponse.json(
      { error: "Faltan frames de la captura. Reintentá." },
      { status: 400 },
    );
  }

  // result.status === 'error'
  const status =
    result.category === "rekognition"
      ? 503
      : result.category === "network"
      ? 504
      : result.category === "no_face"
      ? 422
      : 500;
  return NextResponse.json(
    {
      error: result.message,
      category: result.category,
      debug: result.debug,
    },
    { status },
  );
}
