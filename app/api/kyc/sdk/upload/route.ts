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
import { uploadKycImage } from "@/lib/kyc/blob";
import { ensureKycSchema } from "@/lib/kyc/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const tag = "[kyc/sdk/upload]";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB por frame

type Kind = "dni_front" | "dni_back" | "selfie" | "liveness_frame";

const BLOB_KIND: Record<Kind, Parameters<typeof uploadKycImage>[0]["kind"]> = {
  dni_front: "dni-anverso",
  dni_back: "dni-reverso",
  selfie: "selfie",
  liveness_frame: "liveness-frame",
};

function decodeBase64(b64: string): Buffer | null {
  const cleaned = b64.replace(/^data:image\/\w+;base64,/, "").trim();
  try {
    const buf = Buffer.from(cleaned, "base64");
    if (buf.length === 0) return null;
    return buf;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  await ensureSdkSchema();
  await ensureKycSchema();

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
  if (session.status === "completed" || session.status === "failed") {
    return NextResponse.json({ error: "session_closed" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    kind?: Kind;
    image?: string;
    content_type?: string;
    frame_index?: number;
  } | null;
  if (!body || !body.kind || !body.image) {
    return NextResponse.json(
      { error: "bad_request", detail: "kind and image required" },
      { status: 400 },
    );
  }
  if (!(body.kind in BLOB_KIND)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  const bytes = decodeBase64(body.image);
  if (!bytes) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "image_too_large", max_bytes: MAX_BYTES },
      { status: 413 },
    );
  }

  const contentType = body.content_type ?? "image/jpeg";
  const uploaded = await uploadKycImage({
    correlationId: session.correlation_id,
    kind: BLOB_KIND[body.kind],
    frameIndex: body.frame_index,
    bytes,
    contentType,
  });

  // Marcar sesión como "capturing" en el primer upload
  if (session.status === "pending") {
    await query(
      `UPDATE kyc_sdk_sessions SET status = 'capturing' WHERE id = $1`,
      [session.id],
    );
  }

  console.log(
    `${tag} tenant=${payload.tenant_id} session=${session.id} kind=${body.kind} size=${bytes.length}`,
  );

  return NextResponse.json({
    ok: true,
    kind: body.kind,
    url: uploaded.url,
    pathname: uploaded.pathname,
    size: uploaded.size,
  });
}
