"use client";

import { useState } from "react";

type Policy = "never" | "low_confidence" | "all_borderline";

const LABELS: Record<Policy, { title: string; detail: string }> = {
  never: {
    title: "Nunca",
    detail:
      "El pipeline automático resuelve todo binario (verified/rejected). Mayor throughput, sin humanos en el loop.",
  },
  low_confidence: {
    title: "Solo cuando el arbiter dude (confidence < 70%)",
    detail:
      "Si el arbiter IA no está seguro de su decisión, la session cae a review manual. Balance entre automatización y prudencia.",
  },
  all_borderline: {
    title: "Siempre que el arbiter tenga que correr",
    detail:
      "Cualquier caso que el pipeline clásico no pudo resolver binario pasa a humano. Más seguro, más cola manual.",
  },
};

export function ReviewPolicyForm({
  initial,
}: {
  initial: Policy;
}) {
  const [policy, setPolicy] = useState<Policy>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tenant/review-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: body.detail ?? body.error ?? "Error" });
      } else {
        setMsg({ kind: "ok", text: "Guardado" });
      }
    } catch (e) {
      setMsg({
        kind: "err",
        text: e instanceof Error ? e.message : "Error de red",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-3">
      <div>
        <h3 className="text-xs text-white/50 uppercase tracking-wider">
          Policy de revisión manual
        </h3>
        <p className="text-xs text-white/40 mt-1">
          Cuándo enviar sesiones borderline a la cola de{" "}
          <a href="/tenant/review" className="underline">revisión humana</a>{" "}
          en vez de resolverlas automáticamente con el arbiter IA.
        </p>
      </div>

      <div className="space-y-2">
        {(Object.keys(LABELS) as Policy[]).map((key) => (
          <label
            key={key}
            className={`flex gap-3 items-start p-3 rounded border cursor-pointer transition ${
              policy === key
                ? "bg-white/10 border-white/30"
                : "bg-slate-950 border-white/10 hover:border-white/20"
            }`}
          >
            <input
              type="radio"
              name="policy"
              value={key}
              checked={policy === key}
              onChange={() => setPolicy(key)}
              className="mt-1"
            />
            <div>
              <div className="text-white font-medium text-sm">{LABELS[key].title}</div>
              <div className="text-white/50 text-xs mt-0.5">{LABELS[key].detail}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving || policy === initial}
          className="bg-white text-black rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar policy"}
        </button>
        {msg && (
          <span
            className={`text-sm ${msg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
