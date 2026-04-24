/**
 * Publishable key del tenant — pattern Stripe (pk_live_...).
 *
 * Se pega en HTML público del cliente como atributo data-*. NO es secreto:
 * la seguridad real viene del whitelist de `allowed_origins` que verificamos
 * en cada llamada a `/api/kyc/embed/session`. Sin origin permitido, la pk
 * sola no sirve.
 *
 * Formato: `pk_<tenant_id>_<48 hex chars>` — el prefijo tenant_id simplifica
 * el lookup (extraemos tenant_id antes de hitear DB para rate-limit eficiente).
 */

import { randomBytes } from "node:crypto";

export function generatePublishableKey(tenantId: string): string {
  const suffix = randomBytes(24).toString("hex"); // 48 hex chars = 192 bits
  return `pk_${tenantId}_${suffix}`;
}

/**
 * Parsea el tenant_id de una pk. Retorna null si el formato no matchea.
 * NO valida contra DB — solo el shape. El caller hace el lookup real.
 */
export function parseTenantIdFromPk(pk: string): string | null {
  const m = /^pk_([a-zA-Z0-9_-]+)_[0-9a-f]{48}$/.exec(pk);
  return m ? m[1] : null;
}

/**
 * True si `origin` está en `allowedOrigins` con match exacto del host
 * (incluye scheme + optional port). Ejemplo: 'https://securex.pe' matchea
 * solo 'https://securex.pe', NO 'http://securex.pe' ni 'https://www.securex.pe'.
 * El tenant debe agregar cada variante a su whitelist.
 */
export function isOriginAllowed(
  origin: string | null | undefined,
  allowed: string[],
): boolean {
  if (!origin || allowed.length === 0) return false;
  // Normalizar removiendo trailing slash
  const normalize = (s: string) => s.trim().replace(/\/+$/, "");
  const o = normalize(origin);
  return allowed.some((a) => normalize(a) === o);
}
