import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ensureKycSchema } from "@/lib/kyc/db";
import {
  fetchCalibrationSnapshot,
  simulateEnforcement,
  DEFAULT_SIM_THRESHOLDS,
  type CalibrationMetricDist,
  type SimulatedScan,
  type SimulatedVerdict,
} from "@/lib/kyc/calibration";
import AdminNav from "../../../AdminNav";

export const metadata: Metadata = {
  title: "KYC Forense · Calibración · Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WINDOW_DAYS = 30;
const SAMPLE_LIMIT = 500;

/**
 * `/admin/kyc/forensics/calibration`
 *
 * Dashboard read-only que responde a la pregunta operacional:
 * **"¿Puedo activar `KYC_FORENSICS_ENFORCE=true` sin bloquear users legítimos?"**
 *
 * Lee los últimos 500 scans de la ventana de 30 días, corre el simulador con
 * los thresholds default (los mismos de producción) y muestra el delta vs el
 * verdict real. Si `would_flip` es grande o `known_blockers` tiene users con
 * DNI real, **no activar enforce** hasta revisar caso por caso.
 *
 * Sliders interactivos (what-if con thresholds custom) → commit 4/5.
 */
export default async function KycCalibrationPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");
  await ensureKycSchema();

  const snapshot = await fetchCalibrationSnapshot(WINDOW_DAYS, SAMPLE_LIMIT);
  const sim = simulateEnforcement(snapshot, DEFAULT_SIM_THRESHOLDS);
  const enforceFlag = process.env.KYC_FORENSICS_ENFORCE === "true";
  const sanctionsEnforce = process.env.KYC_SANCTIONS_ENFORCE === "true";

  const metrics: { key: string; dist: CalibrationMetricDist; goodLow: boolean }[] = [
    { key: "forensics.overall_tampering_risk", dist: snapshot.forensics_overall, goodLow: true },
    { key: "forensics.ela.mean_score", dist: snapshot.forensics_ela_mean, goodLow: true },
    { key: "forensics.copy_move.score", dist: snapshot.forensics_copy_move, goodLow: true },
    { key: "template.layout_score", dist: snapshot.template_layout, goodLow: false },
    { key: "age.deviation_years", dist: snapshot.age_deviation, goodLow: true },
    { key: "sanctions.risk_score", dist: snapshot.sanctions_risk, goodLow: true },
  ];

  const flipsTop50 = sim.would_flip.slice(0, 50);
  const transitionKeys = Object.keys(sim.transition_matrix).sort();

  const statuses = ["verified", "rejected", "review", "pending", "unknown"];

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white">
      <AdminNav />
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-white/40 mb-1">
              <Link href="/admin/kyc/forensics" className="hover:text-white/70">
                ← Forense
              </Link>
              <span>/</span>
              <span>Calibración</span>
            </div>
            <h1 className="text-2xl font-black">KYC · Calibración de enforcement</h1>
            <p className="text-sm text-white/50 mt-1">
              Simula qué pasaría si <code className="font-mono text-amber-300">KYC_FORENSICS_ENFORCE=true</code>{" "}
              con los thresholds actuales. Ventana: últimos {snapshot.window_days} días,{" "}
              {snapshot.total_scans} scans.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <EnforceBadge label="Forensics" active={enforceFlag} />
            <EnforceBadge label="Sanctions" active={sanctionsEnforce} />
          </div>
        </div>

        {/* KPIs principales */}
        <div className="grid grid-cols-5 gap-3">
          <StatCard label="Total scans" value={snapshot.total_scans} />
          <StatCard
            label="Con forensics"
            value={`${snapshot.total_with_forensics}/${snapshot.total_scans}`}
            tone={snapshot.total_with_forensics === 0 ? "warn" : "default"}
          />
          <StatCard
            label="Con sanctions"
            value={`${snapshot.total_with_sanctions}/${snapshot.total_scans}`}
            tone={snapshot.total_with_sanctions === 0 ? "warn" : "default"}
          />
          <StatCard
            label="Would flip"
            value={sim.would_flip.length}
            tone={sim.would_flip.length > 0 ? "warn" : "ok"}
          />
          <StatCard
            label="Known blockers"
            value={sim.known_blockers.length}
            tone={sim.known_blockers.length > 0 ? "danger" : "ok"}
          />
        </div>

        {/* Status counts */}
        <Section title="Verdict actual (baseline)">
          <div className="grid grid-cols-5 gap-2">
            {statuses.map((st) => (
              <div
                key={st}
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <StatusBadge status={st} />
                <div className="text-2xl font-black mt-2">
                  {snapshot.counts_by_actual_status[st] ?? 0}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Distribuciones */}
        <Section
          title="Distribuciones por métrica"
          subtitle="Elegí un threshold mirando dónde cae la masa. P95 es el techo de la población 'normal'."
        >
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-white/5 text-white/60 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2 text-left">Métrica</th>
                  <th className="px-2 py-2 text-right">n</th>
                  <th className="px-2 py-2 text-right">missing</th>
                  <th className="px-2 py-2 text-right">P50</th>
                  <th className="px-2 py-2 text-right">P75</th>
                  <th className="px-2 py-2 text-right">P90</th>
                  <th className="px-2 py-2 text-right">P95</th>
                  <th className="px-2 py-2 text-right">P99</th>
                  <th className="px-2 py-2 text-right">Max</th>
                  <th className="px-2 py-2 text-center">Dirección</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr
                    key={m.key}
                    className="border-t border-white/5 hover:bg-white/5"
                  >
                    <td className="px-3 py-1.5 font-mono text-[11px]">{m.key}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {m.dist.n === 0 ? (
                        <span className="text-white/30">—</span>
                      ) : (
                        m.dist.n
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-white/50">
                      {m.dist.missing || "—"}
                    </td>
                    <PercentileCells dist={m.dist} />
                    <td className="px-2 py-1.5 text-center text-[10px] text-white/50">
                      {m.goodLow ? "↓ bajo = ok" : "↑ alto = ok"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-white/40 mt-2">
            <strong className="text-white/60">Nota operativa:</strong> si{" "}
            <code className="font-mono">forensics.ela.mean_score</code> y{" "}
            <code className="font-mono">forensics.copy_move.score</code> marcan n=0 pero{" "}
            <code className="font-mono">forensics.overall_tampering_risk</code> tiene data, es porque el
            calibrator busca un shape jerárquico (<code>forensics.ela.mean_score</code>) mientras que{" "}
            <code className="font-mono">lib/kyc/forensics.ts</code> emite shape flat (
            <code>ela_score</code>). El overall sí está disponible y es la métrica que decide enforce.
          </p>
        </Section>

        {/* Transition matrix */}
        <Section
          title="Matriz actual → simulado"
          subtitle={`Con thresholds default (forensicsReject=${DEFAULT_SIM_THRESHOLDS.forensicsReject}, templateMin=${DEFAULT_SIM_THRESHOLDS.templateMin}, ageDev=${DEFAULT_SIM_THRESHOLDS.ageDeviationLimit}, sanctionsEnforce=${DEFAULT_SIM_THRESHOLDS.sanctionsEnforce}).`}
        >
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
          <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
            {(["verified", "review", "rejected", "pending"] as SimulatedVerdict[]).map((v) => (
              <div
                key={v}
                className="rounded-lg bg-white/5 border border-white/10 p-2 flex items-center justify-between"
              >
                <StatusBadge status={v} />
                <span className="font-mono font-bold">
                  {sim.verdict_counts[v]}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Known blockers */}
        <Section
          title={`Known blockers (${sim.known_blockers.length})`}
          subtitle="Scans con DNI real que el simulador RECHAZARÍA. Antes de activar enforce, revisar caso por caso."
        >
          {sim.known_blockers.length === 0 ? (
            <p className="text-sm text-emerald-300/70 py-3 px-4 bg-emerald-500/5 border border-emerald-400/20 rounded-lg">
              ✓ Ningún scan con DNI real sería rechazado automáticamente. Seguro activar enforce.
            </p>
          ) : (
            <ScanList scans={sim.known_blockers} tone="danger" />
          )}
        </Section>

        {/* Would flip list */}
        <Section
          title={`Would flip — top ${flipsTop50.length} de ${sim.would_flip.length}`}
          subtitle="Scans cuyo verdict cambiaría bajo enforce. Ordenados por fecha desc."
        >
          {flipsTop50.length === 0 ? (
            <p className="text-sm text-emerald-300/70 py-3 px-4 bg-emerald-500/5 border border-emerald-400/20 rounded-lg">
              ✓ Cero flips — el simulador coincide 100% con verdict.ts actual.
            </p>
          ) : (
            <ScanList scans={flipsTop50} tone="warn" />
          )}
        </Section>

        {/* Pre-enforce checklist */}
        <Section title="Pre-enforce checklist">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2 text-[12px]">
            <Check
              ok={snapshot.total_scans >= 100}
              label={`Sample size ≥ 100 scans (actual: ${snapshot.total_scans})`}
            />
            <Check
              ok={snapshot.total_with_forensics / Math.max(snapshot.total_scans, 1) >= 0.9}
              label={`≥90% scans con forensics_json poblado (actual: ${snapshot.total_with_forensics}/${snapshot.total_scans})`}
            />
            <Check
              ok={sim.known_blockers.length === 0}
              label={`Zero known blockers con DNI real (actual: ${sim.known_blockers.length})`}
            />
            <Check
              ok={(snapshot.forensics_overall.p95 ?? 0) < DEFAULT_SIM_THRESHOLDS.forensicsReject}
              label={`P95 de overall_tampering_risk < ${DEFAULT_SIM_THRESHOLDS.forensicsReject} (actual: ${fmt(snapshot.forensics_overall.p95)})`}
            />
            <Check
              ok={(sim.verdict_counts.rejected ?? 0) / Math.max(snapshot.total_scans, 1) < 0.3}
              label={`Tasa de rejected simulada < 30% (actual: ${fmt(
                (sim.verdict_counts.rejected ?? 0) / Math.max(snapshot.total_scans, 1),
                2,
              )})`}
            />
          </div>
          <p className="text-[11px] text-white/40 mt-3">
            Si los 5 checks están en verde, abrí Vercel → drip → Settings → Environment
            Variables y seteá <code className="font-mono text-amber-300">KYC_FORENSICS_ENFORCE=true</code>,
            luego Redeploy. La UI de arriba (<Link href="/admin/kyc/forensics" className="underline">
            /admin/kyc/forensics</Link>) pasará del badge 👁 observación a 🔴 ENFORCING.
          </p>
        </Section>

        <div className="text-[10px] text-white/30 text-right">
          Snapshot generado: {new Date(snapshot.generated_at).toLocaleString("es-PE")}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Componentes ───────────────────────────── */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && (
          <p className="text-[12px] text-white/50 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
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
      <div className="text-[10px] uppercase tracking-widest text-white/50">
        {label}
      </div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}

function EnforceBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold ${
        active
          ? "bg-red-500/20 text-red-200 border border-red-400/40"
          : "bg-white/10 text-white/60 border border-white/20"
      }`}
    >
      {active ? `🔴 ${label} ENFORCING` : `👁 ${label} obs`}
    </div>
  );
}

function PercentileCells({ dist }: { dist: CalibrationMetricDist }) {
  if (dist.n === 0) {
    return (
      <>
        <td className="px-2 py-1.5 text-right text-white/25 font-mono" colSpan={6}>
          sin data en la ventana
        </td>
      </>
    );
  }
  return (
    <>
      <td className="px-2 py-1.5 text-right font-mono">{fmt(dist.p50)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{fmt(dist.p75)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{fmt(dist.p90)}</td>
      <td className="px-2 py-1.5 text-right font-mono font-bold">
        {fmt(dist.p95)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">{fmt(dist.p99)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{fmt(dist.max)}</td>
    </>
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

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
          ok ? "bg-emerald-500/30 text-emerald-200" : "bg-red-500/30 text-red-200"
        }`}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span className={ok ? "text-white/80" : "text-white/60"}>{label}</span>
    </div>
  );
}

/* ───────────────────────────── Utils ───────────────────────────── */

function fmt(n: number | undefined | null, digits = 3): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
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
