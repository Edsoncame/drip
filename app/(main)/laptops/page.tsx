import ProductCard from "@/components/ProductCard";
import { products } from "@/lib/products";

export default function LaptopsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black mb-2" style={{ color: "var(--dark-text)" }}>MacBooks en drip</h1>
        <p style={{ color: "var(--medium-text)" }}>Los mejores modelos Apple. Sin comprarlos. Solo paga por mes.</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-1">
        {["Todos", "MacBook Air", "MacBook Pro", "Chip M4", "Chip M5"].map(f => (
          <button key={f} className="flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-full transition-all border-2"
            style={{
              background: f === "Todos" ? "var(--primary)" : "transparent",
              color: f === "Todos" ? "#fff" : "var(--medium-text)",
              borderColor: f === "Todos" ? "var(--primary)" : "var(--border)"
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map(p => <ProductCard key={p.slug} product={p} />)}
      </div>

      {/* Info footer */}
      <div className="mt-12 p-6 rounded-2xl" style={{ background: "var(--primary-light)" }}>
        <h3 className="font-bold mb-2" style={{ color: "var(--primary)" }}>¿Necesitas más de 5 equipos?</h3>
        <p className="text-sm mb-4" style={{ color: "var(--medium-text)" }}>Para flotas corporativas tenemos precios especiales y contratos marco. Contáctanos y armamos el plan en 24h.</p>
        <a href="/empresas" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full" style={{ background: "var(--primary)" }}>
          Ver planes empresas
        </a>
      </div>
    </div>
  );
}
