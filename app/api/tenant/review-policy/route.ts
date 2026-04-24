import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/review-policy]";
const ALLOWED = new Set(["never", "low_confidence", "all_borderline"]);

export async function POST(req: NextRequest) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    policy?: string;
  } | null;
  if (!body?.policy || !ALLOWED.has(body.policy)) {
    return NextResponse.json(
      { error: "invalid_policy", detail: `Valores válidos: ${Array.from(ALLOWED).join(", ")}` },
      { status: 400 },
    );
  }
  await query(
    `UPDATE kyc_tenants SET manual_review_policy = $2, updated_at = NOW() WHERE id = $1`,
    [session.user.tenant_id, body.policy],
  );
  console.log(
    `${tag} updated tenant=${session.user.tenant_id} policy=${body.policy} by=${session.user.id}`,
  );
  return NextResponse.json({ ok: true, policy: body.policy });
}
