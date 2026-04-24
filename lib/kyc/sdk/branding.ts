/**
 * Branding del tenant — se aplica al hosted web flow (`/kyc/s/[session]`).
 *
 * Paralelo a lo que hace Truora con "Brand Theme": el tenant sube logo,
 * elige colores, y el flow de captura se muestra con su identidad en vez
 * de la nuestra. Reduce fricción perceptual del usuario final ("¿por qué
 * estoy en otra marca?").
 *
 * Almacenado en `kyc_tenants.branding_json` como JSONB. Si el tenant no
 * tiene nada, usamos los defaults `DEFAULT_BRANDING` (paleta Flux).
 */

import { query } from "../../db";
import { ensureSdkSchema } from "./schema";

export interface BrandingTokens {
  logo_url: string | null;
  brand_name: string;
  primary_color: string;      // hex, botones + highlights
  background_color: string;   // hex, fondo de la página
  text_color: string;         // hex, texto principal
  muted_text_color: string;   // hex, texto secundario
  welcome_message: string | null;
}

export const DEFAULT_BRANDING: BrandingTokens = {
  logo_url: null,
  brand_name: "Flux KYC",
  primary_color: "#FFFFFF",
  background_color: "#000000",
  text_color: "#FFFFFF",
  muted_text_color: "#FFFFFF99", // white/60
  welcome_message: null,
};

/**
 * Valida que `raw` sea un hex válido `#RRGGBB` o `#RRGGBBAA`. Devuelve null
 * si no matchea — el caller decide si cae a default o rechaza.
 */
export function validateHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(s) || /^#[0-9A-F]{8}$/.test(s)) return s;
  return null;
}

/**
 * Normaliza un branding proveniente del front-end / DB, aplicando defaults
 * para cada field inválido o ausente. Nunca tira — siempre devuelve un
 * BrandingTokens válido.
 */
export function normalizeBranding(raw: unknown): BrandingTokens {
  const input = (raw as Record<string, unknown> | null) ?? {};
  return {
    logo_url:
      typeof input.logo_url === "string" && input.logo_url.startsWith("https://")
        ? input.logo_url
        : DEFAULT_BRANDING.logo_url,
    brand_name:
      typeof input.brand_name === "string" && input.brand_name.trim().length > 0
        ? input.brand_name.trim().slice(0, 60)
        : DEFAULT_BRANDING.brand_name,
    primary_color:
      validateHex(input.primary_color) ?? DEFAULT_BRANDING.primary_color,
    background_color:
      validateHex(input.background_color) ?? DEFAULT_BRANDING.background_color,
    text_color:
      validateHex(input.text_color) ?? DEFAULT_BRANDING.text_color,
    muted_text_color:
      validateHex(input.muted_text_color) ?? DEFAULT_BRANDING.muted_text_color,
    welcome_message:
      typeof input.welcome_message === "string" &&
      input.welcome_message.trim().length > 0
        ? input.welcome_message.trim().slice(0, 200)
        : DEFAULT_BRANDING.welcome_message,
  };
}

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

/**
 * Serializa los tokens a CSS variables inyectables inline:
 *   --flux-primary, --flux-bg, --flux-text, --flux-muted
 * El consumer las usa con `style={{ backgroundColor: "var(--flux-bg)" }}`.
 */
export function brandingToCssVars(b: BrandingTokens): Record<string, string> {
  return {
    "--flux-primary": b.primary_color,
    "--flux-bg": b.background_color,
    "--flux-text": b.text_color,
    "--flux-muted": b.muted_text_color,
  };
}
