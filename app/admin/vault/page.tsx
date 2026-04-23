import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import VaultClient from "./VaultClient";

export const metadata: Metadata = {
  title: "Vault | Admin FLUX",
  robots: { index: false, follow: false },
};

export default async function VaultPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <div className="bg-white border-b border-[#E5E5E5] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="FLUX" className="h-7 w-auto" />
          <span className="text-xs font-600 px-2 py-0.5 bg-[#1B4FFF] text-white rounded-full">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#999999] hidden sm:block">{session.email}</span>
          <Link href="/" className="text-sm text-[#666666] hover:text-[#1B4FFF] transition-colors">← Sitio</Link>
        </div>
      </div>

      <AdminNav />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-800 text-[#18191F]">Vault de credenciales</h1>
          <p className="text-sm text-[#999999] mt-0.5">
            Acceso restringido · contraseñas encriptadas con AES-256-GCM
          </p>
        </div>
        <VaultClient />
      </div>
    </div>
  );
}
