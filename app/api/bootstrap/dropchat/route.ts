import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { syncAllContacts } from "@/lib/dropchat-sync";
import { syncAllProducts } from "@/lib/dropchat-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const tag = "[bootstrap/dropchat]";

/**
 * Bootstrap inicial idempotente — corre el sync a Drop Chat UNA sola vez
 * cuando se setea DROPCHAT_API_KEY por primera vez.
 *
 * Es público a propósito (sin auth) porque:
 *   - No hace nada si DROPCHAT_API_KEY no está seteado
 *   - No hace nada si ya corrió (flag en la BD)
 *   - Escritura solo a Drop Chat (que ya tiene su propia auth via X-API-Key)
 *
 * Después del primer run queda desactivado. Los real-time hooks se encargan
 * de mantener sincronizado. El cron nocturno hace resync full por seguridad.
 */
export async function GET() {
  if (!process.env.DROPCHAT_API_KEY) {
    return NextResponse.json({ ok: false, reason: "DROPCHAT_API_KEY no seteado" });
  }

  // Flag en BD — una mini tabla para tracking de bootstraps one-shot
  await query(`
    CREATE TABLE IF NOT EXISTS bootstrap_flags (
      key        TEXT PRIMARY KEY,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      result     JSONB
    )
  `);

  const existing = await query<{ completed_at: Date; result: unknown }>(
    `SELECT completed_at, result FROM bootstrap_flags WHERE key = 'dropchat-initial-sync'`,
  );
  if (existing.rows.length > 0) {
    return NextResponse.json({
      ok: true,
      already_done: true,
      completed_at: existing.rows[0].completed_at,
      result: existing.rows[0].result,
    });
  }

  console.log(`${tag} ejecutando initial sync (contactos + catálogo)…`);
  const [contacts, catalog] = await Promise.all([
    syncAllContacts(),
    syncAllProducts(),
  ]);

  const summary = {
    contacts: {
      synced: contacts.synced,
      total: contacts.total,
      skipped: contacts.skipped,
      errors: contacts.errors,
    },
    catalog: {
      synced: catalog.synced,
      total: catalog.total,
      errors: catalog.errors,
    },
  };

  await query(
    `INSERT INTO bootstrap_flags (key, result) VALUES ('dropchat-initial-sync', $1::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(summary)],
  );

  console.log(`${tag} done`, JSON.stringify(summary));
  return NextResponse.json({ ok: true, bootstrap: true, ...summary });
}
