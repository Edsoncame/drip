/**
 * Pure financial calculation functions for Flux equipment pricing.
 *
 * Break-even logic (verified against spreadsheet):
 *   financiamiento = precio × (tasa/100) × (plazo_credito/12)
 *   residual       = precio × residual_pct/100
 *   break_even     = (precio + financiamiento + opex×meses - residual) / meses
 *   tarifa ≈ break_even / (1 - margin)   →  margin ≈ 30%
 */

export const PLAN_RESIDUAL_PCT: Record<string, number> = {
  "8":  77.5,
  "16": 55.0,
  "24": 32.5,
};

export const TARGET_MARGIN = 0.30; // 30% margin over break-even → tarifa sugerida

export interface PlanCalc {
  meses: number;
  residualPct: number;
  residualUsd: number;
  financiamiento: number;
  opexTotal: number;
  netCost: number;
  breakEven: number;
  suggested: number;
  /** ROI at the given tarifa. undefined if no tarifa. */
  rentabilidad?: number;
}

/**
 * Calculate financial metrics for a rental plan.
 * All amounts in USD.
 */
export function calcPlan(
  precio: number,
  tasaPct: number,
  plazoCreditoMeses: number,
  opexMensual: number,
  residualPct: number,
  mesesPlan: number,
  tarifaActual?: number,
  margin = TARGET_MARGIN,
): PlanCalc {
  const financiamiento = precio * (tasaPct / 100) * (plazoCreditoMeses / 12);
  const opexTotal = opexMensual * mesesPlan;
  const residualUsd = precio * (residualPct / 100);
  const netCost = precio + financiamiento + opexTotal - residualUsd;
  const breakEven = netCost / mesesPlan;
  const suggested = margin < 1 ? breakEven / (1 - margin) : breakEven;

  let rentabilidad: number | undefined;
  if (tarifaActual !== undefined) {
    const totalIngresos = tarifaActual * mesesPlan + residualUsd;
    const totalCostos = precio + financiamiento + opexTotal;
    rentabilidad = ((totalIngresos - totalCostos) / precio) * 100;
  }

  return { meses: mesesPlan, residualPct, residualUsd, financiamiento, opexTotal, netCost, breakEven, suggested, rentabilidad };
}

/**
 * Solve for monthly interest rate given PV, periodic payment, and periods.
 * Uses Newton-Raphson iteration.
 * Returns the monthly rate (e.g. 0.0083 for 0.83% monthly).
 */
export function solveMonthlyRate(pv: number, pmt: number, n: number): number {
  if (pv <= 0 || pmt <= 0 || n <= 0) return 0;
  // Quick check: if pmt * n ≈ pv, rate ≈ 0
  if (Math.abs(pmt * n - pv) < 0.01) return 0;

  let r = 0.01; // 1% initial guess
  for (let i = 0; i < 200; i++) {
    const onePlusR_n = Math.pow(1 + r, n);
    const denom = onePlusR_n - 1;
    if (denom === 0) break;
    // f(r) = pmt*(1-(1+r)^-n)/r - pv = 0
    const f = (pmt * (1 - 1 / onePlusR_n)) / r - pv;
    // f'(r)
    const df = pmt * ((n * Math.pow(1 + r, -n - 1)) / r - (1 - Math.pow(1 + r, -n)) / (r * r));
    if (df === 0) break;
    const step = f / df;
    r -= step;
    if (r <= 0) r = 1e-6;
    if (Math.abs(step) < 1e-10) break;
  }
  return Math.max(0, r);
}

/**
 * Annual rate (simple) from monthly rate.
 * e.g. 0.0083 → 9.96
 */
export function monthlyToAnnualPct(monthlyRate: number): number {
  return monthlyRate * 12 * 100;
}

/**
 * Effective annual rate (compound) from monthly rate.
 */
export function monthlyToEffectiveAnnualPct(monthlyRate: number): number {
  return (Math.pow(1 + monthlyRate, 12) - 1) * 100;
}

/**
 * Monthly payment (cuota) given PV, monthly rate, and periods.
 */
export function calcCuota(pv: number, monthlyRate: number, n: number): number {
  if (monthlyRate === 0) return pv / n;
  return (pv * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
}
