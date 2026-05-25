"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SaleEquipment } from "@/app/api/sale-equipment/route";

const HERO_VIDEO = "https://orrhouuqrkvgo7yu.public.blob.vercel-storage.com/videos/macbook-certified-hero-long.mp4";

const CONDITION_LABEL: Record<string, string> = {
  Excelente: "Excelente",
  "Muy bueno": "Muy bueno",
  Bueno: "Bueno",
};

const CONDITION_COLOR: Record<string, string> = {
  Excelente: "bg-[#E5F3DF] text-[#2D7D46]",
  "Muy bueno": "bg-[#EEF2FF] text-[#1B4FFF]",
  Bueno: "bg-[#FFF8E5] text-[#B45309]",
};

function ConditionBadge({ condition }: { condition: string }) {
  const label = CONDITION_LABEL[condition] ?? condition;
  const color = CONDITION_COLOR[condition] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-700 ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function CertifiedHero() {
  return (
    <section className="relative overflow-hidden" style={{ background: "#0a0a0a", minHeight: 460 }}>
      {/* Video de fondo — loop infinito */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0, opacity: 0.85 }}
      >
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>

      {/* Gradiente oscuro izquierda → transparente derecha para legibilidad del texto */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.15) 100%)",
          zIndex: 1,
        }}
      />

      {/* Gradiente inferior para blend con el resto de la página */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.3))", zIndex: 1 }}
      />

      {/* Text content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20 relative" style={{ zIndex: 2 }}>
        <div className="max-w-[520px]">
          <span className="inline-block px-3 py-1 text-xs font-bold rounded-full mb-4 text-white border border-white/20 bg-white/10">
            FLUX Certified
          </span>

          <h1
            className="text-3xl md:text-5xl font-black leading-tight mb-3 text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            MacBooks que ya<br />vivieron. Ahora<br />son tuyos.
          </h1>

          <p className="text-sm md:text-base font-medium mb-6 leading-relaxed text-white/75">
            De nuestra flota de renta. Revisados en 15 puntos, con 90 días de garantía. Desde $380.
          </p>

          <a
            href="#catalogo"
            className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold rounded-full bg-[#1B4FFF] text-white hover:bg-[#1340CC] transition-colors active:scale-95"
          >
            Ver equipos disponibles
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>

      {/* Trust badges strip */}
      <div className="border-t relative" style={{ borderColor: "rgba(255,255,255,0.12)", zIndex: 2 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-6 md:gap-10 overflow-x-auto no-scrollbar">
          {["15 puntos revisados", "90 días de garantía", "Devolución en 7 días", "Despacho Lima en 24h"].map((b) => (
            <div key={b} className="flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold text-white/80 whitespace-nowrap">
              <span style={{ fontSize: 11, opacity: 0.6 }}>✓</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SaleCard({ item }: { item: SaleEquipment }) {
  return (
    <div className="group bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden hover:shadow-lg transition-all duration-200">
      {/* Imagen */}
      <div className="relative bg-[#F7F7F7] h-48 overflow-hidden flex items-center justify-center p-6">
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-[#1B4FFF] text-white text-[10px] font-700 rounded-full tracking-wide">
          FLUX Certified
        </div>
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.modelo_completo}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-6xl">💻</span>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-800 text-[#18191F] text-base leading-tight">{item.modelo_completo}</h3>
          <ConditionBadge condition={item.sale_condition} />
        </div>

        <div className="space-y-1 mb-4">
          {item.chip && (
            <p className="text-sm text-[#666666]">
              <span className="font-600">Chip</span> {item.chip}
            </p>
          )}
          {item.ram && (
            <p className="text-sm text-[#666666]">
              <span className="font-600">RAM</span> {item.ram}
            </p>
          )}
          {item.ssd && (
            <p className="text-sm text-[#666666]">
              <span className="font-600">SSD</span> {item.ssd}
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-[#F0F0F0]">
          <div className="mb-3">
            {item.precio_compra_usd ? (
              <p className="text-sm text-[#999999] line-through">
                Precio nuevo ${item.precio_compra_usd.toLocaleString("en-US")} USD
              </p>
            ) : null}
            <p className="text-2xl font-900 text-[#18191F]">
              ${item.sale_price_usd.toLocaleString("en-US")}
              <span className="text-sm font-500 text-[#999999] ml-1">USD</span>
            </p>
          </div>
          <Link
            href={`/comprar-checkout?id=${item.id}`}
            className="block w-full py-2.5 bg-[#1B4FFF] text-white text-sm font-700 rounded-full hover:bg-[#1340CC] transition-colors text-center"
          >
            Comprar ahora
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 px-4">
      <div className="w-20 h-20 bg-[#F0F4FF] rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">💻</span>
      </div>
      <h2 className="text-xl font-800 text-[#18191F] mb-2">Pronto disponible</h2>
      <p className="text-[#666666] mb-6 max-w-sm mx-auto">
        Estamos preparando la primera tanda de equipos FLUX Certified. Escríbenos y te avisamos cuando estén listos.
      </p>
      <a
        href="https://wa.me/51900164769?text=Hola,%20quiero%20saber%20cu%C3%A1ndo%20estarán%20disponibles%20los%20equipos%20FLUX%20Certified"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors"
      >
        Avísame por WhatsApp
      </a>
    </div>
  );
}

export default function ComprarPage() {
  const [equipment, setEquipment] = useState<SaleEquipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sale-equipment")
      .then((r) => (r.ok ? r.json() : { equipment: [] }))
      .then((data) => setEquipment(data.equipment ?? []))
      .catch(() => setEquipment([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <CertifiedHero />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10" id="catalogo">
        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#F7F7F7] rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        ) : equipment.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {equipment.map((item) => (
              <SaleCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}

        {/* ¿Por qué FLUX Certified? */}
        <div className="mt-14 mb-2">
          <h2 className="text-2xl font-black text-[#18191F] mb-2 text-center">¿Por qué FLUX Certified?</h2>
          <p className="text-center text-[#666666] text-sm mb-8">
            MacBooks que ya tienen kilómetros recorridos — revisados para que tú arranques sin sorpresas.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4"/>
                    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                  </svg>
                ),
                title: "15 puntos revisados",
                desc: "Batería, pantalla, puertos, teclado, altavoces y cámara. Nada se salva sin revisión.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                ),
                title: "90 días de garantía",
                desc: "Si falla algo de hardware después de comprarlo, nos hacemos cargo. Sin letra chica.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                ),
                title: "Devolución en 7 días",
                desc: "No te convenció, sin problema. 7 días para devolverlo sin preguntas.",
              },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-start gap-4 p-6 bg-white rounded-2xl border border-[#E5E5E5]">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-[#1B4FFF]">
                  {item.icon}
                </div>
                <div>
                  <p className="font-700 text-[#18191F] mb-1">{item.title}</p>
                  <p className="text-sm text-[#666666]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-12 p-6 rounded-2xl" style={{ background: "var(--primary-light)" }}>
          <h3 className="font-bold mb-2" style={{ color: "var(--primary)" }}>
            ¿Prefieres alquilar en vez de comprar?
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--medium-text)" }}>
            Renta un MacBook nuevo desde $85/mes. Sin pago inicial, con soporte incluido.
          </p>
          <Link
            href="/laptops"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full"
            style={{ background: "var(--primary)" }}
          >
            Ver MacBooks en renta
          </Link>
        </div>
      </div>
    </>
  );
}
