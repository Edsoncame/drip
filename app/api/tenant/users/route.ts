import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import type { DbTenantUser } from "@/lib/kyc/sdk/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/users]";

/** GET — lista users del tenant (solo del tenant propio). */
export async function GET() {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await query<DbTenantUser>(
    `SELECT * FROM kyc_tenant_users
     WHERE tenant_id = $1
     ORDER BY created_at ASC`,
    [session.user.tenant_id],
  );
  const safe = res.rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: u.active,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
    is_self: u.id === session.user.id,
  }));
  return NextResponse.json({ users: safe });
}

/**
 * DELETE — desactivar user. Body `{ user_id }`. No se pueden desactivar
 * a sí mismo (para evitar que un admin se locke out).
 */
export async function DELETE(req: NextRequest) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    user_id?: string;
  } | null;
  if (!body?.user_id) {
    return NextResponse.json({ error: "user_id_required" }, { status: 400 });
  }
  if (body.user_id === session.user.id) {
    return NextResponse.json(
      { error: "cannot_deactivate_self" },
      { status: 400 },
    );
  }
  const res = await query<{ id: string }>(
    `UPDATE kyc_tenant_users
       SET active = false, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING id`,
    [body.user_id, session.user.tenant_id],
  );
  if (res.rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  console.log(
    `${tag} deactivated tenant=${session.user.tenant_id} target=${body.user_id} by=${session.user.id}`,
  );
  return NextResponse.json({ ok: true });
}
