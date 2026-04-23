import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import {
  fetchDashboardSnapshot,
  type DashboardSnapshot,
} from "@/lib/kpi-queries";
import AdminNav from "../AdminNav";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard | Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PrefetchResult {
  snapshot: DashboardSnapshot | null;
  error: string | null;
}

async function prefetch(): Promise<PrefetchResult> {
  try {
    const snapshot = await fetchDashboardSnapshot();
    return { snapshot, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { snapshot: null, error: msg };
  }
}

export default async function DashboardPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const { snapshot, error } = await prefetch();

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#E5E5E5] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="FLUX" className="h-7 w-auto" />
          <span className="text-xs font-600 px-2 py-0.5 bg-[#1B4FFF] text-white rounded-full">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#999999] hidden sm:block">
            {session.email}
          </span>
          <Link
            href="/"
            className="text-sm text-[#666666] hover:text-[#1B4FFF] transition-colors"
          >
            ← Sitio
          </Link>
        </div>
      </div>

      <AdminNav />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-6 bg-[#FFF5F5] border border-[#D84040]/30 rounded-2xl p-4">
            <p className="text-sm font-700 text-[#D84040] mb-1">
              ⚠️ Error al cargar el dashboard
            </p>
            <p className="text-xs text-[#666] font-mono whitespace-pre-wrap break-all">
              {error}
            </p>
            <p className="text-xs text-[#666] mt-2">
              Revisá los logs en Vercel o recargá la página.
            </p>
          </div>
        )}

        {snapshot && <DashboardClient snapshot={snapshot} />}

        {!snapshot && !error && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center">
            <p className="text-[#999]">Sin datos disponibles</p>
          </div>
        )}
      </div>
    </div>
  );
}
