"use client";
import { motion } from "framer-motion";

const steps = [
  {
    n: "1",
    icon: "🖥️",
    title: "Elige tu Mac",
    desc: "Air o Pro, elige el modelo y cuántos meses quieres. Simple, sin letra chica.",
  },
  {
    n: "2",
    icon: "💳",
    title: "Paga el primer mes",
    desc: "Solo pagas el primer mes para activar tu pedido. Sin matrícula ni depósito.",
  },
  {
    n: "3",
    icon: "📦",
    title: "Recibe y a trabajar",
    desc: "Tu Mac llega a Lima en 24-48h, lista para usar. MDM incluido si lo necesitas.",
  },
  {
    n: "4",
    icon: "🔄",
    title: "Tú decides al final",
    desc: "La devuelves sin costo, la compras al valor residual o tu trabajador la compra en cuotas.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-16 md:py-20" style={{ background: "var(--light-bg)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-10">
          <h2 className="text-3xl font-black" style={{ color: "var(--dark-text)" }}>
            Tu Mac en 4 pasos
          </h2>
          <span className="text-sm font-semibold hidden md:block" style={{ color: "var(--medium-text)" }}>
            Fácil. Rápido. Sin letra chica.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((step, i) => (
            <motion.div key={step.n}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-white rounded-2xl p-6" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                  style={{ background: "var(--primary)" }}>
                  {step.n}
                </span>
                <span className="text-2xl">{step.icon}</span>
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: "var(--dark-text)" }}>{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--medium-text)" }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
