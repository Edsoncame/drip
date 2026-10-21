/**
 * Candado: el panel /admin/kyc tiene que leer TODAS las fuentes de KYC.
 *
 * El 21-oct-2026 se descubrió que el panel solo leía el pipeline propio
 * (kyc_dni_scans) y llevaba desde mayo sin mostrar ninguna verificación,
 * porque el checkout las mandaba a Drop Validation. Si alguien agrega una
 * fuente nueva y no la incluye en la consulta, o la saca, esto falla.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const ROOT = path.resolve(__dirname, "..", "..");

test("la consulta del panel incluye cada fuente declarada", async () => {
  const { KYC_CASES_SQL, KYC_CASE_SOURCES } = await import("../kyc/admin-cases");
  for (const [source, table] of Object.entries(KYC_CASE_SOURCES)) {
    assert.ok(KYC_CASES_SQL.includes(`FROM ${table}`), `falta leer ${table}`);
    assert.ok(KYC_CASES_SQL.includes(`'${source}'::text AS source`), `falta etiquetar ${source}`);
  }
});

test("toda tabla donde el código guarda verificaciones está declarada como fuente", async () => {
  const { KYC_CASE_SOURCES } = await import("../kyc/admin-cases");
  const declared = new Set<string>(Object.values(KYC_CASE_SOURCES));
  // Tablas que registran un intento de verificación por persona.
  const candidatas = ["kyc_dni_scans", "drop_validation_session_map"];
  const encontradas = new Set<string>();
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (f === "node_modules" || f === "__tests__" || f.startsWith(".")) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) {
        const src = readFileSync(p, "utf8");
        for (const t of candidatas) if (new RegExp(`INSERT INTO ${t}\\b`).test(src)) encontradas.add(t);
      }
    }
  };
  walk(path.join(ROOT, "lib"));
  walk(path.join(ROOT, "app"));
  for (const t of encontradas) assert.ok(declared.has(t), `se escribe en ${t} pero el panel no lo lee`);
  assert.ok(encontradas.size >= 2, "el test dejó de encontrar los INSERT de las fuentes; revisar el walker");
});

test("el panel usa listKycCases y no arma su propia consulta", () => {
  const page = readFileSync(path.join(ROOT, "app", "admin", "kyc", "page.tsx"), "utf8");
  assert.ok(page.includes("listKycCases("), "page.tsx debe usar listKycCases()");
  assert.ok(!/FROM\s+kyc_dni_scans/.test(page), "page.tsx no debe consultar kyc_dni_scans directo");
});
