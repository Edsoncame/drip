"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Product } from "@/lib/products";

const PLAN_LABELS: Record<number, string> = {
  8: "8 meses",
  16: "16 meses",
  24: "24 meses",
};

const PLAN_SAVINGS: Record<number, string> = {
  8: "",
  16: "Ahorra 18%",
  24: "Ahorra 27%",
};

export default function ProductDetail({ product }: { product: Product }) {
  const [selectedMonths, setSelectedMonths] = useState(product.pricing[0].months);
  const router = useRouter();

  const selected = product.pricing.find(p => p.months === selectedMonths)!;
  const total = selected.price * selected.months;

  const handleCTA = () => {
    router.push(`/checkout?slug=${product.slug}&months=${selectedMonths}`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-4 py-3 text-sm text-[#999999]">
          <a href="/" className="hover:text-[#1B4FFF] transition-colors">Inicio</a>
          <span className="mx-2">/</span>
          <a href="/laptops" className="hover:text-[#1B4FFF] transition-colors">MacBooks</a>
          <span className="mx-2">/</span>
          <span className="text-[#333333]">{product.shortName}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left — Image */}
          <div className="sticky top-24">
            <div className="bg-[#F7F7F7] rounded-2xl p-10 flex items-center justify-center aspect-square relative overflow-hidden">
              {product.badge && (
                <div className="absolute top-4 left-4 bg-[#1B4FFF] text-white text-xs font-700 px-3 py-1 rounded-full">
                  {product.badge}
                </div>
              )}
              <img
                src={product.image}
                alt={product.name}
                className="w-full max-w-sm object-contain drop-shadow-xl"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = "none";
                  t.parentElement!.innerHTML += `<div style="font-size:120px;opacity:0.15;user-select:none;text-align:center;position:absolute;">💻</div>`;
                }}
              />
            </div>
            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { icon: "🚚", label: "Entrega en Lima" },
                { icon: "🔒", label: "Pago seguro" },
                { icon: "↩️", label: "Sin permanencia" },
              ].map(b => (
                <div key={b.label} className="bg-[#F7F7F7] rounded-xl p-3 text-center">
                  <div className="text-xl mb-1">{b.icon}</div>
                  <div className="text-xs font-500 text-[#666666]">{b.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Info + Plan selector */}
          <div>
            {/* Header */}
            <div className="mb-6">
              <p className="text-sm font-600 text-[#1B4FFF] uppercase tracking-wider mb-2">MacBook</p>
              <h1 className="text-3xl font-800 text-[#18191F] mb-2">{product.name}</h1>
              <div className="flex items-center gap-3 text-sm text-[#666666]">
                <span>{product.chip}</span>
                <span>·</span>
                <span>{product.ram}</span>
                <span>·</span>
                <span>{product.ssd}</span>
                <span>·</span>
                <span>{product.color}</span>
              </div>
            </div>

            {/* Plan selector */}
            <div className="mb-6">
              <h2 className="text-base font-700 text-[#18191F] mb-3">Elige tu plan</h2>
              <div className="space-y-3">
                {product.pricing.map(plan => (
                  <motion.button
                    key={plan.months}
                    onClick={() => setSelectedMonths(plan.months)}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                      selectedMonths === plan.months
                        ? "border-[#1B4FFF] bg-[#EEF2FF]"
                        : "border-[#E5E5E5] bg-white hover:border-[#BBCAFF]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedMonths === plan.months ? "border-[#1B4FFF]" : "border-[#CCCCCC]"
                      }`}>
                        {selectedMonths === plan.months && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#1B4FFF]" />
                        )}
                      </div>
                      <div>
                        <p className="font-700 text-[#18191F]">{PLAN_LABELS[plan.months]}</p>
                        {PLAN_SAVINGS[plan.months] && (
                          <p className="text-xs font-600 text-[#2D7D46]">{PLAN_SAVINGS[plan.months]}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-800 text-[#18191F]">
                        ${plan.price}<span className="text-sm font-500 text-[#666666]">/mes</span>
                      </p>
                      <p className="text-xs text-[#999999]">Total ${plan.price * plan.months}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Summary box */}
            <div className="bg-[#F7F7F7] rounded-2xl p-5 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-[#666666]">Renta mensual</span>
                <span className="font-700 text-[#18191F]">${selected.price}/mes</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-[#666666]">Duración</span>
                <span className="font-700 text-[#18191F]">{selected.months} meses</span>
              </div>
              <div className="border-t border-[#E5E5E5] pt-2 mt-2 flex justify-between items-center">
                <span className="text-sm font-600 text-[#333333]">Primer cobro hoy</span>
                <span className="text-lg font-800 text-[#1B4FFF]">${selected.price}</span>
              </div>
            </div>

            {/* CTA */}
            <motion.button
              onClick={handleCTA}
              whileTap={{ scaleX: 1.06, scaleY: 0.91 }}
              transition={{ type: "spring", stiffness: 700, damping: 30 }}
              className="w-full py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-lg hover:bg-[#1340CC] transition-colors cursor-pointer"
            >
              Rentar por ${selected.price}/mes
            </motion.button>

            <p className="text-center text-xs text-[#999999] mt-3">
              Sin deuda, sin matrícula. Cancela con 30 días de aviso.
            </p>

            {/* Specs */}
            <div className="mt-8">
              <h2 className="text-base font-700 text-[#18191F] mb-4">Especificaciones</h2>
              <div className="divide-y divide-[#E5E5E5]">
                {product.specs.map(spec => (
                  <div key={spec.label} className="flex justify-between py-3 text-sm">
                    <span className="text-[#666666]">{spec.label}</span>
                    <span className="font-600 text-[#333333]">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Includes */}
            <div className="mt-6">
              <h2 className="text-base font-700 text-[#18191F] mb-3">Incluye</h2>
              <ul className="space-y-2">
                {product.includes.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-[#333333]">
                    <span className="text-[#2D7D46] font-700">✓</span>
                    {item}
                  </li>
                ))}
                <li className="flex items-center gap-2 text-sm text-[#333333]">
                  <span className="text-[#2D7D46] font-700">✓</span>
                  Entrega en tu empresa (Lima)
                </li>
                <li className="flex items-center gap-2 text-sm text-[#333333]">
                  <span className="text-[#2D7D46] font-700">✓</span>
                  Soporte técnico incluido
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
