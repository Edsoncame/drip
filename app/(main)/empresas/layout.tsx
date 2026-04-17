import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  title: "MacBooks para empresas en Lima | Renting desde $85/mes · FLUX",
  description:
    "Alquila MacBooks para tu empresa en Lima sin CAPEX. Entrega en 24h, factura con RUC, MDM incluido. Planes desde $85/mes para startups, agencias y corporativos. Cotiza gratis.",
  keywords: [
    "alquiler macbook empresas lima",
    "renting macbook peru",
    "macbook para empresas peru",
    "alquiler laptops apple empresas",
    "hardware as a service peru",
    "leasing macbook peru",
    "renta macbook lima",
  ],
  openGraph: {
    title: "La Mac que tu empresa necesita, hoy · FLUX Perú",
    description:
      "MacBooks para tu equipo desde $85/mes. Sin comprar, sin CAPEX. Entrega en Lima en 24h, factura con RUC, MDM incluido. Cotiza gratis.",
    url: `${BASE_URL}/empresas`,
    type: "website",
    locale: "es_PE",
    siteName: "FLUX — Alquiler de MacBook en Perú",
  },
  twitter: {
    card: "summary_large_image",
    title: "MacBooks para empresas en Lima | FLUX Perú",
    description:
      "Renta de MacBook para tu equipo desde $85/mes. Entrega en 24h, factura con RUC. Sin CAPEX.",
  },
  alternates: {
    canonical: `${BASE_URL}/empresas`,
  },
};

export default function EmpresasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
