"use client";

/**
 * Cliente interactivo del dashboard de calibración KYC.
 *
 * Reemplaza la matriz/flips estáticos del server-render con sliders
 * reactivos que llaman a `POST /api/admin/kyc/calibration/simulate`.
 *
 * Recibe como props el snapshot (stats no dependientes de thresholds) y la
 * simulación inicial con `DEFAULT_SIM_THRESHOLDS` — primer render no
 * necesita round-trip.
 *
 * Patrones:
 *   - Debounce de 250ms en el slider para no spamear POST.
 *   - AbortController para cancelar requests en vuelo si el slider sigue.
 *   - Estado `loading` suavizado: no parpadea si la respuesta llega < 150ms.
 *
 * Commit 4/5 del spec calibration dashboard.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SimulationThresholds,
  SimulatedScan,
  SimulatedVerdict,
} from "@/lib/kyc/calibration";

/* ─────────────────────────── Tipos ─────────────────────────── */

/** Shape que emite el endpoint `/api/admin/kyc/calibration/simulate`. */
export interface SimulateResponse {
  window_days: number;
  total_scans: number;
  total_with_forensics: number;
  total_with_sanctions: number;
  counts_by_actual_status: Record<string, number>;
  generated_at: string;
  sim: {
    thresholds: SimulationThresholds;
    input_n: number;
    verdict_counts: Record<SimulatedVerdict, number>;
    transition_matrix: Record<string, number>;
    would_flip: SimulatedScan[];
    known_blockers: SimulatedScan[];
  };
}

interface Props {
  /** Snapshot inicial pre-calculado server-side (evita POST en primer render). */
  initial: SimulateResponse;
}

/* ─────────────────────────── Componente ─────────────────────────── */

export default function CalibrationClient({ initial }: Props) {
  const [thresholds, setThresholds] = useState<SimulationThresholds>(
    initial.sim.thresholds,
  );
  const [data, setData] = useState<SimulateResponse>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (t: SimulationThresholds) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Loading suave: solo muestra spinner si la request tarda > 150ms
    const softTimer = setTimeout(() => setLoading(true), 150);

    try {
      const res = await fetch("/api/admin/kyc/calibration/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thresholds: t }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 120)}`);
      }
      const json = (await res.json()) as SimulateResponse;
      setData(json);
      setError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      clearTimeout(softTimer);
      setLoading(false);
    }
  }, []);

  // Debounce: cada cambio de thresholds dispara POST 250ms después
  const updateThreshold = useCallback(
    <K extends keyof SimulationThresholds>(key: K, value: SimulationThresholds[K]) => {
      setThresholds((prev) => {
        const next = { ...prev, [key]: value };
        // Auto-correct: forensicsArbiter nunca puede ser > forensicsReject
        if (key === "forensicsReject" && next.forensicsArbiter > (value as number)) {
          next.forensicsArbiter = value as number;
        }
        if (key === "forensicsArbiter" && (value as number) > next.forensicsReject) {
          next.forensicsArbiter = next.forensicsReject;
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => run(thresholds), 250);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [thresholds, run]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const resetToDefaults = () => {
    setThresholds(initial.sim.thresholds);
  };

  const { sim } = data;
  const flipsTop50 = sim.would_flip.slice(0, 50);
  const transitionKeys = Object.keys(sim.transition_matrix).sort();

  return (
    <div className="space-y-6">
      {/* Panel sliders */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Thresholds simulados</h2>
            <p className="text-[12px] text-white/50 mt-0.5">
              Los sliders reejecutan el simulador contra los mismos {data.total_scans} scans.
              No toca DB, no llama arbiter.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {loading && (
              <span className="text-[10px] uppercase tracking-widest text-amber-300 animate-pulse">
                simulando…
              </span>
            )}
            <button
              onClick={resetToDefaults}
              className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded border border-white/15 hover:bg-white/5 transition-colors"
            >
              Reset defaults
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Slider
            label="forensics reject"
            hint="overall_tampering_risk ≥ este valor → rejected automático"
            min={0}
            max={1}
            step={0.01}
            value={thresholds.forensicsReject}
            onChange={(v) => updateThreshold("forensicsReject", v)}
            fmt={(v) => v.toFixed(2)}
          />
          <Slider
            label="forensics arbiter"
            hint="overall_tampering_risk > este valor → entra a review (arbiter)"
            min={0}
            max={1}
            step={0.01}
            value={thresholds.forensicsArbiter}
            onChange={(v) => updateThreshold("forensicsArbiter", v)}
            fmt={(v) => v.toFixed(2)}
          />
          <Slider
            label="template min score"
            hint="layout_score < este valor → concerning"
            min={0}
            max={1}
            step={0.01}
            value={thresholds.templateMin}
            onChange={(v) => updateThreshold("templateMin", v)}
            fmt={(v) => v.toFixed(2)}
          />
          <Slider
            label="age deviation limit (años)"
            hint="deviation_years > este valor → concerning (rekognition vs DOB)"
            min={0}
            max={20}
            step={0.5}
            value={thresholds.ageDeviationLimit}
            onChange={(v) => updateThreshold("ageDeviationLimit", v)}
            fmt={(v) => `${v.toFixed(1)} años`}
          />
          <Slider
            label="sanctions reject"
            hint="risk_score ≥ este valor Y sanctionsEnforce=true → rejected"
            min={0}
            max={1}
            step={0.01}
            value={thresholds.sanctionsReject}
            onChange={(v) => updateThreshold("sanctionsReject", v)}
            fmt={(v) => v.toFixed(2)}
            disabled={!thresholds.sanctionsEnforce}
          />
          <div className="flex flex-col gap-2">
            <label className="text-[11px] uppercase tracking-widest text-white/60">
              sanctions enforce
            </label>
            <button
              onClick={() =>
                updateThreshold("sanctionsEnforce", !thresholds.sanctionsEnforce)
              }
              className={`px-4 py-3 rounded-lg text-[12px] font-bold text-left transition-colors ${
                thresholds.sanctionsEnforce
                  ? "bg-red-500/20 border border-red-400/40 text-red-200"
                  : "bg-white/5 border border-white/15 text-white/60"
              }`}
            >
              {thresholds.sanctionsEnforce
                ? "🔴 Sanctions ENFORCING"
                : "👁 Sanctions observación"}
            </button>
            <p className="text-[11px] text-white/40">
              Toggle equivalente a{" "}
              <code className="font-mono text-amber-300">KYC_SANCTIONS_ENFORCE=true</code>.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            ⚠ {error}
          </div>
        )}
      </section>

      {/* KPIs del simulado */}
      <section className="grid grid-cols-5 gap-3">
        <StatCard label="Input scans" value={sim.input_n} />
        {(["verified", "review", "rejected", "pending"] as SimulatedVerdict[]).map((v) => (
          <StatCard
            key={v}
            label={`→ ${v}`}
            value={sim.verdict_counts[v] ?? 0}
            tone={
              v === "rejected" && (sim.verdict_counts[v] ?? 0) > 0
                ? "warn"
                : v === "verified"
                ? "ok"
                : "default"
            }
          />
        ))}
      </section>

      {/* Transition matrix */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold">Matriz actual → simulado</h2>
          <p className="text-[12px] text-white/50 mt-0.5">
            Celdas amber = flip. Celdas grises = status se mantiene.
          </p>
        </div>
        {transitionKeys.length === 0 ? (
          <p className="text-sm text-white/40 py-6 text-center border border-white/10 rounded-lg">
            Sin transiciones — no hay scans en la ventana.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {transitionKeys.map((k) => {
              const [actual, simulated] = k.split("→");
              const n = sim.transition_matrix[k];
              const flip = actual !== simulated && actual !== "unknown";
              return (
                <div
                  key={k}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    flip
                      ? "bg-amber-500/10 border-amber-400/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px]">
                    <StatusBadge status={actual} />
                    <span className="text-white/40">→</span>
                    <StatusBadge status={simulated} />
                  </div>
                  <div className="text-lg font-black">{n}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Known blockers */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold">
            Known blockers ({sim.known_blockers.length})
          </h2>
          <p className="text-[12px] text-white/50 mt-0.5">
            Scans con DNI real que el simulador rechazaría. Antes de activar
            enforce, revisar caso por caso.
          </p>
        </div>
        {sim.known_blockers.length === 0 ? (
          <p className="text-sm text-emerald-300/70 py-3 px-4 bg-emerald-500/5 border border-emerald-400/20 rounded-lg">
            ✓ Ningún scan con DNI real sería rechazado automáticamente con estos thresholds.
          </p>
        ) : (
          <ScanList scans={sim.known_blockers} tone="danger" />
        )}
      </section>

      {/* Would flip */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold">
            Would flip — top {flipsTop50.length} de {sim.would_flip.length}
          </h2>
          <p className="text-[12px] text-white/50 mt-0.5">
            Scans cuyo verdict cambiaría bajo enforce. Ordenados por fecha desc.
          </p>
        </div>
        {flipsTop50.length === 0 ? (
          <p className="text-sm text-emerald-300/70 py-3 px-4 bg-emerald-500/5 border border-emerald-400/20 rounded-lg">
            ✓ Cero flips — el simulador coincide 100% con verdict.ts bajo estos thresholds.
          </p>
        ) : (
          <ScanList scans={flipsTop50} tone="warn" />
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────── Sub-componentes ─────────────────────────── */

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  fmt,
  disabled = false,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 ${disabled ? "opacity-40" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[11px] uppercase tracking-widest text-white/60 font-mono">
          {label}
        </label>
        <span className="text-[13px] font-mono font-bold tabular-nums text-amber-300">
          {fmt(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-amber-400 w-full disabled:cursor-not-allowed"
      />
      {hint && <p className="text-[10.5px] text-white/40">{hint}</p>}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const toneMap = {
    default: "bg-white/5 border-white/10",
    ok: "bg-emerald-500/10 border-emerald-400/30",
    warn: "bg-amber-500/10 border-amber-400/30",
    danger: "bg-red-500/10 border-red-400/30",
  } as const;
  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="text-2xl font-black mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const map: Record<string, string> = {
    verified: "bg-emerald-500/20 text-emerald-200",
    rejected: "bg-red-500/20 text-red-200",
    review: "bg-amber-500/20 text-amber-200",
    pending: "bg-white/10 text-white/60",
    capturing: "bg-blue-500/20 text-blue-200",
    blocked: "bg-zinc-500/30 text-zinc-200",
    unknown: "bg-white/5 text-white/40",
  };
  const cls = map[status ?? ""] ?? "bg-white/5 text-white/40";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {status ?? "—"}
    </span>
  );
}

function ScanList({
  scans,
  tone,
}: {
  scans: SimulatedScan[];
  tone: "warn" | "danger";
}) {
  const toneCls =
    tone === "danger"
      ? "border-red-400/30 bg-red-500/5"
      : "border-amber-400/30 bg-amber-500/5";
  return (
    <div className={`rounded-xl border ${toneCls} overflow-hidden`}>
      <table className="w-full text-[11px]">
        <thead className="bg-white/5 text-white/60 uppercase tracking-wider text-[10px]">
          <tr>
            <th className="px-3 py-2 text-left">corr_id</th>
            <th className="px-3 py-2 text-left">user_id</th>
            <th className="px-3 py-2 text-left">DNI</th>
            <th className="px-3 py-2 text-left">Actual</th>
            <th className="px-3 py-2 text-left">Simulado</th>
            <th className="px-3 py-2 text-left">Razón</th>
            <th className="px-3 py-2 text-right">Cuándo</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.scan_id} className="border-t border-white/5 hover:bg-white/5">
              <td className="px-3 py-1.5 font-mono text-[10px] text-white/60">
                {s.correlation_id.slice(0, 8)}…
              </td>
              <td className="px-3 py-1.5 font-mono text-[10px] text-white/60">
                {s.user_id ? s.user_id.slice(0, 8) + "…" : "—"}
              </td>
              <td className="px-3 py-1.5 font-mono">{s.dni_number ?? "—"}</td>
              <td className="px-3 py-1.5">
                <StatusBadge status={s.actual_status} />
              </td>
              <td className="px-3 py-1.5">
                <StatusBadge status={s.simulated_status} />
              </td>
              <td className="px-3 py-1.5 text-white/60 text-[10px]">
                {s.simulated_reason}
              </td>
              <td className="px-3 py-1.5 text-right text-white/40 text-[10px]">
                {timeAgo(s.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
