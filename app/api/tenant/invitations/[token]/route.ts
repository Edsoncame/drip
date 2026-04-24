import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  ensureSdkSchema,
  type DbTenantInvitation,
} from "@/lib/kyc/sdk/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET público (SIN auth) — devuelve info mínima de la invitación para que
 * la página /tenant/accept/[token] la muestre. Solo expone:
 *   - tenant_id, tenant_name, email (ya acordados al crear la invite)
 *   - role, expires_at
 *   - estado: valid | expired | accepted | revoked | not_found
 * No devuelve created_by ni token.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  await ensureSdkSchema();
  const { token } = await params;
  if (!token || token.length < 30) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const res = await query<
    DbTenantInvitation & { tenant_name: string }
  >(
    `SELECT i.*, t.name AS tenant_name
     FROM kyc_tenant_invitations i
     JOIN kyc_tenants t ON t.id = i.tenant_id
     WHERE i.token = $1 LIMIT 1`,
    [token],
  );
  const inv = res.rows[0];
  if (!inv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let state: "valid" | "expired" | "accepted" | "revoked" = "valid";
  if (inv.accepted_at) state = "accepted";
  else if (inv.revoked_at) state = "revoked";
  else if (new Date(inv.expires_at) < new Date()) state = "expired";

  return NextResponse.json({
    state,
    email: inv.email,
    role: inv.role,
    tenant_id: inv.tenant_id,
    tenant_name: inv.tenant_name,
    expires_at: inv.expires_at,
  });
}

/**
 * DELETE — revocar invitación. Solo el tenant dueño la puede revocar.
 * Usa la sesión del admin que está logueado.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { getTenantSession } = await import("@/lib/kyc/sdk/tenant-user-auth");
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { token } = await params;
  const res = await query<{ id: string }>(
    `UPDATE kyc_tenant_invitations
       SET revoked_at = NOW()
     WHERE token = $1
       AND tenant_id = $2
       AND accepted_at IS NULL
       AND revoked_at IS NULL
     RETURNING id`,
    [token, session.user.tenant_id],
  );
  if (res.rows.length === 0) {
    return NextResponse.json(
      { error: "not_found_or_already_closed" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
