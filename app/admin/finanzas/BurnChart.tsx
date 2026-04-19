"use client";

import { useState } from "react";

type MonthData = {
  period: string;
  total_usd: number;
  by_category: Record<string, number>;
};

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  hosting:    { label: "Hosting",       color: "#3B82F6" },
  "ai-api":   { label: "AI APIs",       color: "#8B5CF6" },
  payments:   { label: "Pagos",         color: "#6366F1" },
  email:      { label: "Email",         color: "#06B6D4" },
  database:   { label: "Base de datos", color: "#10B981" },
  storage:    { label: "Storage",       color: "#F59E0B" },
  domain:     { label: "Dominio",       color: "#64748B" },
  legal:      { label: "Legal",         color: "#6B7280" },
  mdm:        { label: "MDM",           color: "#EF4444" },
  marketing:  { label: "Marketing",     color: "#EC4899" },
  whatsapp:   { label: "WhatsApp",      color: "#22C55E" },
  otros:      { label: "Otros",         color: "#94A3B8" },
};

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function BurnChart({ history }: { history: MonthData[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxTotal = Math.max(1, ...history.map((m) => m.total_usd));
  const allCats = Array.from(
    new Set(history.flatMap((m) => Object.keys(m.by_category))),
  ).sort((a, b) => {
    // ordenar por gasto total desc para que los grandes queden abajo
    const sumA = history.reduce((s, m) => s + (m.by_category[a] ?? 0), 0);
    const sumB = history.reduce((s, m) => s + (m.by_category[b] ?? 0), 0);
    return sumB - sumA;
  });

  // Calcular delta mom (mes actual vs anterior)
  const current = history[history.length - 1];
  const prev = history[history.length - 2];
  const momDelta = prev && prev.total_usd > 0
    ? ((current.total_usd - prev.total_usd) / prev.total_usd) * 100
    : null;

  // Dimensiones SVG
  const width = 720;
  const height = 240;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 32;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const barW = Math.min(60, (chartW / history.length) * 0.7);
  const barGap = (chartW - barW * history.length) / (history.length - 1 || 1);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="font-700 text-[#18191F]">Burn mensual · últimos {history.length} meses</h3>
          <p className="text-xs text-[#999] mt-0.5">
            Total actual: <strong>${current.total_usd.toFixed(2)}</strong>
            {momDelta !== null && (
              <span className={momDelta > 10 ? "text-red-600 ml-2" : momDelta < -10 ? "text-emerald-600 ml-2" : "text-[#666] ml-2"}>
                {momDelta >= 0 ? "▲" : "▼"} {Math.abs(momDelta).toFixed(0)}% vs mes anterior
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allCats.map((cat) => {
            const meta = CATEGORY_META[cat] ?? { label: cat, color: "#94A3B8" };
            return (
              <div key={cat} className="flex items-center gap-1.5 text-[11px] text-[#666]">
                <span className="w-3 h-3 rounded-sm" style={{ background: meta.color }} />
                {meta.label}
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Grid horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((r) => {
            const y = padTop + chartH * (1 - r);
            const val = maxTotal * r;
            return (
              <g key={r}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#F0F0F0" strokeWidth={1} />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#999">{fmtUsd(val)}</text>
              </g>
            );
          })}

          {/* Bars apiladas por categoría */}
          {history.map((month, i) => {
            const x = padLeft + i * (barW + barGap);
            const total = month.total_usd;
            const hovered = hoveredIdx === i;
            let yOffset = 0;

            return (
              <g
                key={month.period}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {allCats.map((cat) => {
                  const val = month.by_category[cat] ?? 0;
                  if (val <= 0) return null;
                  const h = (val / maxTotal) * chartH;
                  const y = padTop + chartH - yOffset - h;
                  yOffset += h;
                  const meta = CATEGORY_META[cat] ?? { color: "#94A3B8", label: cat };
                  return (
                    <rect
                      key={cat}
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      fill={meta.color}
                      opacity={hovered || hoveredIdx === null ? 1 : 0.4}
                    >
                      <title>{meta.label}: ${val.toFixed(2)}</title>
                    </rect>
                  );
                })}

                {/* Total sobre la barra */}
                {total > 0 && (
                  <text
                    x={x + barW / 2}
                    y={padTop + chartH - (total / maxTotal) * chartH - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill="#18191F"
                  >
                    {fmtUsd(total)}
                  </text>
                )}

                {/* Label del mes */}
                <text
                  x={x + barW / 2}
                  y={height - padBottom + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#666"
                >
                  {new Date(month.period + "-01").toLocaleDateString("es-PE", { month: "short" })}
                </text>
                <text
                  x={x + barW / 2}
                  y={height - padBottom + 28}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#999"
                >
                  {month.period.slice(2, 4)}&apos;{month.period.slice(5, 7)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip con breakdown del mes hovered */}
      {hoveredIdx !== null && (
        <div className="mt-3 p-3 bg-[#F7F7F7] rounded-xl">
          <p className="text-xs font-700 text-[#18191F] mb-1.5">
            {new Date(history[hoveredIdx].period + "-01").toLocaleDateString("es-PE", { month: "long", year: "numeric" })} · <span className="text-[#1B4FFF]">${history[hoveredIdx].total_usd.toFixed(2)}</span>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(history[hoveredIdx].by_category)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, usd]) => {
                const meta = CATEGORY_META[cat] ?? { label: cat, color: "#94A3B8" };
                return (
                  <span key={cat} className="text-[11px] text-[#333] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm" style={{ background: meta.color }} />
                    {meta.label}: <strong>${usd.toFixed(2)}</strong>
                  </span>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
