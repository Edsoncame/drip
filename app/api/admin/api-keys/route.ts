import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createApiKey, listApiKeys, revokeApiKey, ALL_SCOPES, type Scope } from "@/lib/api-keys";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[admin/api-keys]";

// GET — lista todas las API keys con info del usuario dueño
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await query<{
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    key_prefix: string;
    name: string;
    scopes: string[];
    rate_limit: number;
    last_used_at: Date | null;
    expires_at: Date | null;
    revoked_at: Date | null;
    created_at: Date;
    usage_count: string;
  }>(
    `SELECT k.id, k.user_id, u.name AS user_name, u.email AS user_email,
            k.key_prefix, k.name, k.scopes, k.rate_limit,
            k.last_used_at, k.expires_at, k.revoked_at, k.created_at,
            COALESCE((SELECT COUNT(*) FROM api_key_usage WHERE api_key_id = k.id), 0) AS usage_count
     FROM api_keys k
     JOIN users u ON u.id = k.user_id
     ORDER BY k.created_at DESC`,
  );

  return NextResponse.json({ data: res.rows });
}

// POST — crea nueva API key
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    user_id?: string;
    name?: string;
    scopes?: Scope[];
    rate_limit?: number;
    expires_in_days?: number;
  };
  if (!body.user_id || !body.name?.trim() || !Array.isArray(body.scopes) || body.scopes.length === 0) {
    return NextResponse.json({ error: "user_id, name, scopes requeridos" }, { status: 400 });
  }

  // Validar scopes
  for (const s of body.scopes) {
    if (!ALL_SCOPES.includes(s)) {
      return NextResponse.json({ error: `scope inválido: ${s}` }, { status: 400 });
    }
  }

  const expiresAt = body.expires_in_days
    ? new Date(Date.now() + body.expires_in_days * 86400_000)
    : null;

  const { row, plain } = await createApiKey({
    userId: body.user_id,
    name: body.name.trim(),
    scopes: body.scopes,
    rateLimit: body.rate_limit,
    expiresAt,
  });

  console.log(`${tag} ${session.email} creó key ${row.key_prefix} para user=${body.user_id}`);

  // IMPORTANTE: devolvemos el plain token UNA SOLA VEZ. El admin debe copiarlo ahora.
  return NextResponse.json({
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    scopes: row.scopes,
    rate_limit: row.rate_limit,
    expires_at: row.expires_at,
    plain_token: plain,
  }, { status: 201 });
}

// DELETE — revoca una key
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const userId = searchParams.get("user_id");
  if (!id || !userId) return NextResponse.json({ error: "id + user_id requeridos" }, { status: 400 });

  await revokeApiKey(id, userId);
  console.log(`${tag} ${session.email} revocó key ${id}`);
  return NextResponse.json({ ok: true });
}
