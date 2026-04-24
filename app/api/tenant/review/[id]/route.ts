import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import {
  ensureSdkSchema,
  type DbSdkSession,
} from "@/lib/kyc/sdk/schema";
import { dispatchWebhook } from "@/lib/kyc/sdk/webhook";
import { logAttempt, type DbKycDniScan, type DbKycFaceMatch } from "@/lib/kyc/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const tag = "[tenant/review]";

/** GET — detalle de una sesión para revisar. Incluye imágenes + scores. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const sessRes = await query<DbSdkSession>(
    `SELECT * FROM kyc_sdk_sessions
     WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [id, session.user.tenant_id],
  );
  const s = sessRes.rows[0];
  if (!s) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Imágenes + scores del scan subyacente
  const [scanRes, faceRes] = await Promise.all([
    query<DbKycDniScan>(
      `SELECT * FROM kyc_dni_scans WHERE correlation_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [s.correlation_id],
    ),
    query<DbKycFaceMatch>(
      `SELECT * FROM kyc_face_matches WHERE correlation_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [s.correlation_id],
    ),
  ]);

  return NextResponse.json({
    session: {
      id: s.id,
      status: s.status,
      external_user_id: s.external_user_id,
      external_reference: s.external_reference,
      correlation_id: s.correlation_id,
      verdict: s.verdict,
      created_at: s.created_at,
      reviewed_at: s.reviewed_at,
    },
    scan: scanRes.rows[0]
      ? {
          dni_number: scanRes.rows[0].dni_number,
          apellido_paterno: scanRes.rows[0].apellido_paterno,
          apellido_materno: scanRes.rows[0].apellido_materno,
          prenombres: scanRes.rows[0].prenombres,
          fecha_nacimiento: scanRes.rows[0].fecha_nacimiento,
          imagen_anverso_key: scanRes.rows[0].imagen_anverso_key,
          imagen_reverso_key: scanRes.rows[0].imagen_reverso_key,
          ocr_confidence: scanRes.rows[0].ocr_confidence,
        }
      : null,
    face: faceRes.rows[0]
      ? {
          score: faceRes.rows[0].score,
          passed: faceRes.rows[0].passed,
          liveness_passed: faceRes.rows[0].liveness_passed,
          selfie_key: faceRes.rows[0].selfie_key,
        }
      : null,
  });
}

/**
 * POST — resolver review: approve|reject con notas opcionales.
 * Al resolver: update session (reviewed_*, status='completed', verdict
 * final), fire webhook con el verdict humano, logAttempt para auditoría.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSdkSchema();
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    action?: "approve" | "reject";
    notes?: string;
  } | null;

  if (!body?.action || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json(
      { error: "invalid_action", detail: "action debe ser 'approve' o 'reject'" },
      { status: 400 },
    );
  }

  const sessRes = await query<DbSdkSession>(
    `SELECT * FROM kyc_sdk_sessions
     WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [id, session.user.tenant_id],
  );
  const s = sessRes.rows[0];
  if (!s) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (s.status !== "review") {
    return NextResponse.json(
      { error: "not_in_review", detail: `status actual: ${s.status}` },
      { status: 409 },
    );
  }
  if (s.reviewed_at) {
    return NextResponse.json(
      { error: "already_reviewed" },
      { status: 409 },
    );
  }

  const finalStatus = body.action === "approve" ? "verified" : "rejected";
  const currentVerdict = (s.verdict as Record<string, unknown> | null) ?? {};
  const finalVerdict = {
    ...currentVerdict,
    status: finalStatus,
    reason: `manual_review_${body.action}: ${body.notes ?? "(sin notas)"}`,
    manual_review: {
      reviewed_by_email: session.user.email,
      reviewed_at: new Date().toISOString(),
      action: body.action,
      notes: body.notes ?? null,
    },
  };

  await query(
    `UPDATE kyc_sdk_sessions
       SET status = 'completed',
           verdict = $2::jsonb,
           completed_at = NOW(),
           reviewed_at = NOW(),
           reviewed_by = $3,
           review_action = $4,
           review_notes = $5,
           webhook_fired_at = CASE WHEN webhook_url IS NOT NULL THEN NOW() ELSE webhook_fired_at END
     WHERE id = $1`,
    [
      s.id,
      JSON.stringify(finalVerdict),
      session.user.id,
      body.action === "approve" ? "approved" : "rejected",
      body.notes ?? null,
    ],
  );

  // Fire webhook con verdict final
  if (s.webhook_url) {
    const result = await dispatchWebhook({
      url: s.webhook_url,
      secret: s.webhook_secret,
      payload: {
        session_id: s.id,
        tenant_id: s.tenant_id,
        correlation_id: s.correlation_id,
        external_user_id: s.external_user_id,
        external_reference: s.external_reference,
        verdict: finalVerdict,
        completed_at: new Date().toISOString(),
        manual_review: true,
      },
    });
    console.log(
      `${tag} webhook tenant=${s.tenant_id} session=${s.id} ok=${result.ok} attempts=${result.attempts}`,
    );
  }

  await logAttempt({
    userId: null,
    correlationId: s.correlation_id,
    step: "verify",
    outcome: finalStatus === "verified" ? "ok" : "fail",
    reason: `manual_review_${body.action} by ${session.user.email}`,
    payload: {
      reviewer_id: session.user.id,
      notes: body.notes ?? null,
    },
  });

  console.log(
    `${tag} ${body.action} tenant=${s.tenant_id} session=${s.id} by=${session.user.id}`,
  );

  return NextResponse.json({
    ok: true,
    verdict: finalVerdict,
  });
}
