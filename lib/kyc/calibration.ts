/**
 * Calibration utilities para activar `KYC_FORENSICS_ENFORCE=true` con data,
 * no con intuición.
 *
 * Este módulo tiene 2 capas:
 *
 *   1. **Puras** (sin DB): `percentile()` y `breakdown()` — estadística básica
 *      testeable con `node:test`. Contrato en
 *      `lib/kyc/__tests__/calibration.test.ts`.
 *
 *   2. **Con DB** (async, side-effect-free SELECT):
 *      - `fetchCalibrationSnapshot()` — lee los últimos N scans y agrega las
 *        5 capas forenses + face match en un shape que la UI consume.
 *      - `simulateEnforcement()` — what-if sobre un snapshot: replica el
 *        orden de decisión de `lib/kyc/pipeline/verdict.ts` con thresholds
 *        hipotéticos y devuelve la matriz resultante.
 *
 * La capa 2 NO escribe. La fuente de verdad sigue siendo `verdict.ts` en el
 * flujo real — esto es solo observacional, para permitir activar enforce
 * con data histórica, no con intuición.
 *
 * Spec: `reports/2026-04-23-autopilot-kyc-forensics-calibration-spec.md`
 */

import { query } from "../db";
import type { ForensicsResult } from "./forensics";
import type { TemplateMatchResult } from "./template";
import type { AgeConsistencyResult } from "./age-consistency";
import type { DuplicateCheckResult } from "./duplicates";
import type { SanctionsCheckResult } from "./sanctions/types";

/* ────────────────────────────────────────────────────────────────── */
/* Types — estadística pura                                           */
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

/* ────────────────────────────────────────────────────────────────── */
/* Snapshot — lectura de DB                                           */
/* ────────────────────────────────────────────────────────────────── */

/**
 * Un scan individual con todas sus señales unificadas. Lo usamos como la
 * "fila de entrada" para simular enforcement. Nada aquí es recomputado — todo
 * viene de las columnas JSONB de `kyc_dni_scans` + join a `kyc_face_matches`
 * + lookup a `kyc_attempts` para el name_score registrado.
 */
export interface CalibrationScan {
  id: number;
  correlation_id: string;
  user_id: string | null;
  dni_number: string | null;
  created_at: string;
  /** Verdict real emitido por verify en ese momento (verified/rejected/review). */
  actual_status: string | null;
  /** Name score loggeado en kyc_attempts.payload (si existe). */
  name_score: number | null;
  /** Face match score (passed/liveness incluido). null si no hubo selfie. */
  face_score: number | null;
  face_passed: boolean | null;
  liveness_passed: boolean | null;
  /** JSONB de las 5 capas forenses — null si no se computó para ese scan. */
  forensics: ForensicsResult | null;
  template: TemplateMatchResult | null;
  age: AgeConsistencyResult | null;
  duplicates: DuplicateCheckResult | null;
  sanctions: SanctionsCheckResult | null;
}

/**
 * Distribución + conteo de una métrica sobre el window observado.
 * Los keys de `missing` cuentan scans que no tienen esa señal (null) —
 * típicamente porque el módulo falló o el scan es pre-Fase-4.
 */
export interface CalibrationMetricDist extends PercentileBreakdown {
  /** Nombre legible para UI. */
  label: string;
  /** Cuántos scans NO tenían este campo (null). */
  missing: number;
}

export interface CalibrationSnapshot {
  window_days: number;
  generated_at: string;
  total_scans: number;
  total_with_forensics: number;
  total_with_sanctions: number;

  /** Conteo por verdict real (actual_status en la DB). */
  counts_by_actual_status: Record<string, number>;

  /** Distribuciones por métrica — útil para elegir threshold. */
  forensics_overall: CalibrationMetricDist;
  forensics_ela_mean: CalibrationMetricDist;
  forensics_copy_move: CalibrationMetricDist;
  template_layout: CalibrationMetricDist;
  age_deviation: CalibrationMetricDist;
  sanctions_risk: CalibrationMetricDist;

  /** Raw scans — input del simulador. No exponerlo crudo en UI (privacy). */
  scans: CalibrationScan[];
}

interface RawScanRow {
  id: number;
  correlation_id: string;
  user_id: string | null;
  dni_number: string | null;
  created_at: Date;
  forensics_json: ForensicsResult | null;
  template_json: TemplateMatchResult | null;
  age_consistency_json: AgeConsistencyResult | null;
  duplicates_json: DuplicateCheckResult | null;
  sanctions_json: SanctionsCheckResult | null;
  face_score: string | null;
  face_passed: boolean | null;
  liveness_passed: boolean | null;
  actual_status: string | null;
  name_score: string | null;
}

/**
 * Lee los últimos `limit` scans con forensics_json no-null dentro de los
 * últimos `windowDays` días. Hace JOIN con `kyc_face_matches` (por
 * correlation_id, más reciente por scan) para traer el face score y el
 * liveness, y LEFT JOIN a `kyc_attempts` step='verify' más reciente para
 * capturar el `name_score` y el `status` real que verify decidió.
 *
 * Side-effect-free: puro SELECT. Seguro de correr desde una page server.
 */
export async function fetchCalibrationSnapshot(
  windowDays = 30,
  limit = 500,
): Promise<CalibrationSnapshot> {
  const sql = `
    WITH recent_scans AS (
      SELECT
        s.id,
        s.correlation_id,
        s.user_id,
        s.dni_number,
        s.created_at,
        s.forensics_json,
        s.template_json,
        s.age_consistency_json,
        s.duplicates_json,
        s.sanctions_json
      FROM kyc_dni_scans s
      WHERE s.created_at > NOW() - ($1::int * INTERVAL '1 day')
      ORDER BY s.created_at DESC
      LIMIT $2
    ),
    latest_face AS (
      SELECT DISTINCT ON (f.correlation_id)
        f.correlation_id,
        f.score AS face_score,
        f.passed AS face_passed,
        f.liveness_passed
      FROM kyc_face_matches f
      WHERE f.correlation_id IN (SELECT correlation_id FROM recent_scans)
      ORDER BY f.correlation_id, f.created_at DESC
    ),
    latest_verify AS (
      SELECT DISTINCT ON (a.correlation_id)
        a.correlation_id,
        a.outcome AS verify_outcome,
        a.reason AS verify_reason,
        a.payload AS verify_payload
      FROM kyc_attempts a
      WHERE a.step = 'verify'
        AND a.correlation_id IN (SELECT correlation_id FROM recent_scans)
      ORDER BY a.correlation_id, a.created_at DESC
    )
    SELECT
      rs.id,
      rs.correlation_id,
      rs.user_id,
      rs.dni_number,
      rs.created_at,
      rs.forensics_json,
      rs.template_json,
      rs.age_consistency_json,
      rs.duplicates_json,
      rs.sanctions_json,
      lf.face_score,
      lf.face_passed,
      lf.liveness_passed,
      CASE
        WHEN lv.verify_outcome = 'ok' THEN 'verified'
        WHEN lv.verify_outcome = 'fail' THEN 'rejected'
        WHEN lv.verify_outcome = 'review' THEN 'review'
        ELSE NULL
      END AS actual_status,
      (lv.verify_payload->>'name_score') AS name_score
    FROM recent_scans rs
    LEFT JOIN latest_face lf ON lf.correlation_id = rs.correlation_id
    LEFT JOIN latest_verify lv ON lv.correlation_id = rs.correlation_id
  `;

  const res = await query<RawScanRow>(sql, [windowDays, limit]);
  const rows = res.rows;

  const scans: CalibrationScan[] = rows.map((r) => ({
    id: r.id,
    correlation_id: r.correlation_id,
    user_id: r.user_id,
    dni_number: r.dni_number,
    created_at:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    actual_status: r.actual_status,
    name_score: r.name_score != null ? Number(r.name_score) : null,
    face_score: r.face_score != null ? Number(r.face_score) : null,
    face_passed: r.face_passed,
    liveness_passed: r.liveness_passed,
    forensics: r.forensics_json,
    template: r.template_json,
    age: r.age_consistency_json,
    duplicates: r.duplicates_json,
    sanctions: r.sanctions_json,
  }));

  /* ────────────── Métricas (extracción + breakdown) ────────────── */

  const forensicsOverall: number[] = [];
  const forensicsEla: number[] = [];
  const forensicsCopyMove: number[] = [];
  const templateLayout: number[] = [];
  const ageDeviation: number[] = [];
  const sanctionsRisk: number[] = [];
  let missingForensics = 0;
  let missingTemplate = 0;
  let missingAge = 0;
  let missingSanctions = 0;
  const countsByStatus: Record<string, number> = {};
  let withForensics = 0;
  let withSanctions = 0;

  for (const s of scans) {
    const st = s.actual_status ?? "unknown";
    countsByStatus[st] = (countsByStatus[st] ?? 0) + 1;

    if (s.forensics) {
      withForensics++;
      if (typeof s.forensics.overall_tampering_risk === "number") {
        forensicsOverall.push(s.forensics.overall_tampering_risk);
      }
      // ela_mean_score y copy_move_score viven en el bundle del forensics.
      // Shape esperado: `{ ela: { mean_score }, copy_move: { score }, ... }`
      // Si el shape difiere (puede haber evolucionado), fallback silencioso.
      const ela = (s.forensics as unknown as { ela?: { mean_score?: number } }).ela;
      if (typeof ela?.mean_score === "number") forensicsEla.push(ela.mean_score);
      const cm = (s.forensics as unknown as { copy_move?: { score?: number } }).copy_move;
      if (typeof cm?.score === "number") forensicsCopyMove.push(cm.score);
    } else {
      missingForensics++;
    }

    if (s.template) {
      if (typeof s.template.layout_score === "number") {
        templateLayout.push(s.template.layout_score);
      }
    } else {
      missingTemplate++;
    }

    if (s.age) {
      if (typeof s.age.deviation_years === "number") {
        ageDeviation.push(s.age.deviation_years);
      }
    } else {
      missingAge++;
    }

    if (s.sanctions) {
      withSanctions++;
      if (typeof s.sanctions.risk_score === "number") {
        sanctionsRisk.push(s.sanctions.risk_score);
      }
    } else {
      missingSanctions++;
    }
  }

  function metric(label: string, values: number[], missing: number): CalibrationMetricDist {
    return { label, missing, ...breakdown(values) };
  }

  return {
    window_days: windowDays,
    generated_at: new Date().toISOString(),
    total_scans: scans.length,
    total_with_forensics: withForensics,
    total_with_sanctions: withSanctions,
    counts_by_actual_status: countsByStatus,
    forensics_overall: metric(
      "forensics.overall_tampering_risk",
      forensicsOverall,
      missingForensics,
    ),
    forensics_ela_mean: metric("forensics.ela.mean_score", forensicsEla, missingForensics),
    forensics_copy_move: metric(
      "forensics.copy_move.score",
      forensicsCopyMove,
      missingForensics,
    ),
    template_layout: metric("template.layout_score", templateLayout, missingTemplate),
    age_deviation: metric("age.deviation_years", ageDeviation, missingAge),
    sanctions_risk: metric("sanctions.risk_score", sanctionsRisk, missingSanctions),
    scans,
  };
}

/* ────────────────────────────────────────────────────────────────── */
/* Simulador de enforcement                                           */
/* ────────────────────────────────────────────────────────────────── */

/**
 * Thresholds aplicados al simular enforcement. Los defaults coinciden con
 * las env vars de producción (ver `lib/kyc/pipeline/verdict.ts`):
 *
 * - `KYC_FORENSICS_REJECT_THRESHOLD` = 0.75
 * - `KYC_FORENSICS_ARBITER_THRESHOLD` = 0.4
 * - `KYC_TEMPLATE_MIN_SCORE` = 0.6
 * - `KYC_SANCTIONS_REJECT_THRESHOLD` = 0.85
 * - `AGE_DEVIATION_LIMIT` = 5 (hardcoded)
 */
export interface SimulationThresholds {
  forensicsReject: number;
  forensicsArbiter: number;
  templateMin: number;
  ageDeviationLimit: number;
  sanctionsReject: number;
  /** Si true, sanctions enforcement aplica (equivale a KYC_SANCTIONS_ENFORCE=true). */
  sanctionsEnforce: boolean;
}

export const DEFAULT_SIM_THRESHOLDS: SimulationThresholds = {
  forensicsReject: 0.75,
  forensicsArbiter: 0.4,
  templateMin: 0.6,
  ageDeviationLimit: 5,
  sanctionsReject: 0.85,
  sanctionsEnforce: false,
};

/** Verdict que este simulador emite para un scan. */
export type SimulatedVerdict = "verified" | "review" | "rejected" | "pending";

export interface SimulatedScan {
  correlation_id: string;
  scan_id: number;
  user_id: string | null;
  dni_number: string | null;
  created_at: string;
  actual_status: string | null;
  simulated_status: SimulatedVerdict;
  simulated_reason: string;
  /** true si el simulated cambia el actual (el delta que importa revisar). */
  would_flip: boolean;
}

export interface SimulationResult {
  thresholds: SimulationThresholds;
  input_n: number;
  verdict_counts: Record<SimulatedVerdict, number>;
  /** Matriz actual x simulated. Keys: "actual→simulated" (ej: "verified→rejected"). */
  transition_matrix: Record<string, number>;
  /** Scans cuyo simulated difiere del actual — la lista prioritaria de review. */
  would_flip: SimulatedScan[];
  /** Subset del anterior: los que tienen dni_number real (productivos). */
  known_blockers: SimulatedScan[];
  all: SimulatedScan[];
}

/**
 * Aplica los thresholds a un snapshot y devuelve el verdict simulado por
 * scan. Replica **exactamente** el orden de evaluación de
 * `lib/kyc/pipeline/verdict.ts` (commit actual, post-sanctions).
 *
 * Orden:
 *
 *   1. Pre-check liveness + face (ya computados en el scan real) — si
 *      faltan/fallaron, el scan es "pending" o "rejected" del flujo real y
 *      se preserva. El simulador se enfoca en forensics/sanctions/dups.
 *   2. Baseline status desde face/name/liveness (replica verdict.ts).
 *   3. Sanctions enforce (si aplica): risk_score >= sanctionsReject → reject.
 *   4. Forensics enforce:
 *      a. duplicates.dni_reused_by_other_user === true → reject
 *      b. forensics.overall_tampering_risk > forensicsReject → reject
 *      c. Si alguna capa es "concerning" (forensics > arbiter, template <
 *         templateMin, age > ageDeviationLimit) y el status actual era
 *         'verified', pasa a 'review' (arbiter decidirá).
 *
 * El simulador NO invoca al arbiter real (no queremos costo LLM por cada
 * what-if). Los casos que saldrían a arbiter se clasifican como 'review'.
 * En producción el arbiter rompe el empate; acá basta con saber "cuánto
 * volumen entraría a review".
 *
 * **Side-effect-free.** No toca DB.
 */
export function simulateEnforcement(
  snapshot: CalibrationSnapshot,
  thresholds: SimulationThresholds = DEFAULT_SIM_THRESHOLDS,
): SimulationResult {
  const counts: Record<SimulatedVerdict, number> = {
    verified: 0,
    review: 0,
    rejected: 0,
    pending: 0,
  };
  const transition: Record<string, number> = {};
  const all: SimulatedScan[] = [];

  for (const s of snapshot.scans) {
    const sim = simulateSingle(s, thresholds);
    const actual = s.actual_status ?? "unknown";
    const key = `${actual}→${sim.simulated_status}`;
    transition[key] = (transition[key] ?? 0) + 1;
    counts[sim.simulated_status] = (counts[sim.simulated_status] ?? 0) + 1;
    all.push(sim);
  }

  const wouldFlip = all.filter((s) => s.would_flip);
  const knownBlockers = wouldFlip.filter(
    (s) => !!s.dni_number && s.simulated_status === "rejected",
  );

  return {
    thresholds,
    input_n: snapshot.scans.length,
    verdict_counts: counts,
    transition_matrix: transition,
    would_flip: wouldFlip,
    known_blockers: knownBlockers,
    all,
  };
}

/**
 * Simula el verdict para un único scan. Expuesto para testing unitario.
 */
export function simulateSingle(
  scan: CalibrationScan,
  thresholds: SimulationThresholds,
): SimulatedScan {
  let status: SimulatedVerdict;
  let reason: string;

  // 1. Liveness / face / name — baseline (mimica verdict.ts)
  if (scan.face_passed == null || scan.liveness_passed == null) {
    status = "pending";
    reason = "no_selfie_or_face_data";
  } else if (!scan.liveness_passed) {
    status = "rejected";
    reason = "liveness_failed";
  } else if (!scan.face_passed) {
    status = "rejected";
    reason = "face_no_match";
  } else if (typeof scan.name_score === "number" && scan.name_score < 0.8) {
    status = "rejected";
    reason = "name_no_match";
  } else if (typeof scan.name_score === "number" && scan.name_score < 0.9) {
    status = "review";
    reason = "name_similarity_borderline";
  } else {
    status = "verified";
    reason = "all_checks_passed";
  }

  // 2. Sanctions (solo si aplicamos enforce y no está ya rejected)
  if (
    thresholds.sanctionsEnforce &&
    status !== "rejected" &&
    scan.sanctions?.hit &&
    scan.sanctions.risk_score >= thresholds.sanctionsReject
  ) {
    const top = scan.sanctions.hits[0];
    status = "rejected";
    reason = top
      ? `sanctions: ${top.source}/${top.list_type} (${top.match_type} ${top.match_score.toFixed(2)})`
      : "sanctions_hit";
  }

  // 3. Forensics/duplicates enforce (solo si no está ya rejected)
  if (status !== "rejected") {
    if (scan.duplicates?.dni_reused_by_other_user) {
      status = "rejected";
      reason = `duplicates: dni_number usado por ${scan.duplicates.other_user_ids.length} otro(s) user(s)`;
    } else if (
      scan.forensics &&
      typeof scan.forensics.overall_tampering_risk === "number" &&
      scan.forensics.overall_tampering_risk > thresholds.forensicsReject
    ) {
      status = "rejected";
      reason = `forensics: overall_tampering_risk=${scan.forensics.overall_tampering_risk.toFixed(
        3,
      )} > ${thresholds.forensicsReject}`;
    } else {
      const forensicsConcerning =
        scan.forensics &&
        typeof scan.forensics.overall_tampering_risk === "number" &&
        scan.forensics.overall_tampering_risk > thresholds.forensicsArbiter;
      const templateConcerning =
        scan.template &&
        typeof scan.template.layout_score === "number" &&
        scan.template.layout_score < thresholds.templateMin;
      const ageConcerning =
        scan.age &&
        typeof scan.age.deviation_years === "number" &&
        scan.age.deviation_years > thresholds.ageDeviationLimit;

      if (
        (forensicsConcerning || templateConcerning || ageConcerning) &&
        status === "verified"
      ) {
        status = "review";
        reason = "forensics_signals_concerning";
      }
    }
  }

  const actual = scan.actual_status;
  const wouldFlip = actual != null && actual !== status;

  return {
    correlation_id: scan.correlation_id,
    scan_id: scan.id,
    user_id: scan.user_id,
    dni_number: scan.dni_number,
    created_at: scan.created_at,
    actual_status: actual,
    simulated_status: status,
    simulated_reason: reason,
    would_flip: wouldFlip,
  };
}
