import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  ensureKycSchema,
  logAttempt,
  countAttemptsForStep,
  type DbKycDniScan,
} from "@/lib/kyc/db";
import { uploadKycImage } from "@/lib/kyc/blob";
import { checkLiveness, compareFaces, FACE_MATCH_MIN } from "@/lib/kyc/face";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const tag = "[kyc/selfie]";
const MAX_ATTEMPTS = 3;

export async function POST(req: NextRequest) {
  await ensureKycSchema();
  const session = await getSession();
  const userId = session?.userId ?? null;

  const form = await req.formData();
  const correlationId = form.get("correlation_id") as string;
  if (!correlationId) {
    return NextResponse.json({ error: "correlation_id requerido" }, { status: 400 });
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
    return NextResponse.json(
      {
        error: "Alcanzaste el máximo de intentos. Contactanos por WhatsApp.",
        blocked: true,
      },
      { status: 429 },
    );
  }

  // Recoger los 3 frames
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

  // Recuperar el último scan DNI para cross-check
  const scanRes = await query<DbKycDniScan>(
    `SELECT * FROM kyc_dni_scans WHERE correlation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [correlationId],
  );
  if (scanRes.rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "No encontramos tu DNI cargado. Vuelve al paso anterior y cárgalo primero.",
      },
      { status: 400 },
    );
  }
  const scan = scanRes.rows[0];
  if (!scan.imagen_anverso_key) {
    return NextResponse.json(
      { error: "Falta la imagen del DNI. Vuelve al paso anterior." },
      { status: 400 },
    );
  }

  try {
    // 1. Liveness con los 3 frames
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
      return NextResponse.json(
        {
          passed: false,
          liveness_passed: false,
          message,
        },
        { status: 422 },
      );
    }

    // 2. Subir frame central como selfie oficial
    const selfieBlob = await uploadKycImage({
      correlationId,
      kind: "selfie",
      bytes: frames[0],
      contentType: "image/jpeg",
    });

    // 3. Descargar imagen del DNI desde Blob (necesitamos bytes para Rekognition).
    // En registros viejos guardábamos solo el pathname (bug) — si el valor no
    // empieza con http, no hay forma de reconstruir el URL confiablemente, así
    // que devolvemos un error claro.
    if (!scan.imagen_anverso_key.startsWith("http")) {
      return NextResponse.json(
        {
          error:
            "El DNI guardado tiene formato viejo. Vuelve a capturar la foto del DNI en el paso anterior.",
          category: "legacy_blob_key",
        },
        { status: 400 },
      );
    }
    const dniResp = await fetch(scan.imagen_anverso_key);
    if (!dniResp.ok) {
      throw new Error(`No pudimos recuperar la imagen del DNI: ${dniResp.status}`);
    }
    const dniBytes = Buffer.from(await dniResp.arrayBuffer());

    // 4. CompareFaces
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
      return NextResponse.json({
        passed: false,
        liveness_passed: true,
        score: match.similarity,
        message:
          match.similarity < 40
            ? "No pudimos reconocer tu rostro con claridad. Asegurate de tener buena iluminación, sin lentes ni gorra, y mirando de frente a la cámara."
            : "La foto de tu DNI y tu selfie no coinciden con suficiente confianza. Vuelve a capturar el DNI enfocando bien la foto del titular.",
      });
    }

    await logAttempt({
      userId,
      correlationId,
      step: "face-compare",
      outcome: "ok",
      payload: { similarity: match.similarity },
    });

    return NextResponse.json({
      passed: true,
      liveness_passed: true,
      score: match.similarity,
      threshold: FACE_MATCH_MIN,
    });
  } catch (err) {
    // Desenrollamos error.cause (undici fetch failed tiene la causa real adentro)
    function flatten(e: unknown, depth = 0): string {
      if (depth > 4 || !e) return "";
      if (e instanceof Error) {
        const cause = (e as Error & { cause?: unknown }).cause;
        return `${e.name}: ${e.message}${cause ? " → " + flatten(cause, depth + 1) : ""}`;
      }
      return String(e);
    }
    const msg = flatten(err);
    const stack = err instanceof Error ? err.stack ?? "" : "";
    console.error(`${tag} error corr=${correlationId}`, msg, err);
    await logAttempt({
      userId,
      correlationId,
      step: "face-compare",
      outcome: "fail",
      reason: `internal: ${msg.slice(0, 400)}`,
    });

    const lower = msg.toLowerCase();
    const lowerStack = stack.toLowerCase();
    let userMessage = "Tuvimos un problema al verificar tu rostro. Intenta nuevamente.";
    let category = "unknown";
    let status = 500;

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
      category = "rekognition";
      userMessage =
        "El servicio de validación facial no está disponible. Verifica las credenciales de AWS en Vercel.";
      status = 503;
    } else if (
      lower.includes("blob") ||
      lowerStack.includes("@vercel/blob") ||
      lower.includes("unauthorized") ||
      lower.includes("forbidden")
    ) {
      category = "storage";
      userMessage =
        "No pudimos guardar la selfie. Revisa tu conexión e intenta de nuevo.";
    } else if (
      lower.includes("timeout") ||
      lower.includes("aborted") ||
      lower.includes("fetch failed") ||
      lower.includes("network") ||
      lower.includes("enotfound") ||
      lower.includes("econnrefused")
    ) {
      category = "network";
      userMessage = "La conexión se cortó. Revisa tu internet e intenta nuevamente.";
      status = 504;
    } else if (
      lower.includes("no face") ||
      lower.includes("nofacedetected") ||
      lower.includes("face not found")
    ) {
      category = "no_face";
      userMessage = "No detectamos tu rostro en la foto. Asegúrate de estar de frente con buena luz.";
      status = 422;
    }

    console.log(
      `${tag} error_category=${category} corr=${correlationId} original="${msg.slice(0, 200)}"`,
    );

    // Siempre incluimos debug mientras estabilizamos el flujo — crítico para
    // debuggear sin pedirle al usuario que abra DevTools en iPhone.
    return NextResponse.json(
      {
        error: userMessage,
        category,
        debug: { original: msg.slice(0, 500), stack: stack.slice(0, 800) },
      },
      { status },
    );
  }
}
