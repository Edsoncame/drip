"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { calcPlan, PLAN_RESIDUAL_PCT } from "@/lib/finance";

interface PricingRow {
  id: string;
  modelo: string;
  plan: string;
  precio_usd: string;
  residual_pct: string | null;
}

const PLAN_META: Record<string, { label: string; meses: number }> = {
  estreno_8m:    { label: "Estreno 8m",            meses: 8  },
  estreno_16m:   { label: "Estreno 16m",           meses: 16 },
  estreno_24m:   { label: "Estreno 24m",           meses: 24 },
  re_8m_usado8:  { label: "Re-alquiler\n(usado 8m)",  meses: 8  },
  re_8m_usado16: { label: "Re-alquiler\n(usado 16m)", meses: 8  },
};
const PLAN_ORDER = ["estreno_8m", "estreno_16m", "estreno_24m", "re_8m_usado8", "re_8m_usado16"];

function MarginBadge({ margin }: { margin: number }) {
  const cls =
    margin >= 28 ? "bg-green-50 text-green-700" :
    margin >= 15 ? "bg-yellow-50 text-yellow-700" :
                   "bg-red-50 text-red-600";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-700 transition-colors ${cls}`}>
      {margin >= 0 ? "+" : ""}{margin.toFixed(1)}%
    </span>
  );
}

const LS_KEY = "flux_pricing_params";

export default function PricingTable({ pricing }: { pricing: PricingRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editCell, setEditCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [newModelo, setNewModelo] = useState("");

  // ── Financial params ──────────────────────────────────────────────────────
  const [tasa, setTasa]   = useState(0);
  const [plazo, setPlazo] = useState(12);
  const [opex, setOpex]   = useState(25);
  const [costos, setCostos] = useState<Record<string, string>>({});

  // Load persisted params from localStorage
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
      if (p.tasa  !== undefined) setTasa(p.tasa);
      if (p.plazo !== undefined) setPlazo(p.plazo);
      if (p.opex  !== undefined) setOpex(p.opex);
      if (p.costos) setCostos(p.costos);
    } catch { /* ignore */ }
  }, []);

  function persist(patch: object) {
    try {
      const prev = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
      localStorage.setItem(LS_KEY, JSON.stringify({ ...prev, ...patch }));
    } catch { /* ignore */ }
  }

  const models = Array.from(new Set(pricing.map(p => p.modelo)));
  const hasCostos = models.some(m => Number(costos[m]) > 0);

  function getCell(modelo: string, plan: string) {
    return pricing.find(p => p.modelo === modelo && p.plan === plan);
  }

  function getCalc(modelo: string, plan: string) {
    const pc = Number(costos[modelo]);
    if (!pc) return null;
    const cell = getCell(modelo, plan);
    if (!cell) return null;
    const meta = PLAN_META[plan];
    if (!meta) return null;
    const residualPct = Number(cell.residual_pct) || PLAN_RESIDUAL_PCT[String(meta.meses)] || 55;
    const tarifa = Number(cell.precio_usd) || 0;
    const calc = calcPlan(pc, tasa, plazo, opex, residualPct, meta.meses, tarifa || undefined);
    const margin = tarifa > 0 ? ((tarifa - calc.breakEven) / tarifa) * 100 : 0;
    return { breakEven: calc.breakEven, suggested: calc.suggested, margin };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  async function saveCell(id: string) {
    setSaving(true);
    const cell = pricing.find(p => p.id === id);
    await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, precio_usd: Number(editValue), residual_pct: cell?.residual_pct }),
    });
    setEditCell(null);
    setSaving(false);
    startTransition(() => router.refresh());
  }

  async function addModel() {
    if (!newModelo.trim()) return;
    setSaving(true);
    await Promise.all(PLAN_ORDER.map(plan =>
      fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelo: newModelo.trim(), plan, precio_usd: 0 }),
      })
    ));
    setNewModelo("");
    setAddModelOpen(false);
    setSaving(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">

      {/* ── Parámetros financieros ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-700 text-[#18191F]">Parámetros financieros</p>
            <p className="text-xs text-[#999] mt-0.5">
              Configura costos para ver break-even y margen en cada precio
            </p>
          </div>
          {hasCostos && (
            <div className="flex items-center gap-3 text-[10px] text-[#666] flex-shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />≥28% margen
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />15–28%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />&lt;15%
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Tasa anual (%)</label>
            <input type="number" value={tasa} min={0} max={100} step={0.5}
              onChange={e => { const v = Number(e.target.value); setTasa(v); persist({ tasa: v }); }}
              className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] transition-colors" />
            <p className="text-[10px] text-[#999] mt-1">0 = cuotas sin interés</p>
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">Plazo crédito (meses)</label>
            <input type="number" value={plazo} min={1} max={60}
              onChange={e => { const v = Number(e.target.value); setPlazo(v); persist({ plazo: v }); }}
              className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] transition-colors" />
          </div>
          <div>
            <label className="text-xs text-[#666] mb-1.5 block">OPEX mensual (USD)</label>
            <input type="number" value={opex} min={0} step={1}
              onChange={e => { const v = Number(e.target.value); setOpex(v); persist({ opex: v }); }}
              className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] transition-colors" />
          </div>
        </div>
      </div>

      {/* ── Pricing table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <div>
            <h2 className="font-700 text-[#18191F]">Tabla de precios de alquiler</h2>
            <p className="text-xs text-[#999999] mt-0.5">
              Clic en precio para editar · ingresa precio de compra para ver break-even
            </p>
          </div>
          <button onClick={() => setAddModelOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-full hover:bg-[#1340CC] transition-colors cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nuevo modelo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F7F7]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-700 text-[#666666] min-w-[200px]">Modelo</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-[#1B4FFF] min-w-[120px]">
                  Precio compra
                </th>
                {PLAN_ORDER.map(plan => (
                  <th key={plan} className="text-center px-4 py-3 text-xs font-700 text-[#666666] whitespace-pre-line min-w-[120px]">
                    {PLAN_META[plan].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {models.map(modelo => (
                <tr key={modelo} className="hover:bg-[#FAFAFA] transition-colors group">

                  {/* Modelo */}
                  <td className="px-4 py-4 font-600 text-[#18191F] text-sm leading-tight">{modelo}</td>

                  {/* Precio de compra — editable inline */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <span className="text-[#999] text-xs">$</span>
                      <input
                        type="number"
                        placeholder="—"
                        value={costos[modelo] ?? ""}
                        onChange={e => {
                          const next = { ...costos, [modelo]: e.target.value };
                          setCostos(next);
                          persist({ costos: next });
                        }}
                        className="w-20 text-sm font-600 text-[#18191F] border-b border-dashed border-[#CCC] hover:border-[#1B4FFF] focus:border-[#1B4FFF] outline-none bg-transparent transition-colors py-0.5 placeholder:text-[#CCC]"
                      />
                    </div>
                  </td>

                  {/* Plan cells */}
                  {PLAN_ORDER.map(plan => {
                    const cell = getCell(modelo, plan);
                    const isEditing = editCell === cell?.id;
                    const calc = getCalc(modelo, plan);

                    return (
                      <td key={plan} className="px-4 py-4 text-center align-top">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <span className="text-[#999] text-xs">$</span>
                            <input type="number" autoFocus value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter" && cell) saveCell(cell.id);
                                if (e.key === "Escape") setEditCell(null);
                              }}
                              className="w-16 text-center text-sm font-700 border border-[#1B4FFF] rounded-lg px-1 py-1 outline-none"
                              step="1" />
                            <button onClick={() => cell && saveCell(cell.id)} disabled={saving}
                              className="px-1.5 py-1 bg-[#1B4FFF] text-white rounded-lg text-xs cursor-pointer hover:bg-[#1340CC] transition-colors">
                              ✓
                            </button>
                          </div>
                        ) : cell ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            {/* Tarifa editable */}
                            <button
                              onClick={() => { setEditCell(cell.id); setEditValue(cell.precio_usd); }}
                              className="group/btn inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span className="font-700 text-[#18191F] group-hover/btn:text-[#1B4FFF] transition-colors">
                                ${cell.precio_usd}
                              </span>
                              <svg className="opacity-0 group-hover/btn:opacity-100 transition-opacity text-[#1B4FFF]"
                                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>

                            {/* Break-even + margen */}
                            {calc && (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[10px] text-[#999] font-500">
                                  BE ${calc.breakEven.toFixed(2)}
                                </span>
                                <MarginBadge margin={calc.margin} />
                              </div>
                            )}

                            {/* Residual hint */}
                            {cell.residual_pct && (
                              <span className="text-[9px] text-[#CCC]">res. {cell.residual_pct}%</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#CCC] text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Reference ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5">
        <h3 className="font-700 text-[#18191F] mb-3 text-sm">Referencia de planes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#666]">
          {[
            ["Estreno 8m",    "Equipo nuevo · contrato 8m · residual 77.5%"],
            ["Estreno 16m",   "Equipo nuevo · contrato 16m · residual 55%"],
            ["Estreno 24m",   "Equipo nuevo · contrato 24m · residual 32.5%"],
            ["Re-alquiler (usado 8m)",  "Equipo con 8m de uso · residual 55%"],
            ["Re-alquiler (usado 16m)", "Equipo con 16m de uso · residual 32.5%"],
          ].map(([k, v]) => (
            <div key={k}><span className="font-700 text-[#333]">{k}</span> — {v}</div>
          ))}
        </div>
      </div>

      {/* ── New model modal ────────────────────────────────────────────────── */}
      {addModelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="font-800 text-[#18191F] mb-4">Nuevo modelo</h3>
            <label className="block text-xs text-[#666] mb-1">Nombre del modelo</label>
            <input autoFocus value={newModelo} onChange={e => setNewModelo(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addModel(); if (e.key === "Escape") setAddModelOpen(false); }}
              placeholder='MacBook Pro 14" M5 (16 GB / 512 GB SSD)'
              className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] mb-4 transition-colors" />
            <p className="text-xs text-[#999] mb-4">Se crearán 5 planes con precio $0. Edítalos luego.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setAddModelOpen(false)}
                className="px-4 py-2 text-sm text-[#666] hover:text-[#333] transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={addModel} disabled={saving}
                className="px-6 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] transition-colors cursor-pointer disabled:opacity-60">
                {saving ? "Creando…" : "Crear modelo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
