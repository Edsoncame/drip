import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { getTenantSession } from "@/lib/kyc/sdk/tenant-user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[tenant/rotate-key]";

/**
 * Rota el api_key del tenant. El nuevo api_key se devuelve UNA VEZ —
 * el frontend debe mostrarlo al user y luego no hay forma de recuperarlo.
 * El api_key viejo queda inválido al instante (bcrypt hash reemplazado).
 */
export async function POST() {
  const session = await getTenantSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 48 chars hex (192 bits de entropía) — mismo formato que el seeder CLI.
  const newApiKey = randomBytes(24).toString("hex");
  const hash = await bcrypt.hash(newApiKey, 12);

  await query(
    `UPDATE kyc_tenants SET api_key_hash = $2, updated_at = NOW() WHERE id = $1`,
    [session.user.tenant_id, hash],
  );

  console.log(`${tag} rotated tenant=${session.user.tenant_id} by=${session.user.id}`);

  return NextResponse.json({
    ok: true,
    tenant_id: session.user.tenant_id,
    api_key: newApiKey,
    bearer_header: `Bearer ${session.user.tenant_id}:${newApiKey}`,
  });
}
