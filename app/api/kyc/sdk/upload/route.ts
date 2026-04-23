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
// Hard cap por sesión — protege contra abuse con session_token robado:
// con 3 selfie frames + dni_front + dni_back + márgen para retries (15) =
// 20 uploads cubre cualquier flujo legítimo. >20 indica abuse o bug del cliente.
const MAX_UPLOADS_PER_SESSION = 20;
// Hard cap del array selfie_frames específicamente — evita inflar metadata
// con index=999 etc.
const MAX_SELFIE_FRAMES = 10;

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

  // Rate limit por sesión — defensa contra session_token robado.
  const uploadsCount =
    Number((session.metadata as Record<string, unknown>).uploads_count ?? 0) || 0;
  if (uploadsCount >= MAX_UPLOADS_PER_SESSION) {
    console.warn(
      `${tag} session=${session.id} hit MAX_UPLOADS_PER_SESSION=${MAX_UPLOADS_PER_SESSION}`,
    );
    return NextResponse.json(
      { error: "upload_limit", detail: `max ${MAX_UPLOADS_PER_SESSION} uploads per session` },
      { status: 429 },
    );
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
  // Cap selfie_frames index para evitar metadata inflation
  if (
    (body.kind === "selfie" || body.kind === "liveness_frame") &&
    typeof body.frame_index === "number" &&
    (body.frame_index < 0 || body.frame_index >= MAX_SELFIE_FRAMES)
  ) {
    return NextResponse.json(
      { error: "invalid_frame_index", detail: `0..${MAX_SELFIE_FRAMES - 1}` },
      { status: 400 },
    );
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

  // Merge URL en session.metadata.uploads para que finalize las lea.
  //   dni_front / dni_back → single: { url, size }
  //   selfie / liveness_frame → array indexado por frame_index
  const uploads = ((session.metadata as Record<string, unknown>).uploads ?? {}) as {
    dni_front?: { url: string; size: number };
    dni_back?: { url: string; size: number };
    selfie_frames?: Array<{ url: string; size: number }>;
  };
  const entry = { url: uploaded.url, size: uploaded.size };
  if (body.kind === "dni_front") uploads.dni_front = entry;
  else if (body.kind === "dni_back") uploads.dni_back = entry;
  else {
    // selfie + liveness_frame ambos van al array selfie_frames; frame_index
    // determina la posición (0 = central/selfie oficial)
    uploads.selfie_frames = uploads.selfie_frames ?? [];
    const idx = body.frame_index ?? 0;
    uploads.selfie_frames[idx] = entry;
  }

  // Update atomically — uploads + uploads_count en un solo UPDATE para que el
  // contador no quede desincronizado con uploads en escritura concurrente.
  await query(
    `UPDATE kyc_sdk_sessions
       SET status = CASE WHEN status = 'pending' THEN 'capturing' ELSE status END,
           metadata = jsonb_set(
             jsonb_set(metadata, '{uploads}', $2::jsonb),
             '{uploads_count}',
             to_jsonb(COALESCE((metadata->>'uploads_count')::int, 0) + 1)
           )
     WHERE id = $1`,
    [session.id, JSON.stringify(uploads)],
  );

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
