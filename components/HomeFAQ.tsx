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
    a: "Desde $85 USD al mes para una MacBook Air M4 con plan de 24 meses. Los planes más cortos (8 o 16 meses) tienen una cuota mensual mayor pero menor compromiso. Puedes ver todos los precios en nuestro catálogo.",
  },
  {
    q: "¿Tengo que firmar un contrato? ¿Hay penalidad si cancelo?",
    a: "Sí, firmamos un contrato de alquiler digital al iniciar. Tienes 7 días calendario de desistimiento sin costo (Ley 29571 de Indecopi). Después aplica una penalidad del 50% sobre las cuotas restantes si decides cancelar antes del plazo.",
  },
  {
    q: "¿Qué incluye el alquiler?",
    a: "El equipo MacBook (con cargador y cables originales), entrega en Lima en 24-48 horas, soporte técnico durante todo el plazo, y reemplazo por falla de fábrica. No incluye seguro contra robo o daños accidentales (puedes contratarlo aparte como AppleCare+).",
  },
  {
    q: "¿Y si se daña o me la roban?",
    a: "Si el daño es por falla de fábrica, FLUX lo cubre sin costo. Si es por uso indebido o accidente, el cliente debe asumir el costo de la reparación (o contratar AppleCare+ al inicio). En caso de robo, el cliente debe denunciarlo y cubrir el valor residual del equipo.",
  },
  {
    q: "¿Puedo comprar la MacBook al final del contrato?",
    a: "¡Sí! Es una de nuestras opciones más usadas. Al finalizar el plazo, puedes comprar el equipo por su valor residual (entre 32% y 78% del precio original, dependiendo del tiempo que la usaste). También puedes renovar el alquiler o devolverla.",
  },
  {
    q: "¿Cuánto tarda la entrega?",
    a: "Entregamos en Lima Metropolitana en 24-48 horas hábiles después de validar tu identidad y procesar el primer pago. Si necesitas envío a provincia, lo coordinamos con un costo adicional.",
  },
  {
    q: "¿Es solo para empresas o también para personas?",
    a: "Para ambos. Tenemos planes B2C (personas naturales con DNI) y planes B2B con factura electrónica SUNAT, descuento por volumen y opciones de leasing operativo para empresas grandes.",
  },
  {
    q: "¿Cómo facturan? ¿Emiten boleta o factura?",
    a: "Emitimos factura electrónica SUNAT a empresas (con tu RUC) y boleta electrónica a personas naturales. Las facturas llegan por correo automáticamente cada mes y también puedes descargarlas desde tu panel.",
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
            href="https://wa.me/51932648703"
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
