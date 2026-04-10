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
    imageAlt: "MacBook Air M4",
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
  },
];

const BADGES = [
  "Sin depósito de garantía",
  "Entrega en Lima en 24-48h",
  "Desde 8 meses de plazo",
  "Primer mes al iniciar",
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
      style={{ background: slide.bg, minHeight: 400, transition: "background 0.7s ease" }}
    >
      {/* Right-side product image — transparent PNG floats on slide bg */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`img-${active}`}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 15 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute right-0 top-0 bottom-0 hidden md:flex items-center justify-end"
          style={{ width: "46%" }}
        >
          {!imgErrors[active] && (
            <>
              <Image
                src={slide.image}
                alt={slide.imageAlt}
                width={900}
                height={630}
                className="w-full h-full object-contain object-center"
                style={{ padding: "16px 24px 16px 0" }}
                priority={active === 0}
                unoptimized
                onError={() => setImgErrors(prev => ({ ...prev, [active]: true }))}
              />
              {/* Subtle left-edge fade — only 25% to avoid covering the Mac */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to right, ${slide.bg} 0%, ${slide.bg}99 10%, transparent 28%)`,
                }}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Text content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14 relative z-10">
        <div className="max-w-[480px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`text-${active}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <span
                className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-4"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: slide.textColor,
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {slide.tag}
              </span>

              <h1
                className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight mb-3 whitespace-pre-line"
                style={{ color: slide.textColor, letterSpacing: "-0.02em" }}
              >
                {slide.title}
              </h1>

              <p
                className="text-sm md:text-base font-medium mb-6 leading-relaxed"
                style={{ color: slide.textColor, opacity: 0.8 }}
              >
                {slide.subtitle}
              </p>

              <Link
                href={slide.href}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold rounded-full transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: slide.accentColor,
                  color: slide.bg === "#1B4FFF" ? "#18191F" : "#FFFFFF",
                }}
              >
                {slide.cta}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile image */}
      <div className="md:hidden px-6 pb-8 flex justify-center">
        {!imgErrors[active] && (
          <Image
            src={slide.image}
            alt={slide.imageAlt}
            width={500}
            height={350}
            className="w-full max-w-xs object-contain"
            unoptimized
            onError={() => setImgErrors(prev => ({ ...prev, [active]: true }))}
          />
        )}
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="transition-all rounded-full cursor-pointer"
            style={{
              width: i === active ? 22 : 7,
              height: 7,
              background: i === active ? slide.accentColor : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>

      {/* Trust badges — SVG icons, no emoji */}
      <div className="border-t relative z-10" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-6 md:gap-10 overflow-x-auto no-scrollbar">
          {BADGES.map(b => (
            <div
              key={b}
              className="flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold whitespace-nowrap"
              style={{ color: slide.textColor, opacity: 0.85 }}
            >
              <span style={{ opacity: 0.6, fontSize: 11 }}>✓</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
