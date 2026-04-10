"use client";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { APPLE_HERO_IMAGES } from "@/lib/appleImages";

const slides = [
  {
    tag: "MacBook Pro — Apple M5",
    title: "La Mac más potente.\nAhora en goteo mensual.",
    subtitle: "Desde $115/mes · Sin comprar · Sin CAPEX · Entrega a tu empresa",
    cta: "Ver MacBook Pro",
    href: "/laptops/macbook-pro-14-m5",
    bg: "#18191F",
    textColor: "#FFFFFF",
    accentColor: "#1B4FFF",
    image: APPLE_HERO_IMAGES.proHero,
    imageAlt: "MacBook Pro M5",
  },
  {
    tag: "MacBook Air M4 — Lo más buscado",
    title: "Ligera. Poderosa.\nTuya por $90/mes.",
    subtitle: "El equipo favorito de startups y equipos modernos. Sin letra chica.",
    cta: "Ver MacBook Air",
    href: "/laptops/macbook-air-13-m4",
    bg: "#F5F5F7",
    textColor: "#18191F",
    accentColor: "#1B4FFF",
    image: APPLE_HERO_IMAGES.airHero,
    imageAlt: "MacBook Air M4 en azul cielo",
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
    image: APPLE_HERO_IMAGES.airBattery,
    imageAlt: "Persona usando MacBook Air",
  },
];

export default function Hero() {
  const [active, setActive] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, []);

  const slide = slides[active];
  const hasImg = !imgErrors[active];

  return (
    <section className="relative overflow-hidden" style={{ background: slide.bg, minHeight: 480, transition: "background 0.7s ease" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

          {/* Left — text */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`text-${active}`}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <span className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-5"
                style={{ background: "rgba(255,255,255,0.15)", color: slide.textColor, border: "1px solid rgba(255,255,255,0.2)" }}>
                {slide.tag}
              </span>

              <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4 whitespace-pre-line"
                style={{ color: slide.textColor, letterSpacing: "-0.02em" }}>
                {slide.title}
              </h1>

              <p className="text-base md:text-lg font-medium mb-8 leading-relaxed"
                style={{ color: slide.textColor, opacity: 0.8 }}>
                {slide.subtitle}
              </p>

              <Link href={slide.href}
                className="inline-flex items-center gap-2 px-7 py-4 text-base font-bold rounded-full transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: slide.accentColor,
                  color: slide.bg === "#1B4FFF" ? "#18191F" : slide.bg === "#F5F5F7" ? "#FFFFFF" : "#FFFFFF"
                }}>
                {slide.cta}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            </motion.div>
          </AnimatePresence>

          {/* Right — Apple product image */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`img-${active}`}
              initial={{ opacity: 0, scale: 0.95, x: 24 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.97, x: 12 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative flex items-center justify-center"
              style={{ minHeight: 280 }}
            >
              {hasImg ? (
                <Image
                  src={slide.image}
                  alt={slide.imageAlt}
                  width={700}
                  height={450}
                  className="w-full max-w-lg object-contain drop-shadow-2xl"
                  priority={active === 0}
                  unoptimized
                  onError={() => setImgErrors(prev => ({ ...prev, [active]: true }))}
                />
              ) : (
                <div className="text-[180px] opacity-10 select-none">💻</div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {slides.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} className="transition-all rounded-full cursor-pointer"
            style={{
              width: i === active ? 24 : 8,
              height: 8,
              background: i === active ? slide.accentColor : "rgba(255,255,255,0.35)",
            }} />
        ))}
      </div>

      {/* Trust badges */}
      <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
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
