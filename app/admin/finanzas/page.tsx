import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";

export const metadata: Metadata = {
  title: "Finanzas | Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;


interface Row {
  id: string;
  codigo_interno: string;
  modelo_completo: string;
  tipo_financiamiento: string | null;
  cuota_credito_soles: string | null;
  plazo_credito_meses: number | null;
  fecha_compra: string | null;
  factura_url: string | null;
}

function fmtSoles(n: number) {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// First cuota is due one month after purchase date.
// Count how many due dates have already passed (i.e. cuotas pagadas).
function cuotasPagadas(fechaCompra: string | null, plazo: number): number {
  if (!fechaCompra || plazo <= 0) return 0;
  const start = new Date(fechaCompra);
  const now = new Date();
  let count = 0;
  for (let i = 1; i <= plazo; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    if (due <= now) count++;
  }
  return count;
}

function nextDueDate(fechaCompra: string | null, plazo: number): string | null {
  if (!fechaCompra || plazo <= 0) return null;
  const start = new Date(fechaCompra);
  const now = new Date();
  for (let i = 1; i <= plazo; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    if (due > now) return due.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  }
  return null; // all paid
}

export default async function FinanzasPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const result = await query<Row>(
    `SELECT id, codigo_interno, modelo_completo, tipo_financiamiento, cuota_credito_soles,
            plazo_credito_meses, fecha_compra, factura_url
     FROM equipment
     WHERE cuota_credito_soles IS NOT NULL AND cuota_credito_soles::numeric > 0
     ORDER BY tipo_financiamiento, codigo_interno`
  );

  // Group by financing source
  const groups = new Map<string, Row[]>();
  for (const r of result.rows) {
    const key = r.tipo_financiamiento || "Sin especificar";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  // Global totals (only for active — plazo not exhausted)
  let totalMensual = 0;
  let totalPendiente = 0;
  let totalPagado = 0;
  let activos = 0;

  const groupStats = Array.from(groups.entries()).map(([banco, rows]) => {
    let mensualGrupo = 0;
    let pendienteGrupo = 0;
    let pagadoGrupo = 0;
    const enriched = rows.map(r => {
      const cuota = Number(r.cuota_credito_soles) || 0;
      const plazo = r.plazo_credito_meses || 0;
      const pagados = cuotasPagadas(r.fecha_compra, plazo);
      const restantes = Math.max(0, plazo - pagados);
      const pendiente = cuota * restantes;
      if (restantes > 0) {
        mensualGrupo += cuota;
        pendienteGrupo += pendiente;
        activos++;
      }
      totalMensual += restantes > 0 ? cuota : 0;
      totalPendiente += pendiente;
      totalPagado += cuota * pagados;
      pagadoGrupo += cuota * pagados;
      return { ...r, cuota, plazo, pagados, restantes, pendiente, proximo: nextDueDate(r.fecha_compra, plazo) };
    });
    return { banco, rows: enriched, mensualGrupo, pendienteGrupo, pagadoGrupo };
  });

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
        <div className="mb-6">
          <h1 className="text-2xl font-800 text-[#18191F]">Finanzas · Pagos a bancos</h1>
          <p className="text-sm text-[#999999] mt-0.5">Cuotas mensuales pendientes por banco/tarjeta — vista para contador</p>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-[#E5E5E5]">
            <div className="text-2xl mb-2">📅</div>
            <p className="text-2xl font-800 text-[#18191F]">{fmtSoles(totalMensual)}</p>
            <p className="text-xs text-[#666666] mt-1">A pagar este mes</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-green-200 bg-green-50">
            <div className="text-2xl mb-2">✓</div>
            <p className="text-2xl font-800 text-green-700">{fmtSoles(totalPagado)}</p>
            <p className="text-xs text-green-700 mt-1">Ya pagado a la fecha</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#E5E5E5]">
            <div className="text-2xl mb-2">💳</div>
            <p className="text-2xl font-800 text-[#18191F]">{fmtSoles(totalPendiente)}</p>
            <p className="text-xs text-[#666666] mt-1">Deuda pendiente</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#E5E5E5]">
            <div className="text-2xl mb-2">💻</div>
            <p className="text-2xl font-800 text-[#18191F]">{activos}</p>
            <p className="text-xs text-[#666666] mt-1">Equipos con financiamiento activo</p>
          </div>
        </div>

        {/* Groups by bank/card */}
        {groupStats.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 text-center">
            <p className="text-[#999]">Sin equipos con financiamiento activo</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupStats.map(group => (
              <div key={group.banco} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
                <div className="px-6 py-4 bg-[#F7F8FB] border-b border-[#E5E5E5] flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="font-700 text-[#18191F] text-lg">{group.banco}</h2>
                    <p className="text-xs text-[#666] mt-0.5">{group.rows.length} equipo{group.rows.length > 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex gap-6 text-right flex-wrap">
                    <div>
                      <p className="text-[10px] text-[#999] uppercase">Cuota mensual</p>
                      <p className="font-800 text-[#1B4FFF] text-lg">{fmtSoles(group.mensualGrupo)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-green-700 uppercase">Ya pagado</p>
                      <p className="font-800 text-green-700 text-lg">{fmtSoles(group.pagadoGrupo)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#999] uppercase">Pendiente</p>
                      <p className="font-800 text-[#18191F] text-lg">{fmtSoles(group.pendienteGrupo)}</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-[#F0F0F0] bg-white">
                        {["Código", "Modelo", "Cuota mensual", "Plazo", "Pagado", "Restante", "Próximo pago", "Factura"].map(h => (
                          <th key={h} className="px-6 py-2 text-[11px] font-700 text-[#999] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map(r => (
                        <tr key={r.id} className={`border-b border-[#F7F7F7] hover:bg-[#FAFBFF] ${r.restantes === 0 ? "opacity-50" : ""}`}>
                          <td className="px-6 py-3 font-mono text-xs text-[#1B4FFF] font-700">{r.codigo_interno}</td>
                          <td className="px-6 py-3 text-xs text-[#666]">{r.modelo_completo}</td>
                          <td className="px-6 py-3 font-700 text-[#18191F]">{fmtSoles(r.cuota)}</td>
                          <td className="px-6 py-3 text-xs text-[#666]">{r.plazo}m</td>
                          <td className="px-6 py-3 text-xs text-[#666]">{r.pagados}/{r.plazo}</td>
                          <td className="px-6 py-3 text-xs">
                            {r.restantes > 0 ? (
                              <span className="font-700 text-orange-600">{r.restantes}m · {fmtSoles(r.pendiente)}</span>
                            ) : (
                              <span className="text-green-600 font-700">✓ Pagado</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-xs text-[#666]">{r.proximo ?? "—"}</td>
                          <td className="px-6 py-3 text-xs">
                            {r.factura_url ? (
                              <a href={r.factura_url} target="_blank" rel="noreferrer" className="text-[#1B4FFF] hover:underline">Ver</a>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-[#999] mt-6">
          * &quot;Pagado&quot; se calcula desde la fecha de compra del equipo. Ajusta la fecha en Inventario si no coincide con el primer vencimiento real.
        </p>
      </div>
    </div>
  );
}
