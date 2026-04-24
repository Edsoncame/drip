import { NextResponse } from "next/server";
import { clearTenantSessionCookie } from "@/lib/kyc/sdk/tenant-user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearTenantSessionCookie();
  return NextResponse.json({ ok: true });
}
