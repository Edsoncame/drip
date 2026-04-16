import type { Metadata } from "next";
import Link from "next/link";
import { getProducts } from "@/lib/products";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  title: "Alquiler de MacBook Air en Lima — desde $85/mes",
  description:
    "Renta una MacBook Air M4 de 13 o 15 pulgadas en Lima desde $85/mes. Ligera, potente, ideal para profesionales. Entrega en 24-48h, soporte incluido.",
  alternates: { canonical: `${BASE}/alquiler-macbook-air-lima` },
};

export const revalidate = 86400;

export default async function LandingMacAirPage() {
  const products = await getProducts();
  const airs = products.filter((p) => p.name.toLowerCase().includes("air"));

  return (
    <div className="bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: BASE },
          { name: "Alquiler MacBook Air Lima", url: `${BASE}/alquiler-macbook-air-lima` },
        ]}
      />

      <section className="py-16 md:py-20 bg-[#F5F5F7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-800 text-[#18191F] mb-4">
            Alquiler de MacBook Air en Lima
          </h1>
          <p className="text-lg text-[#666] max-w-2xl mx-auto leading-relaxed">
            La MacBook más vendida del Perú, ahora en alquiler mensual. Sin comprarla,
            sin depósito, con entrega en Lima en 24-48 horas.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/laptops?filter=air"
              className="px-6 py-3 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors"
            >
              Ver MacBook Air disponibles
            </Link>
            <a
              href="https://wa.me/51900164769"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 border border-[#E5E5E5] text-[#333] font-700 rounded-full hover:bg-white transition-colors"
            >
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {airs.map((p) => {
              const lowest = Math.min(...p.pricing.map((pr) => pr.price));
              return (
                <Link
                  key={p.slug}
                  href={`/laptops/${p.slug}`}
                  className="group bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden hover:border-[#1B4FFF] transition-colors"
                >
                  <div className="aspect-video bg-[#F7F7F7]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="p-6">
                    <p className="font-700 text-[#18191F] text-xl mb-1">{p.name}</p>
                    <p className="text-sm text-[#666] mb-4">
                      {p.chip} · {p.ram} · {p.ssd} · {p.color}
                    </p>
                    <div className="space-y-1.5 text-sm">
                      {p.pricing.map((pr) => (
                        <div key={pr.months} className="flex justify-between">
                          <span className="text-[#666]">Plan {pr.months} meses</span>
                          <span className="font-700 text-[#18191F]">${pr.price}/mes</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm mt-4 text-[#1B4FFF] font-700 group-hover:underline">
                      Desde ${lowest}/mes →
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#F7F7F7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-800 text-[#18191F] mb-6 text-center">
            ¿Para quién es la MacBook Air?
          </h2>
          <ul className="space-y-3 text-[#333]">
            {[
              "Profesionales independientes (diseñadores, desarrolladores, marketers)",
              "Estudiantes universitarios que necesitan un equipo confiable y portátil",
              "Equipos de startups y agencias en crecimiento",
              "Trabajadores remotos que buscan ligereza y autonomía de batería",
              "Cualquier persona que valora simplicidad, velocidad y diseño",
            ].map((text) => (
              <li key={text} className="flex items-start gap-3">
                <span className="text-[#1B4FFF] mt-0.5">✓</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
