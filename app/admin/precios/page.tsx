import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import PricingTable from "./PricingTable";
import PriceCalculator from "./PriceCalculator";

export const metadata: Metadata = {
  title: "Precios | Admin FLUX",
  robots: { index: false, follow: false },
};

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());

interface PricingRow {
  id: string;
  modelo: string;
  plan: string;
  precio_usd: string;
  residual_pct: string | null;
  channel: string;
}

export default async function PreciosPage() {
  const session = await getSession();
  if (!session || !ADMIN_EMAILS.includes(session.email.toLowerCase())) redirect("/");

  const result = await query<PricingRow>(`SELECT * FROM pricing ORDER BY channel, modelo, plan`);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#E5E5E5] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/isotipoflux.svg" alt="Flux" className="h-7 w-auto" />
          <div className="flex items-center gap-2">
            <span className="font-800 text-[#18191F]">flux</span>
            <span className="text-xs font-600 px-2 py-0.5 bg-[#1B4FFF] text-white rounded-full">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#999999] hidden sm:block">{session.email}</span>
          <a href="/" className="text-sm text-[#666666] hover:text-[#1B4FFF] transition-colors">← Sitio</a>
        </div>
      </div>

      <AdminNav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-800 text-[#18191F]">Precios de alquiler</h1>
          <p className="text-sm text-[#999999] mt-0.5">Matriz de precios por modelo y plan · haz clic para editar</p>
        </div>

        <PricingTable pricing={result.rows} />

        <PriceCalculator />

        <div className="mt-6 bg-white rounded-2xl border border-[#E5E5E5] p-5">
          <h3 className="font-700 text-[#18191F] mb-3 text-sm">Referencia de planes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#666]">
            <div><span className="font-700 text-[#333]">Estreno 8m</span> — Equipo nuevo, contrato 8 meses. Residual 77.5%</div>
            <div><span className="font-700 text-[#333]">Estreno 16m</span> — Equipo nuevo, contrato 16 meses. Residual 55%</div>
            <div><span className="font-700 text-[#333]">Estreno 24m</span> — Equipo nuevo, contrato 24 meses. Residual 32.5%</div>
            <div><span className="font-700 text-[#333]">Re-alquiler 8m (usado 8m)</span> — Después de un contrato de 8m, otro de 8m. Residual 55%</div>
            <div><span className="font-700 text-[#333]">Re-alquiler 8m (usado 16m)</span> — Después de un contrato de 16m, otro de 8m. Residual 32.5%</div>
            <div><span className="font-700 text-[#333]">Re-alquiler 16m (usado 8m)</span> — Después de un contrato de 8m, otro de 16m. Residual 32.5%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
