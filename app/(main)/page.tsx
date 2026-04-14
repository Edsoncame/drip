"use client";
import { useState, useEffect } from "react";
import Hero from "@/components/Hero";
import ProductCard from "@/components/ProductCard";
import HowItWorks from "@/components/HowItWorks";
import HomeFAQ from "@/components/HomeFAQ";
import { useProducts } from "@/lib/use-products";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

const testimonials = [
  { name: "Andrea C.", role: "Head of Ops · Fintech Lima", text: "Equipamos a 12 personas con MacBook Pro en una semana. Sin comprar nada. FLUX lo hizo fácil.", stars: 5 },
  { name: "Marco V.", role: "CEO · Agencia Digital", text: "El modelo es perfecto. Pagas mes a mes, y cuando tu equipo crece solo agregas más Macs.", stars: 5 },
  { name: "Lucía R.", role: "CFO · Startup SaaS", text: "Lo mejor: cero CAPEX. Todo va a OPEX y eso cambia totalmente el flujo de caja.", stars: 5 },
];

const benefits = [
  { icon: "🏦", title: "Sin CAPEX", desc: "Todo va a OPEX. Tu balance queda limpio." },
  { icon: "🔒", title: "MDM incluido", desc: "Control total de los equipos de tu empresa." },
  { icon: "💰", title: "Opción de compra", desc: "Al terminar el plazo, tu colaborador puede comprarla." },
  { icon: "🔄", title: "Activo rotante", desc: "El equipo rota. Siempre aprovechamos el activo." },
];

export default function Home() {
  const { products } = useProducts();
  const [imageSets, setImageSets] = useState<Record<string, { open: string }>>({});

  useEffect(() => {
    fetch("/api/apple-images")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setImageSets(data); })
      .catch(() => {});
  }, []);

  return (
    <>
      <Hero />

      {/* Products */}
      <section className="py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black" style={{ color: "var(--dark-text)" }}>MacBooks disponibles</h2>
              <p className="text-sm mt-1" style={{ color: "var(--medium-text)" }}>Todos los modelos. Siempre con chip Apple Silicon.</p>
            </div>
            <Link href="/laptops" className="text-sm font-bold hidden md:flex items-center gap-1 hover:underline" style={{ color: "var(--primary)" }}>
              Ver todos
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map(p => (
              <ProductCard
                key={p.slug}
                product={p}
                imageUrl={imageSets[p.slug]?.open ?? p.image}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12" style={{ background: "var(--primary-light)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {benefits.map(b => (
              <motion.div
                key={b.title}
                variants={fadeUp}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="bg-white rounded-2xl p-5"
                style={{ boxShadow: "0 2px 8px rgba(27,79,255,0.08)" }}
              >
                <div className="text-3xl mb-3">{b.icon}</div>
                <h3 className="font-bold text-sm mb-1" style={{ color: "var(--dark-text)" }}>{b.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--medium-text)" }}>{b.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <HowItWorks />

      <HomeFAQ />

      {/* Pricing table */}
      <motion.section
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="py-14 md:py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black mb-2" style={{ color: "var(--dark-text)" }}>Precios transparentes</h2>
            <p style={{ color: "var(--medium-text)" }}>El mismo precio para todos. Sin sorpresas.</p>
          </div>
          {/* Mobile: card layout */}
          <div className="md:hidden max-w-md mx-auto space-y-4">
            {products.map((p, i) => (
              <motion.div
                key={p.slug}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.28, delay: i * 0.06 }}
                className="bg-white rounded-2xl p-5 border border-[#E5E5E5]"
              >
                <Link href={`/laptops/${p.slug}`} className="font-bold text-base hover:underline" style={{ color: "var(--primary)" }}>{p.shortName}</Link>
                <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--light-text)" }}>{p.chip} · {p.ram} · {p.ssd}</p>
                <div className="grid grid-cols-3 gap-3">
                  {p.pricing.map(pr => (
                    <div key={pr.months} className="text-center bg-[#F7F7F7] rounded-xl py-2.5 px-1">
                      <p className="text-[10px] font-600 mb-1" style={{ color: "var(--light-text)" }}>{pr.months} meses</p>
                      <p className="text-lg font-black" style={{ color: "var(--dark-text)" }}>${pr.price}</p>
                      <p className="text-[10px]" style={{ color: "var(--light-text)" }}>/mes</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden md:block max-w-3xl mx-auto overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th className="text-left pb-3 text-sm font-bold" style={{ color: "var(--dark-text)" }}>Modelo</th>
                  <th className="pb-3 text-sm font-bold text-center" style={{ color: "var(--dark-text)" }}>8 meses</th>
                  <th className="pb-3 text-sm font-bold text-center" style={{ color: "var(--dark-text)" }}>16 meses</th>
                  <th className="pb-3 text-sm font-bold text-center" style={{ color: "var(--dark-text)" }}>24 meses</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <motion.tr
                    key={p.slug}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.28, delay: i * 0.06, ease: "easeOut" }}
                    style={{ borderBottom: i < products.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <td className="py-4 text-sm font-semibold">
                      <Link href={`/laptops/${p.slug}`} className="hover:underline font-bold" style={{ color: "var(--primary)" }}>{p.shortName}</Link>
                      <div className="text-xs mt-0.5" style={{ color: "var(--light-text)" }}>{p.chip} · {p.ram} · {p.ssd}</div>
                    </td>
                    {p.pricing.map(pr => (
                      <td key={pr.months} className="py-4 text-center">
                        <span className="text-xl font-black" style={{ color: "var(--dark-text)" }}>${pr.price}</span>
                        <span className="text-xs ml-0.5" style={{ color: "var(--light-text)" }}>/mes</span>
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-center mt-8">
            <p className="text-xs mb-4" style={{ color: "var(--light-text)" }}>Precios en USD · IGV no incluido · Sujeto a evaluación</p>
            <Link href="/laptops" className="inline-flex items-center gap-2 px-6 py-3.5 font-bold text-white rounded-full hover:opacity-90 transition-all"
              style={{ background: "var(--primary)" }}>
              Comenzar ahora
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Testimonials */}
      <section className="py-14 md:py-20" style={{ background: "var(--light-bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-black mb-8 text-center" style={{ color: "var(--dark-text)" }}>Empresas que ya hacen flux</h2>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {testimonials.map(t => (
              <motion.div
                key={t.name}
                variants={fadeUp}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="bg-white rounded-2xl p-6"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
              >
                <div className="flex mb-3">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#FFC700"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--dark-text)" }}>&ldquo;{t.text}&rdquo;</p>
                <p className="text-sm font-bold" style={{ color: "var(--dark-text)" }}>{t.name}</p>
                <p className="text-xs" style={{ color: "var(--light-text)" }}>{t.role}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <motion.section
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="py-16"
        style={{ background: "var(--primary)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">¿Listo para hacer flux?</h2>
          <p className="text-white/80 mb-8 text-lg">Armamos el plan para tu empresa en 24h.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/laptops" className="px-8 py-4 bg-white font-bold rounded-full hover:bg-gray-100 transition-all text-sm" style={{ color: "var(--primary)" }}>
              Ver MacBooks disponibles
            </Link>
            <Link href="/empresas" className="px-8 py-4 font-bold rounded-full text-white text-sm transition-all hover:bg-white/10" style={{ border: "2px solid rgba(255,255,255,0.4)" }}>
              Hablar con ventas
            </Link>
          </div>
        </div>
      </motion.section>
    </>
  );
}
