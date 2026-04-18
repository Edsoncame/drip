import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
  other: {
    // Evita que Chrome iOS sirva HTML cacheado del back-forward cache (bfcache)
    // cuando hacemos deploys del flujo KYC.
    "Cache-Control": "no-store, no-cache, must-revalidate",
  },
};

// force-dynamic + revalidate=0 garantizan que Next.js emita HTML fresco en
// cada request y que los CDN intermedios no puedan cachear esta ruta.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
