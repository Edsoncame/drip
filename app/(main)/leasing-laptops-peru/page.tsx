import type { Metadata } from "next";
import Link from "next/link";
import BuyVsRentCalculator from "@/components/BuyVsRentCalculator";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  title: "Leasing de laptops en Perú — MacBook desde $85/mes",
  description:
    "Leasing operativo de MacBook para empresas en Perú. Convierte capital en gasto deducible, soporte técnico incluido, sin depósito. Cotiza online en segundos.",
  alternates: { canonical: `${BASE}/leasing-laptops-peru` },
};

export const revalidate = 86400;

export default function LeasingPage() {
  return (
    <div className="bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: BASE },
          { name: "Leasing de laptops Perú", url: `${BASE}/leasing-laptops-peru` },
        ]}
      />

      <section className="py-16 md:py-20 bg-[#18191F] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-700 uppercase tracking-wider opacity-70 mb-3">
            Hardware as a Service
          </p>
          <h1 className="text-4xl md:text-5xl font-800 mb-5 leading-tight">
            Leasing de laptops MacBook en Perú
          </h1>
          <p className="text-lg opacity-80 max-w-2xl mx-auto leading-relaxed">
            FLUX ofrece leasing operativo de MacBook Air y MacBook Pro para empresas en
            Lima. Convierte el costo de equipos en un gasto operativo mensual deducible
            de impuestos.
          </p>
          <Link
            href="/empresas#cotizar"
            className="inline-block mt-8 px-7 py-3.5 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors"
          >
            Cotizar leasing online
          </Link>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-800 text-[#18191F] mb-6">
            Diferencia entre leasing operativo, leasing financiero y compra
          </h2>
          <div className="space-y-5 text-[#333] leading-relaxed">
            <p>
              En el Perú, las empresas tienen tres formas principales de adquirir equipos
              tecnológicos:
            </p>
            <div className="bg-[#F7F7F7] rounded-2xl p-6 border border-[#E5E5E5]">
              <h3 className="font-700 text-[#18191F] mb-2">1. Compra directa</h3>
              <p className="text-sm text-[#666]">
                Pagas el equipo completo de una vez. Requiere capital inicial alto, los
                equipos se deprecian en tu balance, y el soporte técnico corre por tu
                cuenta. Es la opción tradicional pero la menos eficiente desde el punto
                de vista financiero.
              </p>
            </div>
            <div className="bg-[#F7F7F7] rounded-2xl p-6 border border-[#E5E5E5]">
              <h3 className="font-700 text-[#18191F] mb-2">2. Leasing financiero</h3>
              <p className="text-sm text-[#666]">
                Un banco compra el equipo y te lo arrienda con opción de compra al final.
                Requiere evaluación crediticia, garantías y aparece como pasivo en tu
                balance. Plazos típicos de 24 a 60 meses.
              </p>
            </div>
            <div className="bg-[#1B4FFF]/5 border-2 border-[#1B4FFF] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-700 text-[#18191F]">3. Leasing operativo (lo que ofrece FLUX)</h3>
                <span className="text-[10px] font-700 px-2 py-0.5 rounded-full bg-[#1B4FFF] text-white">
                  Recomendado
                </span>
              </div>
              <p className="text-sm text-[#666]">
                Pagas una cuota mensual fija que cubre el equipo y el soporte. No requiere
                garantías ni capital inicial. Es 100% gasto operativo deducible (no aparece
                como pasivo). Al final del plazo puedes renovar, devolver o comprar el
                equipo por su valor residual.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#F7F7F7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <BuyVsRentCalculator />
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-800 text-[#18191F] mb-6">
            Beneficios tributarios del leasing operativo en Perú
          </h2>
          <ul className="space-y-3 text-[#333]">
            {[
              "100% del pago mensual es deducible como gasto operativo (artículo 37 LIR)",
              "No incrementa el activo fijo de la empresa, manteniendo ratios financieros saludables",
              "Crédito fiscal del IGV recuperable en cada factura mensual",
              "No requiere depreciación contable (la lleva el dueño del activo, FLUX)",
              "Ideal para empresas que quieren mantener liquidez sin renunciar a equipo de calidad",
            ].map((text) => (
              <li key={text} className="flex items-start gap-3">
                <span className="text-[#1B4FFF] font-700 mt-0.5">✓</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#999] mt-6 italic">
            * Esta información es referencial. Consulta a tu contador o asesor tributario
            para la aplicación específica a tu empresa.
          </p>
        </div>
      </section>
    </div>
  );
}
