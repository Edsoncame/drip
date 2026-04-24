import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import type { DbTenantInvitation } from "@/lib/kyc/sdk/schema";
import { sendTenantInviteEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const tag = "[tenant/invitations/resend]";

/**
 * POST — reenvía el email de una invitación existente. Útil cuando Resend
 * rebotó (domain bounce, typo en email corregido fuera de banda, etc.).
 * Solo funciona si la invitación sigue viva (no accepted/revoked/expired).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { token } = await params;

  const res = await query<
    DbTenantInvitation & { tenant_name: string; inviter_name: string | null }
  >(
    `SELECT i.*, t.name AS tenant_name, u.name AS inviter_name
     FROM kyc_tenant_invitations i
     JOIN kyc_tenants t ON t.id = i.tenant_id
     LEFT JOIN kyc_tenant_users u ON u.id = i.created_by
     WHERE i.token = $1 AND i.tenant_id = $2 LIMIT 1`,
    [token, session.user.tenant_id],
  );
  const inv = res.rows[0];
  if (!inv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (inv.accepted_at) {
    return NextResponse.json({ error: "already_accepted" }, { status: 409 });
  }
  if (inv.revoked_at) {
    return NextResponse.json({ error: "revoked" }, { status: 409 });
  }
  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const host = req.headers.get("host") ?? "www.fluxperu.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const acceptUrl = `${proto}://${host}/tenant/accept/${inv.token}`;

  try {
    await sendTenantInviteEmail({
      to: inv.email,
      inviterName: inv.inviter_name ?? session.user.email,
      tenantName: inv.tenant_name,
      acceptUrl,
      expiresAt: new Date(inv.expires_at),
    });
    await query(
      `UPDATE kyc_tenant_invitations SET emailed_at = NOW(), emailed_error = NULL WHERE id = $1`,
      [inv.id],
    );
    console.log(`${tag} resent tenant=${inv.tenant_id} email=${inv.email}`);
    return NextResponse.json({ ok: true, email_sent: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
    await query(
      `UPDATE kyc_tenant_invitations SET emailed_error = $2 WHERE id = $1`,
      [inv.id, msg],
    );
    console.error(`${tag} resend failed tenant=${inv.tenant_id} email=${inv.email}:`, msg);
    return NextResponse.json({ ok: false, email_error: msg }, { status: 500 });
  }
}
