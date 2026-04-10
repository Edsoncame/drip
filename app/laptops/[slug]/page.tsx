"use client";
import { getProduct, products } from "@/lib/products";
import { notFound } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProduct(params.slug);
  if (!product) notFound();

  const [selectedPlan, setSelectedPlan] = useState(product.pricing[1]); // default 16m
  const [showSpecs, setShowSpecs] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: "var(--light-text)" }}>
        <Link href="/" className="hover:underline">Inicio</Link>
        <span>/</span>
        <Link href="/laptops" className="hover:underline">MacBooks</Link>
        <span>/</span>
        <span style={{ color: "var(--dark-text)" }}>{product.shortName}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

        {/* LEFT — Image */}
        <div>
          <div className="rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center aspect-square mb-4"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            <div className="text-center p-8">
              <div className="text-9xl mb-4">💻</div>
              <div className="text-sm font-semibold" style={{ color: "var(--medium-text)" }}>
                {product.chip} · {product.ram} · {product.ssd}
              </div>
            </div>
          </div>
          {/* Thumbnails placeholder */}
          <div className="flex gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-2xl cursor-pointer border-2"
                style={{ borderColor: i === 1 ? "var(--primary)" : "transparent" }}>
                💻
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Info & CTA */}
        <div>
          {/* Badge */}
          {product.badge && (
            <span className="inline-block px-3 py-1 text-xs font-bold text-white rounded-full mb-3" style={{ background: "var(--primary)" }}>
              {product.badge}
            </span>
          )}

          <h1 className="text-2xl font-black mb-1" style={{ color: "var(--dark-text)" }}>{product.name}</h1>
          <p className="text-sm mb-6" style={{ color: "var(--medium-text)" }}>{product.ram} · {product.ssd} · {product.color}</p>

          {/* Duration selector — Grover style */}
          <div className="mb-5">
            <p className="text-sm font-bold mb-3" style={{ color: "var(--dark-text)" }}>
              Elige tu plazo mínimo
            </p>
            <div className="flex gap-2">
              {product.pricing.map(plan => (
                <button key={plan.months} onClick={() => setSelectedPlan(plan)}
                  className="relative flex-1 py-3 rounded-2xl border-2 transition-all font-bold text-sm"
                  style={{
                    borderColor: selectedPlan.months === plan.months ? "var(--primary)" : "var(--border)",
                    background: selectedPlan.months === plan.months ? "var(--primary-light)" : "#fff",
                    color: selectedPlan.months === plan.months ? "var(--primary)" : "var(--medium-text)",
                  }}>
                  {plan.months}+
                  <span className="block text-xs font-normal">meses</span>
                  {plan.months === 16 && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 text-xs font-bold text-white rounded-full whitespace-nowrap"
                      style={{ background: "var(--primary)", fontSize: 10 }}>
                      Popular
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Benefits checklist */}
          <div className="space-y-2 mb-5">
            {[
              "Sin depósito de garantía",
              `Cancela desde el mes ${selectedPlan.months + 1}`,
              "Entrega en Lima en 24-48h",
              "MDM disponible para empresas",
            ].map(b => (
              <div key={b} className="flex items-center gap-2 text-sm" style={{ color: "var(--dark-text)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {b}
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="p-5 rounded-2xl mb-5" style={{ background: "var(--light-bg)" }}>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-4xl font-black" style={{ color: "var(--dark-text)" }}>${selectedPlan.price}</span>
              <span className="text-base font-semibold mb-1" style={{ color: "var(--medium-text)" }}>/mes</span>
            </div>
            <p className="text-xs" style={{ color: "var(--light-text)" }}>
              Total {selectedPlan.months} meses: ${selectedPlan.price * selectedPlan.months} USD · IGV no incluido
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--green-text)", background: "var(--green)", display: "inline-block", padding: "2px 8px", borderRadius: 999 }}>
              ✓ Opción de compra al residual incluida
            </p>
          </div>

          {/* CTA */}
          <motion.button whileTap={{ scale: 0.97 }}
            className="w-full py-4 text-white font-black text-base rounded-full mb-3 transition-all hover:opacity-90"
            style={{ background: "var(--primary)" }}>
            Solicitar ahora — ${selectedPlan.price}/mes
          </motion.button>
          <button className="w-full py-3.5 font-bold text-sm rounded-full border-2 hover:bg-gray-50 transition-all"
            style={{ borderColor: "var(--border)", color: "var(--dark-text)" }}>
            Hablar con un asesor
          </button>

          <p className="text-xs text-center mt-3" style={{ color: "var(--light-text)" }}>
            El primer mes se cobra al confirmar el pedido · Sujeto a evaluación
          </p>

          {/* Specs */}
          <div className="mt-8 rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            <button className="w-full flex items-center justify-between p-4 font-bold text-sm"
              style={{ color: "var(--dark-text)" }} onClick={() => setShowSpecs(!showSpecs)}>
              Especificaciones técnicas
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: showSpecs ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showSpecs && (
              <div className="border-t" style={{ borderColor: "var(--border)" }}>
                {product.specs.map((s, i) => (
                  <div key={s.label} className="flex justify-between px-4 py-2.5 text-sm"
                    style={{ background: i % 2 === 0 ? "var(--light-bg)" : "#fff" }}>
                    <span style={{ color: "var(--medium-text)" }}>{s.label}</span>
                    <span className="font-semibold" style={{ color: "var(--dark-text)" }}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related products */}
      <div className="mt-16">
        <h2 className="text-2xl font-black mb-6" style={{ color: "var(--dark-text)" }}>También te puede interesar</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.filter(p => p.slug !== product.slug).map(p => {
            const minPrice = Math.min(...p.pricing.map(pr => pr.price));
            return (
              <Link key={p.slug} href={`/laptops/${p.slug}`}
                className="flex items-center gap-4 p-4 rounded-2xl border hover:shadow-md transition-all"
                style={{ borderColor: "var(--border)" }}>
                <div className="text-4xl">💻</div>
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--dark-text)" }}>{p.shortName}</p>
                  <p className="text-xs" style={{ color: "var(--light-text)" }}>{p.chip} · {p.ram}</p>
                  <p className="text-sm font-black mt-1" style={{ color: "var(--primary)" }}>desde ${minPrice}/mes</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
