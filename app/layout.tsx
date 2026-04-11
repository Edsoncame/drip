import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: "FLUX — Tu Mac. Sin comprarla.", template: "%s | FLUX" },
  description: "Renta MacBook Air o MacBook Pro desde $80/mes. Sin comprar, sin CAPEX. Entrega en Lima en 24-48h. Ideal para empresas y startups.",
  keywords: ["rentar MacBook Lima", "alquiler laptop empresa Peru", "MacBook mensual", "FLUX", "renta Mac Lima"],
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: BASE_URL,
    siteName: "FLUX",
    title: "FLUX — Tu Mac. Sin comprarla.",
    description: "Renta MacBook Air o MacBook Pro desde $80/mes. Sin comprar, sin CAPEX. Entrega en Lima en 24-48h.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "FLUX — Renta de MacBooks en Lima" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FLUX — Tu Mac. Sin comprarla.",
    description: "Renta MacBook desde $80/mes. Entrega en Lima en 24-48h.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <head>
        {GTM_ID && (
          <Script id="gtm-head" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
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
        {children}
      </body>
    </html>
  );
}
