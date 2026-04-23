import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { ensureSdkSchema, type DbSdkSession } from "@/lib/kyc/sdk/schema";
import { authenticateTenant } from "@/lib/kyc/sdk/tenant-auth";
import { signSessionToken } from "@/lib/kyc/sdk/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MIN_DEFAULT = Number(process.env.KYC_SDK_SESSION_TTL_MIN ?? "15");
const tag = "[kyc/sdk/sessions]";

function toIso(d: Date): string {
  return d.toISOString();
}

export async function POST(req: NextRequest) {
  await ensureSdkSchema();

  const auth = await authenticateTenant(req.headers.get("authorization"));
  if (!auth) {
    console.warn(`${tag} unauthorized — invalid or missing tenant credentials`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    external_user_id?: string;
    external_reference?: string;
    webhook_url?: string;
    webhook_secret?: string;
    metadata?: Record<string, unknown>;
  };

  const correlationId = `sdk_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + TTL_MIN_DEFAULT * 60 * 1000);

  const webhookUrl = body.webhook_url ?? auth.tenant.default_webhook_url ?? null;

  const ins = await query<DbSdkSession>(
    `INSERT INTO kyc_sdk_sessions
       (tenant_id, external_user_id, external_reference, correlation_id,
        status, webhook_url, webhook_secret, metadata, expires_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7::jsonb, $8)
     RETURNING *`,
    [
      auth.tenant.id,
      body.external_user_id ?? null,
      body.external_reference ?? null,
      correlationId,
      webhookUrl,
      body.webhook_secret ?? null,
      JSON.stringify(body.metadata ?? {}),
      toIso(expiresAt),
    ],
  );
  const session = ins.rows[0];

  const { token, expiresAt: tokenExp } = await signSessionToken(
    {
      session_id: session.id,
      tenant_id: auth.tenant.id,
    },
    TTL_MIN_DEFAULT * 60,
  );

  console.log(
    `${tag} created tenant=${auth.tenant.id} session=${session.id} corr=${correlationId} ext_user=${body.external_user_id ?? "-"}`,
  );

  return NextResponse.json(
    {
      session_id: session.id,
      session_token: token,
      correlation_id: correlationId,
      expires_at: toIso(tokenExp),
      tenant_id: auth.tenant.id,
      capture_config: {
        document_types: ["DNI"],
        require_dni_front: true,
        require_dni_back: true,
        require_selfie: true,
        require_liveness: true,
        selfie_frames_required: 3,
      },
    },
    { status: 201 },
  );
}
