#!/usr/bin/env node
/**
 * Seeder CLI para el SDK multi-tenant de KYC.
 *
 * Uso:
 *   DATABASE_URL=postgres://... node scripts/seed-kyc-tenant.mjs \
 *     --id securex \
 *     --name "Securex" \
 *     --webhook "https://securex.pe/api/kyc-webhook"
 *
 * Comportamiento:
 *   - Genera un api_key aleatorio de 48 chars hex.
 *   - bcrypt-hashea con cost 12 y lo guarda en kyc_tenants.api_key_hash.
 *   - Imprime api_key UNA SOLA VEZ. Después ya no se puede recuperar —
 *     hay que rotarlo corriendo el seeder otra vez.
 *   - El formato del Authorization header para el SDK es:
 *       Authorization: Bearer <tenant_id>:<api_key>
 *
 * Si el tenant ya existe, hace UPDATE del hash (rotación) en vez de fallar.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { id: null, name: null, webhook: null, help: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--id") opts.id = args[++i];
    else if (a === "--name") opts.name = args[++i];
    else if (a === "--webhook") opts.webhook = args[++i];
  }
  return opts;
}

function usage() {
  console.log(`
Uso:
  DATABASE_URL=postgres://... node scripts/seed-kyc-tenant.mjs \\
    --id <tenant_id> \\
    --name "<Nombre Cliente>" \\
    [--webhook <https://...>]

Ejemplo:
  DATABASE_URL=$(vercel env pull --environment production && cat .env.vercel | grep DATABASE_URL | cut -d= -f2-) \\
    node scripts/seed-kyc-tenant.mjs --id securex --name "Securex" --webhook "https://securex.pe/api/kyc-webhook"
`);
}

async function main() {
  const opts = parseArgs();
  if (opts.help || !opts.id || !opts.name) {
    usage();
    process.exit(opts.help ? 0 : 1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL env var requerida");
    process.exit(1);
  }

  const apiKey = crypto.randomBytes(24).toString("hex");
  const hash = await bcrypt.hash(apiKey, 12);

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("railway")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  // Asegurar schema — en dev puede no haberse corrido nunca todavía.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kyc_tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key_hash TEXT NOT NULL,
      default_webhook_url TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const res = await pool.query(
    `INSERT INTO kyc_tenants (id, name, api_key_hash, default_webhook_url, active, updated_at)
     VALUES ($1, $2, $3, $4, true, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       api_key_hash = EXCLUDED.api_key_hash,
       default_webhook_url = EXCLUDED.default_webhook_url,
       active = true,
       updated_at = NOW()
     RETURNING (xmax = 0) AS inserted, created_at`,
    [opts.id, opts.name, hash, opts.webhook],
  );
  const inserted = res.rows[0].inserted;

  await pool.end();

  console.log("\n" + "═".repeat(70));
  console.log(`  ${inserted ? "CREADO" : "ROTADO"} tenant: ${opts.id}`);
  console.log("═".repeat(70));
  console.log(`  id:       ${opts.id}`);
  console.log(`  name:     ${opts.name}`);
  console.log(`  webhook:  ${opts.webhook ?? "(sin default)"}`);
  console.log(`  api_key:  ${apiKey}`);
  console.log("═".repeat(70));
  console.log(`
  Guardá este api_key AHORA — no se vuelve a mostrar.

  Para autenticar pedidos del SDK usá el header:
    Authorization: Bearer ${opts.id}:${apiKey}

  Si perdés el key corré este seeder de nuevo para rotarlo.
`);
}

main().catch((err) => {
  console.error("FALLÓ:", err.message ?? err);
  process.exit(1);
});
