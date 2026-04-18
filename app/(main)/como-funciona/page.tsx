"use client";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

const steps = [
  { n: "01", icon: "🖥️", title: "Elige tu Mac y tu plazo", desc: "Air o Pro, 8, 16 o 24 meses. Cuanto más largo el plazo, más barata la cuota mensual. Simple." },
  { n: "02", icon: "👤", title: "Crea tu cuenta", desc: "Tus datos básicos como empresa o persona natural. Hacemos una evaluación rápida — sin papeleo eterno." },
  { n: "03", icon: "💳", title: "Paga el primer mes", desc: "Con tarjeta o transferencia. Ese primer pago activa tu pedido al toque. Sin matrícula, sin letra chica." },
  { n: "04", icon: "📦", title: "Recibe tu Mac", desc: "La llevamos a tu oficina en Lima en 24-48 horas hábiles. Lista para usar, con todos sus accesorios originales." },
  { n: "05", icon: "🔄", title: "Paga mes a mes, sin preocuparte", desc: "El cobro va automático cada mes. Si necesitas cambiar tu método de pago, lo haces desde tu cuenta en segundos." },
  { n: "06", icon: "🏁", title: "Al terminar, tú decides", desc: "La devuelves sin costo, renuevas con un modelo nuevo, o te la quedas a un precio especial que coordinamos contigo." },
];

const faqs = [
  { q: "¿Necesito pagar un depósito de garantía?", a: "Para nada. FLUX no te pide depósito. El primer mes de renta es el único pago al inicio — y ese ya cubre tu primer mes de uso." },
  { q: "¿Puedo salirme antes de terminar el plazo?", a: "Puedes cancelar una vez que completes tu plazo mínimo (8, 16 o 24 meses según lo que hayas elegido). Solo coordinas la devolución del equipo y listo." },
  { q: "¿Qué pasa si se me cae o se daña la Mac?", a: "Los daños por accidente o mal uso están fuera de la cobertura básica, así que corren por tu cuenta. Por eso ofrecemos AppleCare+ como add-on — te cubre casi todo." },
  { q: "¿Puedo comprar la Mac al terminar?", a: "Sí. Al terminar tu plazo, puedes quedártela a un precio especial que coordinamos contigo — sin compromiso previo." },
  { q: "¿Cuánto demora la entrega en Lima?", a: "Entre 24 y 48 horas hábiles desde que confirmamos tu pedido. Entregamos en tu oficina o donde nos digas en Lima." },
];

export default function ComoFunciona() {
  return (
    <div>
      {/* Hero */}
      <section className="py-16 md:py-20" style={{ background: "var(--primary)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4" style={{ letterSpacing: "-0.02em" }}>
            Así de fácil. En 6 pasos.
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
