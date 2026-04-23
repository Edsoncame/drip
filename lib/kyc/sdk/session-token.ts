/**
 * Firma y verifica session tokens (JWT HS256) que el SDK lleva en
 * `Authorization: Bearer <token>` durante toda la captura.
 *
 * Distinto al JWT de sesión humana (lib/auth.ts): este token es de corta
 * duración (15 min default), single-purpose (no autentica al usuario del SDK
 * en la app — autentica una sesión KYC), y se firma con su propio secret
 * (KYC_SDK_SESSION_SECRET) para poder rotar sin tocar JWT_SECRET.
 *
 * Payload intencionalmente mínimo — solo lo que endpoint handler necesita
 * para leer la session row de DB. No metemos PII acá.
 */

import { SignJWT, jwtVerify } from "jose";

const DEFAULT_TTL_SECONDS = 15 * 60;

const secretRaw = process.env.KYC_SDK_SESSION_SECRET;
if (!secretRaw && process.env.NODE_ENV === "production") {
  throw new Error("KYC_SDK_SESSION_SECRET env var is required in production");
}
const SDK_SECRET = new TextEncoder().encode(
  secretRaw ?? "flux-kyc-sdk-dev-secret",
);

export interface SdkSessionTokenPayload {
  session_id: string;
  tenant_id: string;
}

export async function signSessionToken(
  payload: SdkSessionTokenPayload,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const token = await new SignJWT({
    session_id: payload.session_id,
    tenant_id: payload.tenant_id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer("flux-kyc")
    .setAudience("flux-kyc-sdk")
    .sign(SDK_SECRET);
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifySessionToken(
  token: string,
): Promise<SdkSessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SDK_SECRET, {
      issuer: "flux-kyc",
      audience: "flux-kyc-sdk",
    });
    if (
      typeof payload.session_id === "string" &&
      typeof payload.tenant_id === "string"
    ) {
      return {
        session_id: payload.session_id,
        tenant_id: payload.tenant_id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Extrae el token de un header `Authorization: Bearer <token>`. */
export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1].trim() : null;
}
