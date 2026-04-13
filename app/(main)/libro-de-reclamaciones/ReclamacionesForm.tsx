"use client";

import { useState } from "react";

interface FormData {
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellidos: string;
  domicilio: string;
  telefono: string;
  email: string;
  es_menor: boolean;
  rep_legal_nombre: string;
  rep_legal_dni: string;
  tipo_bien: string;
  monto_reclamado: string;
  descripcion_bien: string;
  tipo_reclamo: string;
  detalle_reclamo: string;
  pedido: string;
  acepta: boolean;
}

const initialForm: FormData = {
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
  acepta: false,
};

export default function ReclamacionesForm() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.acepta) {
      setError("Debes aceptar la declaración jurada antes de enviar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/libro-reclamaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          monto_reclamado: form.monto_reclamado ? parseFloat(form.monto_reclamado) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al enviar");
      setSuccess(json.numeroHoja);
      setForm(initialForm);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-600 text-white flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-2xl font-800 text-green-900 mb-2">Reclamación registrada</h2>
        <p className="text-sm text-green-800 mb-1">Tu Hoja de Reclamación N° <strong>{String(success).padStart(6, "0")}</strong> ha sido recibida.</p>
        <p className="text-sm text-green-800 mb-4">Te enviamos un comprobante al correo que nos proporcionaste.</p>
        <p className="text-xs text-green-700">Te responderemos en un plazo máximo de 30 días calendario.</p>
        <button
          onClick={() => setSuccess(null)}
          className="mt-6 px-5 py-2.5 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC]"
        >
          Registrar otra reclamación
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Datos del consumidor */}
      <section className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
        <h2 className="text-lg font-700 text-[#18191F] mb-4">1. Datos del consumidor</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombres *">
            <input type="text" value={form.nombre} onChange={(e) => update("nombre", e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Apellidos *">
            <input type="text" value={form.apellidos} onChange={(e) => update("apellidos", e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Tipo de documento *">
            <select value={form.tipo_documento} onChange={(e) => update("tipo_documento", e.target.value)} className={inputCls}>
              <option value="DNI">DNI</option>
              <option value="CE">Carné de extranjería</option>
              <option value="PAS">Pasaporte</option>
              <option value="RUC">RUC</option>
            </select>
          </Field>
          <Field label="N° de documento *">
            <input type="text" value={form.numero_documento} onChange={(e) => update("numero_documento", e.target.value)} required className={inputCls} />
          </Field>
          <Field label="Domicilio *" full>
            <input type="text" value={form.domicilio} onChange={(e) => update("domicilio", e.target.value)} required placeholder="Av. / Jr. / Calle, número, distrito" className={inputCls} />
          </Field>
          <Field label="Teléfono">
            <input type="tel" value={form.telefono} onChange={(e) => update("telefono", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Correo electrónico *">
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.es_menor} onChange={(e) => update("es_menor", e.target.checked)} />
              <span className="text-sm text-[#333]">El consumidor es menor de edad</span>
            </label>
          </div>
          {form.es_menor && (
            <>
              <Field label="Nombre del representante legal *">
                <input type="text" value={form.rep_legal_nombre} onChange={(e) => update("rep_legal_nombre", e.target.value)} required className={inputCls} />
              </Field>
              <Field label="DNI del representante legal *">
                <input type="text" value={form.rep_legal_dni} onChange={(e) => update("rep_legal_dni", e.target.value)} required className={inputCls} />
              </Field>
            </>
          )}
        </div>
      </section>

      {/* Bien contratado */}
      <section className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
        <h2 className="text-lg font-700 text-[#18191F] mb-4">2. Identificación del bien contratado</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo *">
            <select value={form.tipo_bien} onChange={(e) => update("tipo_bien", e.target.value)} className={inputCls}>
              <option value="servicio">Servicio (alquiler)</option>
              <option value="producto">Producto</option>
            </select>
          </Field>
          <Field label="Monto reclamado (S/ o USD)">
            <input type="number" value={form.monto_reclamado} onChange={(e) => update("monto_reclamado", e.target.value)} step="0.01" placeholder="Opcional" className={inputCls} />
          </Field>
          <Field label="Descripción del bien contratado *" full>
            <textarea value={form.descripcion_bien} onChange={(e) => update("descripcion_bien", e.target.value)} required rows={3} placeholder="Ejemplo: Alquiler de MacBook Air 13'' M4 por 16 meses — Código TKA-MACAIR-M4-003" className={inputCls} />
          </Field>
        </div>
      </section>

      {/* Reclamo */}
      <section className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
        <h2 className="text-lg font-700 text-[#18191F] mb-4">3. Detalle del reclamo o queja</h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Tipo *">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer flex-1 p-3 border border-[#E5E5E5] rounded-xl hover:border-[#1B4FFF]">
                <input type="radio" name="tipo" value="reclamo" checked={form.tipo_reclamo === "reclamo"} onChange={(e) => update("tipo_reclamo", e.target.value)} />
                <div>
                  <p className="font-700 text-sm text-[#18191F]">Reclamo</p>
                  <p className="text-xs text-[#666]">Disconformidad con el producto o servicio</p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer flex-1 p-3 border border-[#E5E5E5] rounded-xl hover:border-[#1B4FFF]">
                <input type="radio" name="tipo" value="queja" checked={form.tipo_reclamo === "queja"} onChange={(e) => update("tipo_reclamo", e.target.value)} />
                <div>
                  <p className="font-700 text-sm text-[#18191F]">Queja</p>
                  <p className="text-xs text-[#666]">Disconformidad con la atención</p>
                </div>
              </label>
            </div>
          </Field>
          <Field label="Detalle del reclamo *">
            <textarea value={form.detalle_reclamo} onChange={(e) => update("detalle_reclamo", e.target.value)} required rows={5} placeholder="Describe con detalle el motivo de tu reclamo o queja..." className={inputCls} />
          </Field>
          <Field label="Pedido *">
            <textarea value={form.pedido} onChange={(e) => update("pedido", e.target.value)} required rows={3} placeholder="¿Qué solución esperas? (devolución, reemplazo, compensación, etc.)" className={inputCls} />
          </Field>
        </div>
      </section>

      {/* Declaración */}
      <section className="bg-[#FFFBEB] border border-yellow-200 rounded-2xl p-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.acepta} onChange={(e) => update("acepta", e.target.checked)} className="mt-1" />
          <span className="text-sm text-[#333]">
            <strong>Declaración:</strong> Declaro bajo juramento que los datos consignados en la presente hoja de reclamación son verdaderos
            y que no he falseado información alguna. Acepto que la empresa me responda al correo electrónico indicado en un plazo máximo de 30 días calendario,
            conforme al <strong>Código de Protección y Defensa del Consumidor (Ley N° 29571)</strong>.
          </span>
        </label>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || !form.acepta}
          className="px-8 py-3.5 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Enviando..." : "Enviar reclamación"}
        </button>
      </div>
    </form>
  );
}

const inputCls = "w-full px-4 py-3 bg-white border border-[#E5E5E5] rounded-xl text-sm outline-none focus:border-[#1B4FFF] transition-colors";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-600 text-[#666] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
