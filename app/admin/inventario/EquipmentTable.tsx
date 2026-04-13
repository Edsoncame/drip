"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  calcPlan, solveMonthlyRate, monthlyToAnnualPct, calcCuota,
  PLAN_RESIDUAL_PCT, TARGET_MARGIN,
} from "@/lib/finance";

export interface Equipment {
  id: string;
  codigo_interno: string;
  marca: string;
  modelo_completo: string;
  chip: string | null;
  ram: string | null;
  ssd: string | null;
  color: string | null;
  teclado: string | null;
  numero_serie: string | null;
  proveedor: string | null;
  factura_url: string | null;
  web_url: string | null;
  fecha_compra: string | null;
  mantenimiento_proximo: string | null;
  precio_compra_usd: string | null;
  tipo_cambio: string | null;
  valor_soles: string | null;
  tipo_financiamiento: string | null;
  tasa_pct: string | null;
  plazo_credito_meses: number | null;
  cuota_credito_soles: string | null;
  estado_actual: string;
  cliente_actual: string | null;
  tipo_arriendo_meses: number | null;
  inicio_alquiler: string | null;
  fin_alquiler: string | null;
  tarifa_usd: string | null;
  opex_usd: string | null;
  ingreso_neto_mensual_usd: string | null;
  valor_residual_usd: string | null;
  ingreso_total_proyectado_usd: string | null;
  rentabilidad_pct: string | null;
  seguro: string | null;
  garantia_anos: number | null;
  ubicacion_fisica: string | null;
  responsable: string | null;
  usuario_dispositivo: string | null;
  clave_dispositivo: string | null;
  clave_vault: string | null;
  clave_vault_url: string | null;
  observaciones: string | null;
  colaborador: string | null;
  compra_status: string | null;
  compra_notas: string | null;
  compra_inicio: string | null;
  tipo_renta: string | null;
  meses_uso_previo: number | null;
  area: string | null;
}

const ESTADO_STYLES: Record<string, string> = {
  "Arrendada": "bg-green-100 text-green-700",
  "Disponible": "bg-blue-100 text-blue-700",
  "Mantenimiento": "bg-yellow-100 text-yellow-700",
  "Vendida": "bg-gray-100 text-gray-500",
};

const EMPTY: Partial<Equipment> = {
  marca: "Apple", estado_actual: "Disponible",
  tipo_cambio: "3.39", teclado: "Español",
};

// ─── Rentabilidad badge ────────────────────────────────────────────────────
function RentBadge({ pct }: { pct: number }) {
  const color = pct >= 20 ? "text-green-700 bg-green-50" : pct >= 0 ? "text-blue-700 bg-blue-50" : "text-red-600 bg-red-50";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-700 ${color}`}>{pct.toFixed(1)}%</span>;
}

export default function EquipmentTable({ equipment }: { equipment: Equipment[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Equipment> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreds, setShowCreds] = useState<string | null>(null);

  const estados = ["Todos", ...Array.from(new Set(equipment.map(e => e.estado_actual.split(" / ")[0])))];

  const filtered = equipment.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || [e.codigo_interno, e.modelo_completo, e.numero_serie, e.cliente_actual, e.proveedor, e.color].some(v => v?.toLowerCase().includes(q));
    const matchEstado = filterEstado === "Todos" || e.estado_actual.startsWith(filterEstado);
    return matchSearch && matchEstado;
  });

  function openCreate() { setEditing({ ...EMPTY }); setModalOpen(true); }
  function openEdit(eq: Equipment) { setEditing({ ...eq }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch("/api/admin/equipment", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      closeModal();
      startTransition(() => router.refresh());
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, codigo: string) {
    if (!confirm(`¿Eliminar ${codigo}?`)) return;
    setDeleting(id);
    await fetch("/api/admin/equipment", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setDeleting(null);
    startTransition(() => router.refresh());
  }

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" });
  }
  function fmtUSD(v: string | null | number) {
    if (v == null || v === "") return "—";
    return `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  function daysUntil(d: string | null) {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  }

  // Compute live rentabilidad for table display — tasa always derived from cuota+plazo
  function liveRent(eq: Equipment): number | null {
    const precio = Number(eq.precio_compra_usd);
    const plazo = eq.plazo_credito_meses ?? 0;
    const opex = Number(eq.opex_usd);
    const tarifa = Number(eq.tarifa_usd);
    const meses = eq.tipo_arriendo_meses ?? 16;
    const tc = Number(eq.tipo_cambio) || 3.39;
    const cuotaSoles = Number(eq.cuota_credito_soles) || 0;
    const valorSoles = Number(eq.valor_soles) || (precio * tc);
    if (!precio || !tarifa) return null;
    const monthly = (cuotaSoles > 0 && plazo > 0 && valorSoles > 0)
      ? solveMonthlyRate(valorSoles, cuotaSoles, plazo) : 0;
    const tasa = monthlyToAnnualPct(monthly);
    const residualPct = PLAN_RESIDUAL_PCT[String(meses)] ?? 55;
    const r = calcPlan(precio, tasa, plazo, opex, residualPct, meses, tarifa);
    return r.rentabilidad ?? null;
  }

  // Derived tasa for table display
  function derivedTasaForRow(eq: Equipment): string {
    const precio = Number(eq.precio_compra_usd);
    const plazo = eq.plazo_credito_meses ?? 0;
    const tc = Number(eq.tipo_cambio) || 3.39;
    const cuotaSoles = Number(eq.cuota_credito_soles) || 0;
    const valorSoles = Number(eq.valor_soles) || (precio * tc);
    if (cuotaSoles > 0 && plazo > 0 && valorSoles > 0) {
      const r = solveMonthlyRate(valorSoles, cuotaSoles, plazo);
      const pct = monthlyToAnnualPct(r);
      if (pct < 0.5) return `Sin intereses · ${plazo}m`;
      return `${pct.toFixed(1)}% · ${plazo}m`;
    }
    return plazo > 0 ? `— · ${plazo}m` : "—";
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-700 text-[#18191F]">Inventario de equipos</h2>
          <p className="text-xs text-[#999999] mt-0.5">{filtered.length} de {equipment.length} equipos</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Buscar código, modelo, S/N…" value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] w-56" />
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-full hover:bg-[#1340CC] transition-colors cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Nuevo equipo
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
        {estados.map(e => {
          const count = e === "Todos" ? equipment.length : equipment.filter(eq => eq.estado_actual.startsWith(e)).length;
          return (
            <button key={e} onClick={() => setFilterEstado(e)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-600 transition-colors cursor-pointer ${filterEstado === e ? "bg-[#1B4FFF] text-white" : "bg-[#F5F5F7] text-[#666666] hover:bg-[#E8E8EA]"}`}>
              {e} <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7F7]">
            <tr>
              {["Código / Modelo","Spec","N° Serie","Estado / Cliente","Alquiler","Tarifa / OPEX","Costo compra","Financiamiento","Mantenimiento","ROI",""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666666] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-12 text-[#999999]">Sin resultados</td></tr>
            ) : filtered.map(eq => {
              const stStyle = ESTADO_STYLES[eq.estado_actual.split(" / ")[0]] ?? "bg-gray-100 text-gray-500";
              const days = daysUntil(eq.mantenimiento_proximo);
              const maintAlert = days !== null && days <= 30;
              const isExp = expanded === eq.id;
              const rent = liveRent(eq);

              return (
                <>
                  <tr key={eq.id} className={`hover:bg-[#FAFAFA] transition-colors cursor-pointer ${isExp ? "bg-[#F5F8FF]" : ""}`}
                    onClick={() => setExpanded(isExp ? null : eq.id)}>
                    <td className="px-4 py-3">
                      <p className="font-700 text-xs text-[#1B4FFF] font-mono">{eq.codigo_interno}</p>
                      <p className="text-xs text-[#333333] mt-0.5 max-w-[160px] truncate">{eq.modelo_completo}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666]">
                      <p>{eq.chip} · {eq.ram}</p>
                      <p>{eq.ssd} · {eq.color}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-[#555]">{eq.numero_serie ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-700 ${stStyle}`}>{eq.estado_actual.split(" / ")[0]}</span>
                      {eq.cliente_actual && <p className="text-xs text-[#999] mt-1 truncate max-w-[120px]">{eq.cliente_actual}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666]">
                      <p>{eq.tipo_arriendo_meses ? `${eq.tipo_arriendo_meses}m` : "—"}</p>
                      <p className="text-[#999]">{fmtDate(eq.inicio_alquiler)} → {fmtDate(eq.fin_alquiler)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-700 text-[#18191F]">{fmtUSD(eq.tarifa_usd)}<span className="text-xs font-400 text-[#999]">/m</span></p>
                      <p className="text-xs text-[#999]">OPEX {fmtUSD(eq.opex_usd)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-600">{fmtUSD(eq.precio_compra_usd)}</p>
                      <p className="text-xs text-[#999]">S/ {eq.valor_soles ? Number(eq.valor_soles).toLocaleString() : "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666]">
                      <p className="truncate max-w-[110px]">{eq.tipo_financiamiento ?? "—"}</p>
                      <p className="text-[#999]">{derivedTasaForRow(eq)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {eq.mantenimiento_proximo && days !== null ? (
                        <>
                          <p className={maintAlert ? "font-700 text-orange-600" : "text-[#666666]"}>
                            {fmtDate(eq.mantenimiento_proximo)}
                          </p>
                          <p className={maintAlert ? "text-[10px] text-orange-600" : "text-[10px] text-[#999]"}>
                            {days > 0 ? `en ${days}d` : `hace ${Math.abs(days)}d`}
                          </p>
                        </>
                      ) : <span className="text-[#999]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {rent !== null ? <RentBadge pct={rent} /> : <span className="text-xs text-[#999]">—</span>}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(eq)} className="px-2.5 py-1 rounded-full text-xs font-700 bg-[#F5F5F7] text-[#333] hover:bg-[#E8E8EA] cursor-pointer">Editar</button>
                        <button onClick={() => handleDelete(eq.id, eq.codigo_interno)} disabled={deleting === eq.id}
                          className="px-2.5 py-1 rounded-full text-xs font-700 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer disabled:opacity-50">
                          {deleting === eq.id ? "…" : "✕"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExp && (
                    <tr key={`${eq.id}-exp`} className="bg-[#F5F8FF]">
                      <td colSpan={11} className="px-6 pb-5 pt-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          <InfoCell label="Proveedor" value={eq.proveedor ?? "—"} />
                          <InfoCell label="Fecha compra" value={fmtDate(eq.fecha_compra)} />
                          <InfoCell label="Ingreso neto/mes" value={fmtUSD(eq.ingreso_neto_mensual_usd)} />
                          <InfoCell label="Valor residual" value={fmtUSD(eq.valor_residual_usd)} />
                          <InfoCell label="Ingreso total proy." value={fmtUSD(eq.ingreso_total_proyectado_usd)} />
                          <InfoCell label="Rentabilidad guardada" value={eq.rentabilidad_pct ? `${eq.rentabilidad_pct}%` : "—"} />
                          <InfoCell label="Seguro" value={eq.seguro ?? "—"} />
                          <InfoCell label="Garantía" value={eq.garantia_anos ? `${eq.garantia_anos} años` : "—"} />
                          <InfoCell label="Ubicación" value={eq.ubicacion_fisica ?? "—"} />
                          <InfoCell label="Responsable" value={eq.responsable ?? "—"} />
                          <InfoCell label="Cuota crédito" value={eq.cuota_credito_soles ? `S/ ${Number(eq.cuota_credito_soles).toLocaleString()}` : "—"} />
                          <InfoCell label="Teclado" value={eq.teclado ?? "—"} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => setShowCreds(showCreds === eq.id ? null : eq.id)}
                            className="flex items-center gap-1.5 text-xs text-[#1B4FFF] hover:underline cursor-pointer">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            {showCreds === eq.id ? "Ocultar credenciales" : "Ver credenciales del equipo"}
                          </button>
                        </div>
                        {showCreds === eq.id && (
                          <div className="grid grid-cols-3 gap-3 mt-2">
                            <InfoCell label="Usuario" value={eq.usuario_dispositivo ?? "—"} copy />
                            <InfoCell label="Clave" value={eq.clave_dispositivo ?? "—"} copy />
                            <InfoCell label="Clave Vault" value={eq.clave_vault ?? "—"} copy />
                          </div>
                        )}
                        {eq.observaciones && <p className="text-xs text-[#666] mt-2 bg-white rounded-xl px-3 py-2 border border-[#E5E5E5]">📝 {eq.observaciones}</p>}
                        <div className="flex flex-wrap gap-3 mt-2">
                          {eq.clave_vault_url && (
                            <a href={eq.clave_vault_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#1B4FFF] hover:underline">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                              Ver clave vault
                            </a>
                          )}
                          {eq.factura_url && (
                            <a href={eq.factura_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#666] hover:underline">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                              Ver factura
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && editing && (
        <EquipmentModal
          data={editing}
          onChange={patch => setEditing(prev => ({ ...prev, ...patch }))}
          onSave={handleSave}
          onClose={closeModal}
          saving={saving}
        />
      )}
    </div>
  );
}

// ─── Info cell ────────────────────────────────────────────────────────────────
function InfoCell({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-white rounded-xl p-3 border border-[#E5E5E5]">
      <p className="text-xs text-[#999999] mb-0.5">{label}</p>
      <div className="flex items-center gap-1">
        <p className="text-xs font-600 text-[#18191F] truncate flex-1">{value}</p>
        {copy && value !== "—" && (
          <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-[#1B4FFF] flex-shrink-0 cursor-pointer" title="Copiar">
            {copied ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
type ModalProps = {
  data: Partial<Equipment>;
  onChange: (patch: Partial<Equipment>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
};

function EquipmentModal({ data, onChange, onSave, onClose, saving }: ModalProps) {
  const f = (key: keyof Equipment) => (data[key] as string) ?? "";
  const set = (key: keyof Equipment) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ [key]: e.target.value });

  // ── Financial calculator state ──────────────────────────────────────────
  const [calcMargin, setCalcMargin] = useState(TARGET_MARGIN * 100); // editable margin %

  const precio = Number(data.precio_compra_usd) || 0;
  const plazo = Number(data.plazo_credito_meses) || 0;
  const opex = Number(data.opex_usd) || 0;
  const tarifa = Number(data.tarifa_usd) || 0;
  const mesesArr = Number(data.tipo_arriendo_meses) || 16;
  const tc = Number(data.tipo_cambio) || 3.39;

  // Tasa siempre calculada desde cuota + plazo + precio (Newton-Raphson)
  const cuotaSoles = Number(data.cuota_credito_soles) || 0;
  const valorSoles = Number(data.valor_soles) || (precio * tc);
  const monthlyRate = (cuotaSoles > 0 && plazo > 0 && valorSoles > 0)
    ? solveMonthlyRate(valorSoles, cuotaSoles, plazo)
    : 0;
  const tasa = monthlyToAnnualPct(monthlyRate); // % anual, siempre derivada
  const tasaReady = tasa > 0;

  // Auto-calculate valor_soles when precio + tc change
  useEffect(() => {
    if (precio > 0 && tc > 0 && !data.valor_soles) {
      onChange({ valor_soles: (precio * tc).toFixed(0) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precio, tc]);

  // Plan calculations
  const planCalcs = [8, 16, 24].map(m => {
    const residualPct = PLAN_RESIDUAL_PCT[String(m)] ?? 55;
    return {
      m,
      ...calcPlan(precio, tasa, plazo, opex, residualPct, m, tarifa || undefined, calcMargin / 100),
    };
  });

  // Current plan calc
  const currentPlanResidue = PLAN_RESIDUAL_PCT[String(mesesArr)] ?? 55;
  const currentPlan = precio > 0
    ? calcPlan(precio, tasa, plazo, opex, currentPlanResidue, mesesArr, tarifa || undefined, calcMargin / 100)
    : null;

  // Apply suggestions to form fields
  const applyCalc = useCallback(() => {
    if (!currentPlan || !precio) return;
    onChange({
      valor_residual_usd: currentPlan.residualUsd.toFixed(2),
      ingreso_neto_mensual_usd: tarifa > 0 ? (tarifa - opex).toFixed(2) : undefined,
      ingreso_total_proyectado_usd: tarifa > 0 ? (tarifa * mesesArr).toFixed(2) : undefined,
      rentabilidad_pct: currentPlan.rentabilidad != null ? currentPlan.rentabilidad.toFixed(2) : undefined,
    });
  }, [currentPlan, precio, tarifa, opex, mesesArr, onChange]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
          <h3 className="font-800 text-[#18191F]">{data.id ? "Editar equipo" : "Nuevo equipo"}</h3>
          <button onClick={onClose} className="text-[#999] hover:text-[#333] cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-6 max-h-[78vh] overflow-y-auto">

          {/* ══ CALCULADORA FINANCIERA ══════════════════════════════════════ */}
          {precio > 0 && (
            <div className="bg-[#EEF2FF] rounded-2xl p-4 border border-[#C7D2FE]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-800 text-[#1B4FFF] uppercase tracking-wide">Calculadora financiera</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#666]">Margen objetivo</label>
                  <input
                    type="number" value={calcMargin} min={0} max={60} step={1}
                    onChange={e => setCalcMargin(Number(e.target.value))}
                    className="w-14 text-center text-xs font-700 border border-[#C7D2FE] rounded-lg px-2 py-1 outline-none bg-white"
                  />
                  <span className="text-xs text-[#666]">%</span>
                </div>
              </div>

              {/* Tasa calculada automáticamente */}
              <div className="bg-white rounded-xl px-4 py-2 mb-3 border border-[#E0E7FF] text-xs">
                {tasaReady ? (
                  <div className="grid grid-cols-4 gap-2 text-[#555]">
                    <div>
                      <span className="text-[#999]">Tasa calculada</span><br />
                      <span className="font-800 text-[#1B4FFF]">{tasa.toFixed(2)}% anual</span>
                    </div>
                    <div>
                      <span className="text-[#999]">Mensual</span><br />
                      <span className="font-700">{(tasa/12).toFixed(3)}%</span>
                    </div>
                    <div>
                      <span className="text-[#999]">Financiamiento total</span><br />
                      <span className="font-700">${(precio*(tasa/100)*(plazo/12)).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[#999]">Cuota USD equiv.</span><br />
                      <span className="font-700">${calcCuota(precio, monthlyRate, plazo).toFixed(2)}/m</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[#999] italic">Ingresa precio de compra, cuota y plazo para calcular la tasa automáticamente.</p>
                )}
              </div>

              {/* Plan table */}
              <div className="bg-white rounded-xl overflow-hidden border border-[#E0E7FF]">
                <table className="w-full text-xs">
                  <thead className="bg-[#F0F4FF]">
                    <tr>
                      <th className="text-left px-3 py-2 font-700 text-[#666]">Plan</th>
                      <th className="text-right px-3 py-2 font-700 text-[#666]">Residual</th>
                      <th className="text-right px-3 py-2 font-700 text-[#666]">Break-even</th>
                      <th className="text-right px-3 py-2 font-700 text-[#1B4FFF]">Precio sug. ({calcMargin}%)</th>
                      {tarifa > 0 && <th className="text-right px-3 py-2 font-700 text-[#666]">ROI actual</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2FF]">
                    {planCalcs.map(p => {
                      const isCurrent = p.m === mesesArr;
                      return (
                        <tr key={p.m} className={isCurrent ? "bg-[#EEF2FF]" : ""}>
                          <td className="px-3 py-2 font-600 text-[#333]">
                            {p.m}m <span className="text-[#999]">({p.residualPct}% residual)</span>
                            {isCurrent && <span className="ml-1 text-[#1B4FFF]">← actual</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-[#555]">${p.residualUsd.toFixed(0)}</td>
                          <td className="px-3 py-2 text-right text-[#555]">${p.breakEven.toFixed(2)}/m</td>
                          <td className="px-3 py-2 text-right font-800 text-[#1B4FFF]">
                            <button
                              onClick={() => onChange({ tarifa_usd: Math.ceil(p.suggested).toString(), tipo_arriendo_meses: p.m })}
                              className="underline decoration-dotted cursor-pointer hover:text-[#1340CC]"
                              title="Aplicar este precio"
                            >
                              ${Math.ceil(p.suggested)}/m
                            </button>
                          </td>
                          {tarifa > 0 && (
                            <td className="px-3 py-2 text-right">
                              {p.rentabilidad != null ? <RentBadge pct={p.rentabilidad} /> : "—"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button onClick={applyCalc}
                className="mt-3 w-full py-2 text-xs font-700 bg-[#1B4FFF] text-white rounded-xl hover:bg-[#1340CC] cursor-pointer transition-colors">
                Aplicar cálculos al formulario (residual, rentabilidad, ingreso)
              </button>
            </div>
          )}

          {/* Identificación */}
          <Section title="Identificación">
            <Row>
              <Field label="Código interno *" value={f("codigo_interno")} onChange={set("codigo_interno")} placeholder="TKA-MACPRO-M4-001" mono />
              <Field label="Marca" value={f("marca")} onChange={set("marca")} placeholder="Apple" />
            </Row>
            <Field label="Modelo completo *" value={f("modelo_completo")} onChange={set("modelo_completo")} placeholder='MacBook Pro 14" M4 (2024)' />
            <Row>
              <Field label="Chip" value={f("chip")} onChange={set("chip")} placeholder="M4" />
              <Field label="RAM" value={f("ram")} onChange={set("ram")} placeholder="16 GB" />
              <Field label="SSD" value={f("ssd")} onChange={set("ssd")} placeholder="512 GB" />
              <Field label="Color" value={f("color")} onChange={set("color")} placeholder="Negro Espacial" />
            </Row>
            <Row>
              <SelectField label="Teclado" value={f("teclado")} onChange={set("teclado")} options={["Español","Inglés"]} />
              <Field label="N° Serie" value={f("numero_serie")} onChange={set("numero_serie")} placeholder="FXXXXXXXXX" mono />
              <Field label="Garantía (años)" type="number" value={String(data.garantia_anos ?? "")} onChange={set("garantia_anos")} placeholder="3" />
              <Field label="Seguro" value={f("seguro")} onChange={set("seguro")} placeholder="AppleCare Uno" />
            </Row>
          </Section>

          {/* Compra y financiamiento */}
          <Section title="Compra y financiamiento">
            <Row>
              <Field label="Proveedor" value={f("proveedor")} onChange={set("proveedor")} placeholder="CASESWORLD" />
              <Field label="Fecha compra" type="date" value={f("fecha_compra")?.split("T")[0]} onChange={set("fecha_compra")} />
              <Field label="URL Factura" value={f("factura_url")} onChange={set("factura_url")} placeholder="https://drive.google.com/…" />
              <Field label="Foto clave vault" value={f("clave_vault_url")} onChange={set("clave_vault_url")} placeholder="https://drive.google.com/…" />
              <Field label="URL Marketplace" value={f("web_url")} onChange={set("web_url")} placeholder="https://mercadolibre.com/…" />
            </Row>
            <Row>
              <Field label="Precio compra (USD) *" type="number" value={f("precio_compra_usd")} onChange={set("precio_compra_usd")} placeholder="1754.87" />
              <Field label="Tipo cambio (S/)" type="number" value={f("tipo_cambio")} onChange={set("tipo_cambio")} placeholder="3.39" />
              <Field label="Valor en soles (S/)" type="number" value={f("valor_soles")} onChange={set("valor_soles")} placeholder="5949" />
            </Row>
            <Row>
              <Field label="Tipo de financiamiento" value={f("tipo_financiamiento")} onChange={set("tipo_financiamiento")} placeholder="Tarjeta crédito Scotia" />
              <div>
                <p className="text-xs text-[#666666] mb-1">Tasa anual (auto-calculada)</p>
                <div className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl bg-[#F7F7F7] text-[#1B4FFF] font-700">
                  {tasaReady ? `${tasa.toFixed(2)}%` : <span className="text-[#999] font-400 italic">Ingresa cuota y plazo</span>}
                </div>
              </div>
              <Field label="Plazo crédito (meses)" type="number" value={String(data.plazo_credito_meses ?? "")} onChange={set("plazo_credito_meses")} placeholder="6" />
              <Field label="Cuota (S/mes)" type="number" value={f("cuota_credito_soles")} onChange={set("cuota_credito_soles")} placeholder="583.33" />
            </Row>
          </Section>

          {/* Estado y arrendamiento */}
          <Section title="Estado y arrendamiento">
            <Row>
              <SelectField label="Estado actual" value={f("estado_actual")} onChange={set("estado_actual")}
                options={["Disponible","Arrendada","Mantenimiento","Vendida","Arrendada / Usuario con privilegios administrativos"]} />
              <Field label="Cliente actual" value={f("cliente_actual")} onChange={set("cliente_actual")} placeholder="Securex Perú" />
              <Field label="Duración arriendo (m)" type="number" value={String(data.tipo_arriendo_meses ?? "")} onChange={set("tipo_arriendo_meses")} placeholder="16" />
            </Row>
            <Row>
              <Field label="Inicio alquiler" type="date" value={f("inicio_alquiler")?.split("T")[0]} onChange={set("inicio_alquiler")} />
              <Field label="Fin alquiler" type="date" value={f("fin_alquiler")?.split("T")[0]} onChange={set("fin_alquiler")} />
              <Field label="Tarifa (USD/mes)" type="number" value={f("tarifa_usd")} onChange={set("tarifa_usd")} placeholder="120" />
              <Field label="OPEX (USD/mes)" type="number" value={f("opex_usd")} onChange={set("opex_usd")} placeholder="32.50" />
            </Row>
            <Row>
              <SelectField label="Tipo de renta" value={f("tipo_renta") ?? "estreno"} onChange={set("tipo_renta")}
                options={["estreno", "re_alquiler"]} />
              <SelectField label="Meses de uso previo" value={String(data.meses_uso_previo ?? 0)} onChange={set("meses_uso_previo")}
                options={["0", "8", "16"]} />
              <Field label="Colaborador" value={f("colaborador")} onChange={set("colaborador")} placeholder="JEFRY" />
              <Field label="Área / Dpto" value={f("area")} onChange={set("area")} placeholder="Marketing" />
            </Row>
            <Row>
              <SelectField label="Opción de compra" value={f("compra_status") ?? "no_desea"} onChange={set("compra_status")}
                options={["no_desea", "contrato_firmado", "en_proceso", "desestimado", "completada"]} />
              <Field label="Notas compra" value={f("compra_notas")} onChange={set("compra_notas")} placeholder="Firmó contrato..." />
              <Field label="Inicio compra" type="date" value={f("compra_inicio")?.split("T")[0]} onChange={set("compra_inicio")} />
            </Row>
          </Section>

          {/* Credenciales del dispositivo */}
          <Section title="Credenciales del dispositivo (visibles para el cliente)">
            <Row>
              <Field label="Usuario" value={f("usuario_dispositivo")} onChange={set("usuario_dispositivo")} placeholder="Securex01" mono />
              <Field label="Contraseña" value={f("clave_dispositivo")} onChange={set("clave_dispositivo")} placeholder="securex123" mono />
            </Row>
          </Section>

          {/* Métricas financieras — calculadas o manuales */}
          <Section title="Métricas financieras">
            <p className="text-xs text-[#999] -mt-2 mb-2">Usa la calculadora de arriba para auto-rellenar estos campos.</p>
            <Row>
              <Field label="Valor residual (USD)" type="number" value={f("valor_residual_usd")} onChange={set("valor_residual_usd")} placeholder="912.53" />
              <Field label="Ingreso neto/mes (USD)" type="number" value={f("ingreso_neto_mensual_usd")} onChange={set("ingreso_neto_mensual_usd")} placeholder="87.50" />
              <Field label="Ingreso total proy. (USD)" type="number" value={f("ingreso_total_proyectado_usd")} onChange={set("ingreso_total_proyectado_usd")} placeholder="1920" />
              <Field label="Rentabilidad (%)" type="number" value={f("rentabilidad_pct")} onChange={set("rentabilidad_pct")} placeholder="15.3" />
            </Row>
          </Section>

          {/* Logística */}
          <Section title="Logística">
            <Row>
              <Field label="Próximo mantenimiento" type="date" value={f("mantenimiento_proximo")?.split("T")[0]} onChange={set("mantenimiento_proximo")} />
              <Field label="Ubicación física" value={f("ubicacion_fisica")} onChange={set("ubicacion_fisica")} placeholder="Av. Primavera 543 – Lima" />
              <Field label="Responsable" value={f("responsable")} onChange={set("responsable")} placeholder="Tika Admin" />
            </Row>
          </Section>

          {/* Credenciales */}
          <Section title="Credenciales del equipo">
            <Row>
              <Field label="Usuario" value={f("usuario_dispositivo")} onChange={set("usuario_dispositivo")} placeholder="Securex01" mono />
              <Field label="Clave" value={f("clave_dispositivo")} onChange={set("clave_dispositivo")} placeholder="securex123" mono />
              <Field label="Clave Vault" value={f("clave_vault")} onChange={set("clave_vault")} placeholder="TKA-MACPRO-M4-001" mono />
            </Row>
          </Section>

          <Section title="Observaciones">
            <textarea value={f("observaciones")} onChange={set("observaciones")} rows={3}
              placeholder="Notas sobre el equipo…"
              className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] resize-none" />
          </Section>
        </div>

        <div className="px-6 py-4 border-t border-[#E5E5E5] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#666] hover:text-[#333] cursor-pointer">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="px-6 py-2 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] transition-colors disabled:opacity-60 cursor-pointer">
            {saving ? "Guardando…" : (data.id ? "Guardar cambios" : "Crear equipo")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wide mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{children}</div>;
}

function Field({ label, value, onChange, type = "text", placeholder, mono }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; placeholder?: string; mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-[#666] mb-1">{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] ${mono ? "font-mono" : ""}`}
        step={type === "number" ? "any" : undefined} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs text-[#666] mb-1">{label}</label>
      <select value={value} onChange={onChange}
        className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] bg-white">
        <option value="">— Seleccionar —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
