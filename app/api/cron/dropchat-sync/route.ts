import { NextRequest, NextResponse } from "next/server";
import { syncAllContacts } from "@/lib/dropchat-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const tag = "[cron/dropchat-sync]";

/**
 * Cron — push todos los users a Drop Chat cada noche.
 * Drop Chat es idempotente por external_id, así que correr N veces el mismo
 * día no duplica contactos. Solo actualiza LTV, tags, custom_fields.
 *
 * Configurado en vercel.json: 0 4 * * * (4am UTC)
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.DROPCHAT_API_KEY) {
    console.warn(`${tag} skip — DROPCHAT_API_KEY no seteado`);
    return NextResponse.json({ skipped: true, reason: "no api key" });
  }

  console.log(`${tag} iniciando full sync`);
  const result = await syncAllContacts();
  console.log(
    `${tag} done · synced=${result.synced}/${result.total} skipped=${result.skipped} errors=${result.errors.length}`,
  );

  return NextResponse.json(result);
}
