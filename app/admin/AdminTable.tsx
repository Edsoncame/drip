"use client";

import { Fragment, useState, useTransition } from "react";
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
  dni_number: string | null;
  dni_photo_url: string | null;
  selfie_url: string | null;
  identity_verified: boolean | null;
  payment_method?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  preparing: { label: "Preparando",   color: "bg-blue-100 text-blue-700" },
  shipped:   { label: "En camino",    color: "bg-purple-100 text-purple-700" },
  delivered: { label: "Entregado",    color: "bg-green-100 text-green-700" },
  paused:    { label: "Pausado",      color: "bg-yellow-100 text-yellow-700" },
  cancelled: { label: "Cancelado",    color: "bg-red-100 text-red-600" },
  completed: { label: "Completado",   color: "bg-gray-100 text-gray-500" },
  active:    { label: "Activo",       color: "bg-green-100 text-green-700" },
};

// Todos los estados seleccionables desde el dropdown (admin puede mover libremente)
const STATUS_OPTIONS = ["preparing", "shipped", "delivered", "paused", "cancelled", "completed"] as const;

const FILTERS = ["Todos", "preparing", "shipped", "delivered", "paused", "cancelled", "completed"] as const;
const FILTER_LABELS: Record<string, string> = {
  Todos: "Todos", preparing: "Preparando", shipped: "En camino", delivered: "Entregados",
  paused: "Pausados", cancelled: "Cancelados", completed: "Completados",
};

type PaymentFilter = "todos" | "online" | "offline";

function isOnline(sub: Sub): boolean {
  const pm = (sub.payment_method ?? "").toLowerCase();
  return pm === "stripe" || pm === "culqi" || pm === "mercadopago" || pm === "mp";
}

function paymentBadge(sub: Sub) {
  const pm = (sub.payment_method ?? "").toLowerCase();
  if (pm === "stripe")   return { label: "💳 Stripe",        color: "bg-indigo-100 text-indigo-700" };
  if (pm === "culqi")    return { label: "💳 Culqi",         color: "bg-indigo-100 text-indigo-700" };
  if (pm === "transferencia" || pm === "transfer") return { label: "🏦 Transferencia", color: "bg-amber-100 text-amber-700" };
  if (pm) return { label: pm, color: "bg-gray-100 text-gray-600" };
  return { label: "—", color: "bg-gray-100 text-gray-400" };
}

export default function AdminTable({ subs }: { subs: Sub[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("Todos");
  const [payFilter, setPayFilter] = useState<PaymentFilter>("todos");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [noteEditing, setNoteEditing] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [trackingEditing, setTrackingEditing] = useState<string | null>(null);
  const [trackingValue, setTrackingValue] = useState("");
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const filtered = subs.filter(s => {
    const matchStatus = filter === "Todos" || s.status === filter;
    const matchPay = payFilter === "todos" || (payFilter === "online" ? isOnline(s) : !isOnline(s));
    const q = search.toLowerCase();
    const matchSearch = !q || [
      s.customer_name, s.customer_email, s.customer_company,
      s.product_name, s.user_email ?? "",
    ].some(v => v.toLowerCase().includes(q));
    return matchStatus && matchPay && matchSearch;
  });

  async function changeStatus(id: string, status: string, extra?: { tracking_number?: string; equipment_code?: string }) {
    setUpdating(id);
    await fetch("/api/admin/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, ...extra }),
    });
    setUpdating(null);
    setTrackingEditing(null);
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

  const onlineCount = subs.filter(isOnline).length;
  const offlineCount = subs.length - onlineCount;

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-700 text-[#18191F]">Rentas</h2>
          <p className="text-xs text-[#999999] mt-0.5">{filtered.length} de {subs.length} — <span className="text-indigo-600 font-600">💳 Online: {onlineCount}</span> · <span className="text-amber-600 font-600">🏦 Offline: {offlineCount}</span></p>
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

      {/* Payment-method filter (online vs offline) */}
      <div className="flex gap-2 px-6 pt-3">
        {([
          { key: "todos",   label: `Todos · ${subs.length}` },
          { key: "online",  label: `💳 Online · ${onlineCount}` },
          { key: "offline", label: `🏦 Offline · ${offlineCount}` },
        ] as { key: PaymentFilter; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setPayFilter(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-700 transition-colors cursor-pointer ${
              payFilter === t.key
                ? "bg-[#18191F] text-white"
                : "bg-[#F5F5F7] text-[#666666] hover:bg-[#E8E8EA]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Status filter tabs */}
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
              {["Cliente", "Producto", "$/mes", "Pago", "Estado", "Vence", "Acción"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666666] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-[#999999]">Sin resultados</td>
              </tr>
            ) : filtered.map(sub => {
              const st = STATUS_LABELS[sub.status] ?? { label: sub.status, color: "bg-gray-100 text-gray-500" };
              const pb = paymentBadge(sub);
              const isExpanded = expanded === sub.id;

              return (
                <Fragment key={sub.id}>
                  <tr
                    className={`hover:bg-[#FAFAFA] transition-colors cursor-pointer ${isExpanded ? "bg-[#F5F8FF]" : ""}`}
                    onClick={() => setExpanded(isExpanded ? null : sub.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-600 text-[#18191F]">{sub.customer_name}</p>
                      <p className="text-xs text-[#999999]">{sub.customer_company || sub.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-[#333333] max-w-[180px]">
                      <p className="font-500 truncate">{sub.product_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-[#999999]">
                          {new Date(sub.started_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} · {sub.months}m
                        </p>
                        {sub.apple_care && (
                          <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">🛡️ AC+</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-700 text-[#18191F]">${sub.monthly_price}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-700 whitespace-nowrap ${pb.color}`}>
                        {pb.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-700 whitespace-nowrap ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666] whitespace-nowrap">
                      {sub.ends_at
                        ? new Date(sub.ends_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {/* Flujo operativo: botón contextual según estado */}
                        {(sub.status === "preparing" || sub.status === "active") && (
                          <ActionBtn
                            label="📦 Despachar"
                            color="blue"
                            loading={updating === sub.id}
                            onClick={() => {
                              if (sub.delivery_method === "pickup") {
                                changeStatus(sub.id, "shipped");
                              } else {
                                setTrackingEditing(sub.id);
                                setTrackingValue("");
                              }
                            }}
                          />
                        )}
                        {sub.status === "shipped" && (
                          <ActionBtn
                            label="✅ Entregado"
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
                        {/* Dropdown flexible — permite forzar cualquier estado */}
                        <select
                          value={sub.status}
                          onChange={e => changeStatus(sub.id, e.target.value)}
                          disabled={updating === sub.id}
                          className="text-xs border border-[#E5E5E5] rounded-full px-2 py-1 bg-white cursor-pointer hover:border-[#1B4FFF] focus:border-[#1B4FFF] outline-none disabled:opacity-50"
                          title="Cambiar estado manualmente"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s]?.label ?? s}</option>
                          ))}
                        </select>
                        {trackingEditing === sub.id && (
                          <div className="flex items-center gap-1.5 ml-2">
                            <input
                              autoFocus
                              value={trackingValue}
                              onChange={e => setTrackingValue(e.target.value)}
                              placeholder="N° guía"
                              className="px-2 py-1 text-xs border border-[#1B4FFF] rounded-lg outline-none w-24"
                              onKeyDown={e => { if (e.key === "Enter") changeStatus(sub.id, "shipped", { tracking_number: trackingValue || undefined }); if (e.key === "Escape") setTrackingEditing(null); }}
                            />
                            <button onClick={() => changeStatus(sub.id, "shipped", { tracking_number: trackingValue || undefined })} className="px-2 py-1 bg-[#1B4FFF] text-white text-xs font-700 rounded-lg cursor-pointer">OK</button>
                            <button onClick={() => setTrackingEditing(null)} className="text-xs text-[#999] cursor-pointer">✕</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded — datos completos */}
                  {isExpanded && (
                    <tr className="bg-[#F5F8FF]">
                      <td colSpan={7} className="px-6 pb-6 pt-3">
                        {/* Info general */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                          <Info label="Email"     value={sub.customer_email} copy />
                          <Info label="Teléfono"  value={sub.customer_phone} copy />
                          <Info label="RUC"       value={sub.customer_ruc ?? "—"} />
                          <Info label="AppleCare+" value={sub.apple_care ? "✅ Sí — activar" : "No"} />
                        </div>

                        {/* Entrega — siempre visible */}
                        <div className="mb-4">
                          <p className="text-xs font-700 text-[#666666] uppercase tracking-wider mb-2">
                            📍 Dirección de entrega
                            <span className="ml-2 normal-case font-500 text-[#333]">
                              {sub.delivery_method === "pickup" ? "🏢 Recojo en oficina" : "🚚 Envío a domicilio"}
                            </span>
                          </p>
                          {sub.delivery_method === "shipping" ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Info label="Dirección" value={sub.delivery_address ?? "—"} copy />
                              <Info label="Distrito" value={sub.delivery_distrito ?? "—"} />
                              <Info label="Referencia" value={sub.delivery_reference ?? "—"} />
                            </div>
                          ) : (
                            <p className="text-xs text-[#666666]">Cliente retira en oficina (L-V 9-6pm).</p>
                          )}
                        </div>

                        {/* Identidad — imágenes grandes + clickables */}
                        <div className="mb-4">
                          <p className="text-xs font-700 text-[#666666] uppercase tracking-wider mb-2">
                            🪪 Verificación de identidad
                            {sub.identity_verified
                              ? <span className="ml-2 text-green-600 normal-case font-600">✅ Verificado</span>
                              : <span className="ml-2 text-orange-500 normal-case font-600">⏳ Pendiente</span>
                            }
                          </p>
                          {sub.dni_number || sub.dni_photo_url || sub.selfie_url ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Info label="DNI / CE" value={sub.dni_number ?? "—"} copy />
                              {sub.dni_photo_url && (
                                <button
                                  onClick={() => setLightbox({ url: sub.dni_photo_url!, label: "Foto DNI" })}
                                  className="bg-white rounded-xl p-2 border border-[#E5E5E5] text-left hover:border-[#1B4FFF] transition-colors cursor-pointer"
                                >
                                  <p className="text-xs text-[#999999] mb-1.5">Foto DNI <span className="text-[#1B4FFF]">🔍</span></p>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={sub.dni_photo_url} alt="DNI" className="w-full h-48 object-cover rounded-lg bg-[#F7F7F7]" />
                                </button>
                              )}
                              {sub.selfie_url && (
                                <button
                                  onClick={() => setLightbox({ url: sub.selfie_url!, label: "Selfie con DNI" })}
                                  className="bg-white rounded-xl p-2 border border-[#E5E5E5] text-left hover:border-[#1B4FFF] transition-colors cursor-pointer"
                                >
                                  <p className="text-xs text-[#999999] mb-1.5">Selfie con DNI <span className="text-[#1B4FFF]">🔍</span></p>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={sub.selfie_url} alt="Selfie" className="w-full h-48 object-cover rounded-lg bg-[#F7F7F7]" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-[#999999]">Sin datos de KYC (renta offline/B2B).</p>
                          )}
                        </div>

                        {/* Referencias de pago */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                          <Info label="Método de pago" value={paymentBadge(sub).label} />
                          <Info label="ID Stripe/Culqi" value={sub.mp_subscription_id ?? "—"} copy />
                          <Info label={isOnline(sub) ? "Flujo" : "Flujo"} value={isOnline(sub) ? "Online (checkout + webhook)" : "Offline (transferencia → /admin/pagos)"} />
                        </div>

                        {/* Nota interna */}
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
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {isPending && (
        <div className="px-6 py-2 bg-[#EEF2FF] text-xs text-[#1B4FFF] font-600">Actualizando…</div>
      )}

      {/* Lightbox para DNI/selfie */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div onClick={e => e.stopPropagation()} className="relative max-w-4xl max-h-[90vh] cursor-default">
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white text-sm font-600 hover:opacity-70 cursor-pointer"
            >
              ✕ Cerrar
            </button>
            <p className="text-white text-xs mb-2 font-600">{lightbox.label}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={lightbox.label} className="max-w-full max-h-[80vh] rounded-xl" />
            <a
              href={lightbox.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-3 text-xs text-white/80 hover:text-white underline"
            >
              Abrir original en nueva pestaña ↗
            </a>
          </div>
        </div>
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
