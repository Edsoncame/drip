import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparar MacBooks",
  description: "Compara MacBook Air vs MacBook Pro lado a lado: chip, RAM, SSD, batería, peso y precio mensual de alquiler. Encuentra el modelo ideal para ti.",
  robots: { index: true, follow: true },
};

export default function CompararLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
