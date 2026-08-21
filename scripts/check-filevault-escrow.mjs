#!/usr/bin/env node
/**
 * Revisa, equipo por equipo, si SimpleMDM ya tiene depositada la llave de
 * recuperación de FileVault.
 *
 * NO imprime la llave. Solo dice si existe o no, para que la salida se pueda
 * pegar en un chat o en un ticket sin filtrar un secreto.
 *
 * Uso:
 *   SIMPLEMDM_API_KEY=... node scripts/check-filevault-escrow.mjs
 *
 * El perfil que hace el depósito es "FileVault - deposito de llave de
 * recuperacion" (id 233202). Contexto en docs/RUNBOOK-ENDURECER-FLOTA.md.
 */

const API = "https://a.simplemdm.com/api/v1";
const key = process.env.SIMPLEMDM_API_KEY;

if (!key) {
  console.error("Falta SIMPLEMDM_API_KEY en el entorno.");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${key}:`).toString("base64");

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: auth } });
  if (res.status === 403) {
    // Pasó el 20-ago-2026: la cuenta se bloquea por facturación y todo da 403.
    throw new Error(`403 — ${await res.text()}`);
  }
  if (!res.ok) throw new Error(`${res.status} en ${path}: ${await res.text()}`);
  return res.json();
}

// La remediación automática de llaves faltantes pide macOS 26.0 o superior.
function soportaRemediacion(osVersion) {
  const major = Number.parseInt(String(osVersion ?? "").split(".")[0], 10);
  return Number.isFinite(major) && major >= 26;
}

const { data: devices } = await get("/devices?limit=100");

const filas = [];
for (const d of devices) {
  const { data } = await get(`/devices/${d.id}`);
  const a = data.attributes;
  filas.push({
    nombre: a.device_name ?? a.name ?? String(d.id),
    macos: a.os_version ?? "?",
    cifrado: a.filevault_enabled === true,
    depositada: Boolean(a.filevault_recovery_key), // nunca imprimimos el valor
    remediable: soportaRemediacion(a.os_version),
  });
}

const ancho = Math.max(...filas.map((f) => f.nombre.length), 6);
console.log(
  `${"EQUIPO".padEnd(ancho)}  ${"macOS".padEnd(8)}  CIFRADO  LLAVE DEPOSITADA`,
);
for (const f of filas.sort((x, y) => x.nombre.localeCompare(y.nombre))) {
  const nota = !f.depositada && !f.remediable ? "  (macOS < 26: no remedia solo)" : "";
  console.log(
    `${f.nombre.padEnd(ancho)}  ${f.macos.padEnd(8)}  ${f.cifrado ? "sí     " : "NO     "}  ${f.depositada ? "sí" : "todavía no"}${nota}`,
  );
}

const pendientes = filas.filter((f) => !f.depositada).length;
console.log(
  `\n${filas.length - pendientes} de ${filas.length} equipos con la llave depositada.`,
);
if (pendientes > 0) {
  console.log(
    "Los pendientes se resuelven solos cuando el equipo hace check-in y el usuario\n" +
      "autentica. Los que están en macOS 15 hay que actualizarlos, o apagar y volver\n" +
      "a prender FileVault en el equipo.",
  );
}
