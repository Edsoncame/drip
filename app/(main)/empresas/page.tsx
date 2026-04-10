"use client";
import Link from "next/link";
import { products } from "@/lib/products";
import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export default function Empresas() {
  return (
    <div>
      {/* Hero */}
      <section className="py-16 md:py-24" style={{ background: "var(--dark)" }}>
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="max-w-5xl mx-auto px-4 sm:px-6 text-center"
        >
          <span className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-6"
            style={{ background: "rgba(27,79,255,0.3)", color: "#7EA8FF", border: "1px solid rgba(27,79,255,0.4)" }}>
            FLUX para Empresas
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-5" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Dale Mac a tu equipo.<br />Sin gastar un sol hoy.
          </h1>
          <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
            Paga mensual, olvídate del hardware y enfócate en lo que realmente importa. FLUX arma el plan para tu empresa en 24 horas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/laptops" className="px-8 py-4 font-bold rounded-full text-sm transition-all hover:opacity-90"
              style={{ background: "var(--primary)", color: "#fff" }}>
              Ver MacBooks disponibles
            </Link>
            <a href="mailto:hola@flux.pe" className="px-8 py-4 font-bold rounded-full text-sm text-white transition-all hover:bg-white/10"
              style={{ border: "2px solid rgba(255,255,255,0.3)" }}>
              Escríbenos, sin compromiso
            </a>
          </div>
        </motion.div>
      </section>

      {/* Value props */}
      <section className="py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              { icon: "🏦", title: "Cero CAPEX", desc: "Todo sale de OPEX. Tu flujo de caja queda libre para crecer, contratar o invertir en lo que importa." },
              { icon: "🔒", title: "MDM incluido", desc: "Enrola, controla y gestiona los equipos de tu equipo desde el día uno. Sin configuraciones raras." },
              { icon: "💼", title: "Contratos a tu medida", desc: "Arreglamos un contrato marco para tu empresa con facturación mensual consolidada. Sin papeleo infinito." },
              { icon: "💰", title: "Tu equipo puede comprarla", desc: "Al terminar el plazo, tu trabajador compra la Mac en 16 cuotas. Tú no tienes que gestionar nada." },
              { icon: "🔄", title: "Sin activos tirados", desc: "Cuando un equipo termina su ciclo, se reasigna o se vende al valor residual. Cero desperdicio." },
              { icon: "📊", title: "Todo en un dashboard", desc: "Ves el estado de cada dispositivo, cuándo vence, quién lo tiene y qué opciones hay. Sin llamadas." },
            ].map(v => (
              <motion.div
                key={v.title}
                variants={fadeUp}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-6 rounded-2xl border"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-3xl mb-4">{v.icon}</div>
                <h3 className="font-black mb-2" style={{ color: "var(--dark-text)" }}>{v.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--medium-text)" }}>{v.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing table */}
      <section className="py-14" style={{ background: "var(--light-bg)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-black mb-8 text-center" style={{ color: "var(--dark-text)" }}>Precios para empresas</h2>
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: "var(--primary)" }}>
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-bold text-white">Modelo</th>
                    <th className="px-6 py-4 text-sm font-bold text-white text-center">8 meses</th>
                    <th className="px-6 py-4 text-sm font-bold text-white text-center">16 meses</th>
                    <th className="px-6 py-4 text-sm font-bold text-white text-center">24 meses</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.slug} style={{ borderBottom: i < products.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm" style={{ color: "var(--dark-text)" }}>{p.shortName}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--light-text)" }}>{p.chip} · {p.ram} · {p.ssd}</p>
                      </td>
                      {p.pricing.map(pr => (
                        <td key={pr.months} className="px-6 py-4 text-center">
                          <span className="text-xl font-black" style={{ color: "var(--dark-text)" }}>${pr.price}</span>
                          <span className="text-xs ml-0.5" style={{ color: "var(--light-text)" }}>/mes</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 text-xs" style={{ color: "var(--light-text)", borderTop: "1px solid var(--border)" }}>
              * Precios en USD · IGV no incluido · Para flotas de 5+ equipos consultar precios especiales
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16" style={{ background: "var(--primary)" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-black text-white mb-3">¿Cuántas Macs necesita tu equipo?</h2>
          <p className="text-white/80 mb-8">Escríbenos y en menos de 24 horas tienes una propuesta lista. Sin vueltas.</p>
          <a href="mailto:hola@flux.pe"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white font-bold rounded-full hover:bg-gray-100 transition-all text-sm"
            style={{ color: "var(--primary)" }}>
            Escríbenos a hola@flux.pe
          </a>
        </div>
      </section>
    </div>
  );
}
