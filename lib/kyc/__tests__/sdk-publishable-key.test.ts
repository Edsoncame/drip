import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generatePublishableKey,
  parseTenantIdFromPk,
  isOriginAllowed,
} from "../sdk/publishable-key";

// ============================================================================
// generatePublishableKey
// ============================================================================

test("generatePublishableKey — formato pk_<tenantId>_<48hex>", () => {
  const pk = generatePublishableKey("securex");
  assert.match(pk, /^pk_securex_[0-9a-f]{48}$/);
});

test("generatePublishableKey — tenant_id con guiones y números preservado", () => {
  const pk = generatePublishableKey("acme-corp-2026");
  assert.match(pk, /^pk_acme-corp-2026_[0-9a-f]{48}$/);
});

test("generatePublishableKey — tenant_id con underscores preservado", () => {
  const pk = generatePublishableKey("test_tenant_01");
  assert.match(pk, /^pk_test_tenant_01_[0-9a-f]{48}$/);
});

test("generatePublishableKey — dos calls producen sufijos distintos (entropía)", () => {
  const a = generatePublishableKey("t1");
  const b = generatePublishableKey("t1");
  assert.notEqual(a, b);
  // ambos válidos
  assert.match(a, /^pk_t1_[0-9a-f]{48}$/);
  assert.match(b, /^pk_t1_[0-9a-f]{48}$/);
});

test("generatePublishableKey — sufijo es exactamente 48 hex chars (192 bits)", () => {
  const pk = generatePublishableKey("x");
  // pk_x_<48hex> = "pk_" + "x" + "_" + 48 = 52 chars cuando tenant_id = 1 char
  const parts = pk.split("_");
  // ["pk", "x", "<48hex>"]
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "pk");
  assert.equal(parts[1], "x");
  assert.equal(parts[2].length, 48);
});

// ============================================================================
// parseTenantIdFromPk — happy path
// ============================================================================

test("parseTenantIdFromPk — round-trip con generatePublishableKey", () => {
  const pk = generatePublishableKey("securex");
  assert.equal(parseTenantIdFromPk(pk), "securex");
});

test("parseTenantIdFromPk — tenant_id con guiones", () => {
  const pk = generatePublishableKey("acme-corp");
  assert.equal(parseTenantIdFromPk(pk), "acme-corp");
});

test("parseTenantIdFromPk — tenant_id con underscores se parsea correctamente", () => {
  // Caso interesante: el sufijo se separa por el ÚLTIMO underscore antes del
  // bloque hex de 48 chars. La regex `^pk_(.+)_[0-9a-f]{48}$` con [a-zA-Z0-9_-]+
  // greedy + lookahead final: el tenant_id captura "test_tenant_01".
  const pk = generatePublishableKey("test_tenant_01");
  assert.equal(parseTenantIdFromPk(pk), "test_tenant_01");
});

test("parseTenantIdFromPk — tenant_id alfanumérico mixto", () => {
  const pk = generatePublishableKey("Acme123");
  assert.equal(parseTenantIdFromPk(pk), "Acme123");
});

// ============================================================================
// parseTenantIdFromPk — rechaza formatos malos
// ============================================================================

test("parseTenantIdFromPk — null si falta prefijo pk_", () => {
  // 48 hex chars válidos pero sin prefijo correcto
  const hex48 = "a".repeat(48);
  assert.equal(parseTenantIdFromPk(`sk_securex_${hex48}`), null);
  assert.equal(parseTenantIdFromPk(`securex_${hex48}`), null);
});

test("parseTenantIdFromPk — null si sufijo hex es muy corto", () => {
  assert.equal(parseTenantIdFromPk("pk_securex_abc123"), null);
  assert.equal(parseTenantIdFromPk(`pk_securex_${"a".repeat(47)}`), null);
});

test("parseTenantIdFromPk — null si sufijo hex es muy largo", () => {
  assert.equal(parseTenantIdFromPk(`pk_securex_${"a".repeat(49)}`), null);
});

test("parseTenantIdFromPk — null si sufijo no es hex (G no es hex)", () => {
  assert.equal(parseTenantIdFromPk(`pk_securex_${"G".repeat(48)}`), null);
});

test("parseTenantIdFromPk — null si sufijo es uppercase hex (regex es lowercase)", () => {
  // OBSERVACIÓN: la regex usa [0-9a-f] sin /i. Esto es CORRECTO porque
  // randomBytes().toString('hex') siempre devuelve lowercase.
  // Pero si un humano construye una pk con sufijo uppercase, la rechazaríamos.
  assert.equal(parseTenantIdFromPk(`pk_securex_${"A".repeat(48)}`), null);
});

test("parseTenantIdFromPk — null si tenant_id está vacío", () => {
  assert.equal(parseTenantIdFromPk(`pk__${"a".repeat(48)}`), null);
});

test("parseTenantIdFromPk — null para strings basura", () => {
  assert.equal(parseTenantIdFromPk(""), null);
  assert.equal(parseTenantIdFromPk("not-a-pk"), null);
  assert.equal(parseTenantIdFromPk("pk_"), null);
  assert.equal(parseTenantIdFromPk("pk__"), null);
});

test("parseTenantIdFromPk — null si tenant_id contiene chars inválidos (espacios/punto)", () => {
  // Char class actual: [a-zA-Z0-9_-]
  assert.equal(parseTenantIdFromPk(`pk_acme.corp_${"a".repeat(48)}`), null);
  assert.equal(parseTenantIdFromPk(`pk_acme corp_${"a".repeat(48)}`), null);
  assert.equal(parseTenantIdFromPk(`pk_acme/corp_${"a".repeat(48)}`), null);
});

// ============================================================================
// isOriginAllowed — happy path
// ============================================================================

test("isOriginAllowed — match exacto pasa", () => {
  assert.equal(
    isOriginAllowed("https://securex.pe", ["https://securex.pe"]),
    true,
  );
});

test("isOriginAllowed — múltiples allowed, uno matchea", () => {
  const allowed = [
    "https://securex.pe",
    "https://app.securex.pe",
    "https://staging.securex.pe",
  ];
  assert.equal(isOriginAllowed("https://app.securex.pe", allowed), true);
});

test("isOriginAllowed — match con port preservado", () => {
  assert.equal(
    isOriginAllowed("https://api.example.com:8443", ["https://api.example.com:8443"]),
    true,
  );
});

test("isOriginAllowed — origin del request con trailing slash NO viene del browser, pero allowed mal pegado por humano sí: normalize lo limpia", () => {
  // Caso realista: el admin del tenant copia la URL desde la barra y la pega
  // como "https://securex.pe/" (con slash). El browser manda Origin sin slash.
  // El normalize debe arreglar el lado de allowed_origins.
  assert.equal(
    isOriginAllowed("https://securex.pe", ["https://securex.pe/"]),
    true,
  );
});

test("isOriginAllowed — múltiples trailing slashes también se normalizan", () => {
  assert.equal(
    isOriginAllowed("https://securex.pe", ["https://securex.pe///"]),
    true,
  );
});

test("isOriginAllowed — whitespace alrededor de allowed se trimea", () => {
  assert.equal(
    isOriginAllowed("https://securex.pe", ["  https://securex.pe  "]),
    true,
  );
});

// ============================================================================
// isOriginAllowed — rechazos críticos de seguridad
// ============================================================================

test("SECURITY — isOriginAllowed bloquea http si solo https está allowed", () => {
  // Sin esto, un atacante podría servir un site http:// y robar verdicts.
  assert.equal(
    isOriginAllowed("http://securex.pe", ["https://securex.pe"]),
    false,
  );
});

test("SECURITY — isOriginAllowed bloquea subdominio si solo apex está allowed", () => {
  // El comentario del módulo es explícito: el tenant debe whitelist cada variante.
  assert.equal(
    isOriginAllowed("https://www.securex.pe", ["https://securex.pe"]),
    false,
  );
  assert.equal(
    isOriginAllowed("https://evil.securex.pe", ["https://securex.pe"]),
    false,
  );
});

test("SECURITY — isOriginAllowed bloquea apex si solo www está allowed", () => {
  assert.equal(
    isOriginAllowed("https://securex.pe", ["https://www.securex.pe"]),
    false,
  );
});

test("SECURITY — isOriginAllowed bloquea port mismatch", () => {
  assert.equal(
    isOriginAllowed("https://api.example.com:8443", ["https://api.example.com"]),
    false,
  );
  assert.equal(
    isOriginAllowed("https://api.example.com", ["https://api.example.com:8443"]),
    false,
  );
  assert.equal(
    isOriginAllowed("https://api.example.com:443", ["https://api.example.com"]),
    false,
  );
});

test("SECURITY — isOriginAllowed bloquea path injection (origin nunca debería tener path)", () => {
  // El header Origin del browser nunca incluye path. Si llega uno, rechazar.
  assert.equal(
    isOriginAllowed("https://securex.pe/admin", ["https://securex.pe"]),
    false,
  );
});

test("SECURITY — isOriginAllowed rechaza origin null/undefined/vacío", () => {
  assert.equal(isOriginAllowed(null, ["https://securex.pe"]), false);
  assert.equal(isOriginAllowed(undefined, ["https://securex.pe"]), false);
  assert.equal(isOriginAllowed("", ["https://securex.pe"]), false);
});

test("SECURITY — isOriginAllowed rechaza si allowed array vacío (default seguro)", () => {
  assert.equal(isOriginAllowed("https://securex.pe", []), false);
});

test("SECURITY — isOriginAllowed rechaza si origin = 'null' string (browsers anónimos)", () => {
  // Browsers mandan "Origin: null" para sandbox iframes / file:// etc.
  // Como nadie va a tener "null" en su whitelist, la implementación rechaza
  // por no-match. Test confirma este behaviour.
  assert.equal(isOriginAllowed("null", ["https://securex.pe"]), false);
});

test("SECURITY — isOriginAllowed es CASE-SENSITIVE (limitación conocida)", () => {
  // RFC 6454: el origin es case-insensitive en scheme y host. Sin embargo
  // la implementación actual hace string compare directo. Browsers reales
  // (Chrome/Firefox/Safari) emiten Origin lowercase, así que en práctica
  // no hay regresión, pero documentamos el behaviour.
  // Si esto cambia (cliente exótico manda uppercase), el test falla y nos
  // alerta para agregar `.toLowerCase()` al normalize.
  assert.equal(
    isOriginAllowed("HTTPS://SECUREX.PE", ["https://securex.pe"]),
    false,
  );
  assert.equal(
    isOriginAllowed("https://Securex.pe", ["https://securex.pe"]),
    false,
  );
});

test("isOriginAllowed — múltiples allowed, ninguno matchea", () => {
  const allowed = [
    "https://securex.pe",
    "https://app.securex.pe",
  ];
  assert.equal(isOriginAllowed("https://attacker.com", allowed), false);
});

test("isOriginAllowed — short-circuit cuando allowed vacío evita iterar", () => {
  // Sanity: que el guard de length === 0 funcione antes del .some()
  assert.equal(isOriginAllowed("https://anything.com", []), false);
});
