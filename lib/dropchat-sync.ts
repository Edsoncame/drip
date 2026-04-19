/**
 * Drop Chat — Sync de contactos desde Flux.
 *
 * Push users + info derivada de subscriptions/payments al endpoint de Drop Chat.
 * Drop Chat matchea por `external_id` (canónico users.id UUID) — si el cliente
 * cambia de teléfono, seguimos al mismo contacto.
 *
 * Envs:
 *   DROPCHAT_API_KEY  (requerido — se pega como X-API-Key)
 *   DROPCHAT_API_URL  (opcional — default omni-platform-api-production.up.railway.app)
 */

import { query } from "@/lib/db";

const API_URL =
  process.env.DROPCHAT_API_URL?.replace(/\/$/, "") ??
  "https://omni-platform-api-production.up.railway.app";

const tag = "[dropchat-sync]";

export interface DropchatContact {
  phone: string;
  name: string;
  email: string | null;
  external_id: string;
  segment_name?: string;
  classification?: "VIP" | "premium" | "regular" | "nuevo";
  ltv?: number;
  action_key_count?: number;
  action_key_last_at?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
}

/**
 * Fila que sacamos de la BD para construir el payload.
 */
interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  ruc: string | null;
  legal_name: string | null;
  dni_number: string | null;
  kyc_status: string | null;
  identity_verified: boolean | null;
  created_at: Date;
  subs_count: string;
  active_subs_count: string;
  total_ltv_usd: string;
  last_sub_started_at: Date | null;
  last_payment_method: string | null;
}

async function loadUsers(userIds?: string[]): Promise<UserRow[]> {
  const hasFilter = userIds && userIds.length > 0;
  const extraWhere = hasFilter ? "AND u.id = ANY($1::uuid[])" : "";
  const vals: unknown[] = hasFilter ? [userIds] : [];
  const res = await query<UserRow>(
    `SELECT u.id, u.name, u.email, u.phone, u.company, u.ruc, u.legal_name,
            u.dni_number, u.kyc_status, u.identity_verified, u.created_at,
            COALESCE((SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id), 0) AS subs_count,
            COALESCE((SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id AND s.status IN ('preparing','shipped','delivered','active')), 0) AS active_subs_count,
            COALESCE((SELECT SUM(p.amount::numeric) FROM payments p WHERE p.user_id = u.id AND p.status = 'validated'), 0) AS total_ltv_usd,
            (SELECT MAX(s.started_at) FROM subscriptions s WHERE s.user_id = u.id) AS last_sub_started_at,
            (SELECT s.payment_method FROM subscriptions s WHERE s.user_id = u.id ORDER BY s.started_at DESC LIMIT 1) AS last_payment_method
     FROM users u
     WHERE COALESCE(u.is_admin, false) = false
       ${extraWhere}`,
    vals,
  );
  return res.rows;
}

/**
 * Clasifica al cliente según LTV acumulado.
 */
function classify(ltv: number, activeSubs: number): DropchatContact["classification"] {
  if (ltv >= 10_000) return "VIP";
  if (ltv >= 2_000) return "premium";
  if (activeSubs > 0) return "regular";
  return "nuevo";
}

function segmentOf(row: UserRow): string {
  if (row.company && row.ruc) return "B2B";
  if (parseInt(row.active_subs_count, 10) > 0) return "Cliente activo";
  if (row.identity_verified) return "KYC verificado";
  return "Lead";
}

function tagsOf(row: UserRow): string[] {
  const tags: string[] = [];
  if (row.identity_verified) tags.push("kyc-verified");
  if (row.kyc_status) tags.push(`kyc-${row.kyc_status}`);
  if (row.last_payment_method === "stripe") tags.push("online");
  if (row.last_payment_method === "transferencia") tags.push("offline-b2b");
  if (parseInt(row.active_subs_count, 10) > 0) tags.push("renting");
  if (row.company) tags.push("empresa");
  return tags;
}

/**
 * Normaliza phone a formato E.164 (+51... para PE). Drop Chat ya
 * normaliza internamente pero enviamos en formato correcto.
 */
function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("51") && digits.length === 11) return `+${digits}`;
  if (digits.length === 9) return `+51${digits}`;
  return digits.startsWith("00") ? `+${digits.slice(2)}` : `+${digits}`;
}

/**
 * Convierte un UserRow al payload Drop Chat.
 */
export function toContact(row: UserRow): DropchatContact | null {
  const phone = normalizePhone(row.phone);
  if (!phone) return null; // Drop Chat requiere phone — skip users sin teléfono

  const ltv = parseFloat(row.total_ltv_usd ?? "0") || 0;
  const activeSubs = parseInt(row.active_subs_count, 10) || 0;
  const totalSubs = parseInt(row.subs_count, 10) || 0;

  return {
    phone,
    name: row.name,
    email: row.email,
    external_id: row.id, // UUID canónico Flux — Drop Chat matchea por este campo
    segment_name: segmentOf(row),
    classification: classify(ltv, activeSubs),
    ltv,
    action_key_count: totalSubs,
    action_key_last_at: row.last_sub_started_at
      ? row.last_sub_started_at.toISOString()
      : undefined,
    tags: tagsOf(row),
    custom_fields: {
      legal_name: row.legal_name,
      dni: row.dni_number,
      ruc: row.ruc,
      company: row.company,
      kyc_status: row.kyc_status,
      identity_verified: row.identity_verified,
      active_subs: activeSubs,
      source: "flux",
      created_at: row.created_at.toISOString(),
    },
  };
}

/**
 * Envía un único contacto. Usa /api/v1/sync/contact.
 */
export async function syncContact(userId: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.DROPCHAT_API_KEY;
  if (!apiKey) return { ok: false, error: "DROPCHAT_API_KEY no seteado" };

  const users = await loadUsers([userId]);
  if (users.length === 0) return { ok: false, error: "user not found" };
  const contact = toContact(users[0]);
  if (!contact) return { ok: false, error: "user sin phone válido" };

  try {
    const res = await fetch(`${API_URL}/api/v1/sync/contact`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contact),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    console.log(`${tag} synced user=${userId} phone=${contact.phone}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fire-and-forget. Para usar en route handlers después de cualquier write:
 *   - Crear user → fireSyncToDropchat(userId)
 *   - Update sub / payment / kyc → fireSyncToDropchat(sub.user_id)
 *
 * Nunca throws ni bloquea. Si no hay API key o Drop Chat está caído,
 * loguea warning y sigue. El cron nocturno compensa los fails.
 *
 * Ideal: envolver en `after(() => fireSyncToDropchat(id))` para que corra
 * después de enviar la response al cliente.
 */
export function fireSyncToDropchat(userId: string): Promise<void> {
  if (!process.env.DROPCHAT_API_KEY) return Promise.resolve();
  return syncContact(userId)
    .then((r) => {
      if (!r.ok) console.warn(`${tag} fire sync user=${userId} err=${r.error}`);
    })
    .catch((err) => {
      console.warn(`${tag} fire sync user=${userId} error`, err);
    });
}

/**
 * Igual que fireSyncToDropchat pero recibe subscription.id. Resuelve el
 * user_id antes de sincronizar — útil cuando el handler tiene la sub pero
 * no directamente el user.
 */
export async function fireSyncFromSubscription(subId: string): Promise<void> {
  if (!process.env.DROPCHAT_API_KEY) return;
  try {
    const res = await query<{ user_id: string }>(
      `SELECT user_id FROM subscriptions WHERE id = $1 AND user_id IS NOT NULL LIMIT 1`,
      [subId],
    );
    const userId = res.rows[0]?.user_id;
    if (userId) await fireSyncToDropchat(userId);
  } catch (err) {
    console.warn(`${tag} fire-from-sub ${subId}`, err);
  }
}

/**
 * Batch sync de todos (o un subset) de users. Usa /api/v1/sync/contacts.
 * Divide en chunks de 5000 (límite de Drop Chat).
 */
export async function syncAllContacts(opts?: {
  userIds?: string[];
  batchSize?: number;
}): Promise<{
  ok: boolean;
  total: number;
  synced: number;
  skipped: number;
  errors: Array<{ batch: number; error: string }>;
}> {
  const apiKey = process.env.DROPCHAT_API_KEY;
  if (!apiKey) {
    return { ok: false, total: 0, synced: 0, skipped: 0, errors: [{ batch: 0, error: "DROPCHAT_API_KEY no seteado" }] };
  }

  const batchSize = Math.min(opts?.batchSize ?? 500, 5000);
  const users = await loadUsers(opts?.userIds);

  const contacts: DropchatContact[] = [];
  let skipped = 0;
  for (const u of users) {
    const c = toContact(u);
    if (c) contacts.push(c);
    else skipped++;
  }

  const errors: Array<{ batch: number; error: string }> = [];
  let synced = 0;

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    try {
      const res = await fetch(`${API_URL}/api/v1/sync/contacts`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contacts: batch }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        errors.push({ batch: i / batchSize, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` });
        continue;
      }
      synced += batch.length;
      console.log(`${tag} batch ${i / batchSize + 1} · ${batch.length} contactos OK`);
    } catch (err) {
      errors.push({ batch: i / batchSize, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    ok: errors.length === 0,
    total: users.length,
    synced,
    skipped,
    errors,
  };
}
