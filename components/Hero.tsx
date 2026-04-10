"use client";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";

const CDN = "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is";

const slides = [
  {
    tag: "MacBook Pro — Apple M5",
    title: "La Mac más potente.\nAhora en goteo mensual.",
    subtitle: "Desde $115/mes · Sin comprar · Sin CAPEX · Entrega a tu empresa",
    cta: "Ver MacBook Pro",
    href: "/laptops/macbook-pro-14-m5",
    bg: "#0a0a0a",
    textColor: "#FFFFFF",
    accentColor: "#1B4FFF",
    type: "video" as const,
    video: "https://www.apple.com/105/media/us/macbook-pro/2025/785e1bc4-d1bd-4cf4-b1b3-94b9411c9e74/anim/hero/large.mp4",
    poster: "https://www.apple.com/v/macbook-pro/ax/images/overview/welcome/hero_endframe__fwev9ebh42mq_large.jpg",
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
    type: "image" as const,
    image: `${CDN}/macbook-air-size-unselect-202601-gallery-1?wid=1200&hei=770&fmt=png-alpha&qlt=95`,
    imageAlt: "MacBook Air 13 y 15 pulgadas M4",
  },
  {
    tag: "Para empresas",
    title: "Equipa a tu equipo\ncon Mac. Sin inversión.",
    subtitle: "Contratos flexibles, MDM incluido, opción de compra para colaboradores.",
    cta: "Conocer planes empresa",
    href: "/empresas",
    bg: "#0d1b4b",
    textColor: "#FFFFFF",
    accentColor: "#FFFFFF",
    type: "video" as const,
    video: "https://www.apple.com/105/media/us/macbook-air/2026/ff11cb38-708e-4c28-9653-1b01a2f8fd2b/anim/hero/large.mp4",
    poster: "https://www.apple.com/v/macbook-air/z/images/overview/hero/hero_endframe__c67cz35iy9me_large.png",
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
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, []);

  // Restart video when Pro slide becomes active
  useEffect(() => {
    if (slides[active].type === "video" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [active]);

  const slide = slides[active];

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: slide.bg, height: 460, transition: "background 0.6s ease" }}
    >
      {/* ── VIDEO SLIDE (MacBook Pro) ─────────────────────────── */}
      {slides.map((s, i) =>
        s.type === "video" ? (
          <video
            key="pro-video"
            ref={i === active ? videoRef : undefined}
            autoPlay
            muted
            loop
            playsInline
            poster={s.poster}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ zIndex: 0, opacity: active === i ? 1 : 0, pointerEvents: "none" }}
          >
            <source src={s.video} type="video/mp4" />
          </video>
        ) : null
      )}

      {/* Dark overlay on video slide so text is readable */}
      {slide.type === "video" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 55%, transparent 100%)", zIndex: 1 }}
        />
      )}

      {/* ── IMAGE SLIDE (Air / Empresas) — right column ──────── */}
      <AnimatePresence mode="wait">
        {slide.type === "image" && !imgError[active] && (
          <motion.div
            key={`img-${active}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute right-0 top-0 bottom-0 hidden md:flex items-center justify-end"
            style={{ width: "48%", zIndex: 1 }}
          >
            <Image
              src={(slide as { image: string }).image}
              alt={slide.imageAlt}
              width={1200}
              height={770}
              className="w-full h-full"
              style={{ objectFit: "contain", objectPosition: "right center", padding: "12px 24px 12px 0" }}
              unoptimized
              priority={active > 0}
              onError={() => setImgError(prev => ({ ...prev, [active]: true }))}
            />
            {/* Left-edge blend */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `linear-gradient(to right, ${slide.bg} 0%, ${slide.bg}bb 12%, transparent 32%)` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TEXT CONTENT ─────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-14 relative" style={{ zIndex: 2 }}>
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
                  border: "1px solid rgba(255,255,255,0.22)",
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

              {/* Dots — inline, no overlap */}
              <div className="flex items-center gap-2 mt-6">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className="transition-all rounded-full cursor-pointer"
                    style={{
                      width: i === active ? 22 : 7,
                      height: 7,
                      background:
                        i === active
                          ? slide.accentColor
                          : slide.textColor === "#18191F"
                          ? "rgba(0,0,0,0.25)"
                          : "rgba(255,255,255,0.35)",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile image */}
      <div className="md:hidden px-6 pb-8 flex justify-center">
        {slide.type === "image" && !imgError[active] && (
          <Image
            src={(slide as { image: string }).image}
            alt={slide.imageAlt}
            width={500}
            height={320}
            className="w-full max-w-xs object-contain"
            unoptimized
            onError={() => setImgError(prev => ({ ...prev, [active]: true }))}
          />
        )}
      </div>

      {/* Trust badges */}
      <div className="border-t relative" style={{ borderColor: "rgba(255,255,255,0.12)", zIndex: 2 }}>
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
