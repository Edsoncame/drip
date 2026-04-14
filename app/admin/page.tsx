import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminTable from "./AdminTable";
import AdminNav from "./AdminNav";

export const metadata: Metadata = { title: "Admin | FLUX", robots: { index: false, follow: false } };

interface Sub {
  id: string;
  user_name: string | null;
  user_email: string | null;
  product_name: string;
  months: number;
  monthly_price: string;
  status: string;
  started_at: string;
  ends_at: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_company: string;
  customer_ruc: string | null;
  admin_note: string | null;
  mp_subscription_id: string | null;
  apple_care: boolean | null;
  delivery_method: string | null;
  delivery_address: string | null;
  delivery_distrito: string | null;
  delivery_reference: string | null;
  dni_number: string | null;
  dni_photo_url: string | null;
  selfie_url: string | null;
  identity_verified: boolean | null;
}

interface Stat {
  active_count: string;
  monthly_revenue: string;
  total_users: string;
  total_subs: string;
  pending_delivery: string;
}

interface Referral {
  referral_id: string;
  referrer_name: string;
  referrer_email: string;
  referred_name: string;
  referred_email: string;
  created_at: string;
  status: string;
}

export default async function AdminPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const [statsResult, subsResult, referralsResult] = await Promise.all([
    query<Stat>(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('active','delivered')) AS active_count,
        COUNT(*) FILTER (WHERE status = 'shipped')               AS pending_delivery,
        COALESCE(SUM(monthly_price::numeric) FILTER (WHERE status IN ('active','delivered')), 0) AS monthly_revenue,
        (SELECT COUNT(*) FROM users WHERE COALESCE(is_admin, false) = false) AS total_users,
        COUNT(*)                                     AS total_subs
      FROM subscriptions
    `),
    query<Sub>(`
      SELECT s.id, u.name AS user_name, u.email AS user_email,
             s.product_name, s.months, s.monthly_price, s.status,
             s.started_at, s.ends_at, s.admin_note, s.mp_subscription_id,
             s.customer_name, s.customer_email, s.customer_phone,
             s.customer_company, s.customer_ruc, s.apple_care,
             s.delivery_method, s.delivery_address, s.delivery_distrito, s.delivery_reference,
             s.dni_number, s.dni_photo_url, s.selfie_url, s.identity_verified
      FROM subscriptions s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.started_at DESC
      LIMIT 500
    `),
    query<Referral>(`
      SELECT r.id AS referral_id, r.status, r.created_at,
             ru.name AS referrer_name, ru.email AS referrer_email,
             rd.name AS referred_name, rd.email AS referred_email
      FROM referrals r
      JOIN users ru ON ru.id = r.referrer_id
      JOIN users rd ON rd.id = r.referred_id
      ORDER BY r.created_at DESC
      LIMIT 100
    `).catch(() => ({ rows: [] as Referral[] })),
  ]);

  const stats = statsResult.rows[0];
  const subs = subsResult.rows;
  const referrals = referralsResult.rows;

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Top bar */}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-800 text-[#18191F]">Panel de administración</h1>
          <p className="text-sm text-[#999999] mt-0.5">Bienvenido, {session.name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Rentas activas",    value: stats?.active_count ?? "0",       icon: "💻", highlight: false },
            { label: "En camino",         value: stats?.pending_delivery ?? "0",   icon: "🚚", highlight: Number(stats?.pending_delivery) > 0 },
            { label: "MRR estimado",      value: `$${Number(stats?.monthly_revenue ?? 0).toFixed(0)}`, icon: "💰", highlight: false },
            { label: "Total usuarios",    value: stats?.total_users ?? "0",        icon: "👤", highlight: false },
            { label: "Total rentas",      value: stats?.total_subs ?? "0",         icon: "📋", highlight: false },
          ].map(s => (
            <div key={s.label}
              className={`bg-white rounded-2xl p-5 border ${s.highlight ? "border-orange-300 bg-orange-50" : "border-[#E5E5E5]"}`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-2xl font-800 text-[#18191F]">{s.value}</p>
              <p className="text-xs text-[#666666] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Webhook setup reminder */}
        <div className="bg-[#FFFBEB] border border-yellow-200 rounded-xl px-5 py-3 mb-8 flex items-start gap-3 text-sm">
          <span className="text-lg flex-shrink-0">⚡</span>
          <div>
            <span className="font-700 text-yellow-800">Webhook de Culqi — </span>
            <span className="text-yellow-700">
              Configura la URL <code className="bg-yellow-100 px-1 rounded text-xs font-mono">fluxperu.com/api/webhooks/culqi</code> en Culqi Panel → Desarrollo → Webhooks
              para que los cobros recurrentes se sincronicen automáticamente.
            </span>
          </div>
        </div>

        {/* Interactive table (client component) */}
        <AdminTable subs={subs} />

        {/* Referrals */}
        {referrals.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden mt-8">
            <div className="px-6 py-4 border-b border-[#E5E5E5]">
              <h2 className="font-700 text-[#18191F]">Programa de referidos</h2>
              <p className="text-xs text-[#999999] mt-0.5">{referrals.length} referidos</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F7F7]">
                  <tr>
                    {["Referidor", "Referido", "Fecha", "Estado"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666666]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {referrals.map(r => (
                    <tr key={r.referral_id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3">
                        <p className="font-600 text-[#18191F]">{r.referrer_name}</p>
                        <p className="text-xs text-[#999999]">{r.referrer_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-600 text-[#18191F]">{r.referred_name}</p>
                        <p className="text-xs text-[#999999]">{r.referred_email}</p>
                      </td>
                      <td className="px-4 py-3 text-[#666666] whitespace-nowrap text-xs">
                        {new Date(r.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-700 ${
                          r.status === "rewarded" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {r.status === "rewarded" ? "Recompensado" : "Pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
