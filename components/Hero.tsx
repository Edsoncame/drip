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
    // JPG dark bg → fill right column + left-edge fade
    imageMode: "cover" as const,
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
    // PNG transparent → float naturally on light bg
    imageMode: "contain" as const,
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
    image: APPLE_HERO_IMAGES.airHero,
    imageAlt: "MacBook Air para empresas",
    // PNG transparent → float naturally on blue bg
    imageMode: "contain" as const,
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

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: slide.bg, minHeight: 360, transition: "background 0.7s ease" }}
    >
      {/* Right-side image — full height, no box */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`img-${active}`}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="absolute right-0 top-0 bottom-0 hidden md:block"
          style={{ width: "42%" }}
        >
          {!imgErrors[active] && (
            <>
              <Image
                src={slide.image}
                alt={slide.imageAlt}
                fill
                className={
                  slide.imageMode === "cover"
                    ? "object-cover object-center"
                    : "object-contain object-right-bottom"
                }
                priority={active === 0}
                unoptimized
                onError={() => setImgErrors(prev => ({ ...prev, [active]: true }))}
              />
              {/* Seamless left-edge fade into section background */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to right, ${slide.bg} 0%, ${slide.bg}cc 15%, ${slide.bg}55 35%, transparent 60%)`,
                }}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Left — text content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14 relative z-10">
        <div className="max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={`text-${active}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <span
                className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-5"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: slide.textColor,
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {slide.tag}
              </span>

              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-4 whitespace-pre-line"
                style={{ color: slide.textColor, letterSpacing: "-0.02em" }}
              >
                {slide.title}
              </h1>

              <p
                className="text-base md:text-lg font-medium mb-8 leading-relaxed"
                style={{ color: slide.textColor, opacity: 0.8 }}
              >
                {slide.subtitle}
              </p>

              <Link
                href={slide.href}
                className="inline-flex items-center gap-2 px-7 py-4 text-base font-bold rounded-full transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: slide.accentColor,
                  color:
                    slide.bg === "#1B4FFF"
                      ? "#18191F"
                      : slide.bg === "#F5F5F7"
                      ? "#FFFFFF"
                      : "#FFFFFF",
                }}
              >
                {slide.cta}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile image — shown below text on small screens */}
      <div className="md:hidden px-4 pb-8 flex justify-center">
        {!imgErrors[active] && (
          <Image
            src={slide.image}
            alt={slide.imageAlt}
            width={500}
            height={340}
            className="w-full max-w-sm object-contain"
            unoptimized
            onError={() => setImgErrors(prev => ({ ...prev, [active]: true }))}
          />
        )}
      </div>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="transition-all rounded-full cursor-pointer"
            style={{
              width: i === active ? 24 : 8,
              height: 8,
              background: i === active ? slide.accentColor : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>

      {/* Trust badges */}
      <div className="border-t relative z-10" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-6 md:gap-10 overflow-x-auto no-scrollbar">
          {[
            { icon: "✓", text: "Sin depósito de garantía" },
            { icon: "📦", text: "Entrega en Lima en 24-48h" },
            { icon: "🔄", text: "Desde 8 meses de plazo" },
            { icon: "💳", text: "Primer mes al iniciar" },
          ].map(b => (
            <div
              key={b.text}
              className="flex items-center gap-2 flex-shrink-0 text-sm font-semibold whitespace-nowrap"
              style={{ color: slide.textColor, opacity: 0.85 }}
            >
              <span>{b.icon}</span>
              <span>{b.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
