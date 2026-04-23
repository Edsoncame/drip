import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  ensureSdkSchema,
  type DbSdkSession,
} from "@/lib/kyc/sdk/schema";
import {
  extractBearer,
  verifySessionToken,
} from "@/lib/kyc/sdk/session-token";
import { authenticateTenant } from "@/lib/kyc/sdk/tenant-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET status de una sesión del SDK.
 *
 * Auth: acepta DOS modos, para los dos consumidores esperados:
 *   1. Session JWT (el SDK nativo mientras dura la captura) — self-service
 *      polling del status.
 *   2. Tenant API key (Bearer tenant_id:secret) — el backend del tenant
 *      hace polling como fallback si el webhook falla.
 *
 * Devuelve status + verdict + uploads ya reportados. Nunca devuelve
 * webhook_secret.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSdkSchema();
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");

  // Modo 1: session JWT
  let allowedTenantId: string | null = null;
  const bearer = extractBearer(authHeader);
  if (bearer) {
    const tokenPayload = await verifySessionToken(bearer);
    if (tokenPayload && tokenPayload.session_id === id) {
      allowedTenantId = tokenPayload.tenant_id;
    }
  }

  // Modo 2: tenant API key (solo si no hubo match de JWT)
  if (!allowedTenantId) {
    const tenantAuth = await authenticateTenant(authHeader);
    if (tenantAuth) {
      allowedTenantId = tenantAuth.tenant.id;
    }
  }

  if (!allowedTenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sessRes = await query<DbSdkSession>(
    `SELECT * FROM kyc_sdk_sessions WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [id, allowedTenantId],
  );
  const session = sessRes.rows[0];
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  const expired =
    session.status !== "completed" &&
    session.status !== "failed" &&
    new Date(session.expires_at) < new Date();

  // Proyección — el webhook_secret nunca se devuelve.
  const metadata = session.metadata as Record<string, unknown>;
  return NextResponse.json({
    session_id: session.id,
    tenant_id: session.tenant_id,
    correlation_id: session.correlation_id,
    external_user_id: session.external_user_id,
    external_reference: session.external_reference,
    status: expired ? "expired" : session.status,
    verdict: session.verdict ?? null,
    uploads: metadata.uploads ?? null,
    created_at: session.created_at,
    expires_at: session.expires_at,
    completed_at: session.completed_at,
  });
}
