import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import type { DbSdkSession } from "@/lib/kyc/sdk/schema";
import type { DbKycDniScan, DbKycFaceMatch } from "@/lib/kyc/db";
import { ReviewActions } from "./ReviewActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = (await getTenantSession())!;
  const { id } = await params;

  const sessRes = await query<DbSdkSession>(
    `SELECT * FROM kyc_sdk_sessions
     WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [id, session.user.tenant_id],
  );
  const s = sessRes.rows[0];
  if (!s) notFound();

  const [scanRes, faceRes] = await Promise.all([
    query<DbKycDniScan>(
      `SELECT * FROM kyc_dni_scans WHERE correlation_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [s.correlation_id],
    ),
    query<DbKycFaceMatch>(
      `SELECT * FROM kyc_face_matches WHERE correlation_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [s.correlation_id],
    ),
  ]);
  const scan = scanRes.rows[0] ?? null;
  const face = faceRes.rows[0] ?? null;
  const verdict = s.verdict as {
    status?: string;
    reason?: string;
    arbiter_confidence?: number | null;
    arbiter_used?: boolean;
    face_score?: number | null;
    forensics_overall?: number | null;
    template_layout?: number | null;
    duplicate_flag?: boolean;
  } | null;

  const canReview = s.status === "review" && !s.reviewed_at;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tenant/review"
          className="text-white/50 hover:text-white text-sm"
        >
          ← Cola de revisión
        </Link>
        <h1 className="text-2xl font-semibold mt-2">
          Revisar sesión
        </h1>
        <code className="text-xs text-white/40 font-mono">{s.id}</code>
      </div>

      {!canReview && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm">
          {s.reviewed_at ? (
            <>
              Esta sesión ya fue resuelta{" "}
              <strong className="text-amber-300">{s.review_action}</strong>{" "}
              el {new Date(s.reviewed_at).toLocaleString("es-PE")}.{" "}
              {s.review_notes && <span className="text-white/70">Notas: {s.review_notes}</span>}
            </>
          ) : (
            <>Status actual: <code>{s.status}</code> — no está en cola de review.</>
          )}
        </div>
      )}

      {/* Imágenes side-by-side */}
      <div className="grid md:grid-cols-3 gap-4">
        <ImageBox
          label="DNI frente"
          url={scan?.imagen_anverso_key ?? null}
        />
        <ImageBox
          label="DNI reverso"
          url={scan?.imagen_reverso_key ?? null}
        />
        <ImageBox
          label="Selfie"
          url={face?.selfie_key ?? null}
        />
      </div>

      {/* Datos OCR + scores */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Datos OCR del DNI">
          <KV k="DNI" v={<code>{scan?.dni_number ?? "—"}</code>} />
          <KV k="Apellido paterno" v={scan?.apellido_paterno ?? "—"} />
          <KV k="Apellido materno" v={scan?.apellido_materno ?? "—"} />
          <KV k="Prenombres" v={scan?.prenombres ?? "—"} />
          <KV k="Fecha nacimiento" v={scan?.fecha_nacimiento ?? "—"} />
          <KV
            k="OCR confidence"
            v={scan?.ocr_confidence ? `${parseFloat(scan.ocr_confidence).toFixed(2)}` : "—"}
          />
        </Card>

        <Card title="Scores del pipeline">
          <KV
            k="Verdict inicial"
            v={
              <span className="text-amber-400">
                {verdict?.status ?? "—"}
              </span>
            }
          />
          <KV k="Razón" v={<span className="text-white/70">{verdict?.reason ?? "—"}</span>} />
          <KV
            k="Face match"
            v={
              typeof verdict?.face_score === "number"
                ? `${verdict.face_score.toFixed(1)}% (threshold 85)`
                : "—"
            }
          />
          <KV
            k="Forensics"
            v={
              typeof verdict?.forensics_overall === "number"
                ? `${verdict.forensics_overall.toFixed(3)} (>0.4 sospechoso)`
                : "—"
            }
          />
          <KV
            k="Template"
            v={
              typeof verdict?.template_layout === "number"
                ? `${verdict.template_layout.toFixed(3)} (<0.6 sospechoso)`
                : "—"
            }
          />
          <KV
            k="Duplicate DNI"
            v={verdict?.duplicate_flag ? "SÍ — ya usado" : "no"}
          />
          <KV
            k="Arbiter"
            v={
              verdict?.arbiter_used
                ? `consultado · confidence ${
                    typeof verdict.arbiter_confidence === "number"
                      ? (verdict.arbiter_confidence * 100).toFixed(0) + "%"
                      : "?"
                  }`
                : "no"
            }
          />
        </Card>
      </div>

      {canReview && <ReviewActions sessionId={s.id} />}
    </div>
  );
}

function ImageBox({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      <div className="text-xs text-white/50 uppercase tracking-wider px-3 py-2 border-b border-white/10">
        {label}
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img
            src={url}
            alt={label}
            className="w-full h-56 object-cover bg-slate-950"
          />
        </a>
      ) : (
        <div className="h-56 flex items-center justify-center text-white/30 text-xs">
          sin imagen
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-5">
      <h3 className="text-xs text-white/50 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-white/50 shrink-0">{k}</span>
      <span className="text-right break-all">{v}</span>
    </div>
  );
}
