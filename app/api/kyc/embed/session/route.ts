import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import {
  ensureSdkSchema,
  type DbSdkSession,
} from "@/lib/kyc/sdk/schema";
import { signSessionToken } from "@/lib/kyc/sdk/session-token";
import { extractBearer } from "@/lib/kyc/sdk/session-token";
import {
  parseTenantIdFromPk,
  isOriginAllowed,
} from "@/lib/kyc/sdk/publishable-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[kyc/embed/session]";
const TTL_MIN_DEFAULT = Number(process.env.KYC_SDK_SESSION_TTL_MIN ?? "15");

/**
 * CORS preflight. Permite cualquier origin — el control real está en el
 * chequeo contra allowed_origins que hace el POST.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * POST público (CORS *): el browser del usuario final de Securex lo llama.
 *
 * Auth:
 *   Authorization: Bearer pk_<tenant>_<48hex>
 *   Origin: https://securex.pe   (DEBE estar en kyc_tenants.allowed_origins)
 *
 * Body opcional:
 *   { external_user_id?, external_reference?, metadata? }
 *
 * Response:
 *   { session_id, session_token, correlation_id, expires_at, capture_config }
 *
 * El tenant NUNCA expone su api_key secreto al browser — la pk + whitelist
 * es la única auth. Pattern Stripe Elements / Plaid Link.
 */
export async function POST(req: NextRequest) {
  await ensureSdkSchema();

  const origin = req.headers.get("origin");
  const authHeader = req.headers.get("authorization");
  const pk = extractBearer(authHeader);

  if (!pk) {
    return withCors({ error: "unauthorized", detail: "missing pk" }, 401, origin);
  }
  const tenantId = parseTenantIdFromPk(pk);
  if (!tenantId) {
    return withCors({ error: "unauthorized", detail: "invalid pk format" }, 401, origin);
  }

  const tenantRes = await query<{
    id: string;
    publishable_key: string | null;
    allowed_origins: string[];
    default_webhook_url: string | null;
    active: boolean;
  }>(
    `SELECT id, publishable_key, allowed_origins, default_webhook_url, active
     FROM kyc_tenants WHERE id = $1 LIMIT 1`,
    [tenantId],
  );
  const tenant = tenantRes.rows[0];

  if (!tenant || !tenant.active || tenant.publishable_key !== pk) {
    console.warn(`${tag} bad_pk tenant=${tenantId} origin=${origin ?? "-"}`);
    return withCors({ error: "unauthorized", detail: "invalid pk" }, 401, origin);
  }

  if (!isOriginAllowed(origin, tenant.allowed_origins)) {
    console.warn(
      `${tag} origin_denied tenant=${tenantId} origin=${origin ?? "-"} allowed=${tenant.allowed_origins.join(",")}`,
    );
    return withCors(
      {
        error: "origin_not_allowed",
        detail: "Agregá este dominio a allowed_origins en /tenant/settings",
      },
      403,
      origin,
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    external_user_id?: string;
    external_reference?: string;
    metadata?: Record<string, unknown>;
  };

  const correlationId = `sdk_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + TTL_MIN_DEFAULT * 60 * 1000);

  const ins = await query<DbSdkSession>(
    `INSERT INTO kyc_sdk_sessions
       (tenant_id, external_user_id, external_reference, correlation_id,
        status, webhook_url, webhook_secret, metadata, expires_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, NULL, $6::jsonb, $7)
     RETURNING *`,
    [
      tenant.id,
      body.external_user_id ?? null,
      body.external_reference ?? null,
      correlationId,
      tenant.default_webhook_url,
      JSON.stringify({ ...(body.metadata ?? {}), embed: true, origin }),
      expiresAt.toISOString(),
    ],
  );
  const sess = ins.rows[0];

  const { token, expiresAt: tokenExp } = await signSessionToken(
    { session_id: sess.id, tenant_id: tenant.id },
    TTL_MIN_DEFAULT * 60,
  );

  console.log(
    `${tag} created tenant=${tenant.id} session=${sess.id} origin=${origin}`,
  );

  return withCors(
    {
      session_id: sess.id,
      session_token: token,
      correlation_id: correlationId,
      expires_at: tokenExp.toISOString(),
      tenant_id: tenant.id,
      capture_config: {
        document_types: ["DNI"],
        require_dni_front: true,
        require_dni_back: true,
        require_selfie: true,
        require_liveness: true,
        selfie_frames_required: 3,
      },
    },
    201,
    origin,
  );
}

function withCors(body: unknown, status: number, origin: string | null): NextResponse {
  // Permitimos echo del origin (no '*') para que browsers con credentials OK.
  // Si no hubo origin, caemos a '*' (responses de error genéricas).
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin ?? "*",
      Vary: "Origin",
    },
  });
}
