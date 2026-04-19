import crypto from "node:crypto";
import { query } from "@/lib/db";
import type { NextRequest } from "next/server";

/**
 * API Keys para acceso B2B a `/api/v1/*`.
 *
 * Formato: `flk_live_<32 chars random>`
 *   - `flk_` prefix identifica el proyecto (FLUX)
 *   - `live_` vs `test_` (futuro: keys de testing)
 *   - 32 chars random base62
 *
 * Guardamos solo el hash SHA-256 en la BD. El plain token se muestra
 * UNA SOLA VEZ al crear la key. Si el usuario lo pierde, tiene que regenerar.
 */

export interface ApiKeyRow {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export type Scope =
  | "subscriptions:read"
  | "payments:read"
  | "invoices:read"
  | "users:read:self";

export const ALL_SCOPES: Scope[] = [
  "subscriptions:read",
  "payments:read",
  "invoices:read",
  "users:read:self",
];

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function generatePlainKey(): { plain: string; prefix: string } {
  // 32 chars random — base62 vía base64url (quita padding y símbolos)
  const rand = crypto.randomBytes(24).toString("base64url").slice(0, 32);
  const plain = `flk_live_${rand}`;
  const prefix = plain.slice(0, 12); // "flk_live_abc" → mostrable en UI
  return { plain, prefix };
}

export async function createApiKey(opts: {
  userId: string;
  name: string;
  scopes: Scope[];
  rateLimit?: number;
  expiresAt?: Date | null;
}): Promise<{ row: ApiKeyRow; plain: string }> {
  const { plain, prefix } = generatePlainKey();
  const hash = sha256(plain);
  const res = await query<ApiKeyRow>(
    `INSERT INTO api_keys (user_id, key_hash, key_prefix, name, scopes, rate_limit, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [opts.userId, hash, prefix, opts.name, opts.scopes, opts.rateLimit ?? 120, opts.expiresAt ?? null],
  );
  return { row: res.rows[0], plain };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const res = await query<ApiKeyRow>(
    `SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return res.rows;
}

export async function revokeApiKey(id: string, userId: string): Promise<void> {
  await query(
    `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [id, userId],
  );
}

/**
 * Valida un request contra la tabla api_keys.
 * - Lee Authorization: Bearer <plain>
 * - Hashea con SHA-256 y busca en BD
 * - Verifica que no esté revocada ni expirada
 * - Verifica scope requerido
 * - Actualiza last_used_at
 * - Registra uso en api_key_usage
 *
 * Devuelve la row o un error.
 */
export async function authenticateApiKey(
  req: NextRequest,
  requiredScope: Scope,
): Promise<
  | { ok: true; apiKey: ApiKeyRow }
  | { ok: false; status: number; error: string }
> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }
  const plain = auth.slice(7).trim();
  if (!plain.startsWith("flk_")) {
    return { ok: false, status: 401, error: "Invalid token format" };
  }

  const hash = sha256(plain);
  const res = await query<ApiKeyRow>(
    `SELECT * FROM api_keys WHERE key_hash = $1 LIMIT 1`,
    [hash],
  );
  const row = res.rows[0];
  if (!row) return { ok: false, status: 401, error: "Invalid token" };
  if (row.revoked_at) return { ok: false, status: 401, error: "Token revoked" };
  if (row.expires_at && row.expires_at.getTime() < Date.now()) {
    return { ok: false, status: 401, error: "Token expired" };
  }
  if (!row.scopes.includes(requiredScope)) {
    return {
      ok: false,
      status: 403,
      error: `Token missing scope: ${requiredScope}. Available: ${row.scopes.join(", ")}`,
    };
  }

  // Touch last_used + log (sin await — fire & forget)
  query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => {});
  const endpoint = new URL(req.url).pathname;
  query(
    `INSERT INTO api_key_usage (api_key_id, endpoint, method, status_code) VALUES ($1,$2,$3,200)`,
    [row.id, endpoint, req.method],
  ).catch(() => {});

  return { ok: true, apiKey: row };
}
