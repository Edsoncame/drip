import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin | FLUX", robots: { index: false, follow: false } };

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());

function isAdmin(email: string) {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

interface Sub {
  id: string;
  user_name: string;
  user_email: string;
  product_name: string;
  months: number;
  monthly_price: string;
  status: string;
  started_at: string;
  ends_at: string | null;
}

interface Stat {
  active_count: string;
  monthly_revenue: string;
  total_users: string;
  total_subs: string;
}

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  paused:    "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-600",
  completed: "bg-gray-100 text-gray-500",
};

export default async function AdminPage() {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    redirect("/");
  }

  const [statsResult, subsResult] = await Promise.all([
    query<Stat>(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active_count,
        COALESCE(SUM(monthly_price::numeric) FILTER (WHERE status = 'active'), 0) AS monthly_revenue,
        (SELECT COUNT(*) FROM users) AS total_users,
        COUNT(*) AS total_subs
      FROM subscriptions
    `),
    query<Sub>(`
      SELECT s.id, u.name AS user_name, u.email AS user_email,
             s.product_name, s.months, s.monthly_price, s.status,
             s.started_at, s.ends_at
      FROM subscriptions s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.started_at DESC
      LIMIT 200
    `),
  ]);

  const stats = statsResult.rows[0];
  const subs = subsResult.rows;

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1B4FFF] flex items-center justify-center">
            <span className="text-white font-black text-sm">F</span>
          </div>
          <div>
            <span className="font-800 text-[#18191F]">flux</span>
            <span className="ml-2 text-xs font-600 px-2 py-0.5 bg-[#1B4FFF] text-white rounded-full">Admin</span>
          </div>
        </div>
        <a href="/" className="text-sm text-[#666666] hover:text-[#1B4FFF] transition-colors">← Volver al sitio</a>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-800 text-[#18191F] mb-2">Panel de administración</h1>
        <p className="text-sm text-[#666666] mb-8">Bienvenido, {session.name}</p>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Rentas activas", value: stats?.active_count ?? "0", icon: "💻" },
            { label: "MRR estimado", value: `$${Number(stats?.monthly_revenue ?? 0).toFixed(0)}`, icon: "💰" },
            { label: "Total usuarios", value: stats?.total_users ?? "0", icon: "👤" },
            { label: "Total rentas", value: stats?.total_subs ?? "0", icon: "📋" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-[#E5E5E5]">
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-2xl font-800 text-[#18191F]">{s.value}</p>
              <p className="text-xs text-[#666666] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Subscriptions table */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E5E5]">
            <h2 className="font-700 text-[#18191F]">Todas las rentas</h2>
            <p className="text-xs text-[#999999] mt-0.5">{subs.length} registros</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F7F7]">
                <tr>
                  {["Cliente", "Producto", "Plan", "$/mes", "Estado", "Inicio", "Vence"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-700 text-[#666666] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {subs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-[#999999]">No hay rentas registradas aún.</td>
                  </tr>
                ) : subs.map(sub => (
                  <tr key={sub.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-600 text-[#18191F]">{sub.user_name ?? "—"}</p>
                      <p className="text-xs text-[#999999]">{sub.user_email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#333333] font-500 max-w-[180px] truncate">{sub.product_name}</td>
                    <td className="px-4 py-3 text-[#666666]">{sub.months}m</td>
                    <td className="px-4 py-3 font-700 text-[#18191F]">${sub.monthly_price}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-700 ${STATUS_COLORS[sub.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                      {new Date(sub.started_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                      {sub.ends_at
                        ? new Date(sub.ends_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
