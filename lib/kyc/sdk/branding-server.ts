/**
 * Reader server-only del branding. Separado de `branding.ts` porque importa
 * `query` que transitivamente incluye `pg`, incompatible con client bundles
 * de Next.js/Turbopack.
 *
 * IMPORTAR SOLO desde server components, route handlers, o scripts.
 * Los client components deben importar DEFAULT_BRANDING + types de
 * `./branding` y recibir el branding resuelto como prop.
 */

import { query } from "../../db";
import { ensureSdkSchema } from "./schema";
import {
  DEFAULT_BRANDING,
  normalizeBranding,
  type BrandingTokens,
} from "./branding";

/** Lee el branding del tenant desde DB, con defaults como fallback. */
export async function getTenantBranding(tenantId: string): Promise<BrandingTokens> {
  await ensureSdkSchema();
  const res = await query<{ branding_json: unknown }>(
    `SELECT branding_json FROM kyc_tenants WHERE id = $1 LIMIT 1`,
    [tenantId],
  );
  if (res.rows.length === 0) return DEFAULT_BRANDING;
  return normalizeBranding(res.rows[0].branding_json);
}
