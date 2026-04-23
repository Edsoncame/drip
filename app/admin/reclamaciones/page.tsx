import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import ReclamacionesTable from "./ReclamacionesTable";

export const metadata: Metadata = { title: "Reclamaciones | Admin FLUX", robots: { index: false, follow: false } };

export interface Reclamacion {
  id: string;
  numero_hoja: number;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellidos: string;
  domicilio: string;
  telefono: string | null;
  email: string;
  tipo_bien: string;
  monto_reclamado: string | null;
  descripcion_bien: string;
  tipo_reclamo: string;
  detalle_reclamo: string;
  pedido: string;
  fecha_reclamo: string;
  respuesta: string | null;
  respuesta_fecha: string | null;
  estado: string;
}

export default async function AdminReclamacionesPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const { rows } = await query<Reclamacion>(
    `SELECT id, numero_hoja, tipo_documento, numero_documento, nombre, apellidos,
            domicilio, telefono, email, tipo_bien, monto_reclamado, descripcion_bien,
            tipo_reclamo, detalle_reclamo, pedido, fecha_reclamo,
            respuesta, respuesta_fecha, estado
     FROM libro_reclamaciones
     ORDER BY fecha_reclamo DESC`,
  );

  const pending = rows.filter((r) => r.estado === "pendiente").length;
  // Server component — un render por request, Date.now() es seguro acá.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const overdue = rows.filter((r) => {
    if (r.estado !== "pendiente") return false;
    const days = (now - new Date(r.fecha_reclamo).getTime()) / (1000 * 60 * 60 * 24);
    return days > 25; // se acerca el plazo Indecopi de 30 días hábiles
  }).length;

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <div className="bg-white border-b border-[#E5E5E5] px-4 sm:px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="FLUX" className="h-7" />
          <span className="text-xs font-600 px-2 py-0.5 bg-[#1B4FFF] text-white rounded-full">Admin</span>
        </div>
        <Link href="/" className="text-sm text-[#666] hover:text-[#1B4FFF]">← Sitio</Link>
      </div>

      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-800 text-[#18191F]">Libro de Reclamaciones</h1>
            <p className="text-xs text-[#999] mt-0.5">
              Plazo legal Indecopi: 30 días hábiles por reclamo/queja
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white rounded-xl p-3 border border-[#E5E5E5]">
              <p className="text-xs text-[#999]">Total</p>
              <p className="text-xl font-800">{rows.length}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-yellow-300">
              <p className="text-xs text-yellow-700">Pendientes</p>
              <p className="text-xl font-800 text-yellow-700">{pending}</p>
            </div>
            {overdue > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-300">
                <p className="text-xs text-red-700">Urgentes (&gt;25 días)</p>
                <p className="text-xl font-800 text-red-700">{overdue}</p>
              </div>
            )}
          </div>
        </div>

        <ReclamacionesTable rows={rows} />
      </div>
    </div>
  );
}
