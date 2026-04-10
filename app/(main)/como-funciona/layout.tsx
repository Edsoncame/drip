import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "¿Cómo funciona?",
  description: "Renta tu MacBook en 6 pasos: elige el modelo, selecciona tu plan, completa el pago y recibe tu Mac en casa o en tu oficina en Lima en 24-48h.",
  openGraph: {
    title: "¿Cómo funciona? | FLUX",
    description: "Renta tu MacBook en minutos. Elige, paga y recibe en 24-48h en Lima.",
  },
};

export default function ComoFuncionaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
