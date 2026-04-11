import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi Cuenta",
  robots: { index: false, follow: false },
};

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
