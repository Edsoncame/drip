import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import { generatePublishableKey } from "@/lib/kyc/sdk/publishable-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/embed-config]";
const MAX_ORIGINS = 20;

/**
 * GET — devuelve config actual (pk + allowed_origins) para render del UI.
 * La pk es pública → se puede devolver en plano. api_key_hash sigue bcrypt
 * aparte.
 */
export async function GET() {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await query<{
    publishable_key: string | null;
    allowed_origins: string[];
  }>(
    `SELECT publishable_key, allowed_origins FROM kyc_tenants WHERE id = $1 LIMIT 1`,
    [session.user.tenant_id],
  );
  const row = res.rows[0];
  return NextResponse.json({
    publishable_key: row?.publishable_key ?? null,
    allowed_origins: row?.allowed_origins ?? [],
  });
}

/**
 * POST — acciones:
 *   { action: 'rotate_pk' }           → regenera pk (invalida la anterior)
 *   { action: 'set_origins', origins: [...] } → reemplaza el array completo
 *   { action: 'ensure_pk' }           → genera pk si no existe (idempotente)
 */
export async function POST(req: NextRequest) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { action: "rotate_pk" | "ensure_pk" }
    | { action: "set_origins"; origins: string[] }
    | null;
  if (!body?.action) {
    return NextResponse.json({ error: "action_required" }, { status: 400 });
  }

  if (body.action === "rotate_pk" || body.action === "ensure_pk") {
    if (body.action === "ensure_pk") {
      const existing = await query<{ publishable_key: string | null }>(
        `SELECT publishable_key FROM kyc_tenants WHERE id = $1`,
        [session.user.tenant_id],
      );
      if (existing.rows[0]?.publishable_key) {
        return NextResponse.json({
          ok: true,
          publishable_key: existing.rows[0].publishable_key,
          rotated: false,
        });
      }
    }
    const newPk = generatePublishableKey(session.user.tenant_id);
    await query(
      `UPDATE kyc_tenants SET publishable_key = $2, updated_at = NOW() WHERE id = $1`,
      [session.user.tenant_id, newPk],
    );
    console.log(
      `${tag} ${body.action} tenant=${session.user.tenant_id} by=${session.user.id}`,
    );
    return NextResponse.json({ ok: true, publishable_key: newPk, rotated: true });
  }

  if (body.action === "set_origins") {
    if (!Array.isArray(body.origins)) {
      return NextResponse.json({ error: "origins_must_be_array" }, { status: 400 });
    }
    if (body.origins.length > MAX_ORIGINS) {
      return NextResponse.json(
        { error: "too_many_origins", max: MAX_ORIGINS },
        { status: 400 },
      );
    }
    // Validar cada origin: URL válido, https o http con localhost.
    const normalized: string[] = [];
    for (const o of body.origins) {
      const trimmed = typeof o === "string" ? o.trim().replace(/\/+$/, "") : "";
      if (!trimmed) continue;
      try {
        const u = new URL(trimmed);
        const isHttps = u.protocol === "https:";
        const isLocalhost =
          u.protocol === "http:" &&
          (u.hostname === "localhost" || u.hostname === "127.0.0.1");
        if (!isHttps && !isLocalhost) {
          return NextResponse.json(
            {
              error: "invalid_origin",
              detail: `"${trimmed}" — usá https:// (o http://localhost para dev)`,
            },
            { status: 400 },
          );
        }
        // Normalizar a scheme://host[:port] sin path ni trailing slash
        normalized.push(`${u.protocol}//${u.host}`);
      } catch {
        return NextResponse.json(
          { error: "invalid_url", detail: `"${trimmed}" no es URL válida` },
          { status: 400 },
        );
      }
    }
    const dedup = Array.from(new Set(normalized));
    await query(
      `UPDATE kyc_tenants SET allowed_origins = $2, updated_at = NOW() WHERE id = $1`,
      [session.user.tenant_id, dedup],
    );
    console.log(
      `${tag} set_origins tenant=${session.user.tenant_id} count=${dedup.length}`,
    );
    return NextResponse.json({ ok: true, allowed_origins: dedup });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
