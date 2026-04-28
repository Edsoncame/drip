"use client";

/**
 * Bloque de aceptación de Términos y Condiciones + autorización del Pagaré
 * incompleto + firma digital. Usado en checkout antes del submit final.
 *
 * Flujo (cumple con jurisprudencia INDECOPI sobre aceptación informada):
 *  1. Usuario ve resumen visible de cláusulas críticas (mora, pagaré, no
 *     devolución → acción penal, centrales de riesgo).
 *  2. Click "Ver términos completos" abre modal con iframe de /terminos.
 *  3. Modal detecta scroll-to-bottom — solo después se desbloquea el botón
 *     "He leído todo".
 *  4. Después de leer el modal, aparecen 3 inputs obligatorios:
 *     - Checkbox "Acepto los Términos y autorizo el pagaré incompleto"
 *     - Nombre completo legal (firma digital)
 *     - DNI o documento de identidad (confirmación de firmante)
 *  5. Submit habilitado solo cuando los 3 están completos.
 *
 * Devuelve al padre: { accepted, signatureName, signatureDocument }.
 * El padre debe enviar estos valores al server al registrar al Usuario.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  initialName?: string;
  initialDocument?: string;
  onChange: (state: {
    accepted: boolean;
    signatureName: string;
    signatureDocument: string;
    scrollCompleted: boolean;
  }) => void;
  errorMessage?: string;
}

export default function TyCAcceptanceBlock({
  initialName = "",
  initialDocument = "",
  onChange,
  errorMessage,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [scrollCompleted, setScrollCompleted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState(initialName);
  const [doc, setDoc] = useState(initialDocument);

  // Ref para evitar render loop si el padre no memoiza onChange
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Notificar al padre cuando cualquier campo material cambie
  useEffect(() => {
    onChangeRef.current({
      accepted,
      signatureName: name.trim(),
      signatureDocument: doc.trim(),
      scrollCompleted,
    });
  }, [accepted, name, doc, scrollCompleted]);

  return (
    <div className="space-y-4">
      {/* Resumen de cláusulas críticas */}
      <div className="rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-4 text-sm text-[#333333]">
        <p className="font-700 text-[#18191F] mb-2">Antes de aceptar, ten presente:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-[#555555] text-[13px] leading-relaxed">
          <li>
            La <strong>mora superior a 30 días</strong> habilita reporte automático a INFOCORP,
            Sentinel, Equifax y Xchange por hasta 5 años.
          </li>
          <li>
            Al recibir el equipo firmás un <strong>pagaré incompleto</strong> que autoriza a FLUX a
            ejecutarte por proceso ejecutivo si incumples (cl. 7).
          </li>
          <li>
            <strong>No devolver</strong> el equipo vencido el contrato configura{" "}
            <strong>apropiación ilícita</strong> (Art. 190 Código Penal — 2 a 4 años de cárcel).
          </li>
          <li>
            FLUX puede <strong>bloquear y borrar el equipo remotamente</strong> ante mora o
            no-devolución (cl. 10).
          </li>
          <li>
            En contratos B2B, el <strong>representante legal queda como garante solidario personal</strong>
            de la empresa (cl. 7.3).
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-3 text-[#1B4FFF] font-600 text-sm hover:underline"
        >
          Ver términos completos →
        </button>
      </div>

      {/* Modal de T&C con scroll detection */}
      {modalOpen && (
        <TyCModal
          onClose={() => setModalOpen(false)}
          onScrollComplete={() => setScrollCompleted(true)}
          alreadyCompleted={scrollCompleted}
        />
      )}

      {/* Checkbox de aceptación + firma digital */}
      <div
        className={`rounded-2xl border p-4 ${
          errorMessage ? "border-red-300 bg-red-50" : "border-[#E5E5E5] bg-white"
        }`}
      >
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={accepted}
              disabled={!scrollCompleted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                accepted
                  ? "bg-[#1B4FFF] border-[#1B4FFF]"
                  : !scrollCompleted
                    ? "border-[#DDDDDD] bg-[#F5F5F5]"
                    : "border-[#999999]"
              }`}
            >
              {accepted && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path
                    d="M1 4l3 3 6-6"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>
          <span
            className={`text-sm leading-relaxed ${
              !scrollCompleted ? "text-[#999999]" : "text-[#333333]"
            }`}
          >
            {scrollCompleted ? (
              <>
                Acepto los <strong>Términos y Condiciones</strong> de FLUX y autorizo expresamente
                la suscripción del <strong>pagaré incompleto</strong> a favor de Tika Services
                S.A.C., así como el <strong>tratamiento de mis datos personales</strong> y reporte a
                centrales de riesgo conforme a la Ley 29733.
              </>
            ) : (
              <em>
                Tenés que leer los términos completos antes de aceptar (click en &ldquo;Ver términos
                completos&rdquo; arriba).
              </em>
            )}
          </span>
        </label>

        {/* Firma digital — solo aparece después de aceptar checkbox */}
        {accepted && (
          <div className="mt-5 pt-5 border-t border-[#E5E5E5] space-y-4">
            <div>
              <p className="text-xs font-700 text-[#666666] uppercase tracking-wider mb-2">
                Firma digital
              </p>
              <p className="text-xs text-[#888888] mb-3">
                Conforme al D. Leg. 1310 y la Ley 27269, escribir tu nombre legal completo equivale
                a tu firma manuscrita.
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre completo (como aparece en tu DNI/RUC)"
                className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] focus:border-[#1B4FFF] focus:outline-none text-sm font-600"
                style={{ fontFamily: "Caveat, cursive", fontSize: "20px", letterSpacing: "0.5px" }}
                autoComplete="name"
              />
            </div>
            <div>
              <p className="text-xs font-700 text-[#666666] uppercase tracking-wider mb-2">
                Documento de identidad
              </p>
              <input
                type="text"
                value={doc}
                onChange={(e) => setDoc(e.target.value.replace(/\D/g, ""))}
                placeholder="DNI (8 dígitos) o RUC (11 dígitos)"
                inputMode="numeric"
                maxLength={11}
                className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] focus:border-[#1B4FFF] focus:outline-none text-sm"
              />
            </div>
            <p className="text-[11px] text-[#888888] leading-relaxed">
              Al completar tu firma, FLUX registra: nombre, documento, fecha y hora UTC, IP de
              origen y versión de Términos aceptada (28-abr-2026, v2). Esta evidencia se conserva
              durante toda la vigencia del contrato y 5 años posteriores como prueba ante INDECOPI,
              SUNAT y autoridades judiciales.
            </p>
          </div>
        )}
      </div>

      {errorMessage && <p className="text-red-500 text-xs">{errorMessage}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Modal con iframe de /terminos + detección de scroll-to-bottom
// ──────────────────────────────────────────────────────────────────────

function TyCModal({
  onClose,
  onScrollComplete,
  alreadyCompleted,
}: {
  onClose: () => void;
  onScrollComplete: () => void;
  alreadyCompleted: boolean;
}) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(alreadyCompleted);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    // Considerar "fondo" cuando faltan menos de 100px
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (atBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
      onScrollComplete();
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
          <h3 className="font-800 text-[#18191F]">Términos y Condiciones FLUX</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#999999] hover:text-[#333333] text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          {/* iframe directamente al /terminos para mantener single source of truth */}
          <iframe
            src="/terminos"
            className="w-full"
            style={{ height: "1200px", border: "none" }}
            title="Términos y Condiciones"
          />
          <p className="mt-6 text-xs text-[#999999] text-center">
            ↑ Si el contenido no carga, abrí{" "}
            <a
              href="/terminos"
              target="_blank"
              rel="noreferrer"
              className="text-[#1B4FFF] underline"
            >
              /terminos
            </a>{" "}
            en otra pestaña, leelo y volvé acá.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-[#E5E5E5] flex items-center gap-3">
          <div className="flex-1 text-xs text-[#666666]">
            {hasScrolledToBottom ? (
              <span className="text-[#0A8B3A] font-600">✓ Has leído todo el documento</span>
            ) : (
              <span>↓ Scrolleá hasta el final para confirmar lectura</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!hasScrolledToBottom}
            className={`px-5 py-2.5 rounded-full font-700 text-sm transition-colors ${
              hasScrolledToBottom
                ? "bg-[#1B4FFF] text-white hover:bg-[#1340CC]"
                : "bg-[#E5E5E5] text-[#999999] cursor-not-allowed"
            }`}
          >
            He leído todo
          </button>
        </div>
      </div>
    </div>
  );
}
