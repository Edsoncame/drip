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
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  reviewing: { label: "Por revisar", color: "bg-blue-100 text-blue-700" },
  pending:   { label: "Pendiente",   color: "bg-yellow-100 text-yellow-700" },
  overdue:   { label: "Vencido",     color: "bg-red-100 text-red-600" },
  validated: { label: "Validado",    color: "bg-green-100 text-green-700" },
  upcoming:  { label: "Próximo",     color: "bg-gray-100 text-gray-500" },
};

export default function PaymentsReview({ payments }: { payments: Payment[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");

  const filtered = payments.filter(p =>
    filter === "all" || p.status === filter
  );

  const handleAction = async (paymentId: string, action: "validate" | "reject") => {
    setProcessing(paymentId);
    await fetch("/api/admin/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, action, note: noteValue || undefined }),
    });
    setProcessing(null);
    setExpanded(null);
    setNoteValue("");
    startTransition(() => router.refresh());
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
      {/* Filter tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-[#E5E5E5]">
        {[
          { key: "all", label: "Todos", count: payments.length },
          { key: "reviewing", label: "Por revisar", count: payments.filter(p => p.status === "reviewing").length },
          { key: "pending", label: "Pendientes", count: payments.filter(p => p.status === "pending" || p.status === "overdue").length },
          { key: "validated", label: "Validados", count: payments.filter(p => p.status === "validated").length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-2 text-xs font-600 border-b-2 transition-colors cursor-pointer ${
              filter === f.key ? "border-[#1B4FFF] text-[#1B4FFF]" : "border-transparent text-[#666666] hover:text-[#333333]"
            }`}
          >
            {f.label} {f.count > 0 && <span className="ml-1 opacity-70">{f.count}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7F7]">
            <tr>
              {["Cliente", "Período", "Monto", "Estado", "Comprobante", "Acciones"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666666] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-[#999999]">Sin pagos en esta categoría</td></tr>
            ) : filtered.map(p => {
              const st = STATUS_LABELS[p.status] ?? STATUS_LABELS.pending;
              const isExpanded = expanded === p.id;

              return (
                <tbody key={p.id}>
                  <tr
                    className={`hover:bg-[#FAFAFA] cursor-pointer ${isExpanded ? "bg-[#F5F8FF]" : ""} ${p.status === "reviewing" ? "bg-blue-50/50" : ""}`}
                    onClick={() => setExpanded(isExpanded ? null : p.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-600 text-[#18191F]">{p.user_name}</p>
                        {p.payment_method === "culqi" ? (
                          <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">💳 Tarjeta</span>
                        ) : (
                          <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">🏦 Transf.</span>
                        )}
                      </div>
                      <p className="text-xs text-[#999999]">{p.company ?? p.user_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-600 text-[#18191F]">{p.period_label}</p>
                      <p className="text-xs text-[#999999]">{new Date(p.due_date).toLocaleDateString("es-PE")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-700 text-[#18191F]">${parseFloat(p.amount).toFixed(2)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-700 ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.receipt_url ? (
                        <span className="text-xs text-[#1B4FFF] font-600">Adjunto ✓</span>
                      ) : (
                        <span className="text-xs text-[#999999]">Sin comprobante</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {p.status === "reviewing" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleAction(p.id, "validate")}
                            disabled={processing === p.id}
                            className="px-2.5 py-1 rounded-full text-xs font-700 bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer disabled:opacity-50"
                          >
                            {processing === p.id ? "..." : "✓ Validar"}
                          </button>
                          <button
                            onClick={() => { setExpanded(p.id); setNoteValue(""); }}
                            className="px-2.5 py-1 rounded-full text-xs font-700 bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer"
                          >
                            ✕ Rechazar
                          </button>
                        </div>
                      )}
                      {p.status === "validated" && p.validated_at && (
                        <span className="text-xs text-[#999999]">{new Date(p.validated_at).toLocaleDateString("es-PE")}</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded: receipt preview + reject form */}
                  {isExpanded && (
                    <tr className="bg-[#F5F8FF]">
                      <td colSpan={6} className="px-6 pb-5 pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Receipt preview */}
                          {p.receipt_url && (
                            <div>
                              <p className="text-xs font-700 text-[#666666] uppercase tracking-wider mb-2">Comprobante</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.receipt_url} alt="Comprobante" className="w-full max-h-64 object-contain rounded-xl border border-[#E5E5E5] bg-white" />
                              {p.receipt_uploaded_at && (
                                <p className="text-xs text-[#999999] mt-1">
                                  Subido: {new Date(p.receipt_uploaded_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Reject form */}
                          {p.status === "reviewing" && (
                            <div>
                              <p className="text-xs font-700 text-[#666666] uppercase tracking-wider mb-2">Rechazar con motivo</p>
                              <textarea
                                value={noteValue}
                                onChange={e => setNoteValue(e.target.value)}
                                placeholder="Ej: El monto no coincide / Imagen borrosa / Transferencia a cuenta incorrecta"
                                className="w-full px-3 py-2 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] resize-none h-24"
                              />
                              <button
                                onClick={() => handleAction(p.id, "reject")}
                                disabled={processing === p.id}
                                className="mt-2 px-4 py-2 bg-red-500 text-white text-xs font-700 rounded-full cursor-pointer hover:bg-red-600 disabled:opacity-50"
                              >
                                {processing === p.id ? "Procesando..." : "Rechazar y notificar al cliente"}
                              </button>
                            </div>
                          )}
                        </div>

                        {p.admin_note && (
                          <p className="text-xs text-[#999999] mt-3">Nota: {p.admin_note}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </div>
      {isPending && <div className="px-6 py-2 bg-[#EEF2FF] text-xs text-[#1B4FFF] font-600">Actualizando...</div>}
    </div>
  );
}
