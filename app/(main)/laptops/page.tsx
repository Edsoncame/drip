"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import { products } from "@/lib/products";

const FILTERS = ["Todos", "MacBook Air", "MacBook Pro", "Chip M4", "Chip M5"];

function filterProducts(active: string) {
  if (active === "Todos") return products;
  if (active === "MacBook Air") return products.filter(p => p.name.includes("Air"));
  if (active === "MacBook Pro") return products.filter(p => p.name.includes("Pro"));
  if (active === "Chip M4") return products.filter(p => p.chip === "Apple M4");
  if (active === "Chip M5") return products.filter(p => p.chip === "Apple M5");
  return products;
}

function LaptopsContent() {
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const [imageSets, setImageSets] = useState<Record<string, { open: string }>>({});

  const getInitialFilter = () => {
    if (urlFilter === "air") return "MacBook Air";
    if (urlFilter === "pro") return "MacBook Pro";
    return "Todos";
  };

  const [active, setActive] = useState(getInitialFilter);
  const filtered = filterProducts(active);

  useEffect(() => {
    setActive(getInitialFilter());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter]);

  useEffect(() => {
    fetch("/api/apple-images")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setImageSets(data); })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black mb-2" style={{ color: "var(--dark-text)" }}>MacBooks en flux</h1>
        <p style={{ color: "var(--medium-text)" }}>Los mejores modelos Apple. Sin comprarlos. Solo paga por mes.</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map(f => (
          <button key={f}
            onClick={() => setActive(f)}
            className="flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-full transition-all border-2 cursor-pointer"
            style={{
              background: active === f ? "var(--primary)" : "transparent",
              color: active === f ? "#fff" : "var(--medium-text)",
              borderColor: active === f ? "var(--primary)" : "var(--border)",
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(p => (
            <ProductCard key={p.slug} product={p} imageUrl={imageSets[p.slug]?.open} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-[#999999] text-lg">No hay resultados para ese filtro.</p>
          <button onClick={() => setActive("Todos")} className="mt-4 text-[#1B4FFF] font-600 hover:underline cursor-pointer">
            Ver todos los equipos
          </button>
        </div>
      )}

      {/* Info footer */}
      <div className="mt-12 p-6 rounded-2xl" style={{ background: "var(--primary-light)" }}>
        <h3 className="font-bold mb-2" style={{ color: "var(--primary)" }}>¿Necesitas más de 5 equipos?</h3>
        <p className="text-sm mb-4" style={{ color: "var(--medium-text)" }}>
          Para flotas corporativas tenemos precios especiales y contratos marco. Contáctanos y armamos el plan en 24h.
        </p>
        <a href="/empresas"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full"
          style={{ background: "var(--primary)" }}>
          Ver planes empresas
        </a>
      </div>
    </div>
  );
}

export default function LaptopsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-10 text-[#999999]">Cargando…</div>}>
      <LaptopsContent />
    </Suspense>
  );
}
