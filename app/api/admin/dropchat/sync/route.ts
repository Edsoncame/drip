import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { syncAllContacts, syncContact } from "@/lib/dropchat-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const tag = "[admin/dropchat/sync]";

/**
 * POST /api/admin/dropchat/sync
 *
 * Body opcional:
 *   { user_id: string }  → sincroniza un solo contacto
 *   {}                    → sincroniza todos (batch)
 */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { user_id?: string };

  if (body.user_id) {
    const result = await syncContact(body.user_id);
    console.log(`${tag} ${session.email} synced user=${body.user_id} ok=${result.ok}`);
    return NextResponse.json(result);
  }

  const result = await syncAllContacts();
  console.log(
    `${tag} ${session.email} batch sync: ${result.synced}/${result.total} (skipped=${result.skipped}, errors=${result.errors.length})`,
  );
  return NextResponse.json(result);
}
