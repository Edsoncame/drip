"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Payment {
  id: string;
  user_name: string;
  user_email: string;
  company: string | null;
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
  invoices: Array<{ id: string; invoice_number: string; invoice_url: string; amount: string | null; uploaded_at: string }>;
  invoices_total: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  reviewing: { label: "Por revisar", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "⏳" },
  pending:   { label: "Pendiente",   color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: "⚠️" },
  overdue:   { label: "Vencido",     color: "bg-red-100 text-red-600 border-red-200", icon: "⚠️" },
  validated: { label: "Pagado",      color: "bg-green-100 text-green-700 border-green-200", icon: "✓" },
  upcoming:  { label: "Próximo",     color: "bg-gray-100 text-gray-500 border-gray-200", icon: "○" },
};

export default function PaymentsReview({ payments }: { payments: Payment[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const filtered = payments.filter(p =>
    filter === "all" ||
    (filter === "pending" && (p.status === "pending" || p.status === "overdue")) ||
    filter === p.status
  );

  const handleAction = async (paymentId: string, action: "validate" | "reject") => {
    setProcessing(paymentId);
    await fetch("/api/admin/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, action, note: noteValue || undefined }),
    });
    setProcessing(null);
    setNoteValue("");
    startTransition(() => router.refresh());
  };

  const handleReceiptUpload = async (paymentId: string, file: File) => {
    setProcessing(paymentId);
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch("/api/upload", { method: "POST", body: fd });
    const upData = await up.json();
    if (upData.dataUrl) {
      await fetch(`/api/payments/${paymentId}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptUrl: upData.dataUrl }),
      });
      startTransition(() => router.refresh());
    }
    setProcessing(null);
  };

  const handleInvoiceUpload = async (paymentId: string, file: File) => {
    if (!invoiceNumber.trim()) {
      showToast("error", "Ingresa el N° de factura primero");
      return;
    }
    setProcessing(paymentId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("invoiceNumber", invoiceNumber.trim());
      if (invoiceAmount) fd.append("amount", invoiceAmount);
      const res = await fetch(`/api/admin/payments/${paymentId}/invoice`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al subir factura");
      showToast("success", `Factura ${json.invoiceNumber} subida correctamente`);
      setInvoiceNumber("");
      setInvoiceAmount("");
      startTransition(() => router.refresh());
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Error");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-700 ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}
      {/* Filter tabs */}
      <div className="flex gap-1 px-5 pt-4 pb-0 border-b border-[#E5E5E5] overflow-x-auto">
        {[
          { key: "all", label: "Todos" },
          { key: "reviewing", label: "⏳ Por revisar", count: payments.filter(p => p.status === "reviewing").length },
          { key: "pending", label: "⚠️ Pendientes", count: payments.filter(p => p.status === "pending" || p.status === "overdue").length },
          { key: "validated", label: "✓ Pagados", count: payments.filter(p => p.status === "validated").length },
          { key: "upcoming", label: "Próximos", count: payments.filter(p => p.status === "upcoming").length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-4 py-2.5 text-sm font-600 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              filter === f.key ? "border-[#1B4FFF] text-[#1B4FFF]" : "border-transparent text-[#666666] hover:text-[#333333]"
            }`}
          >
            {f.label} {f.count !== undefined && f.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[#F5F5F7] text-[#666]">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Payments list */}
      <div className="divide-y divide-[#F0F0F0]">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#999999]">
            <p className="text-sm">Sin pagos en esta categoría</p>
          </div>
        ) : filtered.map(p => {
          const st = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
          const isExpanded = expanded === p.id;
          const dueDate = new Date(p.due_date);
          const isOverdue = p.status === "pending" && dueDate < new Date();

          return (
            <div key={p.id} className={`${isExpanded ? "bg-[#F5F8FF]" : "hover:bg-[#FAFAFA]"} transition-colors`}>
              {/* Main row */}
              <div
                className="px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : p.id)}
              >
                {/* Client info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-700 text-[#18191F] truncate">{p.company ?? p.user_name}</p>
                    {p.payment_method === "culqi" ? (
                      <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 flex-shrink-0">💳</span>
                    ) : (
                      <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex-shrink-0">🏦</span>
                    )}
                  </div>
                  <p className="text-xs text-[#999999] truncate">
                    <span className="sm:hidden">{p.period_label} · </span>
                    {p.company ? `Contacto: ${p.user_name}` : p.user_email}
                  </p>
                </div>

                {/* Period — desktop only */}
                <div className="text-sm hidden sm:block flex-shrink-0 w-24">
                  <p className="font-600 text-[#333333]">{p.period_label}</p>
                  <p className="text-xs text-[#999999]">
                    {dueDate.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className="text-base sm:text-lg font-800 text-[#18191F]">${parseFloat(p.amount).toFixed(0)}</p>
                </div>

                {/* Status */}
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-700 border ${st.color}`}>
                    <span>{st.icon}</span>
                    <span className="hidden sm:inline">{st.label}</span>
                  </span>
                </div>

                {/* Expand icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`text-[#999] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-0" onClick={(e) => e.stopPropagation()}>
                  {/* Quick info grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <InfoBlock label="Cliente" value={p.user_name} />
                    <InfoBlock label="Email" value={p.user_email} />
                    <InfoBlock label="Período" value={p.period_label} />
                    <InfoBlock label="Vence" value={dueDate.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })} />
                  </div>

                  {isOverdue && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                      <p className="text-sm font-700 text-red-700">⚠️ Pago vencido — handle urgente</p>
                    </div>
                  )}

                  {/* === RECEIPT SECTION === */}
                  <div className="mb-4">
                    <p className="text-xs font-700 text-[#666] uppercase tracking-wider mb-2">Comprobante de transferencia</p>

                    {p.receipt_url ? (
                      /* Already has receipt */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.receipt_url} alt="Comprobante" className="w-full max-h-64 object-contain rounded-xl border border-[#E5E5E5] bg-white" />
                          {p.receipt_uploaded_at && (
                            <p className="text-xs text-[#999999] mt-2">
                              Subido: {new Date(p.receipt_uploaded_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                        {p.status === "reviewing" && (
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-700 text-[#333333] mb-2">Acciones</p>
                              <button
                                onClick={() => handleAction(p.id, "validate")}
                                disabled={processing === p.id}
                                className="w-full px-4 py-3 mb-2 bg-green-600 text-white text-sm font-700 rounded-xl cursor-pointer hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {processing === p.id ? "Procesando..." : "✓ Validar pago"}
                              </button>
                            </div>
                            <div>
                              <label className="block text-xs font-600 text-[#666] mb-1">Rechazar con motivo</label>
                              <textarea
                                value={noteValue}
                                onChange={e => setNoteValue(e.target.value)}
                                placeholder="Ej: Monto no coincide / Imagen borrosa"
                                className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] resize-none h-16"
                              />
                              <button
                                onClick={() => handleAction(p.id, "reject")}
                                disabled={processing === p.id || !noteValue.trim()}
                                className="w-full mt-2 px-4 py-2.5 bg-red-500 text-white text-sm font-700 rounded-xl cursor-pointer hover:bg-red-600 disabled:opacity-50"
                              >
                                ✕ Rechazar comprobante
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : p.payment_method === "culqi" ? (
                      /* Culqi — no receipt needed */
                      <div className="bg-purple-50 rounded-xl p-4 flex items-center gap-3">
                        <span className="text-2xl">💳</span>
                        <p className="text-sm text-purple-700">Pago automático con tarjeta (Culqi). No requiere comprobante.</p>
                      </div>
                    ) : (
                      /* No receipt yet — admin can upload or mark paid */
                      <div className="bg-[#FFFBEB] border border-yellow-200 rounded-xl p-4">
                        <p className="text-sm font-700 text-yellow-800 mb-3">El cliente aún no subió comprobante</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border-2 border-dashed border-[#CCCCCC] rounded-xl cursor-pointer hover:border-[#1B4FFF] hover:bg-[#F5F8FF] transition-colors">
                            <input type="file" accept="image/*,.pdf" className="sr-only" disabled={processing === p.id}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(p.id, f); }} />
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                            <span className="text-xs font-600">Subir comprobante</span>
                          </label>
                          <button
                            onClick={() => handleAction(p.id, "validate")}
                            disabled={processing === p.id}
                            className="px-3 py-2.5 bg-green-600 text-white text-xs font-700 rounded-xl cursor-pointer hover:bg-green-700 disabled:opacity-50"
                          >
                            ✓ Marcar como pagado
                          </button>
                          <a
                            href={`https://wa.me/51${(p.user_email || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, te recordamos tu pago de ${p.period_label} por $${p.amount} USD en FLUX.`)}`}
                            target="_blank" rel="noreferrer"
                            className="px-3 py-2.5 bg-[#25D366] text-white text-xs font-700 rounded-xl text-center hover:opacity-90 transition-opacity"
                          >
                            WhatsApp recordatorio
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {p.admin_note && (
                    <div className="bg-[#F7F7F7] rounded-xl p-3 mb-4">
                      <p className="text-xs text-[#666]"><strong>Nota:</strong> {p.admin_note}</p>
                    </div>
                  )}

                  {/* === INVOICE SECTION === */}
                  <div className="pt-4 border-t border-[#E5E5E5]">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-700 text-[#18191F]">Facturas SUNAT</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-700 bg-[#1B4FFF]/10 text-[#1B4FFF]">
                          {p.invoices.length}
                        </span>
                      </div>
                      {p.invoices.length > 0 && parseFloat(p.invoices_total ?? "0") > 0 && (
                        <p className="text-xs text-[#666]">
                          Total facturado: <strong className="text-[#18191F]">${parseFloat(p.invoices_total).toFixed(2)}</strong>
                          {" / "}
                          <span className={parseFloat(p.invoices_total) < parseFloat(p.amount) ? "text-orange-600 font-700" : "text-green-600 font-700"}>
                            ${parseFloat(p.amount).toFixed(2)} del pago
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Grid: existing invoices + upload card */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {/* Uploaded invoice cards */}
                      {p.invoices.map(inv => {
                        const isImage = /\.(jpg|jpeg|png|webp)$/i.test(inv.invoice_url);
                        return (
                          <a
                            key={inv.id}
                            href={inv.invoice_url}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative block bg-white border-2 border-green-200 rounded-2xl overflow-hidden hover:border-green-500 hover:shadow-md transition-all"
                          >
                            {/* Preview */}
                            <div className="aspect-[4/5] bg-gradient-to-br from-green-50 to-white flex items-center justify-center relative">
                              {isImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={inv.invoice_url} alt={inv.invoice_number} className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                  <text x="12" y="18" fontSize="4" fill="#16a34a" textAnchor="middle" fontWeight="700" stroke="none">PDF</text>
                                </svg>
                              )}
                              <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-700 px-2 py-0.5 rounded-full shadow">
                                ✓
                              </div>
                            </div>
                            {/* Info */}
                            <div className="p-3 border-t border-green-100">
                              <p className="text-xs font-700 text-[#18191F] truncate">{inv.invoice_number}</p>
                              <p className="text-[10px] text-[#666] mt-0.5">
                                {inv.amount ? `$${parseFloat(inv.amount).toFixed(2)} · ` : ""}
                                {new Date(inv.uploaded_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                              </p>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 py-2 bg-green-600 text-white text-xs font-700 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                              Ver archivo
                            </div>
                          </a>
                        );
                      })}

                      {/* Add new invoice card — inline form trigger */}
                      <div className="relative block bg-[#FAFBFF] border-2 border-dashed border-[#CCCCCC] rounded-2xl hover:border-[#1B4FFF] hover:bg-[#F0F5FF] transition-colors">
                        <div className="aspect-[4/5] flex flex-col items-center justify-center p-4">
                          <div className="w-12 h-12 rounded-full bg-[#1B4FFF]/10 flex items-center justify-center mb-3">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B4FFF" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                          </div>
                          <p className="text-xs font-700 text-[#1B4FFF] text-center leading-tight">
                            {p.invoices.length === 0 ? "Subir primera factura" : "Agregar otra factura"}
                          </p>
                        </div>
                        <div className="p-3 border-t border-dashed border-[#E5E5E5] space-y-2">
                          <input
                            type="text"
                            value={expanded === p.id ? invoiceNumber : ""}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            placeholder="F001-0001"
                            className="w-full px-2 py-1.5 text-xs border border-[#E5E5E5] rounded-lg outline-none focus:border-[#1B4FFF]"
                          />
                          <input
                            type="number"
                            value={expanded === p.id ? invoiceAmount : ""}
                            onChange={(e) => setInvoiceAmount(e.target.value)}
                            placeholder="Monto"
                            step="0.01"
                            className="w-full px-2 py-1.5 text-xs border border-[#E5E5E5] rounded-lg outline-none focus:border-[#1B4FFF]"
                          />
                          <label className="flex items-center justify-center gap-1 w-full px-2 py-1.5 bg-[#1B4FFF] text-white rounded-lg cursor-pointer hover:bg-[#1340CC]">
                            <input type="file" accept="application/pdf,image/*" className="sr-only"
                              disabled={processing === p.id}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInvoiceUpload(p.id, f); }} />
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                            <span className="text-[11px] font-700">{processing === p.id ? "Subiendo..." : "Seleccionar archivo"}</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {p.invoices.length === 0 && (
                      <p className="mt-3 text-[11px] text-[#666] flex items-start gap-2">
                        <span>💡</span>
                        <span>Emite cada factura en SUNAT SOL (gratis), descarga el PDF y súbela aquí. Puedes subir varias facturas que juntas cubran el monto total del pago.</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {isPending && <div className="px-5 py-3 bg-[#EEF2FF] text-xs text-[#1B4FFF] font-600">Actualizando...</div>}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[#999999] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-600 text-[#18191F] truncate">{value}</p>
    </div>
  );
}
