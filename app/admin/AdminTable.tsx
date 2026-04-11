"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Sub {
  id: string;
  user_name: string | null;
  user_email: string | null;
  product_name: string;
  months: number;
  monthly_price: string;
  status: string;
  started_at: string;
  ends_at: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_company: string;
  customer_ruc: string | null;
  admin_note: string | null;
  mp_subscription_id: string | null;
  apple_care: boolean | null;
  delivery_method: string | null;
  delivery_address: string | null;
  delivery_distrito: string | null;
  delivery_reference: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: "Activo",       color: "bg-green-100 text-green-700" },
  delivered: { label: "Entregado",    color: "bg-blue-100 text-blue-700" },
  paused:    { label: "Pausado",      color: "bg-yellow-100 text-yellow-700" },
  cancelled: { label: "Cancelado",    color: "bg-red-100 text-red-600" },
  completed: { label: "Completado",   color: "bg-gray-100 text-gray-500" },
};

const FILTERS = ["Todos", "active", "delivered", "paused", "cancelled", "completed"] as const;
const FILTER_LABELS: Record<string, string> = {
  Todos: "Todos", active: "Activos", delivered: "Entregados",
  paused: "Pausados", cancelled: "Cancelados", completed: "Completados",
};

export default function AdminTable({ subs }: { subs: Sub[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("Todos");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");

  const filtered = subs.filter(s => {
    const matchFilter = filter === "Todos" || s.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || [
      s.customer_name, s.customer_email, s.customer_company,
      s.product_name, s.user_email ?? "",
    ].some(v => v.toLowerCase().includes(q));
    return matchFilter && matchSearch;
  });

  async function changeStatus(id: string, status: string) {
    setUpdating(id);
    await fetch("/api/admin/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setUpdating(null);
    startTransition(() => router.refresh());
  }

  async function saveNote(id: string) {
    await fetch("/api/admin/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: subs.find(s => s.id === id)?.status, note: noteValue }),
    });
    setNoteEditing(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-700 text-[#18191F]">Rentas</h2>
          <p className="text-xs text-[#999999] mt-0.5">{filtered.length} de {subs.length}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar cliente, empresa…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] w-52"
          />
          <a
            href="/api/admin/export"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#18191F] text-white text-xs font-700 rounded-full hover:bg-[#333333] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            CSV
          </a>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
        {FILTERS.map(f => {
          const count = f === "Todos" ? subs.length : subs.filter(s => s.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-600 transition-colors cursor-pointer ${
                filter === f
                  ? "bg-[#1B4FFF] text-white"
                  : "bg-[#F5F5F7] text-[#666666] hover:bg-[#E8E8EA]"
              }`}
            >
              {FILTER_LABELS[f]} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7F7]">
            <tr>
              {["Cliente", "Producto", "Plan / $/mes", "Estado", "Entrega", "Acciones"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666666] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#999999]">Sin resultados</td>
              </tr>
            ) : filtered.map(sub => {
              const st = STATUS_LABELS[sub.status] ?? { label: sub.status, color: "bg-gray-100 text-gray-500" };
              const isExpanded = expanded === sub.id;

              return (
                <>
                  <tr
                    key={sub.id}
                    className={`hover:bg-[#FAFAFA] transition-colors cursor-pointer ${isExpanded ? "bg-[#F5F8FF]" : ""}`}
                    onClick={() => setExpanded(isExpanded ? null : sub.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-600 text-[#18191F]">{sub.customer_name}</p>
                      <p className="text-xs text-[#999999]">{sub.customer_company}</p>
                    </td>
                    <td className="px-4 py-3 text-[#333333] max-w-[160px]">
                      <p className="font-500 truncate">{sub.product_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-[#999999]">
                          {new Date(sub.started_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                        </p>
                        {sub.apple_care && (
                          <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">🛡️ AC+</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-700 text-[#18191F]">${sub.monthly_price}/mes</p>
                      <p className="text-xs text-[#999999]">{sub.months}m</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-700 ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666]">
                      {sub.ends_at
                        ? new Date(sub.ends_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {/* Quick action buttons by status */}
                        {sub.status === "active" && (
                          <ActionBtn
                            label="Entregado"
                            color="blue"
                            loading={updating === sub.id}
                            onClick={() => changeStatus(sub.id, "delivered")}
                          />
                        )}
                        {sub.status === "delivered" && (
                          <ActionBtn
                            label="Completar"
                            color="gray"
                            loading={updating === sub.id}
                            onClick={() => changeStatus(sub.id, "completed")}
                          />
                        )}
                        {(sub.status === "active" || sub.status === "delivered") && (
                          <ActionBtn
                            label="Cancelar"
                            color="red"
                            loading={updating === sub.id}
                            onClick={() => changeStatus(sub.id, "cancelled")}
                          />
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {isExpanded && (
                    <tr key={`${sub.id}-detail`} className="bg-[#F5F8FF]">
                      <td colSpan={6} className="px-6 pb-5 pt-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          <Info label="Email"    value={sub.customer_email} copy />
                          <Info label="Teléfono" value={sub.customer_phone} copy />
                          <Info label="RUC"      value={sub.customer_ruc ?? "—"} />
                          <Info label="AppleCare+" value={sub.apple_care ? "✅ Sí — activar antes de entrega" : "No"} />
                          <Info label="Entrega" value={sub.delivery_method === "pickup" ? "🏢 Recojo en oficina" : "🚚 Envío a domicilio"} />
                          <Info label="MP ID"    value={sub.mp_subscription_id ?? "—"} copy />
                        </div>
                        {sub.delivery_method === "shipping" && sub.delivery_address && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                            <Info label="Distrito" value={sub.delivery_distrito ?? "—"} />
                            <Info label="Dirección" value={sub.delivery_address} copy />
                            <Info label="Referencia" value={sub.delivery_reference ?? "—"} />
                          </div>
                        )}

                        {/* Note */}
                        <div className="flex items-start gap-2">
                          {noteEditing === sub.id ? (
                            <>
                              <input
                                autoFocus
                                value={noteValue}
                                onChange={e => setNoteValue(e.target.value)}
                                placeholder="Nota interna…"
                                className="flex-1 px-3 py-2 text-xs border border-[#1B4FFF] rounded-xl outline-none"
                                onKeyDown={e => { if (e.key === "Enter") saveNote(sub.id); if (e.key === "Escape") setNoteEditing(null); }}
                              />
                              <button onClick={() => saveNote(sub.id)} className="px-3 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-xl cursor-pointer">Guardar</button>
                              <button onClick={() => setNoteEditing(null)} className="px-3 py-2 text-xs text-[#666666] cursor-pointer">Cancelar</button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setNoteEditing(sub.id); setNoteValue(sub.admin_note ?? ""); }}
                              className="text-xs text-[#1B4FFF] hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              {sub.admin_note ? `Nota: ${sub.admin_note}` : "Agregar nota"}
                            </button>
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
      {isPending && (
        <div className="px-6 py-2 bg-[#EEF2FF] text-xs text-[#1B4FFF] font-600">Actualizando…</div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, loading, onClick }: {
  label: string; color: "blue" | "red" | "gray";
  loading: boolean; onClick: () => void;
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    red:  "bg-red-100 text-red-600 hover:bg-red-200",
    gray: "bg-gray-100 text-gray-600 hover:bg-gray-200",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-2.5 py-1 rounded-full text-xs font-700 transition-colors cursor-pointer disabled:opacity-50 ${colors[color]}`}
    >
      {loading ? "…" : label}
    </button>
  );
}

function Info({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-white rounded-xl p-3 border border-[#E5E5E5]">
      <p className="text-xs text-[#999999] mb-0.5">{label}</p>
      <div className="flex items-center gap-1">
        <p className="text-xs font-600 text-[#18191F] truncate flex-1">{value}</p>
        {copy && value !== "—" && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-[#1B4FFF] hover:text-[#1340CC] flex-shrink-0 cursor-pointer"
            title="Copiar"
          >
            {copied
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            }
          </button>
        )}
      </div>
    </div>
  );
}
