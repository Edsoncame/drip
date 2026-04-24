import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import type { DbTenantInvitation } from "@/lib/kyc/sdk/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/invitations]";
const TTL_DAYS = 7;

/** GET — lista invitaciones pendientes + los últimos 20 aceptados/revocados. */
export async function GET() {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await query<DbTenantInvitation>(
    `SELECT * FROM kyc_tenant_invitations
     WHERE tenant_id = $1
     ORDER BY
       CASE WHEN accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW() THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT 50`,
    [session.user.tenant_id],
  );
  // Devolvemos token truncado (primeros 12 chars) para preview en UI sin
  // exponer el token completo en GET — solo el POST response lo devuelve.
  const safe = res.rows.map((r) => ({
    ...r,
    token: r.token.slice(0, 12) + "…",
  }));
  return NextResponse.json({ invitations: safe });
}

/** POST — crear invitación. Devuelve URL con token plano UNA VEZ. */
export async function POST(req: NextRequest) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    role?: string;
  } | null;
  if (!body?.email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // El usuario target ya existe? (en cualquier tenant — email es UNIQUE global)
  const existing = await query<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM kyc_tenant_users WHERE LOWER(email) = $1 LIMIT 1`,
    [email],
  );
  if (existing.rows[0]) {
    return NextResponse.json(
      {
        error: "email_already_user",
        detail: "Ese email ya pertenece a un user (del mismo o otro tenant)",
      },
      { status: 409 },
    );
  }

  const role = body.role === "viewer" ? "viewer" : "admin";
  const token = randomBytes(32).toString("hex"); // 64 chars hex = 256 bits
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86400 * 1000);

  const ins = await query<DbTenantInvitation>(
    `INSERT INTO kyc_tenant_invitations
       (tenant_id, email, token, role, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [session.user.tenant_id, email, token, role, session.user.id, expiresAt.toISOString()],
  );

  // Construir URL absoluta. Usamos el Host header del request para matchear
  // el dominio desde el cual corrió el dashboard (www vs apex).
  const host = req.headers.get("host") ?? "www.fluxperu.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const acceptUrl = `${proto}://${host}/tenant/accept/${token}`;

  console.log(
    `${tag} created tenant=${session.user.tenant_id} email=${email} by=${session.user.id}`,
  );

  return NextResponse.json({
    ok: true,
    invitation: { ...ins.rows[0], token: token.slice(0, 12) + "…" },
    accept_url: acceptUrl, // mostrar UNA vez en la UI
    expires_at: expiresAt.toISOString(),
  });
}
