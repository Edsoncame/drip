import type { Metadata } from "next";
import Link from "next/link";
import { getProducts } from "@/lib/products";
import BuyVsRentCalculator from "@/components/BuyVsRentCalculator";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  title: "Alquiler de MacBook para empresas en Lima — desde $85/mes",
  description:
    "Alquila MacBook Air o MacBook Pro para tu empresa en Lima sin comprometer capital. Soporte técnico incluido, factura SUNAT, entrega 24-48h. Cotiza online.",
  alternates: { canonical: `${BASE}/alquiler-macbook-empresas-lima` },
};

export const revalidate = 86400;

export default async function LandingEmpresasLimaPage() {
  const products = await getProducts();

  return (
    <div className="bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: BASE },
          { name: "Alquiler MacBook empresas Lima", url: `${BASE}/alquiler-macbook-empresas-lima` },
        ]}
      />

      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#1B4FFF] to-[#102F99] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-700 uppercase tracking-wider opacity-80 mb-3">
            Para empresas en Lima
          </p>
          <h1 className="text-4xl md:text-6xl font-800 mb-5 leading-tight">
            Alquiler de MacBook para empresas en Lima
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto leading-relaxed">
            Equipa a tu equipo con MacBook Air o MacBook Pro pagando una cuota mensual fija.
            Sin invertir capital, con soporte técnico y factura electrónica SUNAT incluida.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/empresas#cotizar"
              className="px-6 py-3.5 bg-white text-[#1B4FFF] font-700 rounded-full hover:bg-[#F7F7F7] transition-colors"
            >
              Pedir cotización gratis
            </Link>
            <a
              href="https://wa.me/51900164769"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3.5 border border-white/30 text-white font-700 rounded-full hover:bg-white/10 transition-colors"
            >
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Por qué FLUX */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider mb-2">
              Por qué empresas eligen FLUX
            </p>
            <h2 className="text-3xl md:text-4xl font-800 text-[#18191F]">
              Más liquidez, menos depreciación
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Sin CAPEX",
                desc: "Convierte un gasto de capital en gasto operativo deducible. Tu liquidez intacta.",
                icon: "💰",
              },
              {
                title: "Beneficio tributario",
                desc: "El alquiler es 100% deducible como gasto operativo en SUNAT. Mejor que comprar.",
                icon: "📄",
              },
              {
                title: "Soporte 24-48h",
                desc: "Si una MacBook falla, te enviamos un reemplazo en 48 horas hábiles. Sin perder productividad.",
                icon: "⚡",
              },
              {
                title: "Renovación automática",
                desc: "Cada 16 o 24 meses puedes cambiar tus equipos por modelos nuevos. Tu equipo siempre con lo último de Apple.",
                icon: "🔄",
              },
              {
                title: "Factura electrónica SUNAT",
                desc: "Emitimos factura cada mes con tu RUC. Ideal para deducción de impuestos y cumplimiento.",
                icon: "✓",
              },
              {
                title: "Entrega en Lima",
                desc: "Entregamos en cualquier oficina de Lima Metropolitana en 24-48 horas hábiles.",
                icon: "🚚",
              },
            ].map((f) => (
              <div key={f.title} className="bg-[#F7F7F7] rounded-2xl p-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-700 text-[#18191F] text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-[#666] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calculadora */}
      <section className="py-16 bg-[#F7F7F7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <BuyVsRentCalculator />
        </div>
      </section>

      {/* Catálogo resumido */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-800 text-[#18191F] mb-2">
              MacBooks disponibles
            </h2>
            <p className="text-sm text-[#666]">
              Modelos con stock para entrega inmediata en Lima.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.slice(0, 6).map((p) => {
              const lowest = Math.min(...p.pricing.map((pr) => pr.price));
              return (
                <Link
                  key={p.slug}
                  href={`/laptops/${p.slug}`}
                  className="group bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden hover:border-[#1B4FFF] transition-colors"
                >
                  <div className="aspect-video bg-[#F7F7F7] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="p-5">
                    <p className="font-700 text-[#18191F] mb-1">{p.name}</p>
                    <p className="text-xs text-[#666] mb-3">
                      {p.chip} · {p.ram} · {p.ssd}
                    </p>
                    <p className="text-sm">
                      Desde <span className="font-800 text-[#1B4FFF]">${lowest}/mes</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/laptops"
              className="inline-block px-6 py-3 border border-[#E5E5E5] text-[#333] font-700 rounded-full hover:border-[#1B4FFF] hover:text-[#1B4FFF] transition-colors"
            >
              Ver catálogo completo
            </Link>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 bg-[#18191F] text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-800 mb-3">
            Listo para equipar tu equipo
          </h2>
          <p className="text-lg opacity-80 mb-6">
            Cotización personalizada en menos de 24 horas. Sin compromiso.
          </p>
          <Link
            href="/empresas#cotizar"
            className="inline-block px-8 py-4 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors"
          >
            Pedir cotización gratis
          </Link>
        </div>
      </section>
    </div>
  );
}
