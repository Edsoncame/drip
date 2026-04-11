import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MacBooks en Alquiler — Air y Pro con M4/M5",
  description: "Alquila MacBook Air M4 desde $85/mes o MacBook Pro M4/M5 desde $110/mes en Lima. Sin entrada, sin depósito, entrega en 24-48h.",
  openGraph: {
    title: "MacBooks en Alquiler | FLUX Perú",
    description: "MacBook Air M4 desde $85/mes · MacBook Pro M4/M5 desde $110/mes. Sin comprar, sin CAPEX. Entrega en Lima.",
  },
};

export default function LaptopsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
