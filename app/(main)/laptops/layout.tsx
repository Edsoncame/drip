import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MacBooks disponibles",
  description: "Explora nuestra selección de MacBook Air y MacBook Pro con chip M4 y M5. Renta desde $80/mes, sin entrada, entrega en Lima en 24-48h.",
  openGraph: {
    title: "MacBooks disponibles | FLUX",
    description: "MacBook Air M4 desde $80/mes · MacBook Pro M4/M5 desde $105/mes. Sin comprar, sin CAPEX.",
  },
};

export default function LaptopsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
