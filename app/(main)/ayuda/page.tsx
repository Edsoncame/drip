import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  title: "Centro de ayuda — FAQs y guías FLUX",
  description:
    "Todas las preguntas frecuentes sobre alquiler de MacBook con FLUX: planes, precios, entrega, soporte, facturación, devoluciones y más.",
  alternates: { canonical: `${BASE}/ayuda` },
};

interface Category {
  title: string;
  icon: string;
  items: { q: string; a: string }[];
}

const categories: Category[] = [
  {
    title: "Sobre el servicio",
    icon: "💡",
    items: [
      {
        q: "¿Qué es FLUX exactamente?",
        a: "FLUX es una plataforma peruana operada por Tika Services S.A.C. que alquila MacBooks a empresas y profesionales por una cuota mensual fija. Somos el único proveedor en Perú especializado 100% en equipos Apple.",
      },
      {
        q: "¿En qué ciudades operan?",
        a: "Actualmente operamos en Lima Metropolitana con entrega en 24-48 horas. Para provincias podemos coordinar envíos, pero con costo logístico adicional. Plan de expansión 2026: Arequipa y Trujillo.",
      },
      {
        q: "¿Cuántos años llevan en el mercado?",
        a: "Tika Services S.A.C. está activa en SUNAT desde enero 2020. La marca FLUX se lanzó en abril 2026 como la evolución del servicio de alquiler de MacBooks.",
      },
      {
        q: "¿Son una empresa formal?",
        a: "Sí. Tika Services S.A.C. RUC 20605702512, inscrita en SUNAT y SUNARP (Partida 14423677). Emitimos factura electrónica SUNAT y cumplimos con todos los requisitos legales del Perú.",
      },
    ],
  },
  {
    title: "Planes y precios",
    icon: "💰",
    items: [
      {
        q: "¿Cuánto cuesta alquilar una MacBook?",
        a: "Desde $85/mes para MacBook Air 13\" M4 en plan de 24 meses. El precio varía según modelo (Air o Pro), plazo (8/16/24 meses) y canal (online con Stripe o transferencia bancaria).",
      },
      {
        q: "¿Por qué mientras más largo el plazo, menor la cuota?",
        a: "Porque el equipo tiene un costo fijo que se distribuye en más meses. Un plan de 24 meses tiene menor cuota mensual pero mayor compromiso total.",
      },
      {
        q: "¿Los precios incluyen IGV?",
        a: "Sí. Todos los precios mostrados incluyen el IGV del 18%. La factura los desglosa por si necesitas el crédito fiscal.",
      },
      {
        q: "¿Ofrecen descuento por volumen?",
        a: "Sí. Desde 2 equipos aplica 5% de descuento, desde 5 equipos 8%, y desde 10 equipos 12%. Para más de 20 equipos hacemos cotización personalizada.",
      },
      {
        q: "¿Puedo pagar todo por adelantado?",
        a: "Sí. Si pagas todo el plazo por adelantado te damos 5% de descuento adicional. Útil para cerrar el ejercicio fiscal con gasto asentado.",
      },
    ],
  },
  {
    title: "Proceso de alquiler",
    icon: "📝",
    items: [
      {
        q: "¿Cómo empiezo el proceso?",
        a: "Elige el modelo y plan en /laptops, entra al checkout, llena tus datos, firma el contrato digital, y paga el primer mes. Entregamos en 24-48h una vez validada tu identidad.",
      },
      {
        q: "¿Necesito garantía o aval?",
        a: "No. Solo verificamos tu identidad (DNI + selfie si eres persona natural, RUC si eres empresa). No pedimos aval, fiador ni depósito en efectivo.",
      },
      {
        q: "¿Cuánto tarda la firma del contrato?",
        a: "5-10 minutos. Es un contrato digital con firma electrónica. Lo firmas desde tu computadora o celular, no hay papeleo físico.",
      },
      {
        q: "¿Puedo cancelar antes del plazo?",
        a: "Tienes 7 días calendario de desistimiento sin penalidad (Ley 29571 Indecopi). Después del día 7, aplica penalidad del 50% sobre las cuotas restantes.",
      },
    ],
  },
  {
    title: "Entrega y logística",
    icon: "🚚",
    items: [
      {
        q: "¿Cuánto tarda la entrega?",
        a: "24-48 horas hábiles en Lima Metropolitana. Si coordinamos antes de las 11 am en San Isidro, Miraflores, Surco o San Borja, entregamos el mismo día.",
      },
      {
        q: "¿Entregan en edificios con protocolos de seguridad?",
        a: "Sí. Coordinamos con recepción/portería del edificio. Solo avísanos al momento de la firma para programar correctamente.",
      },
      {
        q: "¿Aceptan entregar en coworkings?",
        a: "Sí. Comunal, WeWork, Selina y cualquier coworking de Lima. Nuestro delivery coordina directamente con la recepción del coworking.",
      },
      {
        q: "¿Entregan fuera de Lima?",
        a: "Para envíos a provincias (Arequipa, Trujillo, Cusco, Piura, etc.) coordinamos con Olva Courier o similar. El costo de envío es adicional y se agrega a la primera factura.",
      },
    ],
  },
  {
    title: "Soporte técnico",
    icon: "🛠️",
    items: [
      {
        q: "¿Qué pasa si se daña el equipo?",
        a: "Si es falla de fábrica, lo reemplazamos sin costo en 48 horas hábiles. Si es daño accidental o uso indebido, el cliente asume la reparación (a menos que haya contratado AppleCare+ al inicio).",
      },
      {
        q: "¿Cubren robo o pérdida?",
        a: "No por defecto. Puedes contratar AppleCare+ con Theft and Loss (cobertura contra robo) al inicio del contrato. Es un add-on con costo adicional.",
      },
      {
        q: "¿Ofrecen AppleCare+?",
        a: "Sí, como add-on. Cubre garantía extendida, daños accidentales con deducible reducido, y opcionalmente robo/pérdida. Se paga al inicio del contrato.",
      },
      {
        q: "¿Quién atiende el soporte?",
        a: "Nuestro equipo técnico directo. Respondemos por WhatsApp (+51 900 164 769) y email (hola@fluxperu.com) en horario de lunes a viernes de 9 a 6.",
      },
    ],
  },
  {
    title: "Facturación y pagos",
    icon: "📄",
    items: [
      {
        q: "¿Emiten factura electrónica SUNAT?",
        a: "Sí, automáticamente cada mes a nombre del RUC de la empresa. También emitimos boleta electrónica para personas naturales.",
      },
      {
        q: "¿Qué métodos de pago aceptan?",
        a: "Tarjeta de crédito/débito (vía Stripe - Visa, Mastercard, Amex) y transferencia bancaria (BCP, Interbank, BBVA, Scotiabank).",
      },
      {
        q: "¿El cobro con tarjeta es automático?",
        a: "Sí. Stripe procesa el cobro recurrente el mismo día de cada mes. También puedes optar por transferencia manual y subir el voucher a tu panel en /cuenta/pagos.",
      },
      {
        q: "¿Qué pasa si no pago una cuota?",
        a: "Tienes 5 días calendario de gracia. Pasados los 10 días, se suspende el servicio. Pasados 30 días, pasa a cobranza con interés moratorio del 5% mensual. Siempre es mejor avisarnos con tiempo para coordinar.",
      },
      {
        q: "¿La factura tiene detracción?",
        a: "Sí, del 10% cuando el monto supera S/ 700 (Resolución 183-2004/SUNAT). Tu empresa deposita el 10% en nuestra cuenta del Banco de la Nación antes de pagar el resto.",
      },
    ],
  },
  {
    title: "Devoluciones y fin de contrato",
    icon: "↩️",
    items: [
      {
        q: "¿Qué pasa al terminar el contrato?",
        a: "Tienes 3 opciones: (1) devolver el equipo sin costo adicional, (2) renovar el contrato con un modelo nuevo, (3) comprar el equipo por su valor residual (77.5% al mes 8, 55% al mes 16, 32.5% al mes 24).",
      },
      {
        q: "¿Cómo devuelvo el equipo?",
        a: "Coordinamos recojo en tu oficina o domicilio en Lima sin costo adicional. Solo empaca el equipo con sus accesorios originales y estamos contigo a las 24h.",
      },
      {
        q: "¿Qué pasa si daño el equipo antes de devolverlo?",
        a: "Evaluamos el daño con taller autorizado Apple. El costo de reparación se descuenta del valor residual o se cobra aparte si el equipo no fue comprado.",
      },
      {
        q: "¿Puedo devolver antes del plazo?",
        a: "Sí con penalidad del 50% sobre las cuotas restantes (para cancelaciones después del día 7 de desistimiento). Coordinamos el recojo en paralelo al pago de la penalidad.",
      },
    ],
  },
  {
    title: "Empresas y facturación B2B",
    icon: "🏢",
    items: [
      {
        q: "¿Pueden darme ficha de proveedor para mi área de compras?",
        a: "Sí. Enviamos ficha de proveedor con RUC, constitución SUNAT, cuenta bancaria detracciones, y toda la documentación corporativa que requieras. Escríbenos con tu checklist.",
      },
      {
        q: "¿Tengo que firmar un MSA (Master Service Agreement)?",
        a: "Para empresas grandes con compras recurrentes, sí podemos firmar un MSA que rija múltiples contratos de alquiler bajo términos negociados. Escríbenos para coordinar.",
      },
      {
        q: "¿Puedo manejar el alquiler desde mi ERP?",
        a: "Por ahora todo se maneja desde el panel admin de FLUX. Integración con ERPs (SAP, Odoo, etc.) está en roadmap 2026.",
      },
      {
        q: "¿Tienen plan para empresas con más de 50 equipos?",
        a: "Sí. Para empresas grandes asignamos account manager dedicado, tarifas negociadas, reportes mensuales de activos en uso, SLA de soporte definido y condiciones de pago a 30-60 días si aplica.",
      },
    ],
  },
];

// Flatten all FAQs for schema
const allFaqs = categories.flatMap((c) => c.items);
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: allFaqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HelpCenterPage() {
  return (
    <div className="bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: BASE },
          { name: "Centro de ayuda", url: `${BASE}/ayuda` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="py-16 bg-[#F7F7F7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider mb-3">
            Centro de ayuda
          </p>
          <h1 className="text-4xl md:text-5xl font-800 text-[#18191F] mb-3">
            ¿En qué podemos ayudarte?
          </h1>
          <p className="text-lg text-[#666]">
            Encuentra respuestas a las preguntas más frecuentes sobre FLUX.
          </p>
        </div>
      </section>

      {/* FAQ categories */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
          {categories.map((cat) => (
            <div key={cat.title}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-3xl">{cat.icon}</span>
                <h2 className="text-2xl font-800 text-[#18191F]">{cat.title}</h2>
              </div>
              <div className="space-y-3">
                {cat.items.map((item) => (
                  <details
                    key={item.q}
                    className="group bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden open:border-[#1B4FFF] open:bg-[#F5F8FF]"
                  >
                    <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4">
                      <p className="font-700 text-[#18191F] text-sm md:text-base">{item.q}</p>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="flex-shrink-0 text-[#999] group-open:rotate-180 group-open:text-[#1B4FFF] transition-transform"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </summary>
                    <div className="px-5 pb-4 -mt-1">
                      <p className="text-sm text-[#666] leading-relaxed">{item.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact fallback */}
      <section className="py-16 bg-[#18191F] text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-800 mb-3">¿No encontraste lo que buscabas?</h2>
          <p className="opacity-80 mb-6">Escríbenos directamente y te respondemos en menos de 24 horas.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://wa.me/51900164769"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-[#25D366] text-white font-700 rounded-full hover:opacity-90"
            >
              WhatsApp
            </a>
            <a
              href="mailto:hola@fluxperu.com"
              className="px-6 py-3 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC]"
            >
              Email
            </a>
            <Link
              href="/contacto"
              className="px-6 py-3 border border-white/30 text-white font-700 rounded-full hover:bg-white/10"
            >
              Formulario
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
