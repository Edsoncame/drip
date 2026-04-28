import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  title: "Centro de ayuda — FAQs y guías FLUX",
  description:
    "Todas las preguntas frecuentes sobre alquiler de MacBook con FLUX: planes, precios, entrega, soporte, contrato y firma digital, facturación, mora, devoluciones, opción de compra y privacidad.",
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
        a: "FLUX es una plataforma peruana operada por Tika Services S.A.C. que alquila MacBooks a empresas y profesionales por una cuota mensual fija. Especializados 100% en equipos Apple, con entrega rápida en Lima y soporte técnico incluido.",
      },
      {
        q: "¿En qué ciudades operan?",
        a: "Actualmente operamos en Lima Metropolitana con entrega gratuita en 24-48 horas. Para provincias coordinamos envíos vía courier, con costo logístico adicional a cargo del cliente. Plan de expansión 2026-2027: Arequipa y Trujillo.",
      },
      {
        q: "¿Cuántos años llevan en el mercado?",
        a: "Tika Services S.A.C. está activa en SUNAT desde enero 2020. La marca FLUX se lanzó en abril 2026 como la evolución del servicio de alquiler de MacBooks.",
      },
      {
        q: "¿Son una empresa formal?",
        a: "Sí. Tika Services S.A.C. RUC 20605702512, inscrita en SUNAT. Emitimos factura electrónica SUNAT y cumplimos con todos los requisitos legales del Perú.",
      },
    ],
  },
  {
    title: "Planes y precios",
    icon: "💰",
    items: [
      {
        q: "¿Cuánto cuesta alquilar una MacBook?",
        a: "Desde $60/mes (MacBook Neo 13\" — Apple A16 Pro, plan 24 meses) y desde $85/mes (MacBook Air 13\" — Apple M4, plan 24 meses). También MacBook Pro 14\" M4 y M5. El precio varía según modelo y plazo (8/16/24 meses). Ver catálogo completo en /laptops.",
      },
      {
        q: "¿Por qué mientras más largo el plazo, menor la cuota?",
        a: "Porque el costo del equipo se distribuye en más meses. Un plan de 24 meses tiene menor cuota mensual pero mayor compromiso total. Lo elegís según tu flujo de caja y horizonte de uso.",
      },
      {
        q: "¿Los precios incluyen IGV?",
        a: "Los precios mostrados están en USD y NO incluyen IGV. El IGV del 18% se adiciona en la factura cuando aplica. La factura desglosa el IGV por si necesitás crédito fiscal.",
      },
      {
        q: "¿Ofrecen descuento por volumen?",
        a: "Sí. Desde 2 equipos aplica 5% de descuento, desde 5 equipos 8%, y desde 10 equipos 12%. Para más de 20 equipos hacemos cotización personalizada con account manager dedicado.",
      },
      {
        q: "¿Puedo pagar todo por adelantado?",
        a: "Sí. Si pagás todo el plazo por adelantado te damos 5% de descuento adicional. Útil para cerrar el ejercicio fiscal con el gasto asentado.",
      },
    ],
  },
  {
    title: "Proceso de alquiler y firma del contrato",
    icon: "📝",
    items: [
      {
        q: "¿Cómo empiezo el proceso?",
        a: "Elegís modelo y plan en /laptops → entrás al checkout → llenás tus datos → leés y firmás el contrato digital (Términos + pagaré incompleto + DNI/RUC) → pagás el primer mes. Entregamos en 24-48h una vez validada tu identidad.",
      },
      {
        q: "¿Necesito garantía o aval?",
        a: "No pedimos depósito en efectivo ni fianza. La protección de FLUX descansa en: (1) firma del pagaré incompleto al recibir el equipo (Ley 27287), (2) en contratos B2B, garantía solidaria personal del representante legal, (3) verificación KYC con DNI + selfie + RUC.",
      },
      {
        q: "¿Cómo es la firma del contrato? ¿Es legal?",
        a: "Es completamente digital y tiene plena validez legal en Perú. Conforme a la Ley 27291, el D.Leg. 1310 y la Ley 27269 de Firmas Digitales, equivale a una firma manuscrita. El proceso te toma 10-15 minutos: leés los Términos completos (con scroll obligatorio para confirmar lectura), aceptás, escribís tu nombre legal completo como firma, y confirmás con DNI o RUC.",
      },
      {
        q: "¿Qué es el pagaré incompleto que firmo?",
        a: "Es un título valor (Art. 10 y 158 de la Ley 27287) que autorizás al recibir el equipo. Lo firmás en blanco y FLUX lo completa solo si caés en mora prolongada o no devolvés el equipo. Permite ejecutar la cobranza por proceso ejecutivo (3-6 meses) en vez de proceso ordinario (1-2 años). Esto es estándar en arrendamiento operativo.",
      },
      {
        q: "¿Puedo cancelar el contrato antes del plazo mínimo?",
        a: "Cumplido el plazo mínimo elegido (8/16/24 meses), cancelás con 30 días de aviso por correo, sin penalidad. Antes del plazo mínimo solo se autoriza cancelación anticipada por causa justificada (cierre de empresa, mudanza fuera de Lima, fuerza mayor) con penalidad de 2 Rentas Mensuales más devolución del equipo.",
      },
      {
        q: "¿Tengo derecho de desistimiento al firmar online?",
        a: "Conforme al Código de Protección y Defensa del Consumidor (Ley 29571), las contrataciones a distancia tienen derecho de desistimiento. Para servicios continuados como el alquiler, el cliente puede notificar la terminación; aplica el art. 14.3 del contrato sobre cancelación anticipada.",
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
        a: "Si es falla de fábrica cubierta por garantía Apple, lo reemplazamos o reparamos sin costo. Si es daño accidental: con AppleCare+ pagás solo el deducible de USD $99 por incidente; sin AppleCare+ asumís el costo de reparación según tarifa Apple Service.",
      },
      {
        q: "¿Cubren robo o pérdida?",
        a: "NO. Ni FLUX ni AppleCare+ cubren robo ni pérdida. En caso de robo, el cliente debe presentar denuncia policial dentro de 48h y abonar el valor comercial de reemplazo del equipo en un plazo máximo de 15 días calendario.",
      },
      {
        q: "¿Ofrecen AppleCare+?",
        a: "Sí, como add-on por +$12/mes durante todo el plazo del contrato. Cubre garantía extendida 3 años + 2 reparaciones por daño accidental con deducible USD $99. Se contrata al inicio del contrato y no se puede cancelar de forma independiente.",
      },
      {
        q: "¿Quién atiende el soporte?",
        a: "Nuestro equipo técnico directo. Respondemos por WhatsApp (+51 900 164 769) y email (hola@fluxperu.com) en horario de lunes a viernes 9am – 6pm.",
      },
      {
        q: "¿FLUX puede acceder o controlar mi MacBook remotamente?",
        a: "FLUX inscribe los equipos en Apple Business Manager y aplica una solución MDM para gestión y seguridad. NO accede a tus archivos ni monitorea tu actividad. La capacidad de bloqueo o borrado remoto solo se activa en escenarios específicos: mora prolongada, robo reportado, no devolución vencido el contrato, o uso para actividades ilícitas. Es la misma tecnología que usan empresas Apple-managed (Google, Cisco, etc.) para proteger sus equipos corporativos.",
      },
    ],
  },
  {
    title: "Facturación, pagos y mora",
    icon: "📄",
    items: [
      {
        q: "¿Emiten factura electrónica SUNAT?",
        a: "Sí, automáticamente cada mes a nombre del RUC de la empresa. También emitimos boleta electrónica para personas naturales.",
      },
      {
        q: "¿Qué métodos de pago aceptan?",
        a: "Tarjeta de crédito/débito vía Stripe (Visa, Mastercard, Amex), Mercado Pago, y transferencia bancaria (BCP, Interbank, BBVA, Scotiabank). El cobro recurrente con tarjeta se autoriza al iniciar el contrato.",
      },
      {
        q: "¿El cobro con tarjeta es automático?",
        a: "Sí. Stripe procesa el cobro recurrente el mismo día calendario de cada mes. Si querés cambiar a transferencia manual, podés hacerlo desde tu panel /cuenta/pagos y subir el voucher.",
      },
      {
        q: "¿Qué pasa si no pago una cuota?",
        a: "Tenés 5 días calendario de gracia sin penalidad. Vencido el período de gracia, devengan intereses moratorios a la tasa máxima legal del BCRP (TIPMN/TIPMEX) más una penalidad compensatoria del 10% sobre la cuota impaga. A partir del día 31 de mora reportamos a las centrales de riesgo y el contrato puede resolverse de pleno derecho conforme al Art. 1430 del Código Civil.",
      },
      {
        q: "¿Qué centrales de riesgo reportan?",
        a: "Las cuatro principales en Perú autorizadas por la SBS: Equifax Perú (INFOCORP), Sentinel Perú, Experian Perú y Xchange Perú (CCL). El reporte se mantiene hasta 5 años desde la cancelación íntegra de la deuda, conforme al Reglamento del Sistema de Información de Riesgos.",
      },
      {
        q: "¿Qué pasa si no devuelvo el equipo al final del contrato?",
        a: "Después de la intimación notarial, tenés 10 días para devolver. Vencido ese plazo: (1) la cláusula penal del contrato te hace pagar el 100% del valor comercial del equipo más 0.5% diario hasta devolverlo o pagarlo; (2) FLUX puede bloquear y borrar el equipo remotamente; (3) la conducta configura el delito de Apropiación Ilícita (Art. 190 del Código Penal Peruano), sancionado con 2 a 4 años de cárcel. La opción legal está siempre disponible mientras vos coordines la devolución.",
      },
      {
        q: "¿La factura tiene detracción?",
        a: "Si el monto de la factura supera S/ 700 y aplica la categoría correspondiente del SPOT (Sistema de Pago de Obligaciones Tributarias), sí — el cliente deposita el 10% (o el porcentaje vigente) en nuestra cuenta del Banco de la Nación antes de pagar el resto. Te confirmamos detracción aplicable en cada factura.",
      },
    ],
  },
  {
    title: "Devoluciones y fin de contrato",
    icon: "↩️",
    items: [
      {
        q: "¿Qué pasa al terminar el contrato?",
        a: "Tenés 3 opciones: (1) devolver el equipo sin costo adicional, (2) renovar el contrato con un modelo nuevo, o (3) ejercer la opción de compra al valor residual coordinado con FLUX. Tenés 30 días desde el vencimiento para decidir y comunicarlo por escrito a hola@fluxperu.com.",
      },
      {
        q: "¿Cuál es el valor residual si quiero comprar al final?",
        a: "Se calcula como porcentaje del precio de lista original de Apple, según el plazo que elegiste: 60-75% en plan 8 meses, 35-50% en plan 16 meses, o 15-30% en plan 24 meses. El porcentaje exacto dentro del rango lo determinamos según estado del equipo, ciclos de batería y daños cosméticos no reportados. Te comunicamos el valor final con 30 días de anticipación al vencimiento.",
      },
      {
        q: "¿Cómo devuelvo el equipo?",
        a: "Coordinás con FLUX recojo en tu oficina o domicilio en Lima sin costo adicional. Devolvés el equipo con todos los accesorios originales (cable, adaptador, caja si aplica), sin daños más allá del desgaste normal, con el software restablecido a fábrica (factory reset) y la sesión de iCloud cerrada (Activation Lock desactivado).",
      },
      {
        q: "¿Qué pasa si daño el equipo antes de devolverlo?",
        a: "FLUX inspecciona el equipo dentro de 5 días hábiles de recibido. Si hay daños no reportados, accesorios faltantes o el equipo viene con bloqueos personales (Activation Lock con tu Apple ID), te facturamos el costo de reparación, reemplazo o desbloqueo según las tarifas de Apple Service. Por eso conviene contratar AppleCare+ al inicio.",
      },
      {
        q: "¿Puedo devolver antes del plazo mínimo?",
        a: "Solo en casos justificados (cierre de empresa documentado, mudanza fuera de Lima, fuerza mayor probada) y con autorización de FLUX. La penalidad es de 2 Rentas Mensuales más devolución del equipo en perfecto estado. No se admiten cancelaciones anticipadas por simple cambio de opinión durante el plazo mínimo.",
      },
    ],
  },
  {
    title: "Empresas y facturación B2B",
    icon: "🏢",
    items: [
      {
        q: "¿Pueden darme ficha de proveedor para mi área de compras?",
        a: "Sí. Enviamos ficha de proveedor con RUC, constitución SUNAT, cuenta bancaria, datos de detracciones y toda la documentación corporativa que requieras. Escribinos con tu checklist a hola@fluxperu.com.",
      },
      {
        q: "¿Tengo que firmar un MSA (Master Service Agreement)?",
        a: "Para empresas con flotas recurrentes, podemos firmar un MSA que rija múltiples contratos de alquiler bajo términos negociados. Escribinos para coordinar.",
      },
      {
        q: "¿En B2B el contrato lo firma la empresa o el dueño?",
        a: "Lo firma la empresa (con representante legal indicado en la SUNARP) Y adicionalmente el representante legal queda como garante solidario personal del contrato (cl. 7.3 del TyC). Esto significa que si la empresa quiebra o desaparece, FLUX puede reclamar el pago contra el patrimonio personal del firmante. Es estándar en arrendamiento operativo de equipos en el Perú.",
      },
      {
        q: "¿Puedo manejar el alquiler desde mi ERP?",
        a: "Por ahora todo se maneja desde el panel admin de FLUX. Integración con ERPs (SAP, Odoo, etc.) está en roadmap 2026-2027 — escribinos si te urge para priorizar.",
      },
      {
        q: "¿Tienen plan para empresas con más de 50 equipos?",
        a: "Sí. Asignamos account manager dedicado, tarifas negociadas, reportes mensuales de activos en uso, SLA de soporte definido y condiciones de pago a 30-60 días si aplica. También podemos ofrecer arbitraje en el Centro de la CCL en lugar de jurisdicción ordinaria para resolución de controversias.",
      },
    ],
  },
  {
    title: "Privacidad y firma digital",
    icon: "🔒",
    items: [
      {
        q: "¿Mi firma digital tiene la misma validez que una manuscrita?",
        a: "Sí, plenamente. Conforme a la Ley 27291 (que modifica el Código Civil), el D.Leg. 1310 (Gobierno Digital) y la Ley 27269 (Firmas y Certificados Digitales), la aceptación digital con tu nombre legal completo + DNI/RUC tiene el mismo valor jurídico que una firma manuscrita ante un notario.",
      },
      {
        q: "¿Qué datos guardan al firmar?",
        a: "Para fines de auditoría legal guardamos: tu nombre completo legal, DNI o RUC, fecha y hora UTC, dirección IP de origen, user-agent del navegador, versión exacta del Términos aceptado y confirmación de scroll de lectura. Esto se conserva durante toda la vigencia del contrato y 5 años posteriores como prueba ante INDECOPI, juzgados y autoridades.",
      },
      {
        q: "¿Pueden compartir mis datos con terceros?",
        a: "Solo en casos específicos y autorizados por la Ley 29733 de Protección de Datos: (1) centrales de riesgo en caso de mora, (2) empresas de cobranza extrajudicial/judicial, (3) procesadores de pago (Stripe, Mercado Pago) para procesar tus pagos, (4) SUNAT para facturación, (5) bancos para gestiones de pago. NO vendemos ni compartimos tus datos para marketing de terceros.",
      },
      {
        q: "¿Cómo ejerzo mis derechos ARCO sobre mis datos?",
        a: "Podés ejercer tus derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO) sobre tus datos personales escribiéndonos a hola@fluxperu.com. Respondemos en un plazo máximo de 15 días hábiles. Importante: la cancelación de datos no extingue por sí misma una obligación de pago vigente.",
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
