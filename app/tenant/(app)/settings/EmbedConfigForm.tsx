"use client";

import { useEffect, useState } from "react";

export function EmbedConfigForm({
  tenantId,
  initialPk,
  initialOrigins,
}: {
  tenantId: string;
  initialPk: string | null;
  initialOrigins: string[];
}) {
  const [pk, setPk] = useState<string | null>(initialPk);
  const [origins, setOrigins] = useState<string[]>(initialOrigins);
  const [newOrigin, setNewOrigin] = useState("");
  const [savingOrigins, setSavingOrigins] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Generar pk automáticamente si no existe todavía (primera vez que se
  // visita esta sección). Idempotente — si ya hay pk, no rota.
  useEffect(() => {
    if (pk) return;
    (async () => {
      const res = await fetch("/api/tenant/embed-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure_pk" }),
      });
      if (res.ok) {
        const body = await res.json();
        setPk(body.publishable_key);
      }
    })();
  }, [pk]);

  async function rotatePk() {
    if (!confirm("Rotar pk invalida la actual al instante. Sitios con la pk vieja empiezan a tirar 401 hasta que pegues la nueva. Continuar?")) {
      return;
    }
    setRotating(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tenant/embed-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate_pk" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: body.detail ?? body.error ?? "Error" });
      } else {
        setPk(body.publishable_key);
        setMsg({ kind: "ok", text: "Publishable key rotada" });
      }
    } finally {
      setRotating(false);
    }
  }

  function addOrigin() {
    const trimmed = newOrigin.trim().replace(/\/+$/, "");
    if (!trimmed) return;
    setOrigins([...origins.filter((o) => o !== trimmed), trimmed]);
    setNewOrigin("");
  }

  function removeOrigin(o: string) {
    setOrigins(origins.filter((x) => x !== o));
  }

  async function saveOrigins() {
    setSavingOrigins(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tenant/embed-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_origins", origins }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: body.detail ?? body.error ?? "Error" });
      } else {
        setOrigins(body.allowed_origins);
        setMsg({ kind: "ok", text: "Dominios guardados" });
      }
    } finally {
      setSavingOrigins(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback para contextos sin clipboard API
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  const snippet = `<!-- Pegá esto en el HTML de tu página de onboarding -->
<button
  data-flux-kyc="${pk ?? "pk_"}"
  data-external-user-id="USER_ID_DEL_CLIENTE"
  data-on-complete="fluxKycDone"
  style="padding:12px 24px;border-radius:999px;background:#000;color:#fff;font-weight:600;cursor:pointer;border:0"
>
  Verificar mi identidad
</button>

<script async src="https://www.fluxperu.com/kyc-embed.js"></script>
<script>
  function fluxKycDone(verdict) {
    console.log('KYC verdict:', verdict.status, verdict.reason);
    // → continuar tu flujo de onboarding aquí
  }
</script>`;

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-5">
      <div>
        <h3 className="text-xs text-white/50 uppercase tracking-wider">
          Integración web — botón embebible
        </h3>
        <p className="text-xs text-white/40 mt-1">
          Tu cliente pega 2 tags HTML en su página de onboarding. Al click,
          abre modal con el flujo KYC branded. Al terminar, dispara
          <code className="text-white/60"> onComplete(verdict)</code>.
          Sin tocar backend — la <code>publishable_key</code> va al browser
          y la seguridad viene del whitelist de dominios de abajo.
        </p>
      </div>

      {/* Publishable key */}
      <div className="space-y-2">
        <div className="text-xs text-white/60 uppercase tracking-wider">
          Publishable key
        </div>
        <div className="flex gap-2 items-center">
          <code className="flex-1 bg-slate-950 border border-white/10 rounded px-3 py-2 text-emerald-300 font-mono text-xs break-all">
            {pk ?? "generando…"}
          </code>
          {pk && (
            <>
              <button
                onClick={() => copyToClipboard(pk)}
                className="text-xs bg-white/10 hover:bg-white/20 rounded px-3 py-2"
              >
                Copiar
              </button>
              <button
                onClick={rotatePk}
                disabled={rotating}
                className="text-xs bg-white/10 hover:bg-white/20 rounded px-3 py-2 disabled:opacity-40"
              >
                {rotating ? "Rotando…" : "Rotar"}
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-white/30">
          No es secreto — puede pegarse en HTML público. Rotar invalida la
          actual al instante.
        </p>
      </div>

      {/* Allowed origins */}
      <div className="space-y-2">
        <div className="text-xs text-white/60 uppercase tracking-wider">
          Dominios autorizados
        </div>
        <p className="text-xs text-white/40">
          La <code>publishable_key</code> solo funciona desde estos dominios.
          Agregá cada variante (ej: <code>https://securex.pe</code> y{" "}
          <code>https://www.securex.pe</code>) — el match es exacto.
        </p>
        <div className="flex flex-wrap gap-2">
          {origins.length === 0 && (
            <span className="text-amber-400 text-xs">
              ⚠ Sin dominios → el botón tirará 403 desde cualquier sitio
            </span>
          )}
          {origins.map((o) => (
            <span
              key={o}
              className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded px-2 py-1 text-xs font-mono"
            >
              {o}
              <button
                onClick={() => removeOrigin(o)}
                className="text-white/50 hover:text-red-400"
                aria-label="remover"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="url"
            value={newOrigin}
            onChange={(e) => setNewOrigin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOrigin();
              }
            }}
            placeholder="https://securex.pe"
            className="flex-1 bg-slate-950 border border-white/10 rounded px-3 py-2 text-white text-sm font-mono"
          />
          <button
            onClick={addOrigin}
            disabled={!newOrigin.trim()}
            className="bg-white/10 hover:bg-white/20 rounded px-3 py-2 text-sm disabled:opacity-40"
          >
            Agregar
          </button>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={saveOrigins}
            disabled={
              savingOrigins ||
              JSON.stringify(origins.slice().sort()) ===
                JSON.stringify(initialOrigins.slice().sort())
            }
            className="bg-white text-black rounded px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
          >
            {savingOrigins ? "Guardando…" : "Guardar dominios"}
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

      {/* Snippet */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/60 uppercase tracking-wider">
            Snippet para el HTML del cliente
          </div>
          <button
            onClick={() => copyToClipboard(snippet)}
            className="text-xs bg-white/10 hover:bg-white/20 rounded px-3 py-1"
          >
            Copiar snippet
          </button>
        </div>
        <pre className="bg-slate-950 border border-white/10 rounded px-3 py-3 text-xs text-white/70 overflow-x-auto">
          <code>{snippet}</code>
        </pre>
        <p className="text-xs text-white/30">
          El botón del snippet es solo un ejemplo — podés usar cualquier
          elemento con <code>data-flux-kyc</code> (div, a, span).
          Tenant: <code>{tenantId}</code>
        </p>
      </div>
    </div>
  );
}
