"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

interface StrategyState {
  hasStrategy: boolean;
  strategy?: {
    id: number;
    name: string;
    slug: string;
    status: string;
    start_date: string;
    end_date: string;
    duration_months: number | null;
    north_star_metric: string | null;
    meta_global_descripcion: string | null;
    plan_crecimiento: string | null;
    mision: string | null;
    vision: string | null;
    rubro: string | null;
    descripcion: string | null;
  };
  objectives?: {
    id: number;
    funnel_stage: string;
    objetivo_general: string | null;
    objetivo_especifico: string | null;
    tacticas: string[] | null;
    canales: string[] | null;
    responsable_agent: string | null;
  }[];
  kpis?: {
    id: number;
    name: string;
    funnel_stage: string | null;
    target_value: number | null;
    current_value: number;
    unit: string | null;
    period: string | null;
    status: string;
  }[];
  upcoming?: {
    id: number;
    title: string;
    category: string | null;
    owner_agent_id: string | null;
    scheduled_for: string | null;
    deadline: string | null;
    priority: string;
    status: string;
  }[];
  experiments?: {
    id: number;
    codigo: string | null;
    nombre: string;
    funnel_stage: string | null;
    hacker_agent_id: string | null;
    status: string;
    puntaje_total: number | null;
    hipotesis: string | null;
  }[];
  budget?: { canal: string; amount_usd: number; period_type: string }[];
  reports?: {
    id: number;
    report_type: string;
    title: string;
    period_start: string | null;
    period_end: string | null;
    executive_summary: string | null;
    generated_at: string;
    pinned: boolean;
  }[];
  tasksSummary?: {
    completed: number;
    pending: number;
    overdue: number;
    running: number;
    failed: number;
  };
  totalBudget?: number;
}

function timeAgo(ts: string | number): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("es-PE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return ts;
  }
}

const FUNNEL_COLORS: Record<string, string> = {
  awareness: "#A78BFA",
  consideracion: "#F472B6",
  acquisition: "#60A5FA",
  activation: "#34D399",
  retention: "#FBBF24",
  revenue: "#FB7185",
  referral: "#F0ABFC",
};

const PRIORITY_COLORS: Record<string, string> = {
  alta: "#EF4444",
  media: "#F59E0B",
  baja: "#10B981",
};

export default function StrategyClient() {
  const [data, setData] = useState<StrategyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    "overview" | "objectives" | "kpis" | "tasks" | "experiments" | "budget" | "reports"
  >("overview");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/admin/strategy/state", { cache: "no-store" });
        const json = await r.json();
        if (alive) setData(json);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="text-white/50 p-8 text-center">Cargando estrategia…</div>
    );
  }

  if (!data?.hasStrategy) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-white">
        <div className="bg-gradient-to-br from-amber-400/15 to-transparent border border-amber-400/40 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-3">📋</div>
          <h1 className="text-2xl font-bold mb-2">No hay estrategia activa</h1>
          <p className="text-white/60 mb-5">
            Pedile al Head of Growth que cree una. En el chat del Orquestador escribí:
          </p>
          <div className="bg-black/50 border border-white/10 rounded-lg p-4 text-left text-sm text-white/80 font-mono mb-5">
            &quot;Armá la estrategia completa de marketing para FLUX para los próximos 6 meses&quot;
          </div>
          <Link
            href="/admin/agentes"
            className="inline-block px-5 py-2.5 bg-amber-400 text-black font-bold rounded-full hover:bg-amber-300"
          >
            🤖 Ir al equipo de agentes
          </Link>
        </div>
      </div>
    );
  }

  const { strategy, objectives, kpis, upcoming, experiments, budget, reports, tasksSummary, totalBudget } = data;
  if (!strategy) return null;

  const daysLeft = Math.ceil(
    (new Date(strategy.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const totalDays = Math.ceil(
    (new Date(strategy.end_date).getTime() - new Date(strategy.start_date).getTime()) / (1000 * 60 * 60 * 24),
  );
  const elapsedDays = totalDays - daysLeft;
  const progressPct = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));

  return (
    <div className="text-white min-h-[calc(100vh-52px)]">
      {/* Hero */}
      <div
        className="px-6 py-6 border-b border-white/10"
        style={{
          background: "linear-gradient(135deg, #1B4FFF22 0%, transparent 60%), #0A0A14",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                Estrategia en ejecución
              </div>
              <h1 className="text-3xl font-bold mb-1">{strategy.name}</h1>
              <div className="text-sm text-white/60">
                {formatDate(strategy.start_date)} → {formatDate(strategy.end_date)} ·{" "}
                {strategy.duration_months ?? "—"} meses · status{" "}
                <span className="text-emerald-300 font-semibold">{strategy.status}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href="/api/admin/strategy/export-pdf"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-amber-400 text-black font-bold rounded-full text-sm hover:bg-amber-300"
              >
                📄 Exportar PDF
              </a>
              <Link
                href="/admin/agentes"
                className="px-4 py-2 bg-white/10 border border-white/15 text-white font-semibold rounded-full text-sm hover:bg-white/20"
              >
                🤖 Equipo
              </Link>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-white/40 mb-1">
              <span>Día {elapsedDays} / {totalDays}</span>
              <span>{daysLeft > 0 ? `${daysLeft} días restantes` : "vencida"}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            <StatCard label="North Star" value={strategy.north_star_metric ?? "—"} small />
            <StatCard
              label="Budget total"
              value={totalBudget ? `$${totalBudget.toFixed(0)}` : "$0"}
            />
            <StatCard label="Objetivos" value={String(objectives?.length ?? 0)} />
            <StatCard
              label="KPIs"
              value={String(kpis?.length ?? 0)}
              sub={`${kpis?.filter((k) => k.status === "on_track").length ?? 0} on track`}
            />
            <StatCard
              label="Tasks"
              value={String(
                (tasksSummary?.completed ?? 0) +
                  (tasksSummary?.pending ?? 0) +
                  (tasksSummary?.running ?? 0),
              )}
              sub={`${tasksSummary?.completed ?? 0} done · ${tasksSummary?.pending ?? 0} pending`}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 bg-black/40 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex gap-1 px-6 overflow-x-auto no-scrollbar">
          {(
            ["overview", "objectives", "kpis", "tasks", "experiments", "budget", "reports"] as const
          ).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-xs uppercase tracking-wider border-b-2 whitespace-nowrap ${
                tab === t
                  ? "border-amber-400 text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t === "overview"
                ? "Vista general"
                : t === "objectives"
                  ? "Objetivos"
                  : t === "kpis"
                    ? "KPIs"
                    : t === "tasks"
                      ? "Tareas"
                      : t === "experiments"
                        ? "Experimentos"
                        : t === "budget"
                          ? "Budget"
                          : "Reportes"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {tab === "overview" && (
          <div className="space-y-6">
            {strategy.plan_crecimiento && (
              <Section title="Plan de crecimiento">
                <p className="text-sm text-white/80 leading-relaxed">{strategy.plan_crecimiento}</p>
              </Section>
            )}
            {strategy.mision && (
              <Section title="Misión">
                <p className="text-sm text-white/80">{strategy.mision}</p>
              </Section>
            )}
            {strategy.vision && (
              <Section title="Visión">
                <p className="text-sm text-white/80">{strategy.vision}</p>
              </Section>
            )}
            <Section title="Próximas 10 tareas">
              {upcoming && upcoming.length > 0 ? (
                <div className="space-y-2">
                  {upcoming.slice(0, 10).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: PRIORITY_COLORS[t.priority] ?? "#888" }}
                      />
                      <div className="w-24 text-white/50 font-mono shrink-0">
                        {formatDate(t.scheduled_for ?? t.deadline)}
                      </div>
                      <div className="flex-1 truncate">{t.title}</div>
                      <div className="text-white/40 shrink-0">{t.owner_agent_id}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white/40 text-sm">Sin tareas programadas</div>
              )}
            </Section>
          </div>
        )}

        {tab === "objectives" && (
          <div className="space-y-4">
            {objectives?.map((o) => {
              const color = FUNNEL_COLORS[o.funnel_stage] ?? "#888";
              return (
                <div
                  key={o.id}
                  className="p-5 rounded-xl border"
                  style={{
                    borderColor: `${color}40`,
                    background: `linear-gradient(135deg, ${color}10 0%, transparent 60%)`,
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-widest font-bold mb-2"
                    style={{ color }}
                  >
                    {o.funnel_stage}
                  </div>
                  <div className="font-bold text-white mb-1">{o.objetivo_general ?? "—"}</div>
                  {o.objetivo_especifico && (
                    <div className="text-sm text-white/70 mb-2">{o.objetivo_especifico}</div>
                  )}
                  {o.tacticas && o.tacticas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {o.tacticas.map((t, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/15"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {o.responsable_agent && (
                    <div className="text-[10px] text-white/50 mt-2">
                      responsable: <code className="text-white/80">{o.responsable_agent}</code>
                    </div>
                  )}
                </div>
              );
            })}
            {(!objectives || objectives.length === 0) && (
              <div className="text-center text-white/40 py-12">Sin objetivos definidos</div>
            )}
          </div>
        )}

        {tab === "kpis" && (
          <div className="space-y-3">
            {kpis?.map((k) => {
              const pct =
                k.target_value && k.target_value > 0
                  ? Math.min(100, (k.current_value / k.target_value) * 100)
                  : 0;
              const color = FUNNEL_COLORS[k.funnel_stage ?? ""] ?? "#888";
              return (
                <div
                  key={k.id}
                  className="p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-white">{k.name}</div>
                      <div className="text-[10px] text-white/40 uppercase">
                        {k.funnel_stage} · {k.period}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">
                        {k.current_value} {k.unit} / {k.target_value ?? "—"} {k.unit}
                      </div>
                      <div className="text-[10px] text-white/40">{k.status}</div>
                    </div>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
            {(!kpis || kpis.length === 0) && (
              <div className="text-center text-white/40 py-12">Sin KPIs registrados</div>
            )}
          </div>
        )}

        {tab === "tasks" && (
          <div className="space-y-2">
            {upcoming?.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PRIORITY_COLORS[t.priority] ?? "#888" }}
                />
                <div className="w-24 text-white/50 font-mono text-[11px] shrink-0">
                  {formatDate(t.scheduled_for ?? t.deadline)}
                </div>
                <div className="flex-1 text-sm">{t.title}</div>
                {t.category && (
                  <div className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                    {t.category}
                  </div>
                )}
                <div className="text-[11px] text-white/50 shrink-0 w-32 truncate">
                  {t.owner_agent_id}
                </div>
              </div>
            ))}
            {(!upcoming || upcoming.length === 0) && (
              <div className="text-center text-white/40 py-12">Sin tareas próximas</div>
            )}
          </div>
        )}

        {tab === "experiments" && (
          <div className="space-y-3">
            {experiments?.map((e) => {
              const color = FUNNEL_COLORS[e.funnel_stage ?? ""] ?? "#888";
              return (
                <div
                  key={e.id}
                  className="p-4 rounded-xl border"
                  style={{
                    borderColor: `${color}40`,
                    background: `linear-gradient(135deg, ${color}10 0%, transparent 60%)`,
                  }}
                >
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{
                            background: `${color}25`,
                            color,
                          }}
                        >
                          {e.codigo ?? "#" + e.id}
                        </span>
                        <span className="text-[10px] text-white/50 uppercase">
                          {e.funnel_stage}
                        </span>
                        <span className="text-[10px] text-white/50">· {e.status}</span>
                      </div>
                      <div className="font-bold text-white mt-1">{e.nombre}</div>
                    </div>
                    {e.puntaje_total && (
                      <div className="text-right">
                        <div className="text-[9px] text-white/40 uppercase">PIE score</div>
                        <div className="text-lg font-bold text-amber-300">
                          {e.puntaje_total.toFixed(0)}
                        </div>
                      </div>
                    )}
                  </div>
                  {e.hipotesis && (
                    <div className="text-xs text-white/60 italic mt-2">
                      &quot;{e.hipotesis}&quot;
                    </div>
                  )}
                  {e.hacker_agent_id && (
                    <div className="text-[10px] text-white/40 mt-2">
                      owner: <code>{e.hacker_agent_id}</code>
                    </div>
                  )}
                </div>
              );
            })}
            {(!experiments || experiments.length === 0) && (
              <div className="text-center text-white/40 py-12">Sin experimentos</div>
            )}
          </div>
        )}

        {tab === "budget" && (
          <div className="space-y-3">
            <div className="text-3xl font-bold text-white mb-1">
              ${totalBudget?.toFixed(2) ?? "0"}
            </div>
            <div className="text-xs text-white/40 mb-6">total asignado USD</div>
            {budget && budget.length > 0 ? (
              <div className="space-y-1">
                {(() => {
                  const byCanal = new Map<string, number>();
                  for (const b of budget) {
                    byCanal.set(b.canal, (byCanal.get(b.canal) ?? 0) + Number(b.amount_usd));
                  }
                  const sorted = Array.from(byCanal).sort((a, b) => b[1] - a[1]);
                  const max = Math.max(...sorted.map((x) => x[1]));
                  return sorted.map(([canal, amount]) => (
                    <div key={canal} className="flex items-center gap-3">
                      <div className="w-40 text-xs text-white/80 truncate">{canal}</div>
                      <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: `${(amount / max) * 100}%` }}
                        />
                      </div>
                      <div className="w-20 text-right text-xs font-mono">
                        ${amount.toFixed(0)}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="text-white/40 text-sm">Sin presupuesto asignado</div>
            )}
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-3">
            {reports?.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 uppercase font-bold">
                        {r.report_type}
                      </span>
                      {r.pinned && <span className="text-amber-400">📌</span>}
                    </div>
                    <div className="font-bold text-white mt-1">{r.title}</div>
                  </div>
                  <div className="text-[10px] text-white/40">
                    {timeAgo(r.generated_at)}
                  </div>
                </div>
                {r.executive_summary && (
                  <div className="text-sm text-white/70 mt-2 leading-relaxed">
                    {r.executive_summary}
                  </div>
                )}
              </div>
            ))}
            {(!reports || reports.length === 0) && (
              <div className="text-center text-white/40 py-12">
                Sin reportes todavía. El Growth los genera semanalmente.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl bg-white/5 border border-white/10">
      <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">{title}</div>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  small,
}: {
  label: string;
  value: string;
  sub?: string;
  small?: boolean;
}) {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
      <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
      <div
        className={`font-bold text-white mt-1 ${small ? "text-sm" : "text-xl"} truncate`}
        title={value}
      >
        {value}
      </div>
      {sub && <div className="text-[9px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}
