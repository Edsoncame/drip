import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  ensureSdkSchema,
  type DbSdkSession,
} from "@/lib/kyc/sdk/schema";
import {
  extractBearer,
  verifySessionToken,
} from "@/lib/kyc/sdk/session-token";
import { dispatchWebhook } from "@/lib/kyc/sdk/webhook";
import { ingestDni } from "@/lib/kyc/pipeline/ingest-dni";
import { ingestSelfie } from "@/lib/kyc/pipeline/ingest-selfie";
import { computeKycVerdict } from "@/lib/kyc/pipeline/verdict";
import { matchIdentity } from "@/lib/kyc/match";
import type { DbKycDniScan } from "@/lib/kyc/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pipeline completo: OCR (~15s) + Rekognition (~3s) + forensics 5 capas (~8s)
// + arbiter opcional (~5s) + webhook (~4s). Subimos a 120s para cubrir.
export const maxDuration = 120;

const tag = "[kyc/sdk/finalize]";

interface UploadEntry {
  url: string;
  size: number;
}
interface UploadsMetadata {
  dni_front?: UploadEntry;
  dni_back?: UploadEntry;
  selfie_frames?: Array<UploadEntry | undefined>;
}

async function fetchBlobBytes(url: string): Promise<Buffer | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(req: NextRequest) {
  await ensureSdkSchema();

  const token = extractBearer(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = await verifySessionToken(token);
  if (!payload) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sessRes = await query<DbSdkSession>(
    `SELECT * FROM kyc_sdk_sessions WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [payload.session_id, payload.tenant_id],
  );
  const session = sessRes.rows[0];
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: "session_expired" }, { status: 410 });
  }
  if (session.status === "completed") {
    return NextResponse.json({ verdict: session.verdict }, { status: 200 });
  }
  if (session.status === "failed") {
    return NextResponse.json({ error: "session_failed" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    form_name?: string;
    form_dni?: string;
  };

  const uploads = ((session.metadata as Record<string, unknown>).uploads ??
    {}) as UploadsMetadata;

  if (!uploads.dni_front) {
    return NextResponse.json(
      { error: "missing_dni_front", detail: "Subí dni_front vía /api/kyc/sdk/upload antes de finalize" },
      { status: 409 },
    );
  }
  const frames = uploads.selfie_frames ?? [];
  if (frames.length < 3 || frames.some((f) => !f)) {
    return NextResponse.json(
      { error: "missing_selfie_frames", detail: "Se requieren 3 frames de selfie antes de finalize" },
      { status: 409 },
    );
  }

  // Marcar processing para que retries concurrentes vean estado.
  await query(
    `UPDATE kyc_sdk_sessions SET status = 'processing' WHERE id = $1`,
    [session.id],
  );

  try {
    // 1. Descargar bytes desde Blob (ya subidos por /upload)
    const [dniBytes, dniBackBytes, ...frameBytes] = await Promise.all([
      fetchBlobBytes(uploads.dni_front.url),
      uploads.dni_back ? fetchBlobBytes(uploads.dni_back.url) : Promise.resolve(null),
      ...frames.map((f) => fetchBlobBytes(f!.url)),
    ]);
    if (!dniBytes) throw new Error("dni_front_download_failed");
    if (frameBytes.some((b) => !b)) throw new Error("selfie_frame_download_failed");

    // 2. ingestDni
    const dniResult = await ingestDni({
      correlationId: session.correlation_id,
      userId: null, // SDK no escribe a users; queda null en kyc_dni_scans
      anversoBuffer: dniBytes,
      anversoContentType: "image/jpeg",
      reversoBuffer: dniBackBytes,
      reversoContentType: dniBackBytes ? "image/jpeg" : undefined,
      captureMode: "auto",
    });
    if (dniResult.status !== "ok") {
      const verdict = {
        status: "rejected" as const,
        reason: `dni_ingest: ${dniResult.status}`,
        detail: dniResult,
      };
      await finalizeSession(session, "failed", verdict);
      await fireWebhook(session, verdict);
      return NextResponse.json({ verdict }, { status: 200 });
    }

    // 3. ingestSelfie
    const selfieResult = await ingestSelfie({
      correlationId: session.correlation_id,
      userId: null,
      frames: frameBytes as Buffer[],
    });
    if (selfieResult.status !== "ok") {
      const verdict = {
        status: "rejected" as const,
        reason: `selfie_ingest: ${selfieResult.status}`,
        detail: selfieResult,
      };
      await finalizeSession(session, "failed", verdict);
      await fireWebhook(session, verdict);
      return NextResponse.json({ verdict }, { status: 200 });
    }

    // 4. Name match server-side — solo si el tenant pasó form_name + form_dni.
    //    Queremos los campos OCR del scan recién insertado; los leemos de DB
    //    en vez de reestructurar el return de ingestDni.
    let nameScore: number | undefined;
    if (body.form_name && body.form_dni) {
      const scanRes = await query<DbKycDniScan>(
        `SELECT * FROM kyc_dni_scans WHERE id = $1 LIMIT 1`,
        [dniResult.scan_id],
      );
      const scanRow = scanRes.rows[0];
      if (scanRow) {
        const m = matchIdentity({
          form: { dni_number: body.form_dni, full_name: body.form_name },
          ocr: {
            dni_number: scanRow.dni_number ?? "",
            apellido_paterno: scanRow.apellido_paterno ?? "",
            apellido_materno: scanRow.apellido_materno ?? "",
            prenombres: scanRow.prenombres ?? "",
          },
        });
        nameScore = m.name_score;
      }
    }

    // 5. computeKycVerdict
    const verdict = await computeKycVerdict({
      correlationId: session.correlation_id,
      userId: null,
      nameScore,
      formName: body.form_name,
      formDni: body.form_dni,
    });

    const verdictPayload = {
      status: verdict.status,
      reason: verdict.reason,
      arbiter_used: verdict.arbiterUsed,
      arbiter_confidence: verdict.arbiterConfidence,
      face_score: verdict.face ? parseFloat(String(verdict.face.score)) : null,
      forensics_overall: verdict.forensicsResult?.overall_tampering_risk ?? null,
      template_layout: verdict.templateResult?.layout_score ?? null,
      age_deviation: verdict.ageResult?.deviation_years ?? null,
      duplicate_flag: verdict.duplicatesResult?.dni_reused_by_other_user ?? false,
    };

    // Decidir si rutear a manual review queue o finalizar directo.
    //
    // Hoy computeKycVerdict nunca devuelve 'review' como output final — el
    // arbiter IA siempre resuelve binario (verified|rejected). La señal que
    // usamos para "esto estuvo borderline" es si el arbiter tuvo que correr
    // (arbiterUsed=true) y, opcionalmente, su propia confidence.
    //
    // Policy del tenant (kyc_tenants.manual_review_policy):
    //   'never'          — siempre completar directo (legacy)
    //   'low_confidence' — review si arbiter corrió y confidence < 0.7
    //   'all_borderline' — review cada vez que el arbiter tuvo que correr
    const policyRes = await query<{ manual_review_policy: string }>(
      `SELECT manual_review_policy FROM kyc_tenants WHERE id = $1`,
      [session.tenant_id],
    );
    const policy = policyRes.rows[0]?.manual_review_policy ?? "never";

    const needsReview =
      (policy === "low_confidence" &&
        verdict.arbiterUsed &&
        typeof verdict.arbiterConfidence === "number" &&
        verdict.arbiterConfidence < 0.7) ||
      (policy === "all_borderline" && verdict.arbiterUsed);

    if (needsReview) {
      // Queue for manual review — NO fire webhook yet.
      await query(
        `UPDATE kyc_sdk_sessions
           SET status = 'review',
               verdict = $2::jsonb
         WHERE id = $1`,
        [session.id, JSON.stringify(verdictPayload)],
      );
      console.log(
        `${tag} routed_to_review tenant=${session.tenant_id} session=${session.id} policy=${policy} reason=${verdict.reason}`,
      );
      return NextResponse.json({
        verdict: { ...verdictPayload, status: "review" },
        correlation_id: session.correlation_id,
        pending_review: true,
      });
    }

    await finalizeSession(session, "completed", verdictPayload);
    await fireWebhook(session, verdictPayload);

    console.log(
      `${tag} completed tenant=${session.tenant_id} session=${session.id} status=${verdict.status} reason=${verdict.reason}`,
    );

    return NextResponse.json({ verdict: verdictPayload, correlation_id: session.correlation_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} failed tenant=${session.tenant_id} session=${session.id}`, msg);
    const verdict = {
      status: "rejected" as const,
      reason: `pipeline_error: ${msg.slice(0, 200)}`,
    };
    await finalizeSession(session, "failed", verdict);
    await fireWebhook(session, verdict);
    return NextResponse.json({ verdict, error: msg.slice(0, 200) }, { status: 500 });
  }
}

async function finalizeSession(
  session: DbSdkSession,
  newStatus: "completed" | "failed",
  verdictPayload: Record<string, unknown>,
): Promise<void> {
  await query(
    `UPDATE kyc_sdk_sessions
       SET status = $2,
           verdict = $3::jsonb,
           completed_at = NOW(),
           webhook_fired_at = CASE WHEN webhook_url IS NOT NULL THEN NOW() ELSE webhook_fired_at END
     WHERE id = $1`,
    [session.id, newStatus, JSON.stringify(verdictPayload)],
  );
}

async function fireWebhook(
  session: DbSdkSession,
  verdictPayload: Record<string, unknown>,
): Promise<void> {
  if (!session.webhook_url) return;
  const result = await dispatchWebhook({
    url: session.webhook_url,
    secret: session.webhook_secret,
    payload: {
      session_id: session.id,
      tenant_id: session.tenant_id,
      correlation_id: session.correlation_id,
      external_user_id: session.external_user_id,
      external_reference: session.external_reference,
      verdict: verdictPayload,
      completed_at: new Date().toISOString(),
    },
  });
  console.log(
    `${tag} webhook session=${session.id} ok=${result.ok} attempts=${result.attempts} status=${result.last_status} err=${result.last_error ?? "-"}`,
  );
}
