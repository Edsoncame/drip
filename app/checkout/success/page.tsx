"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getProduct } from "@/lib/products";

function SuccessContent() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const slug = searchParams.get("slug") ?? "";
  const months = parseInt(searchParams.get("months") ?? "8", 10);
  const name = searchParams.get("name") ?? "";
  const email = searchParams.get("email") ?? "";

  const product = getProduct(slug);
  const plan = product?.pricing.find(p => p.months === months);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center py-10 px-4">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <a href="/" className="block text-center mb-8">
          <span className="text-3xl font-900 text-[#18191F] tracking-tight">flux</span>
        </a>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl p-8 shadow-sm text-center"
        >
          {/* Checkmark */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
            className="w-20 h-20 bg-[#E5F3DF] rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M10 20L17 27L30 13"
                stroke="#2D7D46"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          <h1 className="text-2xl font-800 text-[#18191F] mb-2">
            ¡Listo{name ? `, ${name.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-[#666666] mb-8">
            Tu renta está confirmada. Te escribiremos pronto para coordinar la entrega.
          </p>

          {/* Order card */}
          {product && plan && (
            <div className="bg-[#F7F7F7] rounded-2xl p-5 text-left mb-6">
              <p className="text-xs font-700 text-[#999999] uppercase tracking-wider mb-3">Resumen de tu orden</p>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#E5E5E5]">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
                  💻
                </div>
                <div>
                  <p className="font-700 text-[#18191F]">{product.name}</p>
                  <p className="text-sm text-[#666666]">{product.chip} · {product.ram}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#666666]">Plan</span>
                  <span className="font-600 text-[#18191F]">{months} meses</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">Renta mensual</span>
                  <span className="font-600 text-[#18191F]">${plan.price}/mes</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E5E5E5]">
                  <span className="font-700 text-[#333333]">Cobrado hoy</span>
                  <span className="font-800 text-[#1B4FFF]">${plan.price}</span>
                </div>
              </div>
            </div>
          )}

          {/* Next steps */}
          <div className="text-left mb-8">
            <p className="text-sm font-700 text-[#333333] mb-3">¿Qué sigue?</p>
            <div className="space-y-3">
              {[
                { icon: "📧", text: `Recibirás un correo de confirmación en ${email || "tu email"}` },
                { icon: "📞", text: "Te llamaremos en las próximas 24 horas hábiles para coordinar la entrega" },
                { icon: "🚚", text: "Tu Mac llega a tu empresa en Lima en 24-48 horas hábiles" },
                { icon: "💳", text: "Los meses siguientes se cobrarán automáticamente" },
              ].map(item => (
                <div key={item.text} className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <p className="text-sm text-[#666666]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <a
            href="/laptops"
            className="block w-full py-4 rounded-full bg-[#1B4FFF] text-white font-700 text-base hover:bg-[#1340CC] transition-colors text-center mb-3"
          >
            Ver más MacBooks
          </a>
          <a
            href="/"
            className="block w-full py-3 rounded-full border border-[#E5E5E5] text-[#666666] font-600 text-sm hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors text-center"
          >
            Volver al inicio
          </a>
        </motion.div>

        <p className="text-center text-xs text-[#999999] mt-6">
          ¿Tienes preguntas? Escríbenos a{" "}
          <a href="mailto:hola@flux.pe" className="text-[#1B4FFF]">hola@flux.pe</a>
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
        <div className="text-[#666666] font-600">Cargando…</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
