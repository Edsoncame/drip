/**
 * POST `/api/admin/kyc/calibration/simulate`
 *
 * Endpoint what-if para el dashboard de calibración. Recibe thresholds
 * hipotéticos, corre `simulateEnforcement()` sobre el snapshot cacheado en
 * memoria del request (o lo re-fetch si no se pasa window) y devuelve la
 * matriz + listas de flips y known_blockers.
 *
 * **Side-effect-free.** No escribe. No dispara arbiter (el simulador nunca
 * invoca el LLM — ver `simulateSingle()` en `lib/kyc/calibration.ts`).
 *
 * Protegido con `requireAdmin()`.
 *
 * Body:
 * ```json
 * {
 *   "thresholds": {
 *     "forensicsReject": 0.75,
 *     "forensicsArbiter": 0.4,
 *     "templateMin": 0.6,
 *     "ageDeviationLimit": 5,
 *     "sanctionsReject": 0.85,
 *     "sanctionsEnforce": false
 *   },
 *   "window_days": 30,     // opcional, default 30
 *   "sample_limit": 500    // opcional, default 500
 * }
 * ```
 *
 * Respuesta 200 (privacy-aware: no devuelve `scans[]` completos, solo los
 * bundles que la UI necesita — totales, matriz, flips, blockers):
 * ```json
 * {
 *   "window_days": 30,
 *   "total_scans": 37,
 *   "total_with_forensics": 35,
 *   "total_with_sanctions": 12,
 *   "counts_by_actual_status": { "verified": 30, "rejected": 5, "review": 2 },
 *   "sim": {
 *     "thresholds": { ... },
 *     "input_n": 37,
 *     "verdict_counts": { "verified": 27, "review": 5, "rejected": 5, "pending": 0 },
 *     "transition_matrix": { "verified→verified": 26, "verified→review": 3, ... },
 *     "would_flip": [ { correlation_id, user_id, dni_number, actual_status, simulated_status, simulated_reason, created_at }, ... ],
 *     "known_blockers": [ ... ]
 *   },
 *   "generated_at": "2026-04-24T..."
 * }
 * ```
 *
 * Commit 4/5 del spec calibration dashboard.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureKycSchema } from "@/lib/kyc/db";
import {
  fetchCalibrationSnapshot,
  simulateEnforcement,
  DEFAULT_SIM_THRESHOLDS,
  type SimulationThresholds,
} from "@/lib/kyc/calibration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SimulateBody {
  thresholds?: Partial<SimulationThresholds>;
  window_days?: number;
  sample_limit?: number;
}

/** Valida y normaliza los thresholds incoming, merge con defaults. */
function parseThresholds(input: Partial<SimulationThresholds> | undefined): SimulationThresholds {
  const t = { ...DEFAULT_SIM_THRESHOLDS, ...(input ?? {}) };
  // Clamps defensivos: los sliders de la UI ya limitan, pero el endpoint es
  // público al admin y podría ser llamado con curl.
  t.forensicsReject = clamp(t.forensicsReject, 0, 1);
  t.forensicsArbiter = clamp(t.forensicsArbiter, 0, 1);
  t.templateMin = clamp(t.templateMin, 0, 1);
  t.ageDeviationLimit = clamp(t.ageDeviationLimit, 0, 50);
  t.sanctionsReject = clamp(t.sanctionsReject, 0, 1);
  t.sanctionsEnforce = Boolean(t.sanctionsEnforce);
  // `forensicsArbiter` siempre <= `forensicsReject` (si no, el "concerning"
  // nunca dispararía porque el reject ya cortó antes).
  if (t.forensicsArbiter > t.forensicsReject) {
    t.forensicsArbiter = t.forensicsReject;
  }
  return t;
}

function clamp(n: unknown, min: number, max: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.min(Math.max(v, min), max);
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureKycSchema();

  let body: SimulateBody;
  try {
    body = (await req.json()) as SimulateBody;
  } catch {
    body = {};
  }

  const thresholds = parseThresholds(body.thresholds);
  const windowDays = clamp(body.window_days ?? 30, 1, 365);
  const sampleLimit = clamp(body.sample_limit ?? 500, 10, 5000);

  const snapshot = await fetchCalibrationSnapshot(windowDays, sampleLimit);
  const sim = simulateEnforcement(snapshot, thresholds);

  // No devolvemos `scans[]` crudos (contienen JSONB forenses pesados + user_id).
  // La UI solo necesita los derivados: matriz, would_flip, known_blockers.
  return NextResponse.json({
    window_days: snapshot.window_days,
    total_scans: snapshot.total_scans,
    total_with_forensics: snapshot.total_with_forensics,
    total_with_sanctions: snapshot.total_with_sanctions,
    counts_by_actual_status: snapshot.counts_by_actual_status,
    generated_at: snapshot.generated_at,
    sim: {
      thresholds: sim.thresholds,
      input_n: sim.input_n,
      verdict_counts: sim.verdict_counts,
      transition_matrix: sim.transition_matrix,
      would_flip: sim.would_flip,
      known_blockers: sim.known_blockers,
    },
  });
}
