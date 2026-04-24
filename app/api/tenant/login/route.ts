import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { ensureSdkSchema, type DbTenantUser } from "@/lib/kyc/sdk/schema";
import {
  signTenantSession,
  setTenantSessionCookie,
} from "@/lib/kyc/sdk/tenant-user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/login]";

export async function POST(req: NextRequest) {
  await ensureSdkSchema();

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  if (!body?.email || !body.password) {
    return NextResponse.json(
      { error: "email y password requeridos" },
      { status: 400 },
    );
  }

  const email = body.email.trim().toLowerCase();

  const res = await query<DbTenantUser>(
    `SELECT * FROM kyc_tenant_users WHERE LOWER(email) = $1 AND active = true LIMIT 1`,
    [email],
  );
  const user = res.rows[0];

  // Siempre corremos bcrypt incluso si user no existe — anti-timing-leak.
  const hashToCompare =
    user?.password_hash ??
    "$2a$12$placeholderplaceholderplaceholderplaceholderplaceholderabc";

  let ok = false;
  try {
    ok = await bcrypt.compare(body.password, hashToCompare);
  } catch {
    ok = false;
  }

  if (!user || !ok) {
    console.warn(`${tag} fail email=${email}`);
    return NextResponse.json(
      { error: "Credenciales inválidas" },
      { status: 401 },
    );
  }

  await query(
    `UPDATE kyc_tenant_users SET last_login_at = NOW() WHERE id = $1`,
    [user.id],
  );

  const token = await signTenantSession({
    user_id: user.id,
    tenant_id: user.tenant_id,
    email: user.email,
  });
  await setTenantSessionCookie(token);

  console.log(`${tag} ok tenant=${user.tenant_id} user=${user.id}`);

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
