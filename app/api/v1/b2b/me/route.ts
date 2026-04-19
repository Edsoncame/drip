import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/b2b/me
 * Scope: users:read:self
 *
 * Devuelve la info del dueño de la API key (perfil básico + contadores).
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "users:read:self");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const res = await query<{
    id: string;
    name: string;
    email: string;
    company: string | null;
    ruc: string | null;
    created_at: Date;
    active_subs: string;
    total_subs: string;
  }>(
    `SELECT u.id, u.name, u.email, u.company, u.ruc, u.created_at,
            (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id AND s.status IN ('preparing','shipped','delivered','active')) AS active_subs,
            (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id) AS total_subs
     FROM users u WHERE u.id = $1`,
    [auth.apiKey.user_id],
  );

  const u = res.rows[0];
  if (!u) return NextResponse.json({ error: "user not found" }, { status: 404 });

  return NextResponse.json({
    id: u.id,
    name: u.name,
    email: u.email,
    company: u.company,
    ruc: u.ruc,
    member_since: u.created_at,
    subscriptions: {
      active: parseInt(u.active_subs, 10),
      total: parseInt(u.total_subs, 10),
    },
    api_key: {
      name: auth.apiKey.name,
      prefix: auth.apiKey.key_prefix,
      scopes: auth.apiKey.scopes,
      rate_limit: auth.apiKey.rate_limit,
    },
  });
}
