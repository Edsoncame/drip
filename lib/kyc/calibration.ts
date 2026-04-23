/**
 * Calibration utilities para activar `KYC_FORENSICS_ENFORCE=true` con data,
 * no con intuición.
 *
 * Este archivo provee helpers puros de estadística (`percentile` + `breakdown`).
 * Los consumidores (fetchCalibrationSnapshot, simulateEnforcement, página admin)
 * llegan en commits posteriores — ver
 * `reports/2026-04-23-autopilot-kyc-forensics-calibration-spec.md`.
 *
 * Contrato de tests: `lib/kyc/__tests__/calibration.test.ts` (commit 44b67d8).
 *
 * Puro y sin side effects → unit-testeable con `tsx --test`.
 */

/* ────────────────────────────────────────────────────────────────── */
/* Types                                                              */
/* ────────────────────────────────────────────────────────────────── */

/**
 * Distribución de una métrica continua, calculada una vez sobre el array
 * sorteado ascendente. Los percentiles usan interpolación lineal tipo numpy
 * (`method="linear"`): el índice fraccional se reparte entre los dos vecinos.
 *
 * Para n=0 todos los campos numéricos son NaN. Para n=1 todos son iguales al
 * único valor.
 */
export interface PercentileBreakdown {
  /** Cantidad de valores finitos considerados (post-filtrado de NaN/Infinity). */
  n: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

/* ────────────────────────────────────────────────────────────────── */
/* Percentile (puro, testeable)                                       */
/* ────────────────────────────────────────────────────────────────── */

/**
 * Calcula el percentil `p` (0..1) sobre un array **ya sorteado ascendente**.
 * Interpolación lineal entre los dos vecinos del índice fraccional `(n-1)*p`
 * — equivalente a `numpy.percentile(arr, p*100, method="linear")`.
 *
 * **Contrato:** el caller debe haber sorteado. Si no sortea, el resultado es
 * numéricamente determinístico pero sin significado estadístico. El wrapper
 * `breakdown()` sortea por vos.
 *
 * Edge cases:
 * - `[]` → `NaN`
 * - `[x]` → `x` para cualquier `p`
 * - `p = 0` → primer elemento
 * - `p = 1` → último elemento
 *
 * @example
 * percentile([1, 2, 3, 4], 0.5)  // 2.5 (interpola entre 2 y 3)
 * percentile([1, 2, 3, 4, 5], 0) // 1
 * percentile([1, 2, 3, 4, 5], 1) // 5
 */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] + frac * (sortedAsc[hi] - sortedAsc[lo]);
}

/**
 * Wrapper de alto nivel: recibe valores crudos (orden arbitrario, posibles
 * NaN/Infinity), los filtra a valores finitos, sortea ASC y devuelve un
 * bundle con P50/P75/P90/P95/P99 + max + n.
 *
 * **No muta el input** — usa spread para copiar antes de sortear.
 *
 * Edge cases:
 * - `[]` → `{ n: 0, p50: NaN, ..., max: NaN }`
 * - Valores únicos (`n=1`) → todos los percentiles son iguales al valor.
 * - `NaN` / `±Infinity` se descartan silenciosamente (no cuentan en `n`).
 *
 * @example
 * breakdown([0.1, 0.2, NaN, Infinity, 0.3])
 * // → { n: 3, p50: 0.2, p95: ~0.29, p99: ~0.298, max: 0.3, ... }
 */
export function breakdown(values: number[]): PercentileBreakdown {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? NaN,
  };
}
