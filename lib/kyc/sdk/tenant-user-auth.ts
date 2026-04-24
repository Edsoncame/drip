/**
 * Autenticación del usuario humano del dashboard del tenant.
 *
 * Paralelo a `lib/auth.ts` (que autentica users de Flux) pero SEPARADO:
 *   - Tabla distinta: `kyc_tenant_users` vs `users`
 *   - Cookie distinta: `flux_tenant_session` vs `flux_session`
 *   - Secret distinto: `KYC_TENANT_SESSION_SECRET` vs `JWT_SECRET`
 *
 * Razón: el tenant NO es user de Flux. Mezclar las tablas abriría la
 * posibilidad de que un tenant compromised acceda al admin de Flux, o al
 * revés. Separación estricta = menos superficie de ataque.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "../../db";
import { ensureSdkSchema, type DbTenantUser } from "./schema";

const COOKIE_NAME = "flux_tenant_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

const secretRaw = process.env.KYC_TENANT_SESSION_SECRET;
if (!secretRaw && process.env.NODE_ENV === "production") {
  throw new Error("KYC_TENANT_SESSION_SECRET env var is required in production");
}
const SECRET = new TextEncoder().encode(
  secretRaw ?? "flux-tenant-dev-secret-only-local",
);

export interface TenantSessionPayload {
  user_id: string;
  tenant_id: string;
  email: string;
}

export async function signTenantSession(
  payload: TenantSessionPayload,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + MAX_AGE_SECONDS)
    .setIssuer("flux-tenant")
    .setAudience("flux-tenant-dashboard")
    .sign(SECRET);
}

export async function verifyTenantSession(
  token: string,
): Promise<TenantSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, {
      issuer: "flux-tenant",
      audience: "flux-tenant-dashboard",
    });
    if (
      typeof payload.user_id === "string" &&
      typeof payload.tenant_id === "string" &&
      typeof payload.email === "string"
    ) {
      return {
        user_id: payload.user_id,
        tenant_id: payload.tenant_id,
        email: payload.email,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Setea la cookie httpOnly con el JWT. Llamar desde el route handler de login. */
export async function setTenantSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearTenantSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/**
 * Lee el JWT de la cookie y busca el user en DB. Devuelve null si no hay
 * sesión válida o el user fue desactivado.
 *
 * Usarlo desde server components `/tenant/*` para enforce auth.
 */
export async function getTenantSession(): Promise<
  { user: DbTenantUser; payload: TenantSessionPayload } | null
> {
  await ensureSdkSchema();
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyTenantSession(token);
  if (!payload) return null;
  const res = await query<DbTenantUser>(
    `SELECT * FROM kyc_tenant_users WHERE id = $1 AND active = true LIMIT 1`,
    [payload.user_id],
  );
  const user = res.rows[0];
  if (!user) return null;
  return { user, payload };
}
