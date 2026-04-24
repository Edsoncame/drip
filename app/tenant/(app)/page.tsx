import Link from "next/link";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  external_user_id: string | null;
  external_reference: string | null;
  correlation_id: string;
  status: string;
  verdict: { status?: string; reason?: string } | null;
  created_at: Date;
  completed_at: Date | null;
}

interface StatsRow {
  total: string;
  completed: string;
  verified: string;
  rejected: string;
}

interface TopReasonRow {
  reason: string;
  n: string;
}

export default async function TenantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ext?: string; page?: string }>;
}) {
  const session = (await getTenantSession())!; // layout ya garantiza auth
  const sp = await searchParams;
  const tenantId = session.user.tenant_id;
  const statusFilter = sp.status ?? "";
  const extFilter = (sp.ext ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;

  // Stats del mes en curso
  const statsRes = await query<StatsRow>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
       COUNT(*) FILTER (WHERE (verdict->>'status') = 'verified')::text AS verified,
       COUNT(*) FILTER (WHERE (verdict->>'status') = 'rejected')::text AS rejected
     FROM kyc_sdk_sessions
     WHERE tenant_id = $1
       AND created_at >= date_trunc('month', NOW())`,
    [tenantId],
  );
  const stats = statsRes.rows[0] ?? { total: "0", completed: "0", verified: "0", rejected: "0" };
  const total = parseInt(stats.total, 10);
  const completed = parseInt(stats.completed, 10);
  const verified = parseInt(stats.verified, 10);
  const rejected = parseInt(stats.rejected, 10);
  const passRate = completed > 0 ? Math.round((verified / completed) * 100) : 0;

  // Top 3 rejection reasons
  const topReasonsRes = await query<TopReasonRow>(
    `SELECT verdict->>'reason' AS reason, COUNT(*)::text AS n
     FROM kyc_sdk_sessions
     WHERE tenant_id = $1
       AND (verdict->>'status') = 'rejected'
       AND created_at >= date_trunc('month', NOW())
     GROUP BY verdict->>'reason'
     ORDER BY COUNT(*) DESC
     LIMIT 3`,
    [tenantId],
  );

  // Lista paginada
  const rowsRes = await query<SessionRow>(
    `SELECT id, external_user_id, external_reference, correlation_id, status, verdict,
            created_at, completed_at
     FROM kyc_sdk_sessions
     WHERE tenant_id = $1
       AND ($2::text = '' OR status = $2::text)
       AND ($3::text = '' OR external_user_id ILIKE '%' || $3::text || '%')
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    [tenantId, statusFilter, extFilter],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Verificaciones de este mes</h1>
        <p className="text-white/50 text-sm mt-1">
          Tenant: <code className="text-white/70">{tenantId}</code>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={total.toString()} />
        <StatCard label="Completadas" value={completed.toString()} />
        <StatCard
          label="Pass rate"
          value={completed > 0 ? `${passRate}%` : "—"}
          sub={`${verified} ok / ${rejected} rej`}
        />
        <StatCard
          label="En proceso"
          value={(total - completed).toString()}
          sub="pending/capturing/processing"
        />
      </div>

      {topReasonsRes.rows.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-2">
            Top 3 motivos de rechazo (mes en curso)
          </div>
          <ul className="space-y-1 text-sm">
            {topReasonsRes.rows.map((r, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-white/80">{r.reason ?? "(sin reason)"}</span>
                <span className="text-white/50">{r.n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Últimas verificaciones</h2>
          <form className="flex gap-2 text-sm">
            <select
              name="status"
              defaultValue={statusFilter}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80"
            >
              <option value="">Todos los status</option>
              <option value="pending">pending</option>
              <option value="capturing">capturing</option>
              <option value="processing">processing</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
              <option value="expired">expired</option>
            </select>
            <input
              name="ext"
              placeholder="external_user_id..."
              defaultValue={extFilter}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white placeholder-white/30"
            />
            <button type="submit" className="bg-white/10 hover:bg-white/20 rounded px-3">
              Filtrar
            </button>
          </form>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/50 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5">Creada</th>
                <th className="px-4 py-2.5">external_user_id</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Veredicto</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rowsRes.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-white/40">
                    Sin verificaciones aún.
                  </td>
                </tr>
              )}
              {rowsRes.rows.map((r) => (
                <tr key={r.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white/70">
                    {new Date(r.created_at).toLocaleString("es-PE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/80">
                    {r.external_user_id ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {r.verdict?.status ? (
                      <VerdictBadge s={r.verdict.status} />
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tenant/sessions/${r.id}`}
                      className="text-white/60 hover:text-white text-xs underline"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3 text-sm text-white/50">
          <div>Página {page}</div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}
                className="hover:text-white"
              >
                ← Anterior
              </Link>
            )}
            {rowsRes.rows.length === limit && (
              <Link
                href={`?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}
                className="hover:text-white"
              >
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-slate-500/20 text-slate-300",
    capturing: "bg-blue-500/20 text-blue-300",
    processing: "bg-amber-500/20 text-amber-300",
    completed: "bg-emerald-500/20 text-emerald-300",
    failed: "bg-red-500/20 text-red-300",
    expired: "bg-white/10 text-white/40",
  };
  const cls = colors[status] ?? "bg-white/10 text-white/60";
  return (
    <span className={`${cls} text-xs px-2 py-0.5 rounded-full`}>{status}</span>
  );
}

function VerdictBadge({ s }: { s: string }) {
  if (s === "verified") return <span className="text-emerald-400">✓ verified</span>;
  if (s === "rejected") return <span className="text-red-400">✗ rejected</span>;
  if (s === "review") return <span className="text-amber-400">~ review</span>;
  return <span className="text-white/40">{s}</span>;
}
