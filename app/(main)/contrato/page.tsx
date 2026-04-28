import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  title: "Qué firmas con FLUX — Contrato digital explicado paso a paso",
  description:
    "Antes de alquilar tu MacBook con FLUX te explicamos en español plano qué dice tu contrato, qué protecciones tenés, qué firmas digitalmente y por qué es seguro.",
  alternates: { canonical: `${BASE}/contrato` },
};

interface Step {
  num: string;
  icon: string;
  title: string;
  what: string;
  why: string;
  protection: string;
  duration: string;
}

const steps: Step[] = [
  {
    num: "01",
    icon: "📋",
    title: "Aceptás los Términos y Condiciones",
    what: "Un contrato de arrendamiento operativo que regula precio, plazo, entrega, devolución y soporte técnico. La aceptación es por scroll obligatorio + checkbox.",
    why: "Es el contrato que define todos tus derechos y obligaciones. La ley peruana (Ley 27291 + D.Leg. 1310) le da el mismo valor que una firma manuscrita ante notario.",
    protection:
      "Te da derecho a 30 días de aviso para cancelar al cumplir el plazo mínimo, opción de compra al final con valor residual claro, soporte técnico durante todo el contrato, y reembolso si FLUX falla.",
    duration: "5 min",
  },
  {
    num: "02",
    icon: "🛡️",
    title: "Autorizás el tratamiento de tus datos personales",
    what: "Permiso a FLUX para procesar tus datos (nombre, DNI/RUC, email, teléfono, dirección) según la Ley 29733 de Protección de Datos del Perú.",
    why: "Sin este consentimiento no podemos: emitir tu factura SUNAT, procesar tu pago recurrente, coordinar la entrega, ni registrar tu KYC.",
    protection:
      "Tenés derechos ARCO (Acceso, Rectificación, Cancelación, Oposición) ejercibles en cualquier momento escribiendo a hola@fluxperu.com. Respondemos en 15 días hábiles.",
    duration: "incluido en paso 01",
  },
  {
    num: "03",
    icon: "📞",
    title: "Autorizás el reporte a centrales de riesgo (solo si caés en mora)",
    what: "Si pasás más de 30 días sin pagar tu cuota, podemos reportarte a Equifax (INFOCORP), Sentinel, Experian y Xchange (CCL).",
    why: "Es el mismo mecanismo que usan bancos, telefónicas y aseguradoras. Es estándar del mercado peruano de crédito y arrendamiento.",
    protection:
      "Te avisamos por correo con 48 horas de anticipación antes de cualquier reporte. Si pagás, la deuda se registra como 'cancelada' y desaparece después de 5 años. Mientras pagués al día, NO aparecés en ninguna central.",
    duration: "incluido en paso 01",
  },
  {
    num: "04",
    icon: "✍️",
    title: "Firma digital con tu nombre legal + DNI/RUC",
    what: "Después de leer y aceptar, escribís tu nombre completo (como aparece en tu DNI o RUC) y confirmás con tu documento. Esa es tu firma electrónica.",
    why: "Bajo la Ley 27269 de Firmas y Certificados Digitales, esta firma equivale a la manuscrita. FLUX guarda evidencia: nombre, documento, IP, fecha/hora, navegador, versión del contrato.",
    protection:
      "Tenés copia exacta del documento que firmaste, con timestamp inmutable. Si alguna vez necesitás disputar algo ante INDECOPI o un juzgado, esa evidencia te respalda. La auditoría se conserva durante toda la vigencia del contrato + 5 años.",
    duration: "2 min",
  },
  {
    num: "05",
    icon: "🧾",
    title: "Autorizás el pagaré incompleto (al recibir el equipo)",
    what: "Es un título valor regulado por la Ley 27287. Lo firmás en blanco y FLUX SOLO lo completa si caés en mora superior a 30 días o no devolvés el equipo al final.",
    why: "Sin pagaré, una cobranza judicial puede tomar 1 a 2 años. Con pagaré, FLUX puede ir por 'proceso ejecutivo' (3 a 6 meses). Es estándar en arrendamiento operativo de equipos.",
    protection:
      "El pagaré NUNCA se ejecuta si pagás tus cuotas. FLUX solo lo completa después de intimarte por carta notarial dándote 10 días para pagar o devolver el equipo. Si pagás todo lo adeudado, el pagaré queda nulo automáticamente.",
    duration: "1 min al recibir tu Mac",
  },
];

interface Myth {
  myth: string;
  truth: string;
}

const myths: Myth[] = [
  {
    myth: "“Voy a quedar atado a FLUX para siempre”",
    truth:
      "Falso. El plazo mínimo es 8, 16 o 24 meses (vos elegís). Cumplido el plazo, cancelás con 30 días de aviso, sin penalidad. Después podés devolver el equipo, comprarlo o renovar.",
  },
  {
    myth: "“Si me roban la Mac, FLUX me cobra 5 mil dólares”",
    truth:
      "Te cobramos el valor comercial de reemplazo del equipo (no inflado). Por eso recomendamos AppleCare+ por +$12/mes — pero ojo: AppleCare+ tampoco cubre robo. Para robo no hay seguro estándar en Perú; lo asume el usuario.",
  },
  {
    myth: "“FLUX puede entrar a mi Mac y ver mis archivos”",
    truth:
      "No. FLUX inscribe el equipo en Apple Business Manager para fines de seguridad y soporte (igual que cualquier empresa Apple-managed). NO accedemos a tus archivos, contraseñas, mensajes ni navegación. Solo en caso de mora prolongada o robo reportado podemos bloquear/borrar el equipo a distancia.",
  },
  {
    myth: "“El pagaré me arruina la vida si tengo un mes flojo”",
    truth:
      "El pagaré solo se completa después de mora superior a 30 días + intimación notarial + 10 días extras. Tenés más de 40 días desde el primer cobro fallido para regularizar antes de cualquier acción legal. Si avisás con tiempo, siempre podemos coordinar.",
  },
  {
    myth: "“No puedo deducir esto del impuesto a la renta”",
    truth:
      "Falso. El alquiler de equipos es 100% gasto deducible para empresas (Art. 37 Ley del Impuesto a la Renta). Recuperás el IGV en cada factura. Por eso muchos contadores prefieren alquilar antes que comprar.",
  },
  {
    myth: "“Una vez que firmo, no puedo cancelar nunca”",
    truth:
      "Sí podés. Tenés 7 días calendario de desistimiento sin causa (Ley 29571 de Indecopi). Cumplido el plazo mínimo, cancelás con 30 días de aviso, sin penalidad. En casos extraordinarios (cierre de empresa, mudanza, fuerza mayor) la penalidad es solo 2 cuotas.",
  },
];

export default function ContratoPage() {
  return (
    <div className="bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: BASE },
          { name: "Contrato", url: `${BASE}/contrato` },
        ]}
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-gradient-to-b from-[#1B4FFF] to-[#102F99] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-700 uppercase tracking-widest opacity-80 mb-3">
            Antes del checkout
          </p>
          <h1 className="text-4xl md:text-5xl font-800 mb-4 leading-tight">
            Qué firmás con FLUX (en español plano)
          </h1>
          <p className="text-lg opacity-85 max-w-2xl mx-auto leading-relaxed">
            Acá te explicamos los 5 documentos que firmás cuando alquilás tu MacBook,
            por qué los firmás y qué protecciones tenés vos. Sin tecnicismos legales.
          </p>
          <p className="text-sm opacity-70 mt-4">⏱️ Te toma 7 minutos leer todo · 10-15 minutos firmar</p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="space-y-10">
            {steps.map((s) => (
              <div
                key={s.num}
                className="relative flex flex-col md:flex-row gap-6 md:gap-8 p-6 md:p-8 rounded-2xl border border-[#E5E5E5] bg-white"
              >
                <div className="flex-shrink-0 flex md:flex-col items-center md:items-start gap-3">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-800 text-sm"
                    style={{ background: "#1B4FFF" }}
                  >
                    {s.num}
                  </div>
                  <span className="text-3xl">{s.icon}</span>
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-800 text-[#18191F] mb-1">{s.title}</h2>
                    <p className="text-xs font-600 text-[#1B4FFF] uppercase tracking-wide">
                      ⏱️ {s.duration}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-700 text-[#888] uppercase tracking-wider mb-1">
                      Qué es
                    </p>
                    <p className="text-sm text-[#444] leading-relaxed">{s.what}</p>
                  </div>

                  <div>
                    <p className="text-xs font-700 text-[#888] uppercase tracking-wider mb-1">
                      Por qué se firma
                    </p>
                    <p className="text-sm text-[#444] leading-relaxed">{s.why}</p>
                  </div>

                  <div className="bg-[#F5F8FF] border-l-4 border-[#1B4FFF] rounded p-4">
                    <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider mb-1">
                      🛡️ Tu protección
                    </p>
                    <p className="text-sm text-[#333] leading-relaxed">{s.protection}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparativa visual */}
      <section className="py-16 bg-[#F7F7F7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider mb-2">
              FLUX vs. lo tradicional
            </p>
            <h2 className="text-3xl md:text-4xl font-800 text-[#18191F]">
              Sin papeleo. Sin notarías.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6">
              <p className="text-xs font-700 text-[#999] uppercase tracking-wider mb-3">
                ❌ Alquiler tradicional
              </p>
              <ul className="space-y-3 text-sm text-[#444]">
                <li className="flex items-start gap-2">
                  <span className="text-[#999]">•</span>
                  <span>3-7 días para firmar (papeleo, notaría, fianzas)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#999]">•</span>
                  <span>Aval personal o garantía bancaria obligatoria</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#999]">•</span>
                  <span>Depósito de garantía (1-3 meses de renta)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#999]">•</span>
                  <span>Reuniones presenciales para revisar contrato</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#999]">•</span>
                  <span>Costos legales y notariales a cargo del cliente</span>
                </li>
              </ul>
            </div>

            <div
              className="rounded-2xl p-6 text-white"
              style={{ background: "linear-gradient(135deg, #1B4FFF, #102F99)" }}
            >
              <p className="text-xs font-700 uppercase tracking-wider mb-3 opacity-90">
                ✓ Con FLUX
              </p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>10-15 minutos firma 100% online</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Sin aval ni fiador (B2C); en B2B garante solidario es el rep. legal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Sin depósito en efectivo. Solo el primer mes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Firma desde tu computadora o celular</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Cero costos legales para vos. FLUX absorbe todo</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Mitos */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider mb-2">
              Lo que NO firmás
            </p>
            <h2 className="text-3xl md:text-4xl font-800 text-[#18191F]">
              Mitos comunes (y la realidad)
            </h2>
          </div>

          <div className="space-y-5">
            {myths.map((m, i) => (
              <div
                key={i}
                className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden"
              >
                <div className="px-5 py-4 bg-[#FFF5F5] border-b border-[#FFE0E0]">
                  <p className="text-sm font-700 text-[#C62828]">{m.myth}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs font-700 text-[#0A8B3A] uppercase tracking-wider mb-2">
                    ✓ La realidad
                  </p>
                  <p className="text-sm text-[#444] leading-relaxed">{m.truth}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Documentos completos */}
      <section className="py-12 bg-[#F7F7F7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-800 text-[#18191F] mb-3">
            ¿Querés leer los documentos completos antes de firmar?
          </h2>
          <p className="text-[#666] mb-6">
            Ningún tecnicismo se te oculta. Acá están todos los documentos disponibles para
            tu lectura, sin necesidad de iniciar el checkout.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/terminos"
              className="px-6 py-3 bg-white border border-[#E5E5E5] text-[#18191F] font-700 rounded-full hover:border-[#1B4FFF] hover:text-[#1B4FFF] text-sm"
            >
              Términos y Condiciones (28 secciones)
            </Link>
            <Link
              href="/privacidad"
              className="px-6 py-3 bg-white border border-[#E5E5E5] text-[#18191F] font-700 rounded-full hover:border-[#1B4FFF] hover:text-[#1B4FFF] text-sm"
            >
              Política de Privacidad
            </Link>
            <Link
              href="/cancelaciones"
              className="px-6 py-3 bg-white border border-[#E5E5E5] text-[#18191F] font-700 rounded-full hover:border-[#1B4FFF] hover:text-[#1B4FFF] text-sm"
            >
              Política de Cancelaciones
            </Link>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 bg-[#18191F] text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-800 mb-4">
            Ya entendés todo. ¿Listos?
          </h2>
          <p className="text-lg opacity-80 mb-8">
            Elegí tu MacBook, completá el checkout y firmás digital. En 15 minutos
            tenés todo listo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/laptops"
              className="px-8 py-4 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] text-base"
            >
              Ver MacBooks disponibles →
            </Link>
            <a
              href="https://wa.me/51900164769"
              target="_blank"
              rel="noreferrer"
              className="px-8 py-4 border border-white/30 text-white font-700 rounded-full hover:bg-white/10 text-base"
            >
              Tengo una duda · WhatsApp
            </a>
          </div>
          <p className="text-sm opacity-50 mt-8">
            Última actualización del contrato: 28 de abril de 2026
          </p>
        </div>
      </section>
    </div>
  );
}
