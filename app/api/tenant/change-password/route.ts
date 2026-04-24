import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/change-password]";

export async function POST(req: NextRequest) {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    current_password?: string;
    new_password?: string;
  } | null;

  if (!body?.current_password || !body.new_password) {
    return NextResponse.json({ error: "both_passwords_required" }, { status: 400 });
  }
  if (body.new_password.length < 8) {
    return NextResponse.json(
      { error: "password_too_short", detail: "Mínimo 8 caracteres" },
      { status: 400 },
    );
  }
  if (body.current_password === body.new_password) {
    return NextResponse.json(
      { error: "same_password", detail: "La nueva debe ser distinta de la actual" },
      { status: 400 },
    );
  }

  // Verificar current password
  const ok = await bcrypt.compare(body.current_password, session.user.password_hash);
  if (!ok) {
    console.warn(`${tag} wrong current_password tenant=${session.user.tenant_id} user=${session.user.id}`);
    return NextResponse.json(
      { error: "wrong_current_password" },
      { status: 401 },
    );
  }

  const newHash = await bcrypt.hash(body.new_password, 12);
  await query(
    `UPDATE kyc_tenant_users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
    [session.user.id, newHash],
  );

  console.log(`${tag} changed tenant=${session.user.tenant_id} user=${session.user.id}`);

  return NextResponse.json({ ok: true });
}
