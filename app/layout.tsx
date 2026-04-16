import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { OrganizationJsonLd, LocalBusinessJsonLd } from "@/components/JsonLd";
import "./globals.css";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "FLUX: Alquiler de MacBook para empresas en Lima, Perú",
    template: "%s | FLUX — Alquiler de MacBook en Perú",
  },
  description:
    "Alquiler de MacBook Air y MacBook Pro para empresas y profesionales en Lima, Perú. Renta mensual desde $85 con beneficios tributarios, soporte técnico y entrega en 24-48h. Cotiza online.",
  keywords: [
    // Peruvian primary terms
    "alquiler de MacBook",
    "alquiler de MacBook Peru",
    "alquiler de MacBook Lima",
    "alquiler de Mac para empresas",
    "alquiler de laptops Apple",
    "renta de MacBook Peru",
    "renta de MacBook Lima",
    "arrendamiento de MacBook",
    "arrendamiento de laptops Peru",
    "leasing MacBook Peru",
    "leasing operativo laptops Peru",
    // B2B keywords (matching Leasein)
    "alquiler de laptops para empresas",
    "alquiler de computadoras para empresas",
    "empresa de alquiler de equipos Peru",
    "hardware as a service Peru",
    "HaaS Peru",
    // Long tail
    "alquiler MacBook Air Lima",
    "alquiler MacBook Pro empresas",
    "MacBook mensual empresas Peru",
    "renta laptops Apple Lima",
    "alquiler Apple para startups Lima",
    // Brand
    "FLUX Peru",
    "FLUX alquiler MacBook",
    "fluxperu",
  ],
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: BASE_URL,
    siteName: "FLUX — Alquiler de MacBook en Perú",
    title: "FLUX: Alquiler de MacBook para empresas en Lima, Perú",
    description:
      "Alquiler mensual de MacBook Air y MacBook Pro desde $85. Entrega en Lima en 24-48h, soporte técnico incluido y beneficios tributarios. Cotiza online en segundos.",
    // images auto-detected from app/opengraph-image.png
  },
  twitter: {
    card: "summary_large_image",
    title: "FLUX: Alquiler de MacBook en Lima, Perú",
    description:
      "Renta de MacBook Air y Pro para empresas y profesionales. Desde $85/mes, entrega en 24-48h, soporte técnico incluido.",
    // images auto-detected from app/twitter-image.png
  },
  alternates: {
    canonical: BASE_URL,
    languages: { "es-PE": BASE_URL },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  // Verificación de propiedad para Search Console y Bing Webmaster.
  // Los valores se leen desde env vars — si no están seteadas, no aparecen.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? "",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <head>
        {/* Impide que Google auto-traduzca "FLUX" -> "FLUJO" en los resultados.
            La página ya está en español; el único término en inglés es la
            marca, y no queremos que se traduzca como si fuera un sustantivo. */}
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="es-PE" />
        {/* Favicon explícito con cache-buster para forzar a Google a re-scrapear */}
        <link rel="icon" href="/icon.png?v=2" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=2" />
        {GTM_ID && (
          <Script id="gtm-head" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        )}
        {GA4_ID && (
          <>
            <Script
              id="ga4-gtag"
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            />
            <Script id="ga4-config" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}');`}
            </Script>
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col" style={{ fontFamily: "Inter, sans-serif" }}>
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <OrganizationJsonLd />
        <LocalBusinessJsonLd />
        {children}
      </body>
    </html>
  );
}
