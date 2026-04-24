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
  const opts = {
    id: null,
    name: null,
    webhook: null,
    email: null,
    password: null,
    userName: null,
    help: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--id") opts.id = args[++i];
    else if (a === "--name") opts.name = args[++i];
    else if (a === "--webhook") opts.webhook = args[++i];
    else if (a === "--email") opts.email = args[++i];
    else if (a === "--password") opts.password = args[++i];
    else if (a === "--user-name") opts.userName = args[++i];
  }
  return opts;
}

function usage() {
  console.log(`
Uso:
  DATABASE_URL=postgres://... node scripts/seed-kyc-tenant.mjs \\
    --id <tenant_id> \\
    --name "<Nombre Cliente>" \\
    [--webhook <https://...>] \\
    [--email <user@cliente.com> --password <pass> [--user-name "Ana"]]

Si pasás --email + --password, además crea/actualiza un user del dashboard
(kyc_tenant_users) asociado a ese tenant. El user puede loggear en
/tenant/login y ver sus verificaciones.

Ejemplo completo:
  DATABASE_URL=... node scripts/seed-kyc-tenant.mjs \\
    --id securex \\
    --name "Securex" \\
    --webhook "https://securex.pe/api/kyc-webhook" \\
    --email ops@securex.pe --password "Cambiar@123" --user-name "Ops Securex"
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

  // Si el caller pasó --email + --password, upsert también un tenant_user.
  let userCreated = false;
  if (opts.email && opts.password) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kyc_tenant_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id TEXT NOT NULL REFERENCES kyc_tenants(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'admin',
        active BOOLEAN NOT NULL DEFAULT true,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT kyc_tenant_users_email_unique UNIQUE (email)
      )
    `);
    const pwdHash = await bcrypt.hash(opts.password, 12);
    const userRes = await pool.query(
      `INSERT INTO kyc_tenant_users (tenant_id, email, password_hash, name)
       VALUES ($1, LOWER($2), $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         password_hash = EXCLUDED.password_hash,
         name = COALESCE(EXCLUDED.name, kyc_tenant_users.name),
         active = true,
         updated_at = NOW()
       RETURNING (xmax = 0) AS created`,
      [opts.id, opts.email, pwdHash, opts.userName ?? null],
    );
    userCreated = userRes.rows[0].created;
  }

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

  Si perdés el key corré este seeder de nuevo para rotarlo.`);

  if (opts.email && opts.password) {
    console.log(`
  Dashboard del tenant — user ${userCreated ? "CREADO" : "ACTUALIZADO"}:
    email:    ${opts.email}
    password: ${opts.password}
    URL:      https://www.fluxperu.com/tenant/login

  Pedile al user que cambie la contraseña en la primera sesión (UI
  todavía no tiene esa feature — acordate de agregarla).`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("FALLÓ:", err.message ?? err);
  process.exit(1);
});
