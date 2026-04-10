"use client";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };

const steps = [
  { n: "01", icon: "🖥️", title: "Elige tu Mac y tu plazo", desc: "Selecciona el modelo (Air o Pro), la configuración y cuántos meses quieres: 8, 16 o 24. Mientras más largo el plazo, menor el precio mensual." },
  { n: "02", icon: "👤", title: "Crea tu cuenta", desc: "Datos básicos de tu empresa o como persona. Hacemos una evaluación rápida para confirmar el pedido." },
  { n: "03", icon: "💳", title: "Paga el primer mes", desc: "El primer pago mensual se cobra al confirmar. Eso activa el pedido. Aceptamos tarjeta de crédito, débito y transferencia." },
  { n: "04", icon: "📦", title: "Recibe tu Mac", desc: "Entrega en Lima en 24-48 horas hábiles. El equipo llega en perfectas condiciones, con todos sus accesorios originales." },
  { n: "05", icon: "🔄", title: "Paga mes a mes", desc: "El cobro se realiza automáticamente cada mes desde la fecha de entrega. Puedes cambiar el método de pago desde tu cuenta." },
  { n: "06", icon: "🏁", title: "Al terminar el plazo", desc: "Tienes 3 opciones: devuelves la Mac sin costo, la compras al valor residual pactado, o tu colaborador la compra en cuotas." },
];

const faqs = [
  { q: "¿Necesito un depósito de garantía?", a: "No. FLUX no exige depósito. El primer mes de renta actúa como pago de activación del pedido." },
  { q: "¿Puedo cancelar antes del plazo mínimo?", a: "Puedes cancelar desde el mes siguiente al plazo mínimo contratado (8, 16 o 24 meses). Solo devuelves el equipo." },
  { q: "¿Qué pasa si el equipo se daña?", a: "El arrendatario es responsable por daños fuera del desgaste normal. Recomendamos contratar AppleCare+ que ofrecemos como add-on." },
  { q: "¿Puedo comprar la Mac al final?", a: "Sí. Al terminar el plazo puedes comprarla al valor residual pactado desde el inicio: 77.5% a 8m, 55% a 16m, 32.5% a 24m." },
  { q: "¿Mis colaboradores pueden comprar la Mac en cuotas?", a: "Sí. Es una opción disponible para empresas. El colaborador paga en 16 cuotas mensuales al valor residual del ciclo." },
  { q: "¿Cuánto demora la entrega en Lima?", a: "Entre 24 y 48 horas hábiles desde que confirmamos el pedido." },
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
              transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
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

      {/* Residual table */}
      <section className="py-12" style={{ background: "var(--light-bg)" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-black mb-2" style={{ color: "var(--dark-text)" }}>Valor residual de compra</h2>
          <p className="text-sm mb-8" style={{ color: "var(--medium-text)" }}>Si decides comprar la Mac al terminar tu plazo, este es el precio como porcentaje del costo original.</p>
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            {[
              { plazo: "8 meses", residual: "77.5%", badge: null },
              { plazo: "16 meses", residual: "55.0%", badge: "Más popular" },
              { plazo: "24 meses", residual: "32.5%", badge: "Menor precio de compra" },
            ].map((r, i) => (
              <div key={r.plazo} className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                <div className="flex items-center gap-3">
                  <span className="font-bold" style={{ color: "var(--dark-text)" }}>{r.plazo}</span>
                  {r.badge && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                      {r.badge}
                    </span>
                  )}
                </div>
                <span className="text-xl font-black" style={{ color: "var(--primary)" }}>{r.residual}</span>
              </div>
            ))}
          </div>
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
              transition={{ duration: 0.45, delay: i * 0.07, ease: "easeOut" }}
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
