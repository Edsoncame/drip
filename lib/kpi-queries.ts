/**
 * KPI Queries — data layer del Admin KPI Dashboard (/admin/dashboard)
 * ---------------------------------------------------------------------
 * Cada función devuelve un slice de negocio listo para renderizar. El dashboard
 * las corre en paralelo con `Promise.all` y pasa los resultados como props a un
 * Client component que dibuja cards + sparklines.
 *
 * Reglas de diseño:
 *
 * 1. TODAS las queries sobre `subscriptions` tratan como "activas" los estados
 *      ('active','delivered','shipped','preparing')
 *    (cancelled es el único que se excluye). Esto matchea el fix commit 289306c
 *    y el set que usa `lib/expansion-engine.ts`.
 *
 * 2. Ninguna función lanza si una tabla opcional no existe. `expansion_opportunities`
 *    y la extensión KYC sobre `users` pueden no estar migradas en algunos ambientes
 *    (staging nuevos, primera corrida post-deploy). Atrapamos error code `42P01`
 *    (relation does not exist) y `42703` (column does not exist) y devolvemos un
 *    valor "vacío seguro" — así el dashboard no explota.
 *
 * 3. Una sola `query()` por función. Queries agregadas usan CTEs + FILTER (WHERE …).
 *    Nada de N+1 loops.
 *
 * 4. Montos (MRR, revenue, LTV) se devuelven como `number` en soles. Para parse
 *    seguro de `NUMERIC` se usa `toNum()` que acepta `string | number | null`.
 *
 * 5. Estilo consistente con `lib/expansion-engine.ts`: SQL inline con /* sql *\/
 *    comment, imports mínimos.
 */
import { query } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Estados de `subscriptions` considerados "activos" para MRR/retention/cobro. */
const ACTIVE_STATUSES = ["active", "delivered", "shipped", "preparing"] as const;

/** Parse defensivo de NUMERIC de Postgres (llega como string) a number. */
function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Detecta errores de "tabla no existe" (42P01) o "columna no existe" (42703). */
function isMissingObjectError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = (e as { code?: string }).code;
  if (code === "42P01" || code === "42703") return true;
  const msg = (e as { message?: string }).message || "";
  return /relation .* does not exist|column .* does not exist/i.test(msg);
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface MrrSnapshot {
  /** MRR actual en soles (suma de `monthly_price` de subs activas). */
  current: number;
  /** Delta absoluto contra hace 30 días en soles. */
  delta30d: number;
  /** % de cambio vs hace 30 días (0.12 = +12%). `null` si la base era 0. */
  deltaPct30d: number | null;
}

export interface MrrHistoryPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** MRR estimado para ese día en soles. */
  mrr: number;
}

export interface RevenueSnapshot {
  /** Suma de `payments.amount` con status `validated` en el mes calendario en curso. */
  cobrado: number;
  /** Suma de `payments.amount` con status `pending` que vencen dentro del mes en curso. */
  pendiente: number;
}

export interface OverduePayments {
  count: number;
  monto: number;
}

export interface ExpansionOpen {
  count: number;
  mrrPotencial: number;
}

export interface AdminInbox {
  kycPendientes: number;
  pagosPorValidar: number;
  reclamacionesAbiertas: number;
}

// ---------------------------------------------------------------------------
// 1. MRR actual + delta 30d
// ---------------------------------------------------------------------------

/**
 * MRR actual + delta contra hace 30 días.
 *
 * MRR actual = SUM(monthly_price) de subs con status ACTIVO hoy.
 * MRR hace 30d = SUM(monthly_price) de subs que estaban activas EL 30 DE AYER:
 *                started_at <= NOW() - 30d AND
 *                (status != 'cancelled' OR ends_at > NOW() - 30d)
 *
 * Aproximación: si una sub fue cancelada hace <30d, todavía contaba como MRR en
 * ese punto del pasado. Esto nos da una base realista para mostrar crecimiento
 * orgánico vs churn.
 */
export async function mrrActual(): Promise<MrrSnapshot> {
  const { rows } = await query<{ current: string; past: string }>(
    /* sql */ `
    SELECT
      COALESCE(SUM(monthly_price) FILTER (
        WHERE status = ANY($1::text[])
      ), 0)::text AS current,
      COALESCE(SUM(monthly_price) FILTER (
        WHERE started_at <= NOW() - INTERVAL '30 days'
          AND (status != 'cancelled' OR ends_at > NOW() - INTERVAL '30 days')
      ), 0)::text AS past
    FROM subscriptions
    `,
    [ACTIVE_STATUSES],
  );
  const current = toNum(rows[0]?.current);
  const past = toNum(rows[0]?.past);
  const delta30d = current - past;
  const deltaPct30d = past > 0 ? delta30d / past : null;
  return { current, delta30d, deltaPct30d };
}

/**
 * MRR histórico últimos 30 días (1 punto por día).
 *
 * Para cada día `d` del rango, contamos el MRR de las subs que:
 *   - started_at <= d
 *   - no canceladas, o ends_at > d
 *
 * Esto permite dibujar sparklines de crecimiento diario.
 */
export async function mrrHistorico30d(): Promise<MrrHistoryPoint[]> {
  const { rows } = await query<{ day: string; mrr: string }>(
    /* sql */ `
    WITH days AS (
      SELECT generate_series(
        (NOW() - INTERVAL '29 days')::date,
        NOW()::date,
        INTERVAL '1 day'
      )::date AS day
    )
    SELECT
      d.day::text AS day,
      COALESCE(SUM(s.monthly_price) FILTER (
        WHERE s.started_at::date <= d.day
          AND (s.status != 'cancelled' OR s.ends_at::date > d.day)
      ), 0)::text AS mrr
    FROM days d
    LEFT JOIN subscriptions s ON s.started_at::date <= d.day
    GROUP BY d.day
    ORDER BY d.day ASC
    `,
  );
  return rows.map((r) => ({ date: r.day, mrr: toNum(r.mrr) }));
}

// ---------------------------------------------------------------------------
// 2. Clientes activos + nuevos del mes
// ---------------------------------------------------------------------------

export async function clientesActivos(): Promise<number> {
  const { rows } = await query<{ n: string }>(
    /* sql */ `
    SELECT COUNT(DISTINCT user_id)::text AS n
    FROM subscriptions
    WHERE status = ANY($1::text[])
    `,
    [ACTIVE_STATUSES],
  );
  return Number.parseInt(rows[0]?.n ?? "0", 10);
}

/**
 * Clientes nuevos = users que tienen su PRIMERA subscription en el mes calendario actual.
 * No cuenta signups sin sub (esos son leads, no clientes).
 */
export async function clientesNuevosEsteMes(): Promise<number> {
  const { rows } = await query<{ n: string }>(
    /* sql */ `
    WITH firsts AS (
      SELECT user_id, MIN(started_at) AS first_sub
      FROM subscriptions
      WHERE status != 'cancelled'
      GROUP BY user_id
    )
    SELECT COUNT(*)::text AS n
    FROM firsts
    WHERE first_sub >= date_trunc('month', NOW())
      AND first_sub < date_trunc('month', NOW()) + INTERVAL '1 month'
    `,
  );
  return Number.parseInt(rows[0]?.n ?? "0", 10);
}

// ---------------------------------------------------------------------------
// 3. Churn mensual (ventana móvil 30d)
// ---------------------------------------------------------------------------

/**
 * Churn % = subs canceladas en los últimos 30 días / subs activas hace 30 días.
 * Devuelve 0-1 (ej. 0.08 = 8% churn mensual).
 *
 * Se usa ventana móvil de 30d en lugar de mes calendario para no saltar el 1ro.
 * Si la base era 0 hace 30d (arranque), devuelve 0.
 */
export async function churnMensual(): Promise<number> {
  const { rows } = await query<{ cancelled: string; base: string }>(
    /* sql */ `
    SELECT
      COUNT(*) FILTER (
        WHERE status = 'cancelled'
          AND ends_at >= NOW() - INTERVAL '30 days'
      )::text AS cancelled,
      COUNT(*) FILTER (
        WHERE started_at <= NOW() - INTERVAL '30 days'
          AND (status != 'cancelled' OR ends_at > NOW() - INTERVAL '30 days')
      )::text AS base
    FROM subscriptions
    `,
  );
  const cancelled = Number.parseInt(rows[0]?.cancelled ?? "0", 10);
  const base = Number.parseInt(rows[0]?.base ?? "0", 10);
  if (base === 0) return 0;
  return cancelled / base;
}

// ---------------------------------------------------------------------------
// 4. LTV promedio
// ---------------------------------------------------------------------------

/**
 * LTV promedio en soles = AVG por cliente de SUM(monthly_price * months) sobre
 * subscriptions no canceladas. Incluye clientes con múltiples subs (bundles, upgrades).
 *
 * Nota: es LTV "contratado", no "realmente cobrado". Para el dashboard ejecutivo
 * es el número que le permite a Edson saber cuánto vale un cliente promedio.
 */
export async function ltvPromedio(): Promise<number> {
  const { rows } = await query<{ ltv: string }>(
    /* sql */ `
    WITH per_user AS (
      SELECT user_id, SUM(monthly_price * months) AS total
      FROM subscriptions
      WHERE status != 'cancelled'
      GROUP BY user_id
    )
    SELECT COALESCE(AVG(total), 0)::text AS ltv
    FROM per_user
    `,
  );
  return toNum(rows[0]?.ltv);
}

// ---------------------------------------------------------------------------
// 5. Revenue del mes en curso (cobrado + pendiente)
// ---------------------------------------------------------------------------

/**
 * Revenue del mes calendario en curso.
 * - cobrado: payments.status='validated' con validated_at en el mes
 * - pendiente: payments.status='pending' con due_date en el mes (no vencido aún)
 *
 * No suma 'overdue' — eso va separado en `pagosAtrasados()` como cuenta "roja".
 */
export async function revenueEsteMes(): Promise<RevenueSnapshot> {
  const { rows } = await query<{ cobrado: string; pendiente: string }>(
    /* sql */ `
    SELECT
      COALESCE(SUM(amount) FILTER (
        WHERE status = 'validated'
          AND validated_at >= date_trunc('month', NOW())
          AND validated_at < date_trunc('month', NOW()) + INTERVAL '1 month'
      ), 0)::text AS cobrado,
      COALESCE(SUM(amount) FILTER (
        WHERE status = 'pending'
          AND due_date >= date_trunc('month', NOW())
          AND due_date < date_trunc('month', NOW()) + INTERVAL '1 month'
      ), 0)::text AS pendiente
    FROM payments
    `,
  );
  return {
    cobrado: toNum(rows[0]?.cobrado),
    pendiente: toNum(rows[0]?.pendiente),
  };
}

// ---------------------------------------------------------------------------
// 6. Pagos atrasados
// ---------------------------------------------------------------------------

export async function pagosAtrasados(): Promise<OverduePayments> {
  const { rows } = await query<{ n: string; monto: string }>(
    /* sql */ `
    SELECT
      COUNT(*)::text AS n,
      COALESCE(SUM(amount), 0)::text AS monto
    FROM payments
    WHERE status = 'overdue'
       OR (status = 'pending' AND due_date < NOW())
    `,
  );
  return {
    count: Number.parseInt(rows[0]?.n ?? "0", 10),
    monto: toNum(rows[0]?.monto),
  };
}

// ---------------------------------------------------------------------------
// 7. Oportunidades de expansión abiertas
// ---------------------------------------------------------------------------

/**
 * Oportunidades abiertas (new + contacted + in_conversation) y su MRR potencial.
 * Si la tabla `expansion_opportunities` no existe (migración no corrida), devuelve 0/0
 * sin lanzar — el dashboard simplemente mostrará un estado neutro.
 */
export async function expansionOpen(): Promise<ExpansionOpen> {
  try {
    const { rows } = await query<{ n: string; mrr: string }>(
      /* sql */ `
      SELECT
        COUNT(*)::text AS n,
        COALESCE(SUM(suggested_mrr_delta), 0)::text AS mrr
      FROM expansion_opportunities
      WHERE status IN ('new','contacted','in_conversation')
      `,
    );
    return {
      count: Number.parseInt(rows[0]?.n ?? "0", 10),
      mrrPotencial: toNum(rows[0]?.mrr),
    };
  } catch (e) {
    if (isMissingObjectError(e)) return { count: 0, mrrPotencial: 0 };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// 8. Inbox admin (KYC + pagos por validar + reclamaciones)
// ---------------------------------------------------------------------------

/**
 * Contadores de "cosas que esperan decisión del admin".
 *
 * - kycPendientes: users.kyc_status IN ('pending','capturing','review') que además
 *   tienen alguna subscription (filtramos leads puros que no llegaron a pagar).
 *   La columna puede no existir si el ambiente no corrió ensureKycSchema() aún.
 * - pagosPorValidar: payments.status='pending' con comprobante subido esperando OK.
 * - reclamacionesAbiertas: libro_reclamaciones.estado='pendiente'. Tabla puede no existir
 *   en staging.
 *
 * Todo wrapping individual para aislar missing-object: si una tabla falla, las demás siguen.
 */
export async function inboxAdmin(): Promise<AdminInbox> {
  const kycPendientes = await safeScalar(
    /* sql */ `
    SELECT COUNT(DISTINCT u.id)::text AS n
    FROM users u
    WHERE u.kyc_status IN ('pending','capturing','review')
      AND EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.user_id = u.id AND s.status != 'cancelled'
      )
    `,
  );

  const pagosPorValidar = await safeScalar(
    /* sql */ `
    SELECT COUNT(*)::text AS n
    FROM payments
    WHERE status = 'pending'
      AND receipt_uploaded_at IS NOT NULL
      AND validated_at IS NULL
    `,
  );

  const reclamacionesAbiertas = await safeScalar(
    /* sql */ `
    SELECT COUNT(*)::text AS n
    FROM libro_reclamaciones
    WHERE estado = 'pendiente'
    `,
  );

  return { kycPendientes, pagosPorValidar, reclamacionesAbiertas };
}

/** Corre una query que devuelve un único `n::text` y lo parsea. Tolera missing-object. */
async function safeScalar(sql: string): Promise<number> {
  try {
    const { rows } = await query<{ n: string }>(sql);
    return Number.parseInt(rows[0]?.n ?? "0", 10);
  } catch (e) {
    if (isMissingObjectError(e)) return 0;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Snapshot agregado (helper de conveniencia para el page.tsx)
// ---------------------------------------------------------------------------

export interface DashboardSnapshot {
  mrr: MrrSnapshot;
  mrrHistory: MrrHistoryPoint[];
  clientesActivos: number;
  clientesNuevosEsteMes: number;
  churnMensual: number;
  ltvPromedio: number;
  revenue: RevenueSnapshot;
  pagosAtrasados: OverduePayments;
  expansion: ExpansionOpen;
  inbox: AdminInbox;
  generatedAt: string; // ISO
}

/**
 * Corre las 10 queries en paralelo y devuelve el snapshot completo.
 * Úsalo desde el server component `/admin/dashboard/page.tsx`.
 *
 * Si una query individual falla (excepto por missing-object que ya está manejado
 * internamente) el error se propaga — el page.tsx puede renderizar un error state.
 */
export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [
    mrr,
    mrrHistory,
    cliAct,
    cliNuevos,
    churn,
    ltv,
    revenue,
    overdue,
    expansion,
    inbox,
  ] = await Promise.all([
    mrrActual(),
    mrrHistorico30d(),
    clientesActivos(),
    clientesNuevosEsteMes(),
    churnMensual(),
    ltvPromedio(),
    revenueEsteMes(),
    pagosAtrasados(),
    expansionOpen(),
    inboxAdmin(),
  ]);

  return {
    mrr,
    mrrHistory,
    clientesActivos: cliAct,
    clientesNuevosEsteMes: cliNuevos,
    churnMensual: churn,
    ltvPromedio: ltv,
    revenue,
    pagosAtrasados: overdue,
    expansion,
    inbox,
    generatedAt: new Date().toISOString(),
  };
}
