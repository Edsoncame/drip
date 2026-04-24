import Link from "next/link";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QueueRow {
  id: string;
  external_user_id: string | null;
  correlation_id: string;
  created_at: Date;
  verdict: {
    reason?: string;
    arbiter_confidence?: number | null;
    arbiter_used?: boolean;
    face_score?: number | null;
    forensics_overall?: number | null;
  } | null;
}

interface StatsRow {
  total_pending: string;
  avg_age_minutes: string;
  reviewed_today: string;
}

export default async function ReviewQueuePage() {
  const session = (await getTenantSession())!;
  const tenantId = session.user.tenant_id;

  const [queueRes, statsRes] = await Promise.all([
    query<QueueRow>(
      `SELECT id, external_user_id, correlation_id, created_at, verdict
       FROM kyc_sdk_sessions
       WHERE tenant_id = $1
         AND status = 'review'
         AND reviewed_at IS NULL
       ORDER BY created_at ASC
       LIMIT 100`,
      [tenantId],
    ),
    query<StatsRow>(
      `SELECT
         (SELECT COUNT(*) FROM kyc_sdk_sessions
          WHERE tenant_id = $1 AND status = 'review' AND reviewed_at IS NULL)::text AS total_pending,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 60, 0)::int::text AS avg_age_minutes,
         (SELECT COUNT(*) FROM kyc_sdk_sessions
          WHERE tenant_id = $1 AND reviewed_at >= CURRENT_DATE)::text AS reviewed_today
       FROM kyc_sdk_sessions
       WHERE tenant_id = $1 AND status = 'review' AND reviewed_at IS NULL`,
      [tenantId],
    ),
  ]);

  const stats = statsRes.rows[0] ?? {
    total_pending: "0",
    avg_age_minutes: "0",
    reviewed_today: "0",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Revisión manual</h1>
        <p className="text-white/50 text-sm mt-1">
          Sessions que el pipeline automático marcó como borderline y necesitan
          ojo humano. Configurá cuándo caen acá en{" "}
          <Link
            href="/tenant/settings"
            className="text-white/70 hover:text-white underline"
          >
            Settings → Review policy
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Pendientes"
          value={stats.total_pending}
          sub="awaiting review"
        />
        <StatCard
          label="Más antigua"
          value={stats.avg_age_minutes + " min"}
          sub="ojo: SLA típico 24h"
        />
        <StatCard
          label="Resueltas hoy"
          value={stats.reviewed_today}
          sub="approved + rejected"
        />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2.5">En cola desde</th>
              <th className="px-4 py-2.5">external_user_id</th>
              <th className="px-4 py-2.5">Razón</th>
              <th className="px-4 py-2.5">Arbiter conf</th>
              <th className="px-4 py-2.5">Face</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {queueRes.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                  No hay sesiones pendientes — todo al día 👌
                </td>
              </tr>
            )}
            {queueRes.rows.map((r) => {
              const ageMin = Math.round(
                (Date.now() - new Date(r.created_at).getTime()) / 60000,
              );
              return (
                <tr key={r.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white/70">
                    <div>{new Date(r.created_at).toLocaleString("es-PE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}</div>
                    <div className="text-xs text-white/40">hace {ageMin}min</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/80">
                    {r.external_user_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs max-w-xs truncate">
                    {r.verdict?.reason ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">
                    {typeof r.verdict?.arbiter_confidence === "number"
                      ? `${(r.verdict.arbiter_confidence * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">
                    {typeof r.verdict?.face_score === "number"
                      ? `${r.verdict.face_score.toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tenant/review/${r.id}`}
                      className="bg-white text-black text-xs font-semibold rounded px-3 py-1.5"
                    >
                      Revisar →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
