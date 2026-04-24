import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QueueRow {
  id: string;
  external_user_id: string | null;
  correlation_id: string;
  created_at: Date;
  verdict: {
    status?: string;
    reason?: string;
    arbiter_confidence?: number | null;
    face_score?: number | null;
  } | null;
}

/** GET — cola de sessions pendientes de review + count. */
export async function GET() {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [rows, count] = await Promise.all([
    query<QueueRow>(
      `SELECT id, external_user_id, correlation_id, created_at, verdict
       FROM kyc_sdk_sessions
       WHERE tenant_id = $1
         AND status = 'review'
         AND reviewed_at IS NULL
       ORDER BY created_at ASC
       LIMIT 100`,
      [session.user.tenant_id],
    ),
    query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM kyc_sdk_sessions
       WHERE tenant_id = $1
         AND status = 'review'
         AND reviewed_at IS NULL`,
      [session.user.tenant_id],
    ),
  ]);

  return NextResponse.json({
    queue: rows.rows,
    pending_count: parseInt(count.rows[0]?.n ?? "0", 10),
  });
}
