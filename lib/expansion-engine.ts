/**
 * Account Expansion Engine
 * ------------------------
 * Detecta oportunidades de upsell/expansión sobre la base de clientes activos.
 *
 * Corre una sola query agregada sobre `users` + `subscriptions` + `payments`,
 * computa un score 0-100 por cliente a partir de 8 señales, y deriva una
 * "play" concreta (UPGRADE_TIER, BUNDLE_IPAD, ADD_SEAT, TIER_REFRESH, CHECK_IN).
 *
 * Diseño:
 * - Puro: `computeOpportunities()` solo lee. `persistOpportunities()` escribe.
 * - Idempotente: el upsert se apoya en un índice UNIQUE PARCIAL
 *   `uniq_open_exp_opp (user_id, play_type) WHERE status IN (...abiertas...)`
 *   → nunca duplica oportunidades ABIERTAS del mismo par (usuario, play_type),
 *     pero permite que un cliente con una oportunidad `won`/`lost`/`snoozed`
 *     pueda volver a tener una nueva oportunidad del mismo tipo más adelante.
 * - No requiere env vars ni dependencias nuevas.
 *
 * Para que esto funcione hay que ejecutar en Railway (una sola vez):
 *
 *   CREATE TABLE IF NOT EXISTS expansion_opportunities (
 *     id                  BIGSERIAL PRIMARY KEY,
 *     user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *     score               INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
 *     temperature         TEXT NOT NULL CHECK (temperature IN ('hot','warm','cold')),
 *     play_type           TEXT NOT NULL CHECK (play_type IN (
 *                           'UPGRADE_TIER','BUNDLE_IPAD','ADD_SEAT','TIER_REFRESH','CHECK_IN'
 *                         )),
 *     play_reason         TEXT NOT NULL,
 *     signals             JSONB NOT NULL DEFAULT '{}'::jsonb,
 *     suggested_mrr_delta NUMERIC(10,2),
 *     status              TEXT NOT NULL DEFAULT 'new'
 *                         CHECK (status IN ('new','contacted','in_conversation','won','lost','snoozed')),
 *     contacted_at        TIMESTAMPTZ,
 *     won_at              TIMESTAMPTZ,
 *     lost_reason         TEXT,
 *     snoozed_until       TIMESTAMPTZ,
 *     admin_notes         TEXT,
 *     created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_exp_opps_status ON expansion_opportunities(status);
 *   CREATE INDEX IF NOT EXISTS idx_exp_opps_user ON expansion_opportunities(user_id);
 *   CREATE INDEX IF NOT EXISTS idx_exp_opps_score_desc
 *     ON expansion_opportunities(score DESC) WHERE status='new';
 *   CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_exp_opp
 *     ON expansion_opportunities(user_id, play_type)
 *     WHERE status IN ('new','contacted','in_conversation');
 *
 * Schema de referencia (leído de app/admin/clientes/page.tsx):
 * - users: id UUID, name, email, phone, company, ruc, is_admin, created_at
 * - subscriptions: id, user_id, product_name, months, monthly_price, status,
 *     started_at, ends_at, apple_care, delivery_method, delivery_address, ...
 *     status ∈ ('preparing','shipped','delivered','paused','cancelled','completed')
 * - payments: id, user_id, amount, due_date, status, validated_at, receipt_uploaded_at, ...
 */
import { query } from "@/lib/db";

export type PlayType =
  | "UPGRADE_TIER"
  | "BUNDLE_IPAD"
  | "ADD_SEAT"
  | "TIER_REFRESH"
  | "CHECK_IN";

export type Temperature = "hot" | "warm" | "cold";

export interface ClientSignals {
  user_id: string;
  name: string;
  email: string;
  company: string | null;
  ruc: string | null;
  phone: string | null;
  first_sub_date: string;
  total_active_subs: number;
  total_subs_ever: number;
  total_spent: string; // numeric como string para no perder precisión
  has_overdue_last_6mo: boolean;
  next_end_date: string | null;
  max_product_name: string | null;
  has_applecare: boolean;
  has_ipad_ever: boolean;
  avg_days_to_pay: number | null;
}

export interface ExpansionOpportunity {
  user_id: string;
  score: number;
  temperature: Temperature;
  play_type: PlayType;
  play_reason: string;
  suggested_mrr_delta: number;
  signals: ClientSignals;
}

// Una sola query agrega todo lo necesario para el scoring.
// - Solo clientes no-admin con al menos 1 subscription activa/preparada.
// - Estados activos incluyen 'preparing' y 'shipped' (entregas en tránsito).
const SIGNALS_SQL = /* sql */ `
  WITH sub_agg AS (
    SELECT
      s.user_id,
      MIN(s.started_at) AS first_sub_date,
      COUNT(*) FILTER (WHERE s.status IN ('preparing','shipped','delivered')) AS total_active_subs,
      COUNT(*) AS total_subs_ever,
      COALESCE(SUM(s.monthly_price::numeric * s.months) FILTER (WHERE s.status != 'cancelled'), 0) AS total_spent,
      MAX(s.ends_at) FILTER (WHERE s.status IN ('preparing','shipped','delivered')) AS next_end_date,
      BOOL_OR(COALESCE(s.apple_care, false)) AS has_applecare,
      BOOL_OR(s.product_name ILIKE '%ipad%') AS has_ipad_ever,
      (ARRAY_AGG(s.product_name ORDER BY s.started_at DESC))[1] AS max_product_name
    FROM subscriptions s
    GROUP BY s.user_id
  ),
  pay_agg AS (
    SELECT
      p.user_id,
      BOOL_OR(p.status = 'overdue' AND p.due_date > NOW() - INTERVAL '6 months') AS has_overdue_last_6mo,
      AVG(EXTRACT(EPOCH FROM (p.validated_at - p.receipt_uploaded_at)) / 86400.0)
        FILTER (WHERE p.validated_at IS NOT NULL AND p.receipt_uploaded_at IS NOT NULL)
        AS avg_days_to_pay
    FROM payments p
    GROUP BY p.user_id
  )
  SELECT
    u.id AS user_id,
    u.name,
    u.email,
    u.company,
    u.ruc,
    u.phone,
    sa.first_sub_date,
    COALESCE(sa.total_active_subs, 0)::int AS total_active_subs,
    COALESCE(sa.total_subs_ever, 0)::int   AS total_subs_ever,
    COALESCE(sa.total_spent, 0)::text      AS total_spent,
    COALESCE(pa.has_overdue_last_6mo, false) AS has_overdue_last_6mo,
    sa.next_end_date,
    sa.max_product_name,
    COALESCE(sa.has_applecare, false) AS has_applecare,
    COALESCE(sa.has_ipad_ever, false) AS has_ipad_ever,
    pa.avg_days_to_pay
  FROM users u
  JOIN sub_agg sa ON sa.user_id = u.id
  LEFT JOIN pay_agg pa ON pa.user_id = u.id
  WHERE COALESCE(u.is_admin, false) = false
    AND sa.total_active_subs > 0
`;

/**
 * Scoring 0-100 a partir de 8 señales.
 * Los pesos fueron calibrados para que un "hot lead" (≥70) requiera combinar
 * antigüedad + pagos limpios + alguna señal de volumen/intención.
 */
export function scoreClient(c: ClientSignals): number {
  let s = 0;

  // Antigüedad ≥90d — 20pts
  const firstSubMs = Date.parse(c.first_sub_date);
  if (!Number.isNaN(firstSubMs)) {
    const ageDays = (Date.now() - firstSubMs) / 86_400_000;
    if (ageDays >= 90) s += 20;
  }

  // Pagos limpios (0 overdue últimos 6 meses) — 20pts
  if (!c.has_overdue_last_6mo) s += 20;

  // Ya expandió antes (≥2 subs activas) — 15pts
  if (c.total_active_subs >= 2) s += 15;

  // Empresa formal (RUC) — 10pts
  if (c.ruc && c.ruc.trim().length > 0) s += 10;

  // Cerca de renovación (ventana natural de venta) — 15pts
  if (c.next_end_date) {
    const endMs = Date.parse(c.next_end_date);
    if (!Number.isNaN(endMs)) {
      const daysToEnd = (endMs - Date.now()) / 86_400_000;
      if (daysToEnd >= 0 && daysToEnd <= 30) s += 15;
    }
  }

  // Tier bajo pero LTV alto → señal fuerte de upgrade — 10pts
  const spent = Number.parseFloat(c.total_spent) || 0;
  if ((c.max_product_name || "").toLowerCase().includes("air") && spent > 5000) s += 10;

  // AppleCare activo → mentalidad premium — 5pts
  if (c.has_applecare) s += 5;

  // Paga rápido (<1 día en promedio entre sube comprobante y validación) — 5pts
  if (c.avg_days_to_pay !== null && c.avg_days_to_pay !== undefined && c.avg_days_to_pay < 1) s += 5;

  return Math.min(100, Math.max(0, Math.round(s)));
}

export function temperatureFor(score: number): Temperature {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

/**
 * Deriva la play sugerida + delta MRR aproximado para el cliente.
 * Orden de prioridad: UPGRADE_TIER > BUNDLE_IPAD > ADD_SEAT > TIER_REFRESH > CHECK_IN.
 */
export function derivePlay(c: ClientSignals): {
  type: PlayType;
  reason: string;
  delta: number;
} {
  const prod = (c.max_product_name || "").toLowerCase();
  const firstSubMs = Date.parse(c.first_sub_date);
  const ageDays = Number.isNaN(firstSubMs)
    ? 0
    : Math.round((Date.now() - firstSubMs) / 86_400_000);

  const daysToEnd = c.next_end_date
    ? (Date.parse(c.next_end_date) - Date.now()) / 86_400_000
    : null;

  // 1. MacBook Air + una sola sub activa → upgrade a Pro
  if (prod.includes("air") && c.total_active_subs === 1) {
    return {
      type: "UPGRADE_TIER",
      reason: `Usa ${c.max_product_name}. Con ${ageDays} días de antigüedad y pagos limpios, está listo para subir a MacBook Pro M3.`,
      delta: 400, // delta aproximado Air → Pro por mes
    };
  }

  // 2. ≥2 MacBooks activas sin iPad en historial → bundle iPad
  if (c.total_active_subs >= 2 && !c.has_ipad_ever) {
    return {
      type: "BUNDLE_IPAD",
      reason: `Ya tiene ${c.total_active_subs} MacBooks activas. Complemento natural: iPad Pro 11" para presentaciones y movilidad.`,
      delta: 320,
    };
  }

  // 3. Empresa con RUC y menos de 3 equipos → seat adicional
  if (c.ruc && c.total_active_subs < 3) {
    return {
      type: "ADD_SEAT",
      reason: `Empresa con RUC ${c.ruc}, ${c.total_active_subs} equipo(s) activo(s). Seat adicional para un nuevo rol con cero burocracia.`,
      delta: 890, // MacBook Air base adicional
    };
  }

  // 4. Ventana de renovación (0-30 días) → renovar con upgrade
  if (daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 30) {
    return {
      type: "TIER_REFRESH",
      reason: `Renovación en ${Math.round(daysToEnd)} días. Oportunidad de renovar con upgrade + descuento de fidelidad.`,
      delta: 250,
    };
  }

  // 5. Fallback: check-in de valor sin push comercial directo
  return {
    type: "CHECK_IN",
    reason: "Cliente con buen historial — contacto de valor, sin venta directa aún.",
    delta: 0,
  };
}

/**
 * Corre la query de señales y devuelve oportunidades computadas (no persiste).
 */
export async function computeOpportunities(): Promise<ExpansionOpportunity[]> {
  const { rows } = await query<ClientSignals>(SIGNALS_SQL);
  return rows.map((c) => {
    const score = scoreClient(c);
    const play = derivePlay(c);
    return {
      user_id: c.user_id,
      score,
      temperature: temperatureFor(score),
      play_type: play.type,
      play_reason: play.reason,
      suggested_mrr_delta: play.delta,
      signals: c,
    };
  });
}

/**
 * Persiste oportunidades computadas.
 *
 * Usa UPSERT sobre el índice único parcial `uniq_open_exp_opp`:
 *   (user_id, play_type) WHERE status IN ('new','contacted','in_conversation')
 *
 * - Si existe una oportunidad ABIERTA del mismo tipo para el cliente: update scoring + signals.
 * - Si no existe: insert.
 * - Oportunidades cerradas (won/lost/snoozed pasadas) NO se tocan ni bloquean nuevas inserciones.
 *
 * Requiere PostgreSQL 15+ para `ON CONFLICT ... WHERE` con índice parcial.
 * Railway está en PG 16 → OK.
 */
export async function persistOpportunities(
  opps: ExpansionOpportunity[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const o of opps) {
    const res = await query<{ is_insert: boolean }>(
      `
      INSERT INTO expansion_opportunities
        (user_id, score, temperature, play_type, play_reason, signals, suggested_mrr_delta)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      ON CONFLICT (user_id, play_type)
        WHERE status IN ('new','contacted','in_conversation')
      DO UPDATE SET
        score = EXCLUDED.score,
        temperature = EXCLUDED.temperature,
        play_reason = EXCLUDED.play_reason,
        signals = EXCLUDED.signals,
        suggested_mrr_delta = EXCLUDED.suggested_mrr_delta,
        updated_at = NOW()
      RETURNING (xmax = 0) AS is_insert
      `,
      [
        o.user_id,
        o.score,
        o.temperature,
        o.play_type,
        o.play_reason,
        JSON.stringify(o.signals),
        o.suggested_mrr_delta,
      ]
    );
    if (res.rows[0]?.is_insert) inserted++;
    else updated++;
  }

  return { inserted, updated };
}

/**
 * Helper de conveniencia: compute + persist en una sola llamada.
 * Útil para APIs admin y para gancharlo desde un cron existente.
 */
export async function refreshExpansionOpportunities(): Promise<{
  detected: number;
  inserted: number;
  updated: number;
}> {
  const opps = await computeOpportunities();
  const { inserted, updated } = await persistOpportunities(opps);
  return { detected: opps.length, inserted, updated };
}
