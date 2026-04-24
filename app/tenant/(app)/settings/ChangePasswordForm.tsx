"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPwd.length < 8) {
      setMsg({ kind: "err", text: "Mínimo 8 caracteres" });
      return;
    }
    if (newPwd !== confirm) {
      setMsg({ kind: "err", text: "Las contraseñas no coinciden" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tenant/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: current,
          new_password: newPwd,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: body.detail ?? body.error ?? `HTTP ${res.status}` });
      } else {
        setMsg({ kind: "ok", text: "Contraseña actualizada" });
        setCurrent("");
        setNewPwd("");
        setConfirm("");
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
      <h3 className="text-xs text-white/50 uppercase tracking-wider">
        Cambiar contraseña
      </h3>
      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs text-white/60 mb-1">
            Contraseña actual
          </label>
          <input
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white text-sm"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">
            Nueva contraseña (mín 8)
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white text-sm"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">
            Confirmar nueva contraseña
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white text-sm"
            autoComplete="new-password"
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || !current || newPwd.length < 8 || newPwd !== confirm}
            className="bg-white text-black rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Cambiar contraseña"}
          </button>
          {msg && (
            <span
              className={`text-sm ${msg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}
            >
              {msg.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
