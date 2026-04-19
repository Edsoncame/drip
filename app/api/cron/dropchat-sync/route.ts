import { NextRequest, NextResponse } from "next/server";
import { syncAllContacts } from "@/lib/dropchat-sync";
import { syncAllProducts } from "@/lib/dropchat-catalog";

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

  console.log(`${tag} iniciando full sync (contactos + catálogo)`);
  const [contacts, catalog] = await Promise.all([
    syncAllContacts(),
    syncAllProducts(),
  ]);
  console.log(
    `${tag} done · contactos=${contacts.synced}/${contacts.total} catalog=${catalog.synced}/${catalog.total} errors=${contacts.errors.length + catalog.errors.length}`,
  );

  return NextResponse.json({ contacts, catalog });
}
