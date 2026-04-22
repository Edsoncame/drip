"use client";

/**
 * DashboardClient — Admin KPI Dashboard (Fase 2)
 * ------------------------------------------------
 * Render del snapshot pre-computado por `fetchDashboardSnapshot()` en el server.
 * No hace llamadas propias — los datos vienen en props. Interactividad mínima
 * (hover en sparkline, tooltip inline).
 *
 * Paleta FLUX: primary #1B4FFF, success #2D7D46, warn #FF8A00, danger #D84040.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  DashboardSnapshot,
  MrrHistoryPoint,
} from "@/lib/kpi-queries";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtSoles(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtSolesFull(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPct(n: number | null, digits = 1): string {
  if (n === null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(digits)}%`;
}

function fmtInt(n: number): string {
  return n.toLocaleString("es-PE");
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sparkline (SVG inline, sin dependencias)
// ---------------------------------------------------------------------------

function Sparkline({
  points,
  width = 240,
  height = 56,
  color = "#1B4FFF",
}: {
  points: MrrHistoryPoint[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return null;

  const values = points.map((p) => p.mrr);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padY = 4;
  const innerH = height - padY * 2;
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = padY + innerH - ((p.mrr - min) / range) * innerH;
    return { x, y, mrr: p.mrr, date: p.date };
  });

  const pathD = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(" ");

  const areaD =
    `M${coords[0].x.toFixed(2)},${height} ` +
    coords
      .map((c) => `L${c.x.toFixed(2)},${c.y.toFixed(2)}`)
      .join(" ") +
    ` L${coords[coords.length - 1].x.toFixed(2)},${height} Z`;

  const hovered = hover !== null ? coords[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="mrr-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Área */}
        <path d={areaD} fill="url(#mrr-grad)" />

        {/* Línea */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Punto hover */}
        {hovered && (
          <circle
            cx={hovered.x}
            cy={hovered.y}
            r={3.5}
            fill="#fff"
            stroke={color}
            strokeWidth={2}
          />
        )}

        {/* Hit areas invisibles */}
        {coords.map((c, i) => (
          <rect
            key={i}
            x={c.x - step / 2}
            y={0}
            width={step}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {hovered && (
        <div
          className="absolute -top-8 bg-[#18191F] text-white text-[10px] font-600 px-2 py-1 rounded-md whitespace-nowrap pointer-events-none"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          {fmtSoles(hovered.mrr)} ·{" "}
          {new Date(hovered.date).toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card genérica
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  emoji?: string;
  href?: string;
  children?: React.ReactNode;
}

function StatCard({
  label,
  value,
  sub,
  delta,
  deltaTone = "neutral",
  emoji,
  href,
  children,
}: StatCardProps) {
  const deltaColor =
    deltaTone === "positive"
      ? "text-[#2D7D46]"
      : deltaTone === "negative"
      ? "text-[#D84040]"
      : "text-[#666]";

  const inner = (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-700 text-[#999] uppercase tracking-wider">
          {label}
        </p>
        {emoji && <span className="text-base leading-none">{emoji}</span>}
      </div>
      <p className="text-2xl font-800 text-[#18191F] leading-tight">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta && <span className={`font-700 ${deltaColor}`}>{delta}</span>}
        {sub && <span className="text-[#999]">{sub}</span>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </>
  );

  const cls =
    "block bg-white rounded-2xl border border-[#E5E5E5] p-4 transition-colors";

  if (href) {
    return (
      <Link href={href} className={`${cls} hover:border-[#1B4FFF] cursor-pointer`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

// ---------------------------------------------------------------------------
// Inbox row (una fila por "cosa que esperás decidir")
// ---------------------------------------------------------------------------

function InboxRow({
  label,
  count,
  href,
  emoji,
}: {
  label: string;
  count: number;
  href: string;
  emoji: string;
}) {
  const isEmpty = count === 0;
  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-3 border-b border-[#F0F0F0] last:border-b-0 transition-colors ${
        isEmpty ? "hover:bg-[#FAFAFA]" : "hover:bg-[#FFF7EE]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-base">{emoji}</span>
        <span className="text-sm text-[#333] font-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-800 ${
            isEmpty ? "text-[#999]" : "text-[#FF8A00]"
          }`}
        >
          {fmtInt(count)}
        </span>
        <span className="text-[#999] text-xs">→</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Client principal
// ---------------------------------------------------------------------------

export default function DashboardClient({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const {
    mrr,
    mrrHistory,
    clientesActivos,
    clientesNuevosEsteMes,
    churnMensual,
    ltvPromedio,
    revenue,
    pagosAtrasados,
    expansion,
    inbox,
    generatedAt,
  } = snapshot;

  // Tono del delta de MRR
  const mrrDeltaTone: "positive" | "negative" | "neutral" =
    mrr.delta30d > 0 ? "positive" : mrr.delta30d < 0 ? "negative" : "neutral";

  const mrrDeltaStr = `${mrr.delta30d >= 0 ? "▲" : "▼"} ${fmtSoles(
    Math.abs(mrr.delta30d),
  )} (${fmtPct(mrr.deltaPct30d)})`;

  // Tono del churn: bajo es bueno. >5% mensual es malo.
  const churnTone: "positive" | "negative" | "neutral" =
    churnMensual >= 0.05 ? "negative" : churnMensual > 0 ? "neutral" : "positive";

  // Total inbox
  const inboxTotal =
    inbox.kycPendientes + inbox.pagosPorValidar + inbox.reclamacionesAbiertas;

  // Revenue proyectado: cobrado + pendiente del mes
  const revenueProyectado = revenue.cobrado + revenue.pendiente;

  // Suma total de valor potencial (expansion MRR * 12 meses es proxy de upside anual,
  // pero mostramos MRR mensual que es más intuitivo)
  const hasExpansion = expansion.count > 0;

  // Pagos atrasados
  const hasOverdue = pagosAtrasados.count > 0;

  // Memo del path de la sparkline reusado — ya se calcula dentro del componente

  const updatedLabel = useMemo(() => fmtDate(generatedAt), [generatedAt]);

  return (
    <div className="space-y-6">
      {/* Header con metadata */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-800 text-[#18191F]">📊 Dashboard</h1>
          <p className="text-sm text-[#999] mt-0.5">
            Vista ejecutiva del negocio · snapshot al {updatedLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-xs text-[#666] hover:text-[#1B4FFF] transition-colors px-3 py-1.5 border border-[#E5E5E5] rounded-lg hover:border-[#1B4FFF]"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* ROW 1 — MRR hero card (full width, con sparkline) + cards chicas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MRR hero — ocupa 2 cols en desktop */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E5E5] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-700 text-[#999] uppercase tracking-wider">
              MRR actual
            </p>
            <span className="text-base leading-none">💰</span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap mb-2">
            <p className="text-4xl font-800 text-[#18191F] leading-none">
              {fmtSoles(mrr.current)}
            </p>
            <span
              className={`text-sm font-700 ${
                mrrDeltaTone === "positive"
                  ? "text-[#2D7D46]"
                  : mrrDeltaTone === "negative"
                  ? "text-[#D84040]"
                  : "text-[#666]"
              }`}
            >
              {mrrDeltaStr}
            </span>
            <span className="text-xs text-[#999]">vs hace 30 días</span>
          </div>
          <div className="mt-4">
            <Sparkline points={mrrHistory} color="#1B4FFF" height={64} />
          </div>
        </div>

        {/* Clientes activos */}
        <div className="grid grid-cols-1 gap-4">
          <StatCard
            label="Clientes activos"
            value={fmtInt(clientesActivos)}
            sub={`${clientesNuevosEsteMes} nuevos este mes`}
            deltaTone="neutral"
            emoji="👥"
            href="/admin/clientes"
          />
          <StatCard
            label="Churn mensual"
            value={fmtPct(churnMensual, 1)}
            sub="ventana móvil 30d"
            deltaTone={churnTone}
            emoji="📉"
          />
        </div>
      </div>

      {/* ROW 2 — Revenue + LTV + Pagos atrasados + Expansion */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenue mes"
          value={fmtSoles(revenue.cobrado)}
          sub={`${fmtSoles(revenue.pendiente)} pendiente`}
          delta={`Proyectado ${fmtSoles(revenueProyectado)}`}
          deltaTone="neutral"
          emoji="💳"
          href="/admin/pagos"
        />
        <StatCard
          label="LTV promedio"
          value={fmtSoles(ltvPromedio)}
          sub="valor contratado por cliente"
          deltaTone="neutral"
          emoji="📈"
        />
        <StatCard
          label="Pagos atrasados"
          value={fmtInt(pagosAtrasados.count)}
          sub={fmtSolesFull(pagosAtrasados.monto)}
          deltaTone={hasOverdue ? "negative" : "positive"}
          emoji={hasOverdue ? "⚠️" : "✅"}
          href="/admin/pagos"
        />
        <StatCard
          label="Oportunidades 🎯"
          value={fmtInt(expansion.count)}
          sub={`+${fmtSoles(expansion.mrrPotencial)}/mes potencial`}
          deltaTone={hasExpansion ? "positive" : "neutral"}
          emoji="🚀"
          href="/admin/expansion"
        />
      </div>

      {/* ROW 3 — Inbox admin */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between bg-[#FAFBFF]">
          <div>
            <h2 className="font-700 text-[#18191F] text-sm">Inbox admin</h2>
            <p className="text-[11px] text-[#999] mt-0.5">
              Cosas que esperan tu decisión
            </p>
          </div>
          <span
            className={`text-xs font-800 px-2 py-0.5 rounded-full ${
              inboxTotal > 0
                ? "bg-[#FF8A00] text-white"
                : "bg-[#E8F4EA] text-[#2D7D46]"
            }`}
          >
            {inboxTotal > 0 ? `${inboxTotal} pendientes` : "Todo al día ✓"}
          </span>
        </div>
        <div>
          <InboxRow
            label="KYC pendientes"
            count={inbox.kycPendientes}
            emoji="🛡️"
            href="/admin/kyc"
          />
          <InboxRow
            label="Pagos por validar"
            count={inbox.pagosPorValidar}
            emoji="💳"
            href="/admin/pagos"
          />
          <InboxRow
            label="Reclamaciones abiertas"
            count={inbox.reclamacionesAbiertas}
            emoji="📒"
            href="/admin/reclamaciones"
          />
        </div>
      </div>

      {/* ROW 4 — Atajos rápidos */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
        <p className="text-[11px] font-700 text-[#999] uppercase tracking-wider mb-3">
          Atajos
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/expansion"
            className="text-xs font-600 text-[#1B4FFF] border border-[#1B4FFF]/30 hover:bg-[#1B4FFF] hover:text-white rounded-lg px-3 py-1.5 transition-colors"
          >
            🎯 Ver oportunidades
          </Link>
          <Link
            href="/admin/clientes"
            className="text-xs font-600 text-[#666] border border-[#E5E5E5] hover:border-[#1B4FFF] hover:text-[#1B4FFF] rounded-lg px-3 py-1.5 transition-colors"
          >
            👥 Lista de clientes
          </Link>
          <Link
            href="/admin/finanzas"
            className="text-xs font-600 text-[#666] border border-[#E5E5E5] hover:border-[#1B4FFF] hover:text-[#1B4FFF] rounded-lg px-3 py-1.5 transition-colors"
          >
            💼 Finanzas / Burn
          </Link>
          <Link
            href="/admin/inventario"
            className="text-xs font-600 text-[#666] border border-[#E5E5E5] hover:border-[#1B4FFF] hover:text-[#1B4FFF] rounded-lg px-3 py-1.5 transition-colors"
          >
            💻 Inventario
          </Link>
          <Link
            href="/admin/estrategia"
            className="text-xs font-600 text-[#666] border border-[#E5E5E5] hover:border-[#1B4FFF] hover:text-[#1B4FFF] rounded-lg px-3 py-1.5 transition-colors"
          >
            📋 Estrategia
          </Link>
        </div>
      </div>

      {/* Footer nota */}
      <p className="text-[11px] text-[#999] text-center">
        Datos calculados on-demand. MRR incluye estados{" "}
        <code className="text-[#666]">active · delivered · shipped · preparing</code>.
      </p>
    </div>
  );
}
