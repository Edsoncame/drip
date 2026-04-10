"use client";

import { useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { products } from "@/lib/products";

const ALL_SPEC_LABELS = ["Chip", "CPU", "GPU", "RAM", "SSD", "Pantalla", "Batería", "Peso"];

function getSpec(product: (typeof products)[0], label: string) {
  return product.specs.find(s => s.label === label)?.value ?? "—";
}

function ComparePage() {
  const searchParams = useSearchParams();
  const slugs = (searchParams.get("slugs") ?? "").split(",").filter(Boolean).slice(0, 3);
  const items = useMemo(
    () => slugs.map(s => products.find(p => p.slug === s)).filter(Boolean) as typeof products,
    [slugs]
  );

  if (items.length < 2) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="text-6xl mb-4">⚖️</div>
        <h1 className="text-2xl font-800 text-[#18191F] mb-2">Selecciona 2 o 3 MacBooks para comparar</h1>
        <p className="text-[#666666] mb-6">Ve al catálogo, elige los equipos y usa el botón de comparar en cada tarjeta.</p>
        <Link href="/laptops" className="px-6 py-3 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors">
          Ver catálogo
        </Link>
      </div>
    );
  }

  const colClass = items.length === 3
    ? "grid-cols-3"
    : "grid-cols-2";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/laptops" className="text-[#999999] hover:text-[#1B4FFF] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-800 text-[#18191F]">Comparar MacBooks</h1>
          <p className="text-sm text-[#666666]">Elige el que mejor se adapta a tu trabajo</p>
        </div>
      </div>

      {/* Product headers */}
      <div className={`grid ${colClass} gap-4 mb-6`}>
        {items.map((p, i) => (
          <motion.div
            key={p.slug}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="bg-white rounded-2xl p-5 border border-[#E5E5E5] text-center"
          >
            <div className="w-12 h-12 bg-[#F5F5F7] rounded-xl flex items-center justify-center text-2xl mx-auto mb-3">💻</div>
            <p className="font-800 text-[#18191F] text-sm leading-snug mb-1">{p.name}</p>
            <p className="text-xs text-[#666666] mb-3">{p.chip} · {p.ram}</p>
            {p.stock === 0 ? (
              <span className="inline-block text-xs font-600 text-red-500 bg-red-50 px-3 py-1 rounded-full">Agotado</span>
            ) : p.stock <= 3 ? (
              <span className="inline-block text-xs font-600 bg-orange-50 px-3 py-1 rounded-full" style={{ color: "#E8820C" }}>
                Últimas {p.stock} unidades
              </span>
            ) : (
              <span className="inline-block text-xs font-600 text-green-700 bg-green-50 px-3 py-1 rounded-full">Disponible</span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Pricing table */}
      <Section title="Precio mensual">
        <div className={`grid ${colClass} gap-4`}>
          {items.map(p => {
            const minPrice = Math.min(...p.pricing.map(x => x.price));
            const maxPrice = Math.max(...p.pricing.map(x => x.price));
            return (
              <div key={p.slug} className="bg-white rounded-xl p-4 border border-[#E5E5E5] text-center">
                <p className="text-2xl font-900 text-[#1B4FFF]">${minPrice}</p>
                <p className="text-xs text-[#999999]">desde /mes · hasta ${maxPrice}/mes</p>
                <div className="mt-3 space-y-1.5">
                  {p.pricing.map(pr => (
                    <div key={pr.months} className="flex justify-between text-xs text-[#666666]">
                      <span>{pr.months} meses</span>
                      <span className="font-700 text-[#18191F]">${pr.price}/mes</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Specs comparison */}
      <Section title="Especificaciones">
        <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
          {ALL_SPEC_LABELS.map((label, i) => {
            const values = items.map(p => getSpec(p, label));
            const allSame = values.every(v => v === values[0]);
            return (
              <div
                key={label}
                className={`grid gap-4 px-5 py-3.5 ${colClass} ${i > 0 ? "border-t border-[#F0F0F0]" : ""}`}
                style={{ gridTemplateColumns: `120px repeat(${items.length}, 1fr)` }}
              >
                <span className="text-xs font-600 text-[#999999] self-center">{label}</span>
                {values.map((val, j) => (
                  <span
                    key={j}
                    className={`text-sm font-600 self-center ${
                      !allSame && val === Math.max(...values.map(v => parseFloat(v) || 0)).toString()
                        ? "text-[#1B4FFF]"
                        : "text-[#18191F]"
                    }`}
                  >
                    {val}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </Section>

      {/* CTA row */}
      <Section title="¿Cuál eliges?">
        <div className={`grid ${colClass} gap-4`}>
          {items.map(p => (
            <Link
              key={p.slug}
              href={`/laptops/${p.slug}`}
              className={`block py-3.5 text-center font-700 text-sm rounded-full transition-all hover:opacity-90 ${
                p.stock === 0 ? "bg-[#E5E5E5] text-[#999999] pointer-events-none" : "bg-[#1B4FFF] text-white"
              }`}
            >
              {p.stock === 0 ? "Agotado" : `Rentar ${p.shortName} →`}
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-700 text-[#18191F] mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function CompararPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ComparePage />
    </Suspense>
  );
}
