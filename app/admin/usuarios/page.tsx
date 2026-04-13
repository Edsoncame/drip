import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import UsuariosClient, { AdminUser } from "./UsuariosClient";

export const metadata: Metadata = {
  title: "Usuarios | Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const result = await query<AdminUser>(
    `SELECT id, name, email, created_at, avatar_url, is_admin, is_super_admin
     FROM users
     WHERE is_admin = true
     ORDER BY is_super_admin DESC, created_at ASC`
  );

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
          <a href="/" className="text-sm text-[#666666] hover:text-[#1B4FFF] transition-colors">← Sitio</a>
        </div>
      </div>

      <AdminNav />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
        <UsuariosClient
          users={result.rows}
          currentEmail={session.email.toLowerCase()}
          isSuperAdmin={session.isSuperAdmin}
        />
      </div>
    </div>
  );
}
