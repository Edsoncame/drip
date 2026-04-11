import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import Link from "next/link";
import CancelSubscriptionButton from "@/components/CancelSubscriptionButton";

interface Subscription {
  id: string;
  product_slug: string;
  product_name: string;
  months: number;
  monthly_price: string;
  status: string;
  started_at: string;
  ends_at: string | null;
  mp_subscription_id: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Activo",      color: "#2D7D46", bg: "#E5F3DF" },
  shipped:   { label: "En camino",   color: "#7C3AED", bg: "#EDE9FE" },
  delivered: { label: "Entregado",   color: "#1D4ED8", bg: "#DBEAFE" },
  paused:    { label: "Pausado",     color: "#B45309", bg: "#FEF3C7" },
  cancelled: { label: "Cancelado",   color: "#DC2626", bg: "#FEE2E2" },
  completed: { label: "Completado",  color: "#6B7280", bg: "#F3F4F6" },
};

export default async function RentasPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login?redirect=/cuenta/rentas");

  const result = await query<Subscription>(
    `SELECT id, product_slug, product_name, months, monthly_price, status,
            started_at, ends_at, mp_subscription_id
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY started_at DESC`,
    [session.userId]
  );
  const subs = result.rows;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/cuenta" className="text-[#999999] hover:text-[#1B4FFF] transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-800 text-[#18191F]">Mis rentas</h1>
          <p className="text-sm text-[#666666]">{subs.length === 0 ? "Aún no tienes equipos rentados" : `${subs.length} equipo${subs.length > 1 ? "s" : ""}`}</p>
        </div>
      </div>

      {subs.length === 0 ? (
        /* Empty state */
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">💻</div>
          <h2 className="text-xl font-700 text-[#18191F] mb-2">Aún no rentas ningún equipo</h2>
          <p className="text-[#666666] text-sm mb-6">
            Elige tu MacBook favorita y empieza hoy mismo. Sin depósito, sin deuda.
          </p>
          <Link href="/laptops"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#1B4FFF] text-white font-700 rounded-full hover:bg-[#1340CC] transition-colors">
            Ver MacBooks disponibles
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {subs.map(sub => {
            const status = STATUS_LABELS[sub.status] ?? STATUS_LABELS.active;
            const startDate = new Date(sub.started_at).toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "numeric" });
            const endsDate = sub.ends_at
              ? new Date(sub.ends_at).toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "numeric" })
              : null;
            const total = parseFloat(sub.monthly_price) * sub.months;

            return (
              <div key={sub.id} className="bg-white border border-[#E5E5E5] rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#F7F7F7] rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      💻
                    </div>
                    <div>
                      <p className="font-700 text-[#18191F]">{sub.product_name}</p>
                      <p className="text-sm text-[#666666]">
                        Plan {sub.months} meses · ${sub.monthly_price}/mes
                      </p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-700"
                    style={{ color: status.color, background: status.bg }}>
                    {status.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#F0F0F0]">
                  <div className="bg-[#F7F7F7] rounded-xl p-3">
                    <p className="text-xs text-[#999999] mb-1">Renta mensual</p>
                    <p className="font-700 text-[#18191F]">${sub.monthly_price}</p>
                  </div>
                  <div className="bg-[#F7F7F7] rounded-xl p-3">
                    <p className="text-xs text-[#999999] mb-1">Total del plan</p>
                    <p className="font-700 text-[#18191F]">${total.toFixed(0)}</p>
                  </div>
                  <div className="bg-[#F7F7F7] rounded-xl p-3">
                    <p className="text-xs text-[#999999] mb-1">Inicio</p>
                    <p className="font-700 text-[#18191F] text-sm">{startDate}</p>
                  </div>
                  <div className="bg-[#F7F7F7] rounded-xl p-3">
                    <p className="text-xs text-[#999999] mb-1">Vence</p>
                    <p className="font-700 text-[#18191F] text-sm">{endsDate ?? "En curso"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <Link href={`/laptops/${sub.product_slug}`}
                    className="text-sm font-600 text-[#1B4FFF] hover:underline">
                    Ver equipo
                  </Link>
                  <span className="text-[#E5E5E5]">·</span>
                  <a href={`/api/contracts/${sub.id}`} target="_blank" rel="noreferrer"
                    className="text-sm font-600 text-[#666666] hover:text-[#1B4FFF] transition-colors">
                    Descargar contrato
                  </a>
                  <span className="text-[#E5E5E5]">·</span>
                  <a href="mailto:hola@fluxperu.com?subject=Consulta sobre mi renta"
                    className="text-sm font-600 text-[#666666] hover:text-[#1B4FFF] transition-colors">
                    Contactar soporte
                  </a>
                  {sub.status === "active" && (
                    <>
                      <span className="text-[#E5E5E5]">·</span>
                      <CancelSubscriptionButton subscriptionId={sub.id} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add more CTA */}
      {subs.length > 0 && (
        <div className="mt-6 bg-[#EEF2FF] rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-700 text-[#18191F]">¿Necesitas otro equipo?</p>
            <p className="text-sm text-[#666666]">Agrega más Macs a tu plan fácilmente.</p>
          </div>
          <Link href="/laptops"
            className="flex-shrink-0 px-5 py-2.5 bg-[#1B4FFF] text-white font-700 text-sm rounded-full hover:bg-[#1340CC] transition-colors">
            Ver catálogo
          </Link>
        </div>
      )}
    </div>
  );
}
