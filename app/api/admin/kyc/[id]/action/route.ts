import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureKycSchema, logAttempt } from "@/lib/kyc/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[admin/kyc/action]";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureKycSchema();

  const { id: userId } = await params;
  const body = (await req.json().catch(() => null)) as {
    action?: "approve" | "reject";
    correlation_id?: string;
    reason?: string;
  } | null;

  if (!body?.action || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "action debe ser 'approve' o 'reject'" }, { status: 400 });
  }
  if (!body.correlation_id) {
    return NextResponse.json({ error: "correlation_id requerido" }, { status: 400 });
  }

  const newStatus = body.action === "approve" ? "verified" : "rejected";
  const identityVerified = body.action === "approve";

  await query(
    `UPDATE users SET
      kyc_status = $2,
      identity_verified = $3,
      kyc_verified_at = CASE WHEN $2 = 'verified' THEN NOW() ELSE kyc_verified_at END,
      updated_at = NOW()
     WHERE id = $1`,
    [userId, newStatus, identityVerified],
  );

  await logAttempt({
    userId,
    correlationId: body.correlation_id,
    step: "verify",
    outcome: body.action === "approve" ? "ok" : "fail",
    reason: `admin_${body.action}`,
    payload: { admin_email: session.email, note: body.reason ?? null },
  });

  console.log(
    `${tag} admin=${session.email} ${body.action} user=${userId} corr=${body.correlation_id}`,
  );

  return NextResponse.json({ ok: true, new_status: newStatus });
}
