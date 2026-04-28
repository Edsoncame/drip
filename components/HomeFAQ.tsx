"use client";

/**
 * Sección de preguntas frecuentes para el home.
 *
 * Cubre las objeciones más comunes:
 *   - ¿Cuánto cuesta?
 *   - ¿Necesito firmar contrato?
 *   - ¿Qué incluye?
 *   - ¿Y si la dañas?
 *   - ¿Puedo comprarla al final?
 *   - ¿Cuánto tarda la entrega?
 *
 * Cada pregunta es un acordeón — solo una abierta a la vez para enfocar la
 * lectura. El JSON-LD de FAQ ya está en JsonLd.tsx y se renderiza cuando esta
 * sección está presente, lo que mejora el SEO (rich snippets en Google).
 */

import { useState } from "react";

const FAQS = [
  {
    q: "¿Cuánto cuesta alquilar una MacBook con FLUX?",
    a: "Desde $60/mes (MacBook Neo 13\" — Apple A16 Pro, plan 24 meses) y desde $85/mes (MacBook Air 13\" — Apple M4, plan 24 meses). Los planes más cortos (8 o 16 meses) tienen una cuota mensual mayor pero menor compromiso. También hay MacBook Pro 14\" M4 y M5. Ver todos los precios en /laptops.",
  },
  {
    q: "¿Tengo que firmar un contrato? ¿Hay penalidad si cancelo?",
    a: "Sí. Firmas un contrato digital al checkout (con scroll obligatorio del TyC + firma con tu nombre legal + DNI/RUC, conforme al D.Leg. 1310 y la Ley 27269 de firma electrónica). Te toma 10-15 minutos. Cumplido el plazo mínimo (8/16/24 meses), cancelás con 30 días de aviso sin penalidad. Si necesitás cancelar antes y FLUX lo autoriza por causa justificada (cierre de empresa, mudanza fuera de Lima, fuerza mayor), la penalidad es de 2 meses de Renta Mensual.",
  },
  {
    q: "¿Qué incluye el alquiler?",
    a: "El equipo MacBook con cargador y accesorios originales, entrega gratuita en Lima en 24-48h, soporte técnico durante todo el plazo, y reemplazo por falla de fábrica. AppleCare+ es opcional (+$12/mes) y cubre daños accidentales con deducible $99. NO cubre robo ni pérdida — son responsabilidad del cliente.",
  },
  {
    q: "¿Y si se daña o me la roban?",
    a: "Falla de fábrica: FLUX la cubre sin costo. Daño accidental: con AppleCare+ deducible $99, sin AppleCare+ el cliente paga la reparación según tarifa Apple Service. Robo o pérdida: el cliente presenta denuncia policial en 48h y abona el valor comercial de reemplazo del equipo en 15 días — ni FLUX ni AppleCare+ cubren robo.",
  },
  {
    q: "¿Puedo comprar la MacBook al final del contrato?",
    a: "Sí. Al finalizar tu plazo te ofrecemos opción de compra al valor residual: entre 60-75% del precio original si fue plan de 8 meses, 35-50% si fue 16 meses, o 15-30% si fue 24 meses. El porcentaje exacto depende del estado del equipo, ciclos de batería y modelo. También podés devolverlo sin costo o renovar con un modelo nuevo.",
  },
  {
    q: "¿Cuánto tarda la entrega?",
    a: "Entregamos en Lima Metropolitana en 24-48 horas hábiles después de validar tu identidad y procesar el primer pago. Si necesitás envío a provincia, lo coordinamos con un costo logístico adicional.",
  },
  {
    q: "¿Es solo para empresas o también para personas?",
    a: "Ambos. Personas naturales (con DNI + selfie KYC) y empresas (con RUC + factura electrónica SUNAT, descuento por volumen desde 2 equipos, y planes corporate para más de 50 equipos con account manager dedicado). En contratos B2B el representante legal queda como garante solidario personal.",
  },
  {
    q: "¿Qué pasa si no pago una cuota?",
    a: "Tenés 5 días calendario de gracia. Pasados los 5 días, devengan intereses moratorios a la tasa máxima legal (TIPMN/TIPMEX BCRP) más una penalidad compensatoria del 10% sobre la cuota impaga. A partir del día 31 de mora reportamos a las centrales de riesgo (INFOCORP, Equifax, Sentinel, Xchange CCL). El contrato puede resolverse de pleno derecho conforme al Art. 1430 del Código Civil.",
  },
  {
    q: "¿Cómo facturan? ¿Emiten boleta o factura?",
    a: "Emitimos factura electrónica SUNAT a empresas (con tu RUC) y boleta electrónica a personas naturales. Las facturas llegan por correo automáticamente cada mes y también podés descargarlas desde tu panel /cuenta.",
  },
];

// JSON-LD inline para evitar importar JsonLd.tsx (que arrastra pg desde el server)
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HomeFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider mb-2">
            Preguntas frecuentes
          </p>
          <h2 className="text-3xl md:text-4xl font-800 text-[#18191F]">
            Resolvemos tus dudas
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`border rounded-2xl overflow-hidden transition-colors ${
                  isOpen ? "border-[#1B4FFF] bg-[#F5F8FF]" : "border-[#E5E5E5] bg-white hover:border-[#CCCCCC]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm md:text-base font-700 text-[#18191F]">{faq.q}</span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-[#1B4FFF]" : "text-[#999]"}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 -mt-1">
                    <p className="text-sm text-[#666] leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-[#666] mt-8">
          ¿Tienes otra pregunta?{" "}
          <a
            href="https://wa.me/51900164769"
            target="_blank"
            rel="noreferrer"
            className="text-[#1B4FFF] font-700 hover:underline"
          >
            Escríbenos por WhatsApp
          </a>
        </p>
      </div>
    </section>
  );
}
