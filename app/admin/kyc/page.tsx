import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { listKycCases } from "@/lib/kyc/admin-cases";
import AdminNav from "../AdminNav";
import KycReview from "./KycReview";

export const metadata: Metadata = {
  title: "KYC · Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export type { KycCase } from "@/lib/kyc/admin-cases";

export default async function AdminKycPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");
  // Lee TODAS las fuentes de KYC (pipeline propio + Drop Validation).
  const cases = await listKycCases();

  const stats = await query<{ status: string; n: string }>(`
    SELECT COALESCE(kyc_status, 'pending') AS status, COUNT(*)::text AS n
    FROM users WHERE kyc_status IS NOT NULL
    GROUP BY kyc_status
  `);
  const statMap: Record<string, number> = {};
  for (const r of stats.rows) statMap[r.status] = parseInt(r.n, 10);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <AdminNav />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-800 text-[#18191F]">🛡️ KYC</h1>
          <p className="text-sm text-[#999999] mt-0.5">
            Verificación de identidad — revisá casos en review antes de aprobar clientes nuevos.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="🟡 Review" n={statMap.review ?? 0} color="amber" />
          <StatCard label="🔴 Rechazados" n={statMap.rejected ?? 0} color="red" />
          <StatCard label="✅ Verificados" n={statMap.verified ?? 0} color="green" />
          <StatCard label="⏳ Pending" n={statMap.pending ?? 0} color="gray" />
        </div>

        <KycReview cases={cases} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  n,
  color,
}: {
  label: string;
  n: number;
  color: "amber" | "red" | "green" | "gray";
}) {
  const bg = {
    amber: "bg-amber-50 border-amber-200",
    red: "bg-red-50 border-red-200",
    green: "bg-green-50 border-green-200",
    gray: "bg-gray-50 border-gray-200",
  }[color];
  return (
    <div className={`rounded-2xl border ${bg} p-4`}>
      <p className="text-xs font-600 text-[#666]">{label}</p>
      <p className="text-2xl font-800 text-[#18191F] mt-1">{n}</p>
    </div>
  );
}
