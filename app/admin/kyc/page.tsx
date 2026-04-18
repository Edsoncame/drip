import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureKycSchema } from "@/lib/kyc/db";
import AdminNav from "../AdminNav";
import KycReview from "./KycReview";

export const metadata: Metadata = {
  title: "KYC · Admin FLUX",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export interface KycCase {
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  user_kyc_status: string | null;
  scan_id: number;
  correlation_id: string;
  dni_number: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  prenombres: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  confidence: string | null;
  imagen_anverso_key: string | null;
  capture_mode: string;
  scan_created_at: string;
  face_score: string | null;
  face_passed: boolean | null;
  liveness_passed: boolean | null;
  selfie_key: string | null;
}

export default async function AdminKycPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");
  await ensureKycSchema();

  // Traemos scans + últimos face matches, priorizando casos en review/rejected
  const res = await query<KycCase>(`
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      u.email AS user_email,
      u.phone AS user_phone,
      u.kyc_status AS user_kyc_status,
      s.id AS scan_id,
      s.correlation_id,
      s.dni_number,
      s.apellido_paterno,
      s.apellido_materno,
      s.prenombres,
      s.fecha_nacimiento::text AS fecha_nacimiento,
      s.sexo,
      s.ocr_confidence::text AS confidence,
      s.imagen_anverso_key,
      s.capture_mode,
      s.created_at::text AS scan_created_at,
      f.score::text AS face_score,
      f.passed AS face_passed,
      f.liveness_passed AS liveness_passed,
      f.selfie_key
    FROM kyc_dni_scans s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN LATERAL (
      SELECT score, passed, liveness_passed, selfie_key
      FROM kyc_face_matches fm
      WHERE fm.correlation_id = s.correlation_id
      ORDER BY fm.created_at DESC LIMIT 1
    ) f ON true
    ORDER BY
      CASE u.kyc_status
        WHEN 'review'   THEN 0
        WHEN 'rejected' THEN 1
        WHEN 'blocked'  THEN 2
        WHEN 'pending'  THEN 3
        WHEN 'verified' THEN 4
        ELSE 5
      END,
      s.created_at DESC
    LIMIT 200
  `);

  const stats = await query<{ status: string; n: string }>(`
    SELECT COALESCE(kyc_status, 'pending') AS status, COUNT(*)::text AS n
    FROM users WHERE kyc_status IS NOT NULL
    GROUP BY kyc_status
  `);
  const statMap: Record<string, number> = {};
  for (const r of stats.rows) statMap[r.status] = parseInt(r.n, 10);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <AdminNav />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-800 text-[#18191F]">🛡️ KYC</h1>
          <p className="text-sm text-[#999999] mt-0.5">
            Verificación de identidad — revisá casos en review antes de aprobar clientes nuevos.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="🟡 Review" n={statMap.review ?? 0} color="amber" />
          <StatCard label="🔴 Rechazados" n={statMap.rejected ?? 0} color="red" />
          <StatCard label="✅ Verificados" n={statMap.verified ?? 0} color="green" />
          <StatCard label="⏳ Pending" n={statMap.pending ?? 0} color="gray" />
        </div>

        <KycReview cases={res.rows} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  n,
  color,
}: {
  label: string;
  n: number;
  color: "amber" | "red" | "green" | "gray";
}) {
  const bg = {
    amber: "bg-amber-50 border-amber-200",
    red: "bg-red-50 border-red-200",
    green: "bg-green-50 border-green-200",
    gray: "bg-gray-50 border-gray-200",
  }[color];
  return (
    <div className={`rounded-2xl border ${bg} p-4`}>
      <p className="text-xs font-600 text-[#666]">{label}</p>
      <p className="text-2xl font-800 text-[#18191F] mt-1">{n}</p>
    </div>
  );
}
