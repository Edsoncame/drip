import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureKycSchema } from "@/lib/kyc/db";
import AdminNav from "../../AdminNav";

export const metadata: Metadata = {
  title: "KYC Forense · Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface ForensicsRow {
  scan_id: number;
  correlation_id: string;
  dni_number: string | null;
  apellido_paterno: string | null;
  prenombres: string | null;
  user_email: string | null;
  user_name: string | null;
  user_kyc_status: string | null;
  created_at: string;
  forensics_json: {
    ela_score?: number;
    copy_move_score?: number;
    photo_edge_score?: number;
    noise_consistency?: number;
    overall_tampering_risk?: number;
  } | null;
  template_json: {
    layout_score?: number;
    escudo_detected?: boolean;
    photo_bbox_ok?: boolean;
    mrz_region_ok?: boolean;
    issues?: string[];
  } | null;
  age_consistency_json: {
    estimated_age_low?: number;
    estimated_age_high?: number;
    dni_age?: number;
    within_range?: boolean;
    deviation_years?: number;
  } | null;
  duplicates_json: {
    dni_reused_by_other_user?: boolean;
    other_user_ids?: string[];
    risk_score?: number;
  } | null;
}

function fmt(n: number | undefined | null, digits = 3): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toFixed(digits);
}

/** Celda de score con fondo color según nivel de riesgo. */
function ScoreCell({ value, goodLow = true }: { value: number | undefined | null; goodLow?: boolean }) {
  if (value === null || value === undefined || isNaN(value)) {
    return <td className="px-2 py-1.5 text-center text-white/30">—</td>;
  }
  const risk = goodLow ? value : 1 - value;
  let cls = "bg-emerald-500/20 text-emerald-200";
  if (risk > 0.4) cls = "bg-amber-500/20 text-amber-200";
  if (risk > 0.75) cls = "bg-red-500/30 text-red-100 font-bold";
  return (
    <td className={`px-2 py-1.5 text-center font-mono text-[11px] ${cls}`}>
      {fmt(value)}
    </td>
  );
}

export default async function KycForensicsPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");
  await ensureKycSchema();

  const res = await query<ForensicsRow>(
    `SELECT
       s.id AS scan_id,
       s.correlation_id,
       s.dni_number,
       s.apellido_paterno,
       s.prenombres,
       s.created_at,
       s.forensics_json,
       s.template_json,
       s.age_consistency_json,
       s.duplicates_json,
       u.email AS user_email,
       u.name AS user_name,
       u.kyc_status AS user_kyc_status
     FROM kyc_dni_scans s
     LEFT JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC
     LIMIT 50`,
  );
  const rows = res.rows;

  // KPIs de la ventana de 50
  const withForensics = rows.filter((r) => r.forensics_json).length;
  const flagged = rows.filter((r) => {
    const f = r.forensics_json;
    const d = r.duplicates_json;
    return (f && (f.overall_tampering_risk ?? 0) > 0.4) || d?.dni_reused_by_other_user;
  }).length;
  const duplicates = rows.filter((r) => r.duplicates_json?.dni_reused_by_other_user).length;
  const enforceMode = process.env.KYC_FORENSICS_ENFORCE === "true";

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white">
      <AdminNav />
      <div className="max-w-[1400px] mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">KYC Forense</h1>
            <p className="text-sm text-white/50 mt-1">
              Últimos 50 intentos con los 4 signals cuantitativos del pipeline forense
            </p>
          </div>
          <div
            className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold ${
              enforceMode
                ? "bg-red-500/20 text-red-200 border border-red-400/40"
                : "bg-white/10 text-white/60 border border-white/20"
            }`}
          >
            {enforceMode ? "🔴 ENFORCING" : "👁 observación"}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard label="Total intentos (ventana)" value={rows.length} />
          <StatCard
            label="Con forensics poblado"
            value={`${withForensics}/${rows.length}`}
          />
          <StatCard
            label="Flagged (risk > 0.4 o dup)"
            value={flagged}
            tone={flagged > 0 ? "warn" : "ok"}
          />
          <StatCard
            label="DNI duplicados"
            value={duplicates}
            tone={duplicates > 0 ? "danger" : "ok"}
          />
        </div>

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-white/5 text-white/60 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">DNI</th>
                <th className="px-2 py-2 text-center" title="overall_tampering_risk">Risk</th>
                <th className="px-2 py-2 text-center" title="ela_score">ELA</th>
                <th className="px-2 py-2 text-center" title="copy_move_score">Copy</th>
                <th className="px-2 py-2 text-center" title="photo_edge_score">Edge</th>
                <th className="px-2 py-2 text-center" title="noise_consistency">Noise</th>
                <th className="px-2 py-2 text-center" title="template.layout_score">Layout</th>
                <th className="px-2 py-2 text-center" title="age_consistency.deviation_years">AgeDev</th>
                <th className="px-2 py-2 text-center" title="duplicates.dni_reused_by_other_user">Dup</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right">Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-white/40">
                    Sin intentos registrados todavía
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const f = r.forensics_json;
                const t = r.template_json;
                const a = r.age_consistency_json;
                const d = r.duplicates_json;
                const displayName =
                  [r.prenombres, r.apellido_paterno].filter(Boolean).join(" ") ||
                  r.user_name ||
                  "(sin nombre)";
                const dupFlag = d?.dni_reused_by_other_user;
                const dupStyle = dupFlag
                  ? "bg-red-500/30 text-red-100 font-bold"
                  : d
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "text-white/30";
                return (
                  <tr key={r.scan_id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-1.5">
                      <div className="font-medium">{displayName}</div>
                      <div className="text-white/40 text-[10px]">
                        {r.user_email ?? "(guest)"}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 font-mono">{r.dni_number ?? "—"}</td>
                    <ScoreCell value={f?.overall_tampering_risk} />
                    <ScoreCell value={f?.ela_score} />
                    <ScoreCell value={f?.copy_move_score} />
                    <ScoreCell value={f?.photo_edge_score} />
                    <ScoreCell value={f?.noise_consistency} />
                    <ScoreCell value={t?.layout_score} goodLow={false} />
                    <td className="px-2 py-1.5 text-center font-mono text-[11px]">
                      {a?.deviation_years !== undefined ? (
                        <span
                          className={
                            a.deviation_years > 5
                              ? "bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded"
                              : "text-white/60"
                          }
                        >
                          {a.deviation_years}
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className={`px-2 py-1.5 text-center ${dupStyle}`}>
                      {d ? (dupFlag ? "⚠️ SÍ" : "✓") : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusBadge status={r.user_kyc_status} />
                    </td>
                    <td className="px-3 py-1.5 text-right text-white/40 text-[10px]">
                      {timeAgo(r.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-[11px] text-white/40 space-y-1">
          <p>
            <strong className="text-white/60">Modo observación</strong>: los scores
            se calculan y guardan pero no alteran veredicto.
            <strong className="text-white/60"> Enforcing</strong>: duplicados DNI y risk &gt; 0.75
            auto-rechazan; risk &gt; 0.4, layout &lt; 0.6 o age_dev &gt; 5 fuerzan arbiter.
          </p>
          <p>
            Configuración en <code className="font-mono">.env</code> → ver{" "}
            <Link href="/admin" className="text-amber-300 underline">
              lib/kyc/README.md
            </Link>{" "}
            en el repo.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const toneMap = {
    default: "bg-white/5 border-white/10",
    ok: "bg-emerald-500/10 border-emerald-400/30",
    warn: "bg-amber-500/10 border-amber-400/30",
    danger: "bg-red-500/10 border-red-400/30",
  };
  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    verified: "bg-emerald-500/20 text-emerald-200",
    rejected: "bg-red-500/20 text-red-200",
    review: "bg-amber-500/20 text-amber-200",
    pending: "bg-white/10 text-white/60",
    capturing: "bg-blue-500/20 text-blue-200",
    blocked: "bg-zinc-500/30 text-zinc-200",
  };
  const cls = map[status ?? ""] ?? "bg-white/5 text-white/40";
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {status ?? "—"}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
