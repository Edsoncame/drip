import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import EquipmentTable, { Equipment } from "./EquipmentTable";

export const metadata: Metadata = {
  title: "Inventario | Admin FLUX",
  robots: { index: false, follow: false },
};

export default async function InventarioPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const [equipmentResult] = await Promise.all([
    query<Equipment>(`SELECT * FROM equipment ORDER BY codigo_interno`),
  ]);

  // Stats
  const equipment = equipmentResult.rows;
  const arrendadas = equipment.filter(e => e.estado_actual.startsWith("Arrendada")).length;
  const disponibles = equipment.filter(e => e.estado_actual === "Disponible").length;
  const mrr = equipment
    .filter(e => e.estado_actual.startsWith("Arrendada"))
    .reduce((sum, e) => sum + Number(e.tarifa_usd ?? 0), 0);
  const costoTotal = equipment.reduce((sum, e) => sum + Number(e.precio_compra_usd ?? 0), 0);

  // Maintenance alerts
  const alertas = equipment.filter(e => {
    if (!e.mantenimiento_proximo) return false;
    const days = Math.ceil((new Date(e.mantenimiento_proximo).getTime() - Date.now()) / 86400000);
    return days <= 30;
  }).length;

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

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-800 text-[#18191F]">Inventario</h1>
          <p className="text-sm text-[#999999] mt-0.5">Gestión completa de equipos</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total equipos",    value: equipment.length,              icon: "💻" },
            { label: "Arrendados",       value: arrendadas,                    icon: "✅", highlight: false },
            { label: "Disponibles",      value: disponibles,                   icon: "🟢", highlight: disponibles > 0 },
            { label: "MRR inventario",   value: `$${mrr.toFixed(0)}`,          icon: "💰" },
            { label: "Costo total",      value: `$${costoTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, icon: "🧾" },
          ].map(s => (
            <div key={s.label} className={`bg-white rounded-2xl p-5 border ${(s as { highlight?: boolean }).highlight ? "border-green-300 bg-green-50" : "border-[#E5E5E5]"}`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-2xl font-800 text-[#18191F]">{s.value}</p>
              <p className="text-xs text-[#666666] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {alertas > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 mb-6 flex items-start gap-3 text-sm">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <span className="text-orange-800 font-600">
              {alertas} equipo{alertas > 1 ? "s" : ""} con mantenimiento en los próximos 30 días.
            </span>
          </div>
        )}

        <EquipmentTable equipment={equipment} />
      </div>
    </div>
  );
}
