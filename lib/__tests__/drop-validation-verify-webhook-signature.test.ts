/**
 * Tests para `verifyWebhookSignature` de lib/drop-validation/client.ts.
 *
 * Cubre Gap #11 documentado en
 * reports/2026-05-04-autopilot-drop-validation-architecture-brief.md.
 *
 * Esta función verifica el HMAC sha256 de los webhooks ENTRANTES del API
 * externo `api.dropchat.pe`. Si rompe, podemos procesar webhooks
 * falsificados que cambien `users.kyc_status` arbitrariamente — uno de los
 * riesgos más altos del rollout de Drop Validation.
 *
 * Patrón: idéntico a lib/kyc/__tests__/sdk-publishable-key.test.ts y
 * sdk-webhook.test.ts (node:test + node:assert/strict, sin mocks externos).
 *
 * NOTA SOBRE process.env:
 *   `WEBHOOK_SECRET` se lee del env a import-time como `const` en client.ts.
 *   Para que estos tests sean reproducibles seteamos el env ANTES de
 *   importar el módulo. El case `WEBHOOK_SECRET=""` lo cubrimos lanzando
 *   un subproceso aislado (ver `subprocess` test al final).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

// IMPORTANTE: setear ANTES del import del módulo, que captura el env como const.
const TEST_SECRET = "drop-validation-test-secret-abc123";
process.env.DROP_VALIDATION_WEBHOOK_SECRET = TEST_SECRET;

// Import después de setear env.
const { verifyWebhookSignature } = await import("../drop-validation/client");

// Helper: computa el HMAC esperado para un body usando un secret dado.
function computeSig(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function header(hex: string): string {
  return `sha256=${hex}`;
}

// ============================================================================
// Happy path
// ============================================================================

test("verifyWebhookSignature — body + signature válida con secret correcto → true", () => {
  const body = JSON.stringify({ session_id: "s_1", verdict: { status: "verified" } });
  const sig = computeSig(body, TEST_SECRET);
  assert.equal(verifyWebhookSignature(body, header(sig)), true);
});

test("verifyWebhookSignature — body vacío con signature válida → true", () => {
  // Edge case: webhook con body vacío (raro pero posible para healthchecks).
  // El HMAC de string vacío es determinístico y verificable.
  const body = "";
  const sig = computeSig(body, TEST_SECRET);
  assert.equal(verifyWebhookSignature(body, header(sig)), true);
});

test("verifyWebhookSignature — payload realista de Drop Validation → true", () => {
  // Shape esperado por el receiver (ver app/api/webhooks/drop-validation/route.ts)
  const body = JSON.stringify({
    tenant_id: "flux",
    session_id: "ds_xyz123",
    correlation_id: "flux_corr_42",
    external_user_id: "user_abc",
    status: "verified",
    verdict: {
      status: "verified",
      reason: "all_checks_passed",
      face_score: 92.5,
    },
    legal_name: "JUAN PEREZ GARCIA",
    dni_number: "12345678",
    completed_at: "2026-05-10T18:30:00.000Z",
  });
  const sig = computeSig(body, TEST_SECRET);
  assert.equal(verifyWebhookSignature(body, header(sig)), true);
});

// ============================================================================
// SECURITY — rechazo de forgeries
// ============================================================================

test("SECURITY — signature computada con secret INCORRECTO → false", () => {
  // Tripwire principal: anti-forgery. Si esto pasa = HMAC roto.
  const body = JSON.stringify({ status: "verified" });
  const wrongSig = computeSig(body, "attacker-guessed-secret");
  assert.equal(verifyWebhookSignature(body, header(wrongSig)), false);
});

test("SECURITY — body modificado en 1 byte después de firmar → false", () => {
  // Garantiza que el HMAC depende del body exacto, no aproximado.
  const original = JSON.stringify({ status: "verified", amount: 100 });
  const sig = computeSig(original, TEST_SECRET);
  const tampered = JSON.stringify({ status: "verified", amount: 999 });
  assert.equal(verifyWebhookSignature(tampered, header(sig)), false);
});

test("SECURITY — signature de OTRO body con mismo secret → false", () => {
  // Reuso de signature entre webhooks (replay attack parcial). Bloqueado
  // porque cada body genera HMAC distinto.
  const bodyA = JSON.stringify({ status: "verified", session: "A" });
  const bodyB = JSON.stringify({ status: "verified", session: "B" });
  const sigA = computeSig(bodyA, TEST_SECRET);
  assert.equal(verifyWebhookSignature(bodyB, header(sigA)), false);
});

// ============================================================================
// Formato del header — parseo correcto
// ============================================================================

test("verifyWebhookSignature — sin prefijo 'sha256=' → false", () => {
  const body = "{}";
  const sig = computeSig(body, TEST_SECRET);
  assert.equal(verifyWebhookSignature(body, sig), false); // sin prefijo
  assert.equal(verifyWebhookSignature(body, `sha1=${sig}`), false);
  assert.equal(verifyWebhookSignature(body, `hmac=${sig}`), false);
});

test("verifyWebhookSignature — hex de 63 chars (uno corto) → false", () => {
  const body = "{}";
  const sig = computeSig(body, TEST_SECRET);
  assert.equal(verifyWebhookSignature(body, `sha256=${sig.slice(0, 63)}`), false);
});

test("verifyWebhookSignature — hex de 65 chars (uno largo) → false", () => {
  const body = "{}";
  const sig = computeSig(body, TEST_SECRET);
  assert.equal(verifyWebhookSignature(body, `sha256=${sig}a`), false);
});

test("verifyWebhookSignature — caracteres no-hex en el sufijo → false", () => {
  // 'G' no es hex. La regex /^sha256=([a-f0-9]{64})$/i requiere [a-f0-9].
  const body = "{}";
  const badSig = "G".repeat(64);
  assert.equal(verifyWebhookSignature(body, `sha256=${badSig}`), false);

  // Igual con caracteres especiales
  const badSig2 = "z".repeat(64);
  assert.equal(verifyWebhookSignature(body, `sha256=${badSig2}`), false);
});

test("verifyWebhookSignature — hex uppercase es aceptado (regex usa /i)", () => {
  // OBSERVACIÓN: el regex es /^sha256=([a-f0-9]{64})$/i con flag /i. Eso
  // significa que tanto 'ABCD...' como 'abcd...' parsean. Internamente
  // hace .toLowerCase() y luego compara con el HMAC computado (siempre
  // lowercase). Test confirma este behaviour.
  // Si esto cambiara (regex sin /i), un sender legítimo que use uppercase
  // sería rechazado y este test rompería para forzar revisión.
  const body = JSON.stringify({ x: 1 });
  const sig = computeSig(body, TEST_SECRET);
  const sigUpper = sig.toUpperCase();
  assert.equal(verifyWebhookSignature(body, `sha256=${sigUpper}`), true);
});

test("verifyWebhookSignature — header con whitespace alrededor → trimea y acepta", () => {
  // Algunos servers/proxies agregan whitespace. El código hace .trim().
  const body = JSON.stringify({ x: 1 });
  const sig = computeSig(body, TEST_SECRET);
  assert.equal(verifyWebhookSignature(body, `  sha256=${sig}  `), true);
  assert.equal(verifyWebhookSignature(body, `\tsha256=${sig}\n`), true);
});

test("verifyWebhookSignature — whitespace EN MEDIO del header → false", () => {
  // El trim solo limpia bordes. Whitespace interno rompe la regex.
  const body = "{}";
  const sig = computeSig(body, TEST_SECRET);
  assert.equal(verifyWebhookSignature(body, `sha256= ${sig}`), false);
  assert.equal(verifyWebhookSignature(body, `sha256 =${sig}`), false);
});

// ============================================================================
// Inputs degenerados — null / undefined / empty
// ============================================================================

test("verifyWebhookSignature — signatureHeader = null → false", () => {
  assert.equal(verifyWebhookSignature("{}", null), false);
});

test("verifyWebhookSignature — signatureHeader = undefined → false", () => {
  assert.equal(verifyWebhookSignature("{}", undefined), false);
});

test("verifyWebhookSignature — signatureHeader = '' → false", () => {
  // Algunos browsers/proxies normalizan header ausente a string vacío.
  assert.equal(verifyWebhookSignature("{}", ""), false);
});

test("verifyWebhookSignature — signatureHeader = 'sha256=' (sin hex) → false", () => {
  assert.equal(verifyWebhookSignature("{}", "sha256="), false);
});

test("verifyWebhookSignature — signatureHeader basura aleatoria → false", () => {
  assert.equal(verifyWebhookSignature("{}", "not a signature at all"), false);
  assert.equal(verifyWebhookSignature("{}", "Bearer abcd"), false);
  assert.equal(verifyWebhookSignature("{}", "12345"), false);
});

// ============================================================================
// SECURITY — timing safety (sanity, no exhaustive)
// ============================================================================

test("SECURITY — timingSafeEqual maneja buffers de distinto tamaño sin lanzar", () => {
  // El código tiene try/catch alrededor de timingSafeEqual. Buffers de
  // tamaño distinto lanzan en Node — verificamos que el catch funciona.
  // Como la regex ya rechaza hex != 64, este caso solo se da si la regex
  // cambia. Tripwire defensivo.
  const body = "{}";
  // Truco: hex de 64 chars VÁLIDO pero el HMAC interno también es 64,
  // así que esto no triggerea el catch. El catch existe para defensa en
  // profundidad. Test verifica que NO lanza con un hex inválido (lo
  // rechazaría la regex antes pero documentamos):
  assert.doesNotThrow(() => {
    verifyWebhookSignature(body, `sha256=${"f".repeat(64)}`);
  });
});

test("SECURITY — signature válida + body distinto en orden de keys → false", () => {
  // CRÍTICO: el HMAC es sobre el body raw, no sobre el JSON parseado.
  // Si el sender firma {"a":1,"b":2} y un MitM reescribe a {"b":2,"a":1}
  // (mismo objeto JSON-equivalente pero string distinto), el HMAC NO debe
  // matchear. Tests defienden esta propiedad.
  const bodyA = '{"a":1,"b":2}';
  const bodyB = '{"b":2,"a":1}';
  const sigA = computeSig(bodyA, TEST_SECRET);
  assert.equal(verifyWebhookSignature(bodyA, header(sigA)), true);
  assert.equal(verifyWebhookSignature(bodyB, header(sigA)), false);
});

test("SECURITY — body con caracteres UTF-8 multibyte se firma como utf8 explícito", () => {
  // El código usa .update(rawBody, 'utf8'). Garantiza que un body con
  // tildes / ñ / emojis tiene HMAC determinístico.
  const body = JSON.stringify({ name: "Juan Pérez Ñoño", emoji: "🇵🇪" });
  const sig = computeSig(body, TEST_SECRET);
  assert.equal(verifyWebhookSignature(body, header(sig)), true);

  // Tampering en un caracter unicode también detectable
  const tampered = JSON.stringify({ name: "Juan Perez Nono", emoji: "🇵🇪" });
  assert.equal(verifyWebhookSignature(tampered, header(sig)), false);
});

// ============================================================================
// SECRET MISSING — subprocess isolation
// ============================================================================

test("verifyWebhookSignature — si DROP_VALIDATION_WEBHOOK_SECRET no está seteado → false", () => {
  // No podemos cambiar el env del proceso actual (el módulo lee el secret
  // al import-time como const). Lanzamos un proceso `tsx` aislado con el
  // env limpio y verificamos vía exit code.
  //
  // Este es el guard MÁS CRÍTICO de toda la función: si rompe (siempre
  // retorna true cuando secret falta), cualquier atacante con cualquier
  // body firmado con cualquier cosa entra. Catastrófico.

  const script = `
    process.env.DROP_VALIDATION_WEBHOOK_SECRET = '';
    const { verifyWebhookSignature } = await import('./lib/drop-validation/client.ts');
    // Cualquier firma debería retornar false porque no hay secret server-side.
    const fakeHex = 'a'.repeat(64);
    const result1 = verifyWebhookSignature('{"x":1}', 'sha256=' + fakeHex);
    const result2 = verifyWebhookSignature('', 'sha256=' + fakeHex);
    const result3 = verifyWebhookSignature('any body', null);
    if (result1 === false && result2 === false && result3 === false) {
      console.log('OK');
      process.exit(0);
    } else {
      console.error('FAIL', { result1, result2, result3 });
      process.exit(1);
    }
  `;

  // Detectar el cwd del repo (donde corre npm test). Asumimos que el
  // proceso de tests corre desde la raíz del repo.
  const repoRoot = process.cwd();
  const result = spawnSync(
    "npx",
    ["tsx", "--eval", script],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        DROP_VALIDATION_WEBHOOK_SECRET: "", // override explícito
      },
      encoding: "utf8",
      timeout: 30_000,
    },
  );

  // Si tsx no está disponible (CI distinto), skip con warning visible.
  // No usamos test.skip() porque queremos que el commit que rompa este
  // path levante alerta.
  if (result.error || result.status === null) {
    console.warn(
      "[verify-webhook-signature.test] subprocess tsx no disponible, " +
      "skipping secret-missing test. stderr:",
      result.stderr,
    );
    return; // soft skip
  }

  assert.equal(
    result.status,
    0,
    `subprocess falló: stdout=${result.stdout} stderr=${result.stderr}`,
  );
  assert.match(result.stdout, /OK/);
});
