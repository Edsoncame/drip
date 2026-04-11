import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alquiler de MacBook para Empresas en Lima",
  description: "Equipa a tu equipo con MacBooks desde $85/mes. Sin CAPEX, factura con RUC, entrega en Lima en 24-48h. Ideal para startups, agencias y corporativos.",
  openGraph: {
    title: "Alquiler MacBook para Empresas | FLUX Perú",
    description: "MacBooks para tu equipo desde $85/mes. Sin comprar, factura con RUC, entrega express en Lima.",
  },
};

export default function EmpresasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
