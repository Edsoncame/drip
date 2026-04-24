"use client";

import { useRef, useState } from "react";
import type { BrandingTokens } from "@/lib/kyc/sdk/branding";

export function BrandingForm({
  initial,
}: {
  initial: BrandingTokens;
}) {
  const [b, setB] = useState<BrandingTokens>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tenant/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: body.error ?? `HTTP ${res.status}` });
      } else {
        setB(body.branding);
        setMsg({ kind: "ok", text: "Guardado" });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/tenant/branding/logo", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: body.detail ?? body.error ?? `HTTP ${res.status}` });
      } else {
        setB(body.branding);
        setMsg({ kind: "ok", text: "Logo subido" });
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-5 space-y-5">
      <div>
        <h3 className="text-xs text-white/50 uppercase tracking-wider">
          Branding del flow web
        </h3>
        <p className="text-xs text-white/40 mt-1">
          Se aplica en <code>https://www.fluxperu.com/kyc/s/[session]</code>
          — la página que tus usuarios ven cuando los redirigís para hacer
          KYC. Preview en vivo al costado.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <Field label="Nombre de marca">
            <input
              type="text"
              maxLength={60}
              value={b.brand_name}
              onChange={(e) => setB({ ...b, brand_name: e.target.value })}
              className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white text-sm"
            />
          </Field>

          <Field label="Logo">
            <div className="flex items-center gap-3">
              {b.logo_url ? (
                <img
                  src={b.logo_url}
                  alt="Logo"
                  className="h-10 w-10 object-contain bg-white/5 rounded p-1 border border-white/10"
                />
              ) : (
                <div className="h-10 w-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-white/30 text-xs">
                  sin logo
                </div>
              )}
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="bg-white/10 hover:bg-white/20 border border-white/10 rounded px-3 py-1.5 text-xs"
              >
                {uploadingLogo ? "Subiendo…" : b.logo_url ? "Cambiar" : "Subir"}
              </button>
              {b.logo_url && (
                <button
                  onClick={() => setB({ ...b, logo_url: null })}
                  className="text-xs text-white/40 hover:text-white/70"
                >
                  Quitar
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
              />
            </div>
            <p className="text-xs text-white/30 mt-1">
              PNG, JPG, WEBP o SVG. Máx 2 MB. Sugerido: cuadrado 256×256.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="Primario (botones)"
              value={b.primary_color}
              onChange={(v) => setB({ ...b, primary_color: v })}
            />
            <ColorField
              label="Fondo"
              value={b.background_color}
              onChange={(v) => setB({ ...b, background_color: v })}
            />
            <ColorField
              label="Texto"
              value={b.text_color}
              onChange={(v) => setB({ ...b, text_color: v })}
            />
            <ColorField
              label="Texto secundario"
              value={b.muted_text_color}
              onChange={(v) => setB({ ...b, muted_text_color: v })}
            />
          </div>

          <Field label="Mensaje de bienvenida (opcional)">
            <textarea
              maxLength={200}
              rows={2}
              value={b.welcome_message ?? ""}
              onChange={(e) =>
                setB({ ...b, welcome_message: e.target.value || null })
              }
              placeholder="Ej: Verificá tu identidad para activar tu cuenta en Securex."
              className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-white text-sm"
            />
            <p className="text-xs text-white/30 mt-1">
              {(b.welcome_message ?? "").length}/200
            </p>
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-white text-black rounded px-4 py-1.5 text-sm font-semibold hover:bg-white/90 disabled:opacity-40"
            >
              {saving ? "Guardando…" : "Guardar branding"}
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

        {/* Live preview */}
        <BrandingPreview b={b} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Color pickers HTML solo aceptan #RRGGBB (6 chars), no alpha.
  const pickerValue = value.length === 9 ? value.slice(0, 7) : value;
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 rounded cursor-pointer border border-white/10 bg-slate-950"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="flex-1 bg-slate-950 border border-white/10 rounded px-2 py-1.5 text-white text-sm font-mono"
          placeholder="#RRGGBB"
        />
      </div>
    </div>
  );
}

function BrandingPreview({ b }: { b: BrandingTokens }) {
  return (
    <div>
      <div className="text-xs text-white/50 uppercase tracking-wider mb-2">
        Preview en vivo — así lo ven tus usuarios
      </div>
      <div
        className="rounded-lg border border-white/10 overflow-hidden"
        style={{ backgroundColor: b.background_color }}
      >
        <div className="px-5 py-8 text-center min-h-[380px] flex flex-col justify-between">
          {/* Top: logo + brand */}
          <div className="flex flex-col items-center gap-2">
            {b.logo_url && (
              <img
                src={b.logo_url}
                alt=""
                className="h-10 w-auto object-contain max-w-[140px]"
              />
            )}
            <div
              className="text-xs tracking-[0.3em] uppercase"
              style={{ color: b.muted_text_color }}
            >
              {b.brand_name}
            </div>
          </div>

          {/* Middle: copy */}
          <div className="space-y-3 my-6">
            <div
              className="text-lg font-semibold"
              style={{ color: b.text_color }}
            >
              Foto del frente de tu DNI
            </div>
            <div className="text-sm" style={{ color: b.muted_text_color }}>
              {b.welcome_message ??
                "Tomá una foto clara con buena luz. Que se vean tu foto y los 8 dígitos."}
            </div>
          </div>

          {/* Bottom: CTA */}
          <div>
            <button
              className="px-6 py-2.5 rounded-full font-semibold text-sm"
              style={{
                backgroundColor: b.primary_color,
                color: b.background_color,
              }}
            >
              Abrir cámara
            </button>
          </div>
        </div>
      </div>
      <p className="text-xs text-white/30 mt-2">
        Este preview es estático; la página real abre la cámara del usuario.
      </p>
    </div>
  );
}
