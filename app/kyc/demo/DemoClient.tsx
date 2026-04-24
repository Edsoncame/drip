"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface Verdict {
  status?: string;
  reason?: string;
  face_score?: number | null;
}

export function DemoClient({
  tenantId,
  publishableKey,
  allowedOrigins,
}: {
  tenantId: string;
  publishableKey: string | null;
  allowedOrigins: string[];
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const onComplete = (e: Event) => {
      const ce = e as CustomEvent<{ verdict: Verdict }>;
      setVerdict(ce.detail.verdict);
      setCancelled(false);
      setError(null);
    };
    const onCancel = () => {
      setCancelled(true);
      setVerdict(null);
    };
    const onError = (e: Event) => {
      const ce = e as CustomEvent<{ error: string }>;
      setError(ce.detail.error);
    };
    el.addEventListener("flux-kyc:complete", onComplete);
    el.addEventListener("flux-kyc:cancel", onCancel);
    el.addEventListener("flux-kyc:error", onError);
    return () => {
      el.removeEventListener("flux-kyc:complete", onComplete);
      el.removeEventListener("flux-kyc:cancel", onCancel);
      el.removeEventListener("flux-kyc:error", onError);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <Script src="/kyc-embed.js" strategy="afterInteractive" />

      {/* Fake nav del "cliente" */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-lg font-semibold tracking-wider">
            {tenantId.toUpperCase()}
          </div>
          <div className="text-sm text-slate-500">Mi cuenta · Ayuda · Salir</div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-xs text-slate-400 uppercase tracking-[0.3em] mb-3">
          Demo · Integración embebible Flux KYC
        </div>
        <h1 className="text-3xl font-bold mb-2">Verificá tu identidad</h1>
        <p className="text-slate-600 mb-8">
          Antes de activar tu cuenta, necesitamos validar tu DNI. Tomate 2
          minutos — es 100% desde tu celular.
        </p>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold mb-1">Verificación de identidad</div>
              <div className="text-sm text-slate-500">
                DNI (frente + reverso) + selfie con liveness
              </div>
            </div>
            <button
              ref={btnRef}
              data-flux-kyc={publishableKey ?? "pk_notconfigured"}
              data-external-user-id="demo-user-12345"
              data-external-reference="demo-onboarding-v1"
              className="bg-black hover:bg-slate-800 text-white px-6 py-3 rounded-full font-semibold text-sm"
            >
              Empezar verificación
            </button>
          </div>
        </div>

        {/* Estado reactivo */}
        {verdict && (
          <div
            className={`rounded-xl p-5 mb-4 ${
              verdict.status === "verified"
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="font-semibold text-lg mb-1">
              {verdict.status === "verified"
                ? "✓ Identidad verificada"
                : "✗ Verificación rechazada"}
            </div>
            <div className="text-sm text-slate-700">
              {verdict.reason ?? "(sin razón)"}
            </div>
            {typeof verdict.face_score === "number" && (
              <div className="text-xs text-slate-500 mt-2">
                Face score: {verdict.face_score.toFixed(1)}%
              </div>
            )}
            <pre className="text-xs text-slate-500 mt-3 bg-white rounded p-2 overflow-auto">
              {JSON.stringify(verdict, null, 2)}
            </pre>
          </div>
        )}
        {cancelled && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
            Cancelaste la verificación. Podés volver a intentarlo cuando quieras.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4">
            <div className="font-semibold mb-1">Error</div>
            <div className="text-sm text-slate-700 font-mono">{error}</div>
          </div>
        )}

        {/* Panel lateral: inspección técnica */}
        <div className="bg-slate-900 text-slate-300 rounded-xl p-5 font-mono text-xs space-y-2 mt-10">
          <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-2">
            Inspección técnica (solo visible en esta demo)
          </div>
          <div>
            <span className="text-slate-500">tenant:</span> {tenantId}
          </div>
          <div>
            <span className="text-slate-500">publishable_key:</span>{" "}
            {publishableKey ? (
              <span className="text-emerald-400">{publishableKey}</span>
            ) : (
              <span className="text-red-400">sin pk — configurá en /tenant/settings</span>
            )}
          </div>
          <div>
            <span className="text-slate-500">allowed_origins:</span>{" "}
            {allowedOrigins.length === 0 ? (
              <span className="text-amber-400">
                [] — agregá https://www.fluxperu.com para que el demo funcione
              </span>
            ) : (
              <span className="text-emerald-400">{allowedOrigins.join(", ")}</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
