/**
 * Autenticación de tenants del SDK.
 *
 * Header esperado: `Authorization: Bearer <tenant_id>:<secret>`
 *
 * Preferimos el formato colon-separado en un solo header (patrón Basic Auth)
 * para que los SDKs solo tengan que setear uno. tenant_id no es secreto —
 * es como un "client_id" público; el secret sí.
 *
 * El secret se compara contra `kyc_tenants.api_key_hash` (bcrypt).
 */

import bcrypt from "bcryptjs";
import { query } from "../../db";
import { extractBearer } from "./session-token";
import type { DbSdkTenant } from "./schema";

export interface AuthenticatedTenant {
  tenant: DbSdkTenant;
}

export type TenantLookupFn = (
  tenantId: string,
) => Promise<DbSdkTenant | null>;

const defaultLookup: TenantLookupFn = async (tenantId) => {
  const res = await query<DbSdkTenant>(
    `SELECT * FROM kyc_tenants WHERE id = $1 AND active = true LIMIT 1`,
    [tenantId],
  );
  return res.rows[0] ?? null;
};

export async function authenticateTenant(
  authHeader: string | null | undefined,
  lookupFn: TenantLookupFn = defaultLookup,
): Promise<AuthenticatedTenant | null> {
  const bearer = extractBearer(authHeader);
  if (!bearer) return null;

  const idx = bearer.indexOf(":");
  if (idx < 1 || idx >= bearer.length - 1) return null;
  const tenantId = bearer.slice(0, idx).trim();
  const secret = bearer.slice(idx + 1).trim();
  if (!tenantId || !secret) return null;

  const tenant = await lookupFn(tenantId);
  if (!tenant) return null;

  try {
    const ok = await bcrypt.compare(secret, tenant.api_key_hash);
    if (!ok) return null;
  } catch {
    return null;
  }

  return { tenant };
}
