"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/lib/use-products";
import type { Product } from "@/lib/products";

const FILTERS = ["Todos", "MacBook Air", "MacBook Pro", "Chip M4", "Chip M5", "16 GB", "Novedades"];

function searchProducts(products: Product[], q: string) {
  const lower = q.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(lower) ||
    p.chip.toLowerCase().includes(lower) ||
    p.ram.toLowerCase().includes(lower) ||
    p.ssd.toLowerCase().includes(lower) ||
    p.shortName.toLowerCase().includes(lower)
  );
}

function filterProducts(products: Product[], active: string) {
  if (active === "Todos") return products;
  if (active === "MacBook Air") return products.filter(p => p.name.includes("Air"));
  if (active === "MacBook Pro") return products.filter(p => p.name.includes("Pro"));
  if (active === "Chip M4") return products.filter(p => p.chip === "Apple M4");
  if (active === "Chip M5") return products.filter(p => p.chip === "Apple M5");
  if (active === "16 GB") return products.filter(p => p.ram?.includes("16"));
  if (active === "Novedades") return products.filter(p => p.isNew || p.badge);
  return products;
}

function LaptopsContent() {
  const { products } = useProducts();
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const urlQuery = searchParams.get("q") ?? "";
  const [imageSets, setImageSets] = useState<Record<string, { open: string }>>({});
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [searchInput, setSearchInput] = useState(urlQuery);

  const getInitialFilter = () => {
    if (urlFilter === "air") return "MacBook Air";
    if (urlFilter === "pro") return "MacBook Pro";
    if (urlFilter === "m4") return "Chip M4";
    if (urlFilter === "m5") return "Chip M5";
    if (urlFilter === "16gb") return "16 GB";
    if (urlFilter === "new") return "Novedades";
    return "Todos";
  };

  const [active, setActive] = useState(getInitialFilter);

  useEffect(() => { setActive(getInitialFilter()); }, [urlFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSearchInput(urlQuery); }, [urlQuery]);

  useEffect(() => {
    fetch("/api/apple-images")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setImageSets(data); })
      .catch(() => {});

    fetch("/api/stock")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStockMap(data); })
      .catch(() => {});
  }, []);

  const filtered = urlQuery
    ? searchProducts(products, urlQuery)
    : filterProducts(products, active);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black mb-2" style={{ color: "var(--dark-text)" }}>MacBooks en flux</h1>
        <p style={{ color: "var(--medium-text)" }}>Los mejores modelos Apple. Sin comprarlos. Solo paga por mes.</p>
      </div>

      {/* Mobile search */}
      <form
        className="mb-5 md:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          const q = searchInput.trim();
          window.location.href = q ? `/laptops?q=${encodeURIComponent(q)}` : "/laptops";
        }}
      >
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Busca tu Mac..."
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
          />
        </div>
      </form>

      {/* Search result header */}
      {urlQuery ? (
        <div className="flex items-center gap-3 mb-6">
          <p className="text-sm text-[#666666]">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para <strong>&quot;{urlQuery}&quot;</strong>
          </p>
          <Link href="/laptops" className="text-xs text-[#1B4FFF] font-600 hover:underline">Limpiar</Link>
        </div>
      ) : (
        /* Filter pills */
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
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(p => (
            <ProductCard
              key={p.slug}
              product={p.slug in stockMap ? { ...p, stock: stockMap[p.slug] } : p}
              imageUrl={imageSets[p.slug]?.open ?? p.image}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-[#999999] text-lg mb-2">No encontramos resultados.</p>
          <Link href="/laptops" className="text-[#1B4FFF] font-600 hover:underline cursor-pointer">
            Ver todos los equipos
          </Link>
        </div>
      )}

      {/* Info footer */}
      <div className="mt-12 p-6 rounded-2xl" style={{ background: "var(--primary-light)" }}>
        <h3 className="font-bold mb-2" style={{ color: "var(--primary)" }}>¿Necesitas más de 5 equipos?</h3>
        <p className="text-sm mb-4" style={{ color: "var(--medium-text)" }}>
          Para flotas corporativas tenemos precios especiales y contratos marco. Contáctanos y armamos el plan en 24h.
        </p>
        <Link href="/empresas"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full"
          style={{ background: "var(--primary)" }}>
          Ver planes empresas
        </Link>
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
