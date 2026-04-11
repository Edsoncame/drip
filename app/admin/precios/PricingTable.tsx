"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface PricingRow {
  id: string;
  modelo: string;
  plan: string;
  precio_usd: string;
  residual_pct: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  estreno_8m:   "Estreno 8m",
  estreno_16m:  "Estreno 16m",
  estreno_24m:  "Estreno 24m",
  re_8m_usado8: "Re-alquiler 8m\n(usado 8m)",
  re_8m_usado16:"Re-alquiler 8m\n(usado 16m)",
};

const PLAN_ORDER = ["estreno_8m","estreno_16m","estreno_24m","re_8m_usado8","re_8m_usado16"];

export default function PricingTable({ pricing }: { pricing: PricingRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editCell, setEditCell] = useState<string | null>(null); // `${id}`
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [newModelo, setNewModelo] = useState("");

  const models = Array.from(new Set(pricing.map(p => p.modelo)));

  function getCell(modelo: string, plan: string) {
    return pricing.find(p => p.modelo === modelo && p.plan === plan);
  }

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
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
        <div>
          <h2 className="font-700 text-[#18191F]">Tabla de precios de alquiler</h2>
          <p className="text-xs text-[#999999] mt-0.5">Haz clic en cualquier precio para editar · USD/mes</p>
        </div>
        <button
          onClick={() => setAddModelOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-full hover:bg-[#1340CC] transition-colors cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Nuevo modelo
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7F7]">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-700 text-[#666666] min-w-[220px]">Modelo</th>
              {PLAN_ORDER.map(plan => (
                <th key={plan} className="text-center px-4 py-3 text-xs font-700 text-[#666666] whitespace-pre-line min-w-[110px]">
                  {PLAN_LABELS[plan]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {models.map(modelo => (
              <tr key={modelo} className="hover:bg-[#FAFAFA]">
                <td className="px-4 py-4 font-600 text-[#18191F] text-sm">{modelo}</td>
                {PLAN_ORDER.map(plan => {
                  const cell = getCell(modelo, plan);
                  const isEditing = editCell === cell?.id;
                  return (
                    <td key={plan} className="px-4 py-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-center">
                          <span className="text-[#999] text-xs">$</span>
                          <input
                            type="number"
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && cell) saveCell(cell.id);
                              if (e.key === "Escape") setEditCell(null);
                            }}
                            className="w-16 text-center text-sm font-700 border border-[#1B4FFF] rounded-lg px-1 py-1 outline-none"
                            step="1"
                          />
                          <button
                            onClick={() => cell && saveCell(cell.id)}
                            disabled={saving}
                            className="px-1.5 py-1 bg-[#1B4FFF] text-white rounded-lg text-xs cursor-pointer"
                          >✓</button>
                        </div>
                      ) : cell ? (
                        <button
                          onClick={() => { setEditCell(cell.id); setEditValue(cell.precio_usd); }}
                          className="group relative inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span className="font-700 text-[#18191F]">${cell.precio_usd}</span>
                          <svg className="opacity-0 group-hover:opacity-100 transition-opacity text-[#1B4FFF]" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          {cell.residual_pct && (
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-[#999] whitespace-nowrap">
                              Residual {cell.residual_pct}%
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-[#CCC]">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addModelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="font-800 text-[#18191F] mb-4">Nuevo modelo</h3>
            <label className="block text-xs text-[#666] mb-1">Nombre del modelo</label>
            <input
              autoFocus
              value={newModelo}
              onChange={e => setNewModelo(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addModel(); if (e.key === "Escape") setAddModelOpen(false); }}
              placeholder='MacBook Pro 14" M5 (16 GB / 512 GB SSD)'
              className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] mb-4"
            />
            <p className="text-xs text-[#999] mb-4">Se crearán 5 planes con precio $0. Edítalos luego en la tabla.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setAddModelOpen(false)} className="px-4 py-2 text-sm text-[#666] cursor-pointer">Cancelar</button>
              <button onClick={addModel} disabled={saving} className="px-6 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] cursor-pointer disabled:opacity-60">
                {saving ? "Creando…" : "Crear modelo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
