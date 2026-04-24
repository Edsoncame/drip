import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import {
  ensureSdkSchema,
  type DbTenantInvitation,
  type DbTenantUser,
} from "@/lib/kyc/sdk/schema";
import {
  signTenantSession,
  setTenantSessionCookie,
} from "@/lib/kyc/sdk/tenant-user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/invitations/accept]";

/**
 * POST público (sin auth). Acepta la invitación:
 *   1. Valida token + estado.
 *   2. Crea kyc_tenant_users row con password_hash bcrypt.
 *   3. Marca la invitación como accepted_at/by.
 *   4. Setea cookie de sesión → el usuario queda logueado.
 *
 * Race condition: dos POSTs simultáneos con el mismo token. La UNIQUE
 * constraint en email rechaza el segundo. Aceptable para MVP.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  await ensureSdkSchema();
  const { token } = await params;
  const body = (await req.json().catch(() => null)) as {
    password?: string;
    name?: string;
  } | null;

  if (!body?.password || body.password.length < 8) {
    return NextResponse.json(
      { error: "password_too_short", detail: "Mínimo 8 caracteres" },
      { status: 400 },
    );
  }
  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json(
      { error: "name_required" },
      { status: 400 },
    );
  }

  const invRes = await query<DbTenantInvitation>(
    `SELECT * FROM kyc_tenant_invitations WHERE token = $1 LIMIT 1`,
    [token],
  );
  const inv = invRes.rows[0];
  if (!inv) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (inv.accepted_at) {
    return NextResponse.json({ error: "already_accepted" }, { status: 409 });
  }
  if (inv.revoked_at) {
    return NextResponse.json({ error: "revoked" }, { status: 410 });
  }
  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);

  let user: DbTenantUser;
  try {
    const userRes = await query<DbTenantUser>(
      `INSERT INTO kyc_tenant_users (tenant_id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [inv.tenant_id, inv.email, passwordHash, body.name.trim(), inv.role],
    );
    user = userRes.rows[0];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // UNIQUE(email) — un race o el email se registró aparte entre invite + accept
    if (msg.toLowerCase().includes("unique")) {
      return NextResponse.json(
        { error: "email_taken" },
        { status: 409 },
      );
    }
    throw err;
  }

  await query(
    `UPDATE kyc_tenant_invitations
       SET accepted_at = NOW(), accepted_by = $2
     WHERE id = $1`,
    [inv.id, user.id],
  );

  const jwt = await signTenantSession({
    user_id: user.id,
    tenant_id: user.tenant_id,
    email: user.email,
  });
  await setTenantSessionCookie(jwt);

  console.log(
    `${tag} accepted tenant=${inv.tenant_id} email=${inv.email} user=${user.id}`,
  );

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenant_id: user.tenant_id,
    },
  });
}
