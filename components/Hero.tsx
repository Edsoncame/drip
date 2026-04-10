"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const slides = [
  {
    tag: "MacBook Pro M5 — 2025",
    title: "La Mac más potente.\nAhora en goteo mensual.",
    subtitle: "Desde $115/mes · Sin comprar · Sin CAPEX · Entrega a tu empresa",
    cta: "Ver MacBook Pro M5",
    href: "/laptops/macbook-pro-14-m5",
    bg: "#18191F",
    textColor: "#FFFFFF",
    accentColor: "#1B4FFF",
    emoji: "⚡",
  },
  {
    tag: "MacBook Air M4 — Lo más buscado",
    title: "Ligera. Poderosa.\nTuya por $90/mes.",
    subtitle: "El equipo favorito de startups y equipos modernos. Sin letra chica.",
    cta: "Ver MacBook Air",
    href: "/laptops/macbook-air-13-m4",
    bg: "#EEF2FF",
    textColor: "#18191F",
    accentColor: "#1B4FFF",
    emoji: "🚀",
  },
  {
    tag: "Para empresas",
    title: "Equipa a tu equipo\ncon Mac. Sin inversión.",
    subtitle: "Contratos flexibles, MDM incluido, opción de compra para colaboradores.",
    cta: "Conocer planes empresa",
    href: "/empresas",
    bg: "#1B4FFF",
    textColor: "#FFFFFF",
    accentColor: "#FFFFFF",
    emoji: "🏢",
  },
];

export default function Hero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, []);

  const slide = slides[active];

  return (
    <section className="relative overflow-hidden" style={{ background: slide.bg, minHeight: 420, transition: "background 0.6s ease" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="max-w-2xl">
          <motion.div key={active} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

            {/* Tag */}
            <span className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-5"
              style={{ background: "rgba(255,255,255,0.15)", color: slide.textColor, border: "1px solid rgba(255,255,255,0.2)" }}>
              {slide.tag}
            </span>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4 whitespace-pre-line"
              style={{ color: slide.textColor, letterSpacing: "-0.02em" }}>
              {slide.title}
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg font-medium mb-8 leading-relaxed"
              style={{ color: slide.textColor, opacity: 0.8 }}>
              {slide.subtitle}
            </p>

            {/* CTA */}
            <Link href={slide.href}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-bold rounded-full transition-all hover:opacity-90 active:scale-95"
              style={{ background: slide.accentColor, color: slide.bg === "#1B4FFF" ? "#18191F" : "#FFFFFF" }}>
              {slide.cta}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </motion.div>
        </div>

        {/* Big emoji decoration */}
        <motion.div key={`emoji-${active}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 0.15, scale: 1 }}
          className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:block select-none pointer-events-none"
          style={{ fontSize: 220 }}>
          {slide.emoji}
        </motion.div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {slides.map((_, i) => (
          <button key={i} onClick={() => setActive(i)}
            className="transition-all rounded-full"
            style={{
              width: i === active ? 24 : 8,
              height: 8,
              background: i === active ? slide.accentColor : "rgba(255,255,255,0.4)"
            }} />
        ))}
      </div>

      {/* Trust badges */}
      <div className="border-t mt-8" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-6 md:gap-10 overflow-x-auto no-scrollbar">
          {[
            { icon: "✓", text: "Sin depósito de garantía" },
            { icon: "📦", text: "Entrega en Lima en 24-48h" },
            { icon: "🔄", text: "Desde 8 meses de plazo" },
            { icon: "💳", text: "Primer mes al iniciar" },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-2 flex-shrink-0 text-sm font-semibold whitespace-nowrap"
              style={{ color: slide.textColor, opacity: 0.85 }}>
              <span>{b.icon}</span>
              <span>{b.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
