import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  title: "FLUX vs Leasein — Comparativa alquiler de laptops Perú 2026",
  description:
    "Comparamos FLUX y Leasein: especialización, precios, plazos, soporte, tecnología y experiencia de usuario. Cuál conviene según tu perfil de empresa.",
  alternates: { canonical: `${BASE}/flux-vs-leasein` },
};

export const revalidate = 86400;

export default function FluxVsLeaseinPage() {
  return (
    <div className="bg-white">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: BASE },
          { name: "FLUX vs Leasein", url: `${BASE}/flux-vs-leasein` },
        ]}
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-[#F7F7F7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-700 text-[#1B4FFF] uppercase tracking-wider mb-3">
            Comparativa objetiva
          </p>
          <h1 className="text-4xl md:text-5xl font-800 text-[#18191F] mb-4 leading-tight">
            FLUX vs Leasein: ¿cuál conviene para tu empresa?
          </h1>
          <p className="text-lg text-[#666] max-w-2xl mx-auto">
            Dos alternativas peruanas para alquilar laptops empresariales. Esta es una comparativa
            honesta y basada en información pública de ambas empresas.
          </p>
        </div>
      </section>

      {/* Quick summary */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-[#1B4FFF] text-white rounded-2xl p-6">
              <p className="text-xs font-700 uppercase opacity-80 mb-2">FLUX</p>
              <h2 className="text-2xl font-800 mb-4">Especialización Apple</h2>
              <ul className="space-y-2 text-sm opacity-95">
                <li>✓ 100% MacBook — la única opción Apple-first en Perú</li>
                <li>✓ Precios transparentes desde $85/mes</li>
                <li>✓ Plazos cortos desde 8 meses</li>
                <li>✓ B2C + B2B (personas y empresas)</li>
                <li>✓ Plataforma web moderna (Next.js)</li>
                <li>✓ Calculadora online comprar vs alquilar</li>
              </ul>
            </div>
            <div className="bg-[#F7F7F7] rounded-2xl p-6">
              <p className="text-xs font-700 uppercase text-[#666] mb-2">Leasein</p>
              <h2 className="text-2xl font-800 text-[#18191F] mb-4">Alquiler multi-marca</h2>
              <ul className="space-y-2 text-sm text-[#333]">
                <li>· Ofrece HP, Lenovo, Dell y Apple</li>
                <li>· Precios por cotización (no visibles online)</li>
                <li>· Plazos típicos más largos</li>
                <li>· Solo B2B (solo empresas)</li>
                <li>· Website WordPress tradicional</li>
                <li>· 4,000+ empresas clientes según su sitio</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed comparison */}
      <section className="py-12 bg-[#F7F7F7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-800 text-[#18191F] mb-8 text-center">
            Comparativa detallada
          </h2>

          <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F7F7]">
                <tr>
                  <th className="text-left px-5 py-4 font-700 text-[#666]">Dimensión</th>
                  <th className="text-left px-5 py-4 font-700 text-[#1B4FFF]">FLUX</th>
                  <th className="text-left px-5 py-4 font-700 text-[#666]">Leasein</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {[
                  {
                    dim: "Especialización",
                    flux: "100% MacBook Apple",
                    leasein: "HP, Lenovo, Dell, Apple",
                  },
                  {
                    dim: "Precios públicos",
                    flux: "Desde $85/mes visible online",
                    leasein: "Solo por cotización",
                  },
                  {
                    dim: "Plazo mínimo",
                    flux: "8 meses",
                    leasein: "Típicamente 12-24 meses",
                  },
                  {
                    dim: "Cliente objetivo",
                    flux: "Personas + empresas",
                    leasein: "Solo empresas",
                  },
                  {
                    dim: "Entrega",
                    flux: "24-48h en Lima",
                    leasein: "48h en Lima",
                  },
                  {
                    dim: "Facturación SUNAT",
                    flux: "Factura electrónica automática",
                    leasein: "Factura electrónica",
                  },
                  {
                    dim: "Soporte técnico",
                    flux: "Incluido + reemplazo 48h",
                    leasein: "Incluido + mesa de servicio regional",
                  },
                  {
                    dim: "Opción de compra final",
                    flux: "Sí, con valor residual transparente (77.5/55/32.5%)",
                    leasein: "Sí, a negociar",
                  },
                  {
                    dim: "Calculadora online",
                    flux: "Sí (comprar vs alquilar)",
                    leasein: "No",
                  },
                  {
                    dim: "Plataforma",
                    flux: "App moderna Next.js (fast)",
                    leasein: "WordPress",
                  },
                  {
                    dim: "Historial",
                    flux: "Nuevo (2026)",
                    leasein: "Establecido con 4,000+ clientes",
                  },
                ].map((row) => (
                  <tr key={row.dim} className="hover:bg-[#FAFBFF]">
                    <td className="px-5 py-3.5 font-700 text-[#18191F]">{row.dim}</td>
                    <td className="px-5 py-3.5 text-[#333]">{row.flux}</td>
                    <td className="px-5 py-3.5 text-[#666]">{row.leasein}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-800 text-[#18191F] mb-8 text-center">¿Cuál elegir?</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-2 border-[#1B4FFF] rounded-2xl p-6">
              <h3 className="font-800 text-xl text-[#1B4FFF] mb-4">Elige FLUX si...</h3>
              <ul className="space-y-2 text-sm text-[#333]">
                <li>
                  ✓ Tu empresa o equipo necesita <strong>específicamente MacBook</strong> (diseño,
                  desarrollo iOS, video, marketing creativo)
                </li>
                <li>✓ Valoras <strong>precios transparentes</strong> sin tener que cotizar</li>
                <li>✓ Necesitas un <strong>plazo corto</strong> (8 meses) por flexibilidad</li>
                <li>
                  ✓ Eres <strong>freelancer, estudiante o startup temprana</strong> que necesita una
                  laptop personal
                </li>
                <li>✓ Te importa la <strong>experiencia digital moderna</strong> (self-service online)</li>
                <li>
                  ✓ Buscas <strong>valor residual claro</strong> si planeas comprar al final
                </li>
              </ul>
            </div>

            <div className="border border-[#E5E5E5] rounded-2xl p-6">
              <h3 className="font-800 text-xl text-[#666] mb-4">Elige Leasein si...</h3>
              <ul className="space-y-2 text-sm text-[#333]">
                <li>
                  · Tu empresa necesita <strong>múltiples marcas</strong> (HP, Lenovo, Dell) además
                  de Apple
                </li>
                <li>
                  · Buscas un proveedor con <strong>mayor historial</strong> y referencias de miles
                  de empresas
                </li>
                <li>
                  · Prefieres un proceso más <strong>corporativo tradicional</strong> con cotización
                  y negociación
                </li>
                <li>
                  · Tu empresa es <strong>muy grande</strong> y necesita leasing financiero además
                  del operativo
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8 bg-[#F7F7F7]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="text-xs text-[#999] text-center italic">
            Esta comparativa se basa en información pública de ambos sitios web a abril de 2026.
            Leasein es una marca de su respectivo propietario. FLUX es marca de Tika Services S.A.C.
            (RUC 20605702512). Si eres de Leasein y quieres actualizar información sobre tu empresa
            en esta página, escríbenos a hola@fluxperu.com.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-[#1B4FFF] to-[#102F99] text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-800 mb-3">
            ¿MacBook es lo que necesitas?
          </h2>
          <p className="text-lg opacity-90 mb-6">
            Somos los especialistas. Desde $85/mes, con entrega en Lima en 24-48h.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/laptops"
              className="px-6 py-3.5 bg-white text-[#1B4FFF] font-700 rounded-full hover:bg-[#F7F7F7] transition-colors"
            >
              Ver catálogo FLUX
            </Link>
            <Link
              href="/empresas#cotizar"
              className="px-6 py-3.5 border border-white/30 text-white font-700 rounded-full hover:bg-white/10 transition-colors"
            >
              Pedir cotización
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
