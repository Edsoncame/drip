"use client";

import { useState } from "react";
import type { KycCase } from "./page";

export default function KycReview({ cases }: { cases: KycCase[] }) {
  const [selected, setSelected] = useState<KycCase | null>(null);
  const [filter, setFilter] = useState<string>("review");
  const [acting, setActing] = useState(false);

  const filtered = cases.filter((c) => {
    if (filter === "all") return true;
    return (c.user_kyc_status ?? "pending") === filter;
  });

  const act = async (action: "approve" | "reject", userId: string | null, corrId: string) => {
    if (!userId) {
      alert("Este scan no tiene usuario vinculado (guest). No se puede aprobar desde el panel aún.");
      return;
    }
    setActing(true);
    try {
      const res = await fetch(`/api/admin/kyc/${userId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, correlation_id: corrId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Error al procesar");
        setActing(false);
        return;
      }
      setActing(false);
      setSelected(null);
      window.location.reload();
    } catch (err) {
      setActing(false);
      alert(err instanceof Error ? err.message : "Error de red");
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {["review", "rejected", "blocked", "verified", "pending", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-700 transition ${
              filter === f
                ? "bg-[#1B4FFF] text-white"
                : "bg-white border border-[#E5E5E5] text-[#666] hover:border-[#1B4FFF]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F7F7] text-xs font-700 text-[#666] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">DNI</th>
                <th className="text-left px-4 py-3">Face score</th>
                <th className="text-left px-4 py-3">Liveness</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#999]">
                    No hay casos con status "{filter}"
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.scan_id} className="hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3">
                    <p className="font-600 text-[#18191F]">{c.user_name ?? "—"}</p>
                    <p className="text-xs text-[#999]">{c.user_email ?? "guest"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{c.dni_number ?? "—"}</p>
                    <p className="text-xs text-[#999]">
                      {[c.apellido_paterno, c.apellido_materno, c.prenombres].filter(Boolean).join(" ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {c.face_score ? (
                      <span
                        className={`font-700 ${
                          c.face_passed ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {parseFloat(c.face_score).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[#999]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.liveness_passed === null ? (
                      <span className="text-[#999]">—</span>
                    ) : c.liveness_passed ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-red-600">✕</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.user_kyc_status ?? "pending"} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[#666]">
                    {new Date(c.scan_created_at).toLocaleString("es-PE", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(c)}
                      className="text-[#1B4FFF] hover:underline text-xs font-700"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !acting && setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#E5E5E5] flex items-start justify-between">
              <div>
                <h2 className="text-xl font-800 text-[#18191F]">
                  {selected.user_name ?? "Cliente sin user"}
                </h2>
                <p className="text-sm text-[#666]">{selected.user_email ?? "—"}</p>
                <p className="text-xs text-[#999] mt-1 font-mono">
                  corr: {selected.correlation_id}
                </p>
              </div>
              <button
                onClick={() => !acting && setSelected(null)}
                className="text-[#999] hover:text-[#333] text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-700 text-[#666] uppercase mb-2">DNI anverso</p>
                  {selected.imagen_anverso_key ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={
                        selected.imagen_anverso_key.startsWith("http")
                          ? selected.imagen_anverso_key
                          : `https://${selected.imagen_anverso_key}`
                      }
                      alt="DNI"
                      className="w-full rounded-xl border border-[#E5E5E5]"
                    />
                  ) : (
                    <div className="bg-[#F7F7F7] rounded-xl p-8 text-center text-sm text-[#999]">
                      Sin imagen
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-700 text-[#666] uppercase mb-2">Selfie</p>
                  {selected.selfie_key ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={
                        selected.selfie_key.startsWith("http")
                          ? selected.selfie_key
                          : `https://${selected.selfie_key}`
                      }
                      alt="Selfie"
                      className="w-full rounded-xl border border-[#E5E5E5]"
                    />
                  ) : (
                    <div className="bg-[#F7F7F7] rounded-xl p-8 text-center text-sm text-[#999]">
                      Sin selfie
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-700 text-[#666] uppercase mb-1">Datos OCR</p>
                  <p><strong>DNI:</strong> <span className="font-mono">{selected.dni_number}</span></p>
                  <p><strong>Apellidos:</strong> {selected.apellido_paterno} {selected.apellido_materno}</p>
                  <p><strong>Nombres:</strong> {selected.prenombres}</p>
                  <p><strong>F. Nacimiento:</strong> {selected.fecha_nacimiento ?? "—"}</p>
                  <p><strong>Sexo:</strong> {selected.sexo ?? "—"}</p>
                  <p><strong>OCR confidence:</strong> {selected.confidence ? parseFloat(selected.confidence).toFixed(2) : "—"}</p>
                  <p><strong>Captura:</strong> {selected.capture_mode}</p>
                </div>
                <div>
                  <p className="text-xs font-700 text-[#666] uppercase mb-1">Biométrico</p>
                  <p><strong>Face score:</strong> {selected.face_score ? `${parseFloat(selected.face_score).toFixed(2)}%` : "—"}</p>
                  <p><strong>Match pasó:</strong> {selected.face_passed === null ? "—" : selected.face_passed ? "✓" : "✕"}</p>
                  <p><strong>Liveness pasó:</strong> {selected.liveness_passed === null ? "—" : selected.liveness_passed ? "✓" : "✕"}</p>
                  <p><strong>Status actual:</strong> <StatusBadge status={selected.user_kyc_status ?? "pending"} /></p>
                </div>
              </div>

              {selected.user_id && (
                <div className="flex gap-3 pt-4 border-t border-[#E5E5E5]">
                  <button
                    onClick={() => act("reject", selected.user_id, selected.correlation_id)}
                    disabled={acting}
                    className="flex-1 py-3 rounded-full bg-red-500 text-white font-700 text-sm hover:bg-red-600 transition disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => act("approve", selected.user_id, selected.correlation_id)}
                    disabled={acting}
                    className="flex-1 py-3 rounded-full bg-green-500 text-white font-700 text-sm hover:bg-green-600 transition disabled:opacity-50"
                  >
                    {acting ? "Procesando…" : "Aprobar"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    review: "bg-amber-100 text-amber-800",
    verified: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    blocked: "bg-gray-800 text-white",
    pending: "bg-gray-100 text-gray-600",
    capturing: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-700 ${colors[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}
