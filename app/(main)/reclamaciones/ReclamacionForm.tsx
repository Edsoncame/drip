"use client";

import { useState } from "react";

type FormState = {
  tipo_documento: "DNI" | "CE" | "PASAPORTE" | "RUC";
  numero_documento: string;
  nombre: string;
  apellidos: string;
  domicilio: string;
  telefono: string;
  email: string;
  es_menor: boolean;
  rep_legal_nombre: string;
  rep_legal_dni: string;
  tipo_bien: "producto" | "servicio";
  monto_reclamado: string;
  descripcion_bien: string;
  tipo_reclamo: "reclamo" | "queja";
  detalle_reclamo: string;
  pedido: string;
};

const initial: FormState = {
  tipo_documento: "DNI",
  numero_documento: "",
  nombre: "",
  apellidos: "",
  domicilio: "",
  telefono: "",
  email: "",
  es_menor: false,
  rep_legal_nombre: "",
  rep_legal_dni: "",
  tipo_bien: "servicio",
  monto_reclamado: "",
  descripcion_bien: "",
  tipo_reclamo: "reclamo",
  detalle_reclamo: "",
  pedido: "",
};

export default function ReclamacionForm() {
  const [data, setData] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    { ok: true; numero_hoja: number } | { ok: false; error: string } | null
  >(null);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/reclamaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ ok: false, error: json.error ?? "Error al enviar" });
      } else {
        setResult({ ok: true, numero_hoja: json.numero_hoja });
      }
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Error de red" });
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="text-center py-8">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-700 text-[#18191F] mb-2">Reclamo registrado</h2>
        <p className="text-sm text-[#666] mb-4">
          Tu {data.tipo_reclamo} quedó registrado con el número <strong>{result.numero_hoja}</strong>.
          Te enviamos una copia a <strong>{data.email}</strong>.
        </p>
        <p className="text-xs text-[#999]">Te responderemos en un plazo máximo de 30 días hábiles.</p>
      </div>
    );
  }

  const Field = ({ label, children, req = false }: { label: string; children: React.ReactNode; req?: boolean }) => (
    <div>
      <label className="block text-xs font-700 text-[#333] mb-1.5">
        {label} {req && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );

  const inputClass = "w-full px-3 py-2.5 text-sm border border-[#E5E5E5] rounded-xl outline-none focus:border-[#1B4FFF] transition-colors";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Datos del consumidor */}
      <section>
        <h3 className="text-base font-700 text-[#18191F] mb-4">1. Datos del consumidor</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo de documento" req>
            <select value={data.tipo_documento} onChange={(e) => update("tipo_documento", e.target.value as FormState["tipo_documento"])} className={inputClass}>
              <option>DNI</option>
              <option>CE</option>
              <option>PASAPORTE</option>
              <option>RUC</option>
            </select>
          </Field>
          <Field label="Número de documento" req>
            <input required type="text" inputMode="numeric" value={data.numero_documento} onChange={(e) => update("numero_documento", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Nombres" req>
            <input required type="text" value={data.nombre} onChange={(e) => update("nombre", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Apellidos" req>
            <input required type="text" value={data.apellidos} onChange={(e) => update("apellidos", e.target.value)} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Domicilio" req>
              <input required type="text" value={data.domicilio} onChange={(e) => update("domicilio", e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Teléfono">
            <input type="tel" value={data.telefono} onChange={(e) => update("telefono", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Email" req>
            <input required type="email" value={data.email} onChange={(e) => update("email", e.target.value)} className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-[#333] cursor-pointer">
          <input type="checkbox" checked={data.es_menor} onChange={(e) => update("es_menor", e.target.checked)} className="w-4 h-4 accent-[#1B4FFF]" />
          El consumidor es menor de edad (requiere representante legal)
        </label>
        {data.es_menor && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-[#F7F7F7] rounded-xl">
            <Field label="Nombre del representante legal" req>
              <input required type="text" value={data.rep_legal_nombre} onChange={(e) => update("rep_legal_nombre", e.target.value)} className={inputClass} />
            </Field>
            <Field label="DNI del representante legal" req>
              <input required type="text" inputMode="numeric" value={data.rep_legal_dni} onChange={(e) => update("rep_legal_dni", e.target.value)} className={inputClass} />
            </Field>
          </div>
        )}
      </section>

      {/* Identificación del bien */}
      <section>
        <h3 className="text-base font-700 text-[#18191F] mb-4">2. Identificación del bien contratado</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo" req>
            <select value={data.tipo_bien} onChange={(e) => update("tipo_bien", e.target.value as FormState["tipo_bien"])} className={inputClass}>
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
            </select>
          </Field>
          <Field label="Monto reclamado (USD)">
            <input type="number" min="0" step="0.01" value={data.monto_reclamado} onChange={(e) => update("monto_reclamado", e.target.value)} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción del bien / servicio" req>
              <textarea required rows={3} value={data.descripcion_bien} onChange={(e) => update("descripcion_bien", e.target.value)} className={inputClass} placeholder="Ej: Alquiler mensual de MacBook Air 13&quot; M4 · Plan 16 meses · Equipo código TKA-MACAIR-M4-003" />
            </Field>
          </div>
        </div>
      </section>

      {/* Detalle del reclamo */}
      <section>
        <h3 className="text-base font-700 text-[#18191F] mb-4">3. Detalle de tu reclamo o queja</h3>
        <div className="flex gap-2 mb-3">
          {(["reclamo", "queja"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => update("tipo_reclamo", t)}
              className={`px-4 py-2 rounded-full text-xs font-700 cursor-pointer transition-colors ${data.tipo_reclamo === t ? "bg-[#1B4FFF] text-white" : "bg-[#F5F5F7] text-[#666] hover:bg-[#E8E8EA]"}`}
            >
              {t === "reclamo" ? "Reclamo (producto o servicio)" : "Queja (atención)"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#999] mb-3">
          <strong>Reclamo:</strong> disconformidad con el producto/servicio recibido. <strong>Queja:</strong> malestar con la atención recibida.
        </p>
        <Field label="Detalle" req>
          <textarea required rows={5} value={data.detalle_reclamo} onChange={(e) => update("detalle_reclamo", e.target.value)} className={inputClass} placeholder="Describe qué sucedió, cuándo, y con quién. Sé específico." />
        </Field>
        <div className="mt-4">
          <Field label="Pedido / solicitud concreta" req>
            <textarea required rows={3} value={data.pedido} onChange={(e) => update("pedido", e.target.value)} className={inputClass} placeholder="¿Qué esperas que FLUX haga para resolver tu caso?" />
          </Field>
        </div>
      </section>

      {result && !result.ok && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {result.error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-[#1B4FFF] hover:bg-[#1340CC] text-white font-700 rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
      >
        {submitting ? "Enviando…" : "Enviar reclamo"}
      </button>

      <p className="text-[11px] text-center text-[#999]">
        Al enviar, aceptas que FLUX procese tus datos personales conforme a la Ley 29733 de Protección de Datos Personales.
      </p>
    </form>
  );
}
