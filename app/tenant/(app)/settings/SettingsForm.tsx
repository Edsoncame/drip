"use client";

import { useState } from "react";

export function SettingsForm({
  tenantId,
  initialWebhook,
}: {
  tenantId: string;
  initialWebhook: string;
}) {
  const [webhook, setWebhook] = useState(initialWebhook);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [rotateErr, setRotateErr] = useState<string | null>(null);

  async function saveWebhook() {
    setSavingWebhook(true);
    setWebhookMsg(null);
    try {
      const res = await fetch("/api/tenant/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_webhook_url: webhook.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWebhookMsg({ kind: "err", text: body.detail ?? body.error ?? "Error" });
      } else {
        setWebhookMsg({ kind: "ok", text: "Guardado" });
      }
    } catch (e) {
      setWebhookMsg({
        kind: "err",
        text: e instanceof Error ? e.message : "Error de red",
      });
    } finally {
      setSavingWebhook(false);
    }
  }

  async function rotateKey() {
    setRotating(true);
    setRotateErr(null);
    try {
      const res = await fetch("/api/tenant/rotate-key", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setRotateErr(body.error ?? "Error");
      } else {
        setNewKey(body.api_key);
        setShowRotateConfirm(false);
      }
    } catch (e) {
      setRotateErr(e instanceof Error ? e.message : "Error de red");
    } finally {
      setRotating(false);
    }
  }

  return (
    <>
      {/* Webhook */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-3">
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider">
            Webhook default
          </h3>
          <p className="text-xs text-white/40 mt-1">
            URL que Flux llama con el veredicto al finalizar cada sesión. Puede
            overridearse por sesión al crearla.
          </p>
        </div>
        <input
          type="url"
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          placeholder="https://tu-app.com/kyc-webhook"
          className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white placeholder-white/30 font-mono text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={saveWebhook}
            disabled={savingWebhook || webhook === initialWebhook}
            className="bg-white text-black rounded px-4 py-1.5 text-sm font-semibold hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingWebhook ? "Guardando…" : "Guardar"}
          </button>
          {webhookMsg && (
            <span
              className={`text-sm ${webhookMsg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}
            >
              {webhookMsg.text}
            </span>
          )}
        </div>
      </div>

      {/* API key rotation */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-3">
        <div>
          <h3 className="text-xs text-white/50 uppercase tracking-wider">
            API key del tenant
          </h3>
          <p className="text-xs text-white/40 mt-1">
            Se usa en el Authorization header de tu backend al crear sesiones.
            Formato: <code className="text-white/60">Bearer {tenantId}:&lt;api_key&gt;</code>.
            Rotar invalida el key anterior al instante.
          </p>
        </div>

        {newKey ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-4 space-y-3">
            <div className="text-emerald-300 text-sm font-semibold">
              ✓ API key rotado — guardalo AHORA
            </div>
            <div className="text-white/60 text-xs">
              No se vuelve a mostrar. Si lo perdés, rotá de nuevo.
            </div>
            <code className="block bg-slate-950 border border-white/10 rounded px-3 py-2 text-emerald-300 font-mono text-xs break-all">
              Bearer {tenantId}:{newKey}
            </code>
            <button
              onClick={() => setNewKey(null)}
              className="text-xs text-white/60 hover:text-white underline"
            >
              Ya lo guardé, ocultar
            </button>
          </div>
        ) : showRotateConfirm ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded p-4 space-y-3">
            <div className="text-red-300 text-sm">
              ⚠ El key actual dejará de funcionar apenas confirmes. Cualquier
              servicio que lo use empezará a recibir 401 hasta actualizar.
            </div>
            <div className="flex gap-2">
              <button
                onClick={rotateKey}
                disabled={rotating}
                className="bg-red-500 hover:bg-red-600 text-white rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                {rotating ? "Rotando…" : "Confirmar rotación"}
              </button>
              <button
                onClick={() => setShowRotateConfirm(false)}
                className="text-white/60 hover:text-white text-sm"
              >
                Cancelar
              </button>
            </div>
            {rotateErr && <div className="text-red-400 text-sm">{rotateErr}</div>}
          </div>
        ) : (
          <button
            onClick={() => setShowRotateConfirm(true)}
            className="bg-white/10 hover:bg-white/20 border border-white/10 rounded px-4 py-1.5 text-sm"
          >
            Rotar API key
          </button>
        )}
      </div>
    </>
  );
}
