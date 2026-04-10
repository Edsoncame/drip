import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Para Empresas",
  description: "Equipa a tu equipo con MacBooks desde $80/mes. Sin CAPEX, sin trámites largos. Factura con RUC, entrega en Lima en 24-48h. Ideal para startups y empresas.",
  openGraph: {
    title: "Para Empresas | FLUX",
    description: "MacBooks para tu equipo desde $80/mes. Sin comprar, factura con RUC, entrega express en Lima.",
  },
};

export default function EmpresasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
