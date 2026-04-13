import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { userId, verified } = await req.json() as { userId: string; verified: boolean };

  await query(
    "UPDATE users SET identity_verified = $2, updated_at = NOW() WHERE id = $1",
    [userId, verified]
  );

  console.log(`[admin/verify-identity] ${session.email} set identity_verified=${verified} for user=${userId}`);

  return NextResponse.json({ ok: true });
}
