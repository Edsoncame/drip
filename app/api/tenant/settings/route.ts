import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";
import { isValidWebhookUrl } from "@/lib/kyc/sdk/webhook-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/settings]";

export async function POST(req: NextRequest) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    default_webhook_url?: string | null;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const url = (body.default_webhook_url ?? "").trim();
  if (url && !isValidWebhookUrl(url)) {
    return NextResponse.json(
      { error: "invalid_webhook_url", detail: "https only, sin IPs privadas/localhost" },
      { status: 400 },
    );
  }

  await query(
    `UPDATE kyc_tenants
       SET default_webhook_url = $2, updated_at = NOW()
     WHERE id = $1`,
    [session.user.tenant_id, url || null],
  );

  console.log(
    `${tag} updated tenant=${session.user.tenant_id} webhook=${url || "(cleared)"}`,
  );

  return NextResponse.json({ ok: true, default_webhook_url: url || null });
}
