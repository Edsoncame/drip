import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import { type DbSdkSession } from "@/lib/kyc/sdk/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VerdictShape {
  status?: string;
  reason?: string;
  arbiter_used?: boolean;
  arbiter_confidence?: number | null;
  face_score?: number | null;
  forensics_overall?: number | null;
  template_layout?: number | null;
  age_deviation?: number | null;
  duplicate_flag?: boolean;
  sanctions_hit?: boolean;
  sanctions_risk?: number | null;
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = (await getTenantSession())!;
  const { id } = await params;

  const res = await query<DbSdkSession>(
    `SELECT * FROM kyc_sdk_sessions WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [id, session.user.tenant_id],
  );
  const row = res.rows[0];
  if (!row) {
    notFound();
  }

  const verdict = row.verdict as VerdictShape | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/tenant"
            className="text-white/50 hover:text-white text-sm"
          >
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold mt-2">Sesión de verificación</h1>
        </div>
        <code className="text-xs text-white/40 font-mono">{row.id}</code>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Metadata">
          <KV k="Status" v={row.status} />
          <KV k="External user ID" v={row.external_user_id ?? "—"} />
          <KV k="External reference" v={row.external_reference ?? "—"} />
          <KV k="Correlation ID" v={<code className="text-xs">{row.correlation_id}</code>} />
          <KV k="Creada" v={new Date(row.created_at).toLocaleString("es-PE")} />
          <KV
            k="Completada"
            v={row.completed_at ? new Date(row.completed_at).toLocaleString("es-PE") : "—"}
          />
          <KV k="Expira" v={new Date(row.expires_at).toLocaleString("es-PE")} />
          <KV k="Webhook URL" v={row.webhook_url ?? "—"} />
        </Card>

        <Card title="Veredicto">
          {!verdict ? (
            <div className="text-white/40 text-sm italic">
              Sin veredicto todavía — status: <code>{row.status}</code>
            </div>
          ) : (
            <>
              <KV
                k="Resultado"
                v={
                  verdict.status === "verified" ? (
                    <span className="text-emerald-400 font-medium">✓ verified</span>
                  ) : verdict.status === "rejected" ? (
                    <span className="text-red-400 font-medium">✗ rejected</span>
                  ) : (
                    <span className="text-amber-400">{verdict.status}</span>
                  )
                }
              />
              <KV k="Razón" v={<span className="text-white/80 text-sm">{verdict.reason ?? "—"}</span>} />
              {verdict.arbiter_used && (
                <>
                  <KV k="Arbiter" v="✓ consultado" />
                  {typeof verdict.arbiter_confidence === "number" && (
                    <KV
                      k="Arbiter confidence"
                      v={`${(verdict.arbiter_confidence * 100).toFixed(0)}%`}
                    />
                  )}
                </>
              )}
            </>
          )}
        </Card>
      </div>

      {verdict && (
        <Card title="Scores técnicos">
          <div className="grid md:grid-cols-3 gap-4">
            <MetricBox
              label="Face score"
              value={
                typeof verdict.face_score === "number"
                  ? `${verdict.face_score.toFixed(1)}%`
                  : "—"
              }
              hint="AWS Rekognition similarity. Pass ≥85%"
            />
            <MetricBox
              label="Forensics overall"
              value={
                typeof verdict.forensics_overall === "number"
                  ? verdict.forensics_overall.toFixed(3)
                  : "—"
              }
              hint="0 = DNI limpio, 1 = muy manipulado"
              bad={
                typeof verdict.forensics_overall === "number" &&
                verdict.forensics_overall > 0.4
              }
            />
            <MetricBox
              label="Template layout"
              value={
                typeof verdict.template_layout === "number"
                  ? verdict.template_layout.toFixed(3)
                  : "—"
              }
              hint="Match vs layout DNI Perú auténtico"
              bad={
                typeof verdict.template_layout === "number" &&
                verdict.template_layout < 0.6
              }
            />
            <MetricBox
              label="Age deviation"
              value={
                typeof verdict.age_deviation === "number"
                  ? `${verdict.age_deviation.toFixed(1)}y`
                  : "—"
              }
              hint="Diferencia años Rekognition vs DNI"
              bad={
                typeof verdict.age_deviation === "number" &&
                verdict.age_deviation > 5
              }
            />
            <MetricBox
              label="Duplicate flag"
              value={verdict.duplicate_flag ? "SÍ" : "NO"}
              hint="DNI usado por otro user antes"
              bad={!!verdict.duplicate_flag}
            />
            <MetricBox
              label="Sanctions hit"
              value={verdict.sanctions_hit ? "SÍ" : "NO"}
              hint={
                typeof verdict.sanctions_risk === "number"
                  ? `Risk ${verdict.sanctions_risk.toFixed(2)}`
                  : "PEP/OFAC/UIF check"
              }
              bad={!!verdict.sanctions_hit}
            />
          </div>
        </Card>
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

function MetricBox({
  label,
  value,
  hint,
  bad,
}: {
  label: string;
  value: string;
  hint: string;
  bad?: boolean;
}) {
  return (
    <div
      className={`rounded p-3 border ${bad ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/10"}`}
    >
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div
        className={`text-xl font-semibold mt-1 ${bad ? "text-red-300" : "text-white"}`}
      >
        {value}
      </div>
      <div className="text-xs text-white/40 mt-1">{hint}</div>
    </div>
  );
}
