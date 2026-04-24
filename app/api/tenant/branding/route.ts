import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import {
  getTenantBranding,
  normalizeBranding,
} from "@/lib/kyc/sdk/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/branding]";

/** GET — devuelve el branding actual del tenant (o defaults). */
export async function GET() {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const branding = await getTenantBranding(session.user.tenant_id);
  return NextResponse.json({ branding });
}

/**
 * POST — update branding. Acepta el shape completo; campos inválidos caen
 * a defaults vía normalizeBranding (nunca tira).
 */
export async function POST(req: NextRequest) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const normalized = normalizeBranding(body);

  await query(
    `UPDATE kyc_tenants
       SET branding_json = $2::jsonb, updated_at = NOW()
     WHERE id = $1`,
    [session.user.tenant_id, JSON.stringify(normalized)],
  );

  console.log(`${tag} updated tenant=${session.user.tenant_id}`);

  return NextResponse.json({ ok: true, branding: normalized });
}
