import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());
const tag = "[admin/subscriptions]";

const ALLOWED_STATUSES = ["active", "paused", "cancelled", "completed", "delivered"];

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !ADMIN_EMAILS.includes(session.email.toLowerCase())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, status, note } = await req.json();

  if (!id || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  await query(
    `UPDATE subscriptions SET status = $1, admin_note = $2, updated_at = NOW() WHERE id = $3`,
    [status, note ?? null, id]
  );

  console.log(`${tag} ${session.email} updated subscription id=${id} status=${status}`);
  return NextResponse.json({ ok: true });
}
