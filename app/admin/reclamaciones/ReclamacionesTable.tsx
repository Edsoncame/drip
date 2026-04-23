"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Reclamacion } from "./page";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-yellow-100 text-yellow-700" },
  respondido: { label: "Respondido", color: "bg-green-100 text-green-700" },
  cerrado: { label: "Cerrado", color: "bg-gray-100 text-gray-500" },
};

export default function ReclamacionesTable({ rows }: { rows: Reclamacion[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveRespuesta(id: string) {
    setSaving(true);
    await fetch("/api/admin/reclamaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, respuesta, estado: "respondido" }),
    });
    setSaving(false);
    setRespondingId(null);
    setRespuesta("");
    startTransition(() => router.refresh());
  }

  // `now` memoizado — re-captura en cada set of rows pero no en cada re-render.
  // MUST estar antes de cualquier early return (rule-of-hooks).
  // Date.now() dentro de useMemo: el Compiler lo flaggea porque la llamada
  // es impura, pero el useMemo lo cachea por render-ciclo → estable dentro
  // de un mismo render. Disable documentado.
  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), [rows]);

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center">
        <p className="text-[#999]">Sin reclamaciones registradas.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7F7]">
            <tr>
              {["Hoja", "Fecha", "Consumidor", "Tipo", "Pedido", "Estado", "Plazo"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {rows.map((r) => {
              const st = STATUS_LABELS[r.estado] ?? { label: r.estado, color: "bg-gray-100 text-gray-500" };
              const days = (now - new Date(r.fecha_reclamo).getTime()) / (1000 * 60 * 60 * 24);
              const daysLeft = Math.max(0, 30 - Math.floor(days));
              const urgent = r.estado === "pendiente" && daysLeft <= 5;
              const isExp = expanded === r.id;

              return (
                <Fragment key={r.id}>
                  <tr className={`hover:bg-[#FAFAFA] cursor-pointer ${isExp ? "bg-[#F5F8FF]" : ""}`} onClick={() => setExpanded(isExp ? null : r.id)}>
                    <td className="px-4 py-3 font-700">#{r.numero_hoja}</td>
                    <td className="px-4 py-3 text-xs text-[#666]">
                      {new Date(r.fecha_reclamo).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-600 text-[#18191F]">{r.nombre} {r.apellidos}</p>
                      <p className="text-xs text-[#999]">{r.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-700 ${r.tipo_reclamo === "reclamo" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.tipo_reclamo}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]"><p className="truncate text-[#666]">{r.pedido}</p></td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-700 ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {r.estado === "pendiente" ? (
                        <span className={urgent ? "text-red-600 font-700" : "text-[#666]"}>
                          {daysLeft} días
                        </span>
                      ) : <span className="text-[#999]">—</span>}
                    </td>
                  </tr>

                  {isExp && (
                    <tr className="bg-[#F5F8FF]">
                      <td colSpan={7} className="px-6 pb-6 pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-xs">
                          <div><span className="text-[#999]">Documento:</span> <span className="font-600">{r.tipo_documento} {r.numero_documento}</span></div>
                          <div><span className="text-[#999]">Teléfono:</span> <span className="font-600">{r.telefono ?? "—"}</span></div>
                          <div className="sm:col-span-2"><span className="text-[#999]">Domicilio:</span> <span className="font-600">{r.domicilio}</span></div>
                          <div><span className="text-[#999]">Tipo de bien:</span> <span className="font-600">{r.tipo_bien}</span></div>
                          <div><span className="text-[#999]">Monto reclamado:</span> <span className="font-600">{r.monto_reclamado ? `$${r.monto_reclamado}` : "—"}</span></div>
                        </div>

                        <div className="space-y-3 mb-4">
                          <div>
                            <p className="text-xs font-700 text-[#666] uppercase mb-1">Descripción del bien</p>
                            <p className="text-sm text-[#333] whitespace-pre-wrap bg-white rounded-lg p-3 border border-[#E5E5E5]">{r.descripcion_bien}</p>
                          </div>
                          <div>
                            <p className="text-xs font-700 text-[#666] uppercase mb-1">Detalle del {r.tipo_reclamo}</p>
                            <p className="text-sm text-[#333] whitespace-pre-wrap bg-white rounded-lg p-3 border border-[#E5E5E5]">{r.detalle_reclamo}</p>
                          </div>
                          <div>
                            <p className="text-xs font-700 text-[#666] uppercase mb-1">Pedido</p>
                            <p className="text-sm text-[#333] whitespace-pre-wrap bg-white rounded-lg p-3 border border-[#E5E5E5]">{r.pedido}</p>
                          </div>
                        </div>

                        {r.respuesta ? (
                          <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                            <p className="text-xs font-700 text-green-800 uppercase mb-1">
                              Respuesta enviada
                              {r.respuesta_fecha && (
                                <span className="ml-2 normal-case font-500 text-green-700">
                                  {new Date(r.respuesta_fecha).toLocaleDateString("es-PE")}
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-[#333] whitespace-pre-wrap">{r.respuesta}</p>
                          </div>
                        ) : respondingId === r.id ? (
                          <div className="space-y-2">
                            <textarea
                              autoFocus
                              rows={4}
                              value={respuesta}
                              onChange={(e) => setRespuesta(e.target.value)}
                              placeholder="Respuesta formal al consumidor (será enviada por email)…"
                              className="w-full px-3 py-2.5 text-sm border border-[#1B4FFF] rounded-xl outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                disabled={saving || respuesta.trim().length < 10}
                                onClick={() => saveRespuesta(r.id)}
                                className="px-4 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-full cursor-pointer disabled:opacity-50"
                              >
                                {saving ? "Enviando…" : "Guardar y enviar email"}
                              </button>
                              <button
                                onClick={() => { setRespondingId(null); setRespuesta(""); }}
                                className="px-4 py-2 text-xs text-[#666] cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setRespondingId(r.id); setRespuesta(""); }}
                            className="px-4 py-2 bg-[#1B4FFF] text-white text-xs font-700 rounded-full cursor-pointer"
                          >
                            ✍️ Responder
                          </button>
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
