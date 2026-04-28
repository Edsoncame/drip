"use client";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

const steps = [
  { n: "01", icon: "🖥️", title: "Elige tu Mac y tu plazo", desc: "Air, Pro o Neo. 8, 16 o 24 meses. Cuanto más largo el plazo, más barata la cuota mensual. Simple." },
  { n: "02", icon: "👤", title: "Crea tu cuenta y verifica identidad", desc: "Tus datos básicos como persona natural (DNI + selfie KYC) o empresa (RUC). Validamos en minutos — sin papeleo físico." },
  { n: "03", icon: "✍️", title: "Firma digital del contrato", desc: "Leés los Términos completos, firmás con tu nombre legal + DNI/RUC. 10-15 minutos. Misma validez que firma manuscrita (Ley 27269)." },
  { n: "04", icon: "💳", title: "Paga el primer mes", desc: "Tarjeta de crédito/débito vía Stripe o transferencia bancaria. Ese primer pago activa tu pedido. Sin matrícula, sin letra chica." },
  { n: "05", icon: "📦", title: "Recibe tu Mac", desc: "La llevamos a tu oficina en Lima en 24-48 horas hábiles. Lista para usar, con todos sus accesorios originales." },
  { n: "06", icon: "🔄", title: "Paga mes a mes, sin preocuparte", desc: "El cobro recurrente va automático cada mes. Si necesitás cambiar tu método de pago, lo hacés desde tu cuenta /cuenta/pagos en segundos." },
  { n: "07", icon: "🏁", title: "Al terminar, vos decidís", desc: "La devolvés sin costo, renovás con un modelo nuevo, o ejercés la opción de compra al valor residual que coordinamos contigo." },
];

const faqs = [
  { q: "¿Necesito pagar un depósito de garantía?", a: "No. FLUX no pide depósito en efectivo. La protección de FLUX descansa en la firma del pagaré incompleto al recibir el equipo (Ley 27287) y, en contratos B2B, la garantía solidaria del representante legal. El primer mes de renta es el único pago al inicio." },
  { q: "¿Puedo salirme antes de terminar el plazo?", a: "Cumplido el plazo mínimo (8, 16 o 24 meses), cancelás con 30 días de aviso sin penalidad. Antes del plazo solo se autoriza cancelación anticipada por causa justificada (cierre de empresa, mudanza fuera de Lima, fuerza mayor) con penalidad de 2 Rentas Mensuales." },
  { q: "¿Qué pasa si se cae o se daña la Mac?", a: "Falla de fábrica: FLUX la cubre. Daño accidental: con AppleCare+ pagás solo USD $99 de deducible por incidente; sin AppleCare+ asumís el costo de reparación según tarifa Apple Service. Robo o pérdida NO está cubierto: el cliente abona el valor comercial de reemplazo." },
  { q: "¿Puedo comprar la Mac al terminar?", a: "Sí. Te ofrecemos opción de compra al valor residual: 60-75% del precio original si fue plan 8m, 35-50% si 16m, 15-30% si 24m. El porcentaje exacto depende del estado del equipo y batería." },
  { q: "¿Cuánto demora la entrega en Lima?", a: "Entre 24 y 48 horas hábiles desde que confirmamos tu pedido y validamos tu identidad. Entregamos gratis en cualquier dirección de Lima Metropolitana." },
  { q: "¿Qué pasa si no pago una cuota?", a: "Tenés 5 días calendario de gracia. Pasados los 5 días devengan intereses moratorios (TIPMN/TIPMEX BCRP) más 10% de penalidad por cobro fallido. A partir del día 31 reportamos a las centrales de riesgo (INFOCORP, Equifax, Sentinel, Xchange CCL). Siempre es mejor avisarnos con tiempo para coordinar." },
];

export default function ComoFunciona() {
  return (
    <div>
      {/* Hero */}
      <section className="py-16 md:py-20" style={{ background: "var(--primary)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4" style={{ letterSpacing: "-0.02em" }}>
            Así de fácil. En 7 pasos.
          </h1>
          <p className="text-xl text-white/80 mb-0">
            Accede a Mac. Paga mensual. Sin comprar.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="space-y-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
              className="flex gap-6 items-start"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-black text-white"
                style={{ background: "var(--primary)" }}>
                {step.n}
              </div>
              <div className="flex-1 pb-6" style={{ borderBottom: i < steps.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{step.icon}</span>
                  <h3 className="text-lg font-black" style={{ color: "var(--dark-text)" }}>{step.title}</h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--medium-text)" }}>{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>


      {/* FAQ */}
      <section id="faq" className="py-16 max-w-3xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl font-black mb-8" style={{ color: "var(--dark-text)" }}>Preguntas frecuentes</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={faq.q}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.28, delay: i * 0.05, ease: "easeOut" }}
              className="rounded-2xl p-6 border"
              style={{ borderColor: "var(--border)" }}
            >
              <h3 className="font-bold mb-2" style={{ color: "var(--dark-text)" }}>{faq.q}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--medium-text)" }}>{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-16 text-center px-4">
        <Link href="/laptops" className="inline-flex items-center gap-2 px-8 py-4 font-bold text-white rounded-full hover:opacity-90 transition-all"
          style={{ background: "var(--primary)" }}>
          Ver MacBooks disponibles
        </Link>
      </section>
    </div>
  );
}
