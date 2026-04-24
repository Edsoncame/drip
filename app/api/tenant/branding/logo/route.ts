import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import {
  getTenantBranding,
  normalizeBranding,
} from "@/lib/kyc/sdk/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const tag = "[tenant/branding/logo]";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

/**
 * POST multipart/form-data con field `file`. Sube el logo a Vercel Blob
 * bajo `tenant-branding/<tenant_id>/logo-<ts>.<ext>` y actualiza
 * branding_json.logo_url con la URL pública.
 *
 * Límite 2 MB. Formatos: png, jpg, webp, svg.
 */
export async function POST(req: NextRequest) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", max_bytes: MAX_BYTES },
      { status: 413 },
    );
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "invalid_type", detail: Array.from(ALLOWED).join(", ") },
      { status: 400 },
    );
  }

  const ext = file.type.split("/")[1].replace("svg+xml", "svg").replace("jpeg", "jpg");
  const pathname = `tenant-branding/${session.user.tenant_id}/logo-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const uploaded = await put(pathname, bytes, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: true,
    allowOverwrite: false,
  });

  // Leer branding actual + sobreescribir logo_url
  const current = await getTenantBranding(session.user.tenant_id);
  const next = normalizeBranding({ ...current, logo_url: uploaded.url });
  await query(
    `UPDATE kyc_tenants SET branding_json = $2::jsonb, updated_at = NOW() WHERE id = $1`,
    [session.user.tenant_id, JSON.stringify(next)],
  );

  console.log(
    `${tag} uploaded tenant=${session.user.tenant_id} size=${bytes.length} url=${uploaded.url}`,
  );

  return NextResponse.json({ ok: true, logo_url: uploaded.url, branding: next });
}
