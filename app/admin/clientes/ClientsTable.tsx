"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  ruc: string | null;
  legal_representative: string | null;
  google_id: string | null;
  referral_code: string | null;
  identity_verified: boolean | null;
  created_at: string;
  total_subs: string;
  active_subs: string;
  total_spent: string;
  products: string | null;
  last_sub_date: string | null;
  delivery_address: string | null;
  delivery_distrito: string | null;
}

interface SubDetail {
  id: string;
  user_id: string;
  product_name: string;
  months: number;
  monthly_price: string;
  status: string;
  started_at: string;
  ends_at: string | null;
  apple_care: boolean | null;
  delivery_method: string | null;
  delivery_address: string | null;
  delivery_distrito: string | null;
  tracking_number: string | null;
  external_subscription_id: string | null;
}

interface PaymentDetail {
  id: string;
  user_id: string;
  amount: string;
  period_label: string;
  due_date: string;
  status: string;
  payment_method: string | null;
  receipt_url: string | null;
  receipt_uploaded_at: string | null;
  validated_at: string | null;
  admin_note: string | null;
  invoice_url: string | null;
  invoice_number: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  preparing: { label: "Preparando",   color: "bg-blue-100 text-blue-700" },
  shipped:   { label: "Despachado",   color: "bg-purple-100 text-purple-700" },
  delivered: { label: "Entregado",    color: "bg-green-100 text-green-700" },
  paused:    { label: "Pausado",      color: "bg-yellow-100 text-yellow-700" },
  cancelled: { label: "Cancelado",    color: "bg-red-100 text-red-600" },
  completed: { label: "Completado",   color: "bg-gray-100 text-gray-500" },
  // Legacy
  active:    { label: "Activo",       color: "bg-green-100 text-green-700" },
};

export default function ClientsTable({ clients, allSubs, allPayments }: { clients: Client[]; allSubs: SubDetail[]; allPayments: PaymentDetail[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [verifying, setVerifying] = useState<string | null>(null);

  const verifyIdentity = async (userId: string, verified: boolean) => {
    setVerifying(userId);
    await fetch("/api/admin/verify-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, verified }),
    });
    setVerifying(null);
    startTransition(() => router.refresh());
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || [c.name, c.email, c.company ?? "", c.phone ?? "", c.ruc ?? ""].some(v => v.toLowerCase().includes(q));
    const matchFilter =
      filter === "all" ||
      (filter === "active" && parseInt(c.active_subs) > 0) ||
      (filter === "inactive" && parseInt(c.active_subs) === 0);
    return matchSearch && matchFilter;
  });

  const exportCsv = () => {
    const headers = ["Nombre", "Email", "Teléfono", "Empresa", "RUC", "Distrito", "Dirección", "Rentas activas", "Revenue total", "Productos", "Google", "Código referido", "Registro"];
    const rows = clients.map(c => [
      c.name, c.email, c.phone ?? "", c.company ?? "", c.ruc ?? "",
      c.delivery_distrito ?? "", c.delivery_address ?? "",
      c.active_subs, `$${parseFloat(c.total_spent).toFixed(0)}`,
      c.products ?? "", c.google_id ? "Sí" : "No",
      c.referral_code ?? "",
      new Date(c.created_at).toISOString().split("T")[0],
    ]);
    const escape = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flux-clientes-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="font-700 text-[#18191F]">Directorio</h2>
          <p className="text-xs text-[#999999] mt-0.5">{filtered.length} de {clients.length} clientes</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar nombre, email, empresa, RUC…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] w-64"
          />
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#18191F] text-white text-xs font-700 rounded-full hover:bg-[#333333] transition-colors cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            CSV
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-0">
        {([
          { key: "all", label: "Todos", count: clients.length },
          { key: "active", label: "Con renta activa", count: clients.filter(c => parseInt(c.active_subs) > 0).length },
          { key: "inactive", label: "Sin renta", count: clients.filter(c => parseInt(c.active_subs) === 0).length },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-600 transition-colors cursor-pointer ${
              filter === f.key ? "bg-[#1B4FFF] text-white" : "bg-[#F5F5F7] text-[#666666] hover:bg-[#E8E8EA]"
            }`}
          >
            {f.label} <span className="ml-1 opacity-70">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7F7]">
            <tr>
              {["Cliente", "Contacto", "Empresa", "Rentas", "Revenue", "Último alquiler", "Registro"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666666] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-[#999999]">Sin resultados</td></tr>
            ) : filtered.map(client => {
              const isExpanded = expanded === client.id;
              const clientSubs = allSubs.filter(s => s.user_id === client.id);
              const clientPayments = allPayments.filter(p => p.user_id === client.id);
              const activeSubs = parseInt(client.active_subs);

              return (
                <Fragment key={client.id}>
                  <tr
                    className={`hover:bg-[#FAFAFA] transition-colors cursor-pointer ${isExpanded ? "bg-[#F5F8FF]" : ""}`}
                    onClick={() => setExpanded(isExpanded ? null : client.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1B4FFF] flex items-center justify-center text-white text-xs font-700 flex-shrink-0">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-600 text-[#18191F]">{client.name}</p>
                            {client.identity_verified && (
                              <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700" title="DNI verificado">✓ ID</span>
                            )}
                          </div>
                          <p className="text-xs text-[#999999]">{client.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[#333333]">{client.phone ?? "—"}</p>
                      {client.google_id && <p className="text-[10px] text-[#1B4FFF] font-600">Google</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-500 text-[#333333]">{client.company ?? "—"}</p>
                      {client.ruc && <p className="text-xs text-[#999999]">RUC: {client.ruc}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {activeSubs > 0 ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-700 bg-green-100 text-green-700">
                          {activeSubs} activa{activeSubs > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-[#999999]">{client.total_subs} total</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-700 text-[#18191F]">${parseFloat(client.total_spent).toLocaleString("en-US", { minimumFractionDigits: 0 })}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666]">
                      {client.last_sub_date
                        ? new Date(client.last_sub_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })
                        : <span className="text-[#CCCCCC]">0</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666]">
                      {new Date(client.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <tr className="bg-[#F5F8FF]">
                      <td colSpan={7} className="px-6 pb-5 pt-2">
                        {/* Contact info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                          <InfoCard label="Contacto operativo" value={client.name} />
                          <InfoCard label="Representante legal" value={client.legal_representative ?? "—"} />
                          <InfoCard label="Email" value={client.email} copy />
                          <InfoCard label="Teléfono" value={client.phone ?? "—"} copy />
                          <InfoCard label="Empresa" value={client.company ?? "—"} />
                          <InfoCard label="RUC" value={client.ruc ?? "—"} copy />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                          <InfoCard label="Distrito" value={client.delivery_distrito ?? "—"} />
                          <InfoCard label="Dirección" value={client.delivery_address ?? "—"} copy />
                          <InfoCard label="Código referido" value={client.referral_code ?? "—"} copy />
                          <InfoCard label="Auth" value={client.google_id ? "Google OAuth" : "Email + contraseña"} />
                        </div>

                        {/* Quick actions */}
                        <div className="flex gap-2 mb-4 flex-wrap">
                          <a
                            href={`https://wa.me/51${(client.phone ?? "").replace(/\D/g, "").replace(/^51/, "")}`}
                            target="_blank" rel="noreferrer"
                            className="px-3 py-1.5 bg-[#25D366] text-white text-xs font-700 rounded-full hover:opacity-90 transition-opacity"
                          >
                            WhatsApp
                          </a>
                          <a
                            href={`mailto:${client.email}`}
                            className="px-3 py-1.5 bg-[#1B4FFF] text-white text-xs font-700 rounded-full hover:opacity-90 transition-opacity"
                          >
                            Email
                          </a>
                          {client.identity_verified ? (
                            <button
                              onClick={() => verifyIdentity(client.id, false)}
                              disabled={verifying === client.id}
                              className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-700 rounded-full cursor-pointer hover:bg-green-200 transition-colors disabled:opacity-50"
                            >
                              ✓ ID Verificado
                            </button>
                          ) : (
                            <button
                              onClick={() => verifyIdentity(client.id, true)}
                              disabled={verifying === client.id}
                              className="px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-700 rounded-full cursor-pointer hover:bg-orange-200 transition-colors disabled:opacity-50"
                            >
                              {verifying === client.id ? "..." : "Verificar ID"}
                            </button>
                          )}
                        </div>
                        {isPending && <p className="text-xs text-[#1B4FFF] mb-2">Actualizando...</p>}

                        {/* Subscriptions */}
                        {clientSubs.length > 0 ? (
                          <div>
                            <p className="text-xs font-700 text-[#666666] uppercase tracking-wider mb-2">Suscripciones ({clientSubs.length})</p>
                            <div className="space-y-2">
                              {clientSubs.map(sub => {
                                const st = STATUS_LABELS[sub.status] ?? { label: sub.status, color: "bg-gray-100 text-gray-500" };
                                return (
                                  <div key={sub.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center gap-4 flex-wrap">
                                    <div className="flex-1 min-w-[140px]">
                                      <p className="font-600 text-[#18191F] text-sm">{sub.product_name}</p>
                                      <p className="text-xs text-[#999999]">{sub.months} meses · ${sub.monthly_price}/mes</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-700 ${st.color}`}>{st.label}</span>
                                    {sub.apple_care && <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">🛡️ AC+</span>}
                                    <div className="text-xs text-[#999999]">
                                      {sub.delivery_method === "pickup" ? "🏢 Recojo" : "🚚 Envío"}
                                      {sub.tracking_number && <span className="ml-1">· {sub.tracking_number}</span>}
                                    </div>
                                    <div className="text-xs text-[#999999]">
                                      {new Date(sub.started_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                                      {sub.ends_at && <span> → {new Date(sub.ends_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })}</span>}
                                    </div>
                                    <a href={`/api/contracts/${sub.id}`} target="_blank" rel="noreferrer" className="text-xs text-[#1B4FFF] hover:underline font-600">PDF</a>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-[#999999]">Este cliente no tiene suscripciones.</p>
                        )}

                        {/* Payments */}
                        {clientPayments.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-700 text-[#666666] uppercase tracking-wider mb-2">
                              Pagos ({clientPayments.length})
                              {clientPayments.some(p => p.status === "reviewing") && (
                                <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-700 rounded-full bg-blue-100 text-blue-700 normal-case">
                                  Nuevo por revisar
                                </span>
                              )}
                            </p>
                            <div className="space-y-2">
                              {clientPayments.slice(0, 8).map(p => {
                                const stStyles: Record<string, string> = {
                                  validated: "bg-green-100 text-green-700",
                                  reviewing: "bg-blue-100 text-blue-700",
                                  pending: "bg-yellow-100 text-yellow-700",
                                  overdue: "bg-red-100 text-red-600",
                                  upcoming: "bg-gray-100 text-gray-500",
                                };
                                const stLabels: Record<string, string> = {
                                  validated: "Pagado",
                                  reviewing: "Por revisar",
                                  pending: "Pendiente",
                                  overdue: "Vencido",
                                  upcoming: "Próximo",
                                };
                                return (
                                  <div key={p.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center gap-3 flex-wrap">
                                    <div className="flex-1 min-w-[140px]">
                                      <p className="font-600 text-[#18191F] text-sm">{p.period_label}</p>
                                      <p className="text-xs text-[#999999]">
                                        Vence {new Date(p.due_date).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })}
                                      </p>
                                    </div>
                                    <p className="font-700 text-[#18191F]">${parseFloat(p.amount).toFixed(2)}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-700 ${stStyles[p.status] ?? "bg-gray-100 text-gray-500"}`}>
                                      {stLabels[p.status] ?? p.status}
                                    </span>
                                    {p.payment_method === "culqi" || p.payment_method === "stripe" ? (
                                      <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">💳 Tarjeta</span>
                                    ) : (
                                      <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">🏦 Transf.</span>
                                    )}
                                    {p.receipt_url && (
                                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-[#1B4FFF] hover:underline font-600">Voucher</a>
                                    )}
                                    {p.invoice_url && (
                                      <a href={p.invoice_url} target="_blank" rel="noreferrer" className="text-xs text-[#2D7D46] hover:underline font-600">📄 {p.invoice_number}</a>
                                    )}
                                  </div>
                                );
                              })}
                              {clientPayments.length > 8 && (
                                <p className="text-xs text-[#999999] text-center py-2">
                                  Y {clientPayments.length - 8} pagos más...
                                </p>
                              )}
                            </div>
                            <div className="mt-3 flex gap-3">
                              <a href="/admin/pagos" className="text-xs text-[#1B4FFF] font-600 hover:underline">
                                → Ver en módulo Pagos (validar/rechazar)
                              </a>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoCard({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-white rounded-xl p-3 border border-[#E5E5E5]">
      <p className="text-xs text-[#999999] mb-0.5">{label}</p>
      <div className="flex items-center gap-1">
        <p className="text-xs font-600 text-[#18191F] truncate flex-1">{value}</p>
        {copy && value !== "—" && (
          <button
            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
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
