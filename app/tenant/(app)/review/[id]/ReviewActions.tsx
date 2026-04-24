"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action: "approve" | "reject") {
    if (action === "reject" && notes.trim().length === 0) {
      if (!confirm("Rechazar sin notas? Recomendamos explicar el motivo para audit trail.")) {
        return;
      }
    }
    setSubmitting(action);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/review/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.detail ?? body.error ?? `HTTP ${res.status}`);
        setSubmitting(null);
        return;
      }
      // Redirect de vuelta a la cola
      router.push("/tenant/review");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
      setSubmitting(null);
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-4">
      <div>
        <h3 className="text-xs text-white/50 uppercase tracking-wider mb-2">
          Resolver
        </h3>
        <p className="text-xs text-white/40">
          Tu decisión reemplaza el veredicto del pipeline automático y dispara
          el webhook al cliente (Securex). Queda audit trail con tu email + notas.
        </p>
      </div>

      <div>
        <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wider">
          Notas (audit log)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ej: DNI legible, foto concuerda con selfie. Arbiter dudaba por iluminación."
          className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white text-sm"
        />
        <p className="text-xs text-white/30 mt-1">{notes.length}/500</p>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => resolve("approve")}
          disabled={submitting !== null}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-6 py-2.5 font-semibold disabled:opacity-40"
        >
          {submitting === "approve" ? "Aprobando…" : "✓ Aprobar verificación"}
        </button>
        <button
          onClick={() => resolve("reject")}
          disabled={submitting !== null}
          className="bg-red-600 hover:bg-red-700 text-white rounded px-6 py-2.5 font-semibold disabled:opacity-40"
        >
          {submitting === "reject" ? "Rechazando…" : "✗ Rechazar"}
        </button>
      </div>
    </div>
  );
}
