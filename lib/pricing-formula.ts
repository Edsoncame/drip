/**
 * FLUX Pricing Formula
 *
 * Dado el costo de una Mac, calcula los precios de alquiler en todas las modalidades:
 * - Estreno (nuevo): 8m, 16m, 24m
 * - Re-alquiler (usado): 8m tras 8 meses, 8m tras 16 meses, 16m tras 8 meses
 *
 * Los ratios se derivan de los precios de referencia del negocio para:
 *   Pro M4 ($900), Air M4 ($580), Pro M5 ($1074)
 *
 * La fórmula es: price = (cost × ratio) / months
 *
 * Precios offline = empresas por transferencia (sin comisión)
 * Precios online  = web con Culqi (+4-5%, redondeado al siguiente $5)
 */

export type PlanKey =
  | "estreno_8m"
  | "estreno_16m"
  | "estreno_24m"
  | "realquiler_8m_usado_8m"
  | "realquiler_8m_usado_16m"
  | "realquiler_16m_usado_8m";

export const PLAN_INFO: Record<PlanKey, { label: string; months: number; residualPct: number }> = {
  estreno_8m:              { label: "Estreno 8 meses",               months: 8,  residualPct: 77.5 },
  estreno_16m:             { label: "Estreno 16 meses",              months: 16, residualPct: 55.0 },
  estreno_24m:             { label: "Estreno 24 meses",              months: 24, residualPct: 32.5 },
  realquiler_8m_usado_8m:  { label: "Re-alquiler 8m (usado 8m)",     months: 8,  residualPct: 55.0 },
  realquiler_8m_usado_16m: { label: "Re-alquiler 8m (usado 16m)",    months: 8,  residualPct: 32.5 },
  realquiler_16m_usado_8m: { label: "Re-alquiler 16m (usado 8m)",    months: 16, residualPct: 32.5 },
};

/**
 * Ratios derivados del promedio de 3 modelos de referencia usando
 * los costos REALES de compra:
 *   - Air M4 13": ~$1,124
 *   - Pro M4 14": ~$1,721
 *   - Pro M5 14": ~$2,065
 *
 * ratio = (precio_mensual × meses_total) / costo_equipo
 */
const PLAN_RATIO: Record<PlanKey, number> = {
  estreno_8m:              0.714,
  estreno_16m:             1.135,
  estreno_24m:             1.503,
  realquiler_8m_usado_8m:  0.475,
  realquiler_8m_usado_16m: 0.402,
  realquiler_16m_usado_8m: 0.885,
};

/**
 * Reference prices (offline / empresas) — los 3 modelos base que ya vendemos.
 * Se usan para matches exactos. Para modelos nuevos se usa la fórmula.
 */
export const REFERENCE_PRICES: Record<string, Record<PlanKey, number>> = {
  "macbook-pro-14-m4": {
    estreno_8m: 155, estreno_16m: 120, estreno_24m: 105,
    realquiler_8m_usado_8m: 100, realquiler_8m_usado_16m: 85, realquiler_16m_usado_8m: 95,
  },
  "macbook-air-13-m4": {
    estreno_8m: 110, estreno_16m: 90, estreno_24m: 80,
    realquiler_8m_usado_8m: 75, realquiler_8m_usado_16m: 65, realquiler_16m_usado_8m: 70,
  },
  "macbook-pro-14-m5": {
    estreno_8m: 165, estreno_16m: 130, estreno_24m: 115,
    realquiler_8m_usado_8m: 110, realquiler_8m_usado_16m: 90, realquiler_16m_usado_8m: 100,
  },
};

const CULQI_FEE_PCT = 4.5; // 3.99% + S/0.30 ≈ ~4.5%

/**
 * Redondear al siguiente múltiplo de 5.
 */
function roundUpTo5(n: number): number {
  return Math.ceil(n / 5) * 5;
}

/**
 * Precio offline (empresas, sin comisión) para cualquier equipo.
 * Si el slug existe en referencia, usa el precio exacto.
 * Si no, calcula con la fórmula.
 */
export function calcOfflinePrice(cost: number, plan: PlanKey, slug?: string): number {
  // 1. Try reference lookup first
  if (slug && REFERENCE_PRICES[slug]) {
    return REFERENCE_PRICES[slug][plan];
  }

  // 2. Use formula
  const info = PLAN_INFO[plan];
  const ratio = PLAN_RATIO[plan];
  const raw = (cost * ratio) / info.months;
  return roundUpTo5(raw);
}

/**
 * Precio online (web/Culqi) — offline + comisión redondeado al siguiente $5.
 */
export function calcOnlinePrice(cost: number, plan: PlanKey, slug?: string): number {
  const offline = calcOfflinePrice(cost, plan, slug);
  const withFee = offline * (1 + CULQI_FEE_PCT / 100);
  return roundUpTo5(withFee);
}

/**
 * Calcula TODOS los precios (offline + online) para un equipo.
 */
export function calcAllPrices(cost: number, slug?: string) {
  const plans: PlanKey[] = [
    "estreno_8m", "estreno_16m", "estreno_24m",
    "realquiler_8m_usado_8m", "realquiler_8m_usado_16m", "realquiler_16m_usado_8m",
  ];

  return plans.map(plan => ({
    plan,
    label: PLAN_INFO[plan].label,
    months: PLAN_INFO[plan].months,
    residualPct: PLAN_INFO[plan].residualPct,
    offline: calcOfflinePrice(cost, plan, slug),
    online: calcOnlinePrice(cost, plan, slug),
  }));
}
