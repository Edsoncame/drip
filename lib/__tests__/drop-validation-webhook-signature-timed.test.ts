/**
 * Formato REAL con el que Drop Validation firma sus webhooks
 * (services/validation/sdk/webhook.ts del API, heredado del SDK KYC):
 *
 *   X-Flux-KYC-Signature: t=<unix_ts>,v1=<hex>
 *   hex = HMAC-SHA256(secret, `${t}.${rawBody}`)
 *
 * Hasta el 25-set-2026 el receptor solo aceptaba `sha256=<hmac(body)>`
 * y devolvía 401 a todos los webhooks reales. Estos tests fijan el reloj
 * con el tercer parámetro `nowSeconds`.
 */

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const TEST_SECRET = "drop-validation-test-secret-timed";
// El módulo captura el secret del env al importarse, así que se setea antes
// y se importa de forma diferida (el runner compila a CJS: sin top-level await).
process.env.DROP_VALIDATION_WEBHOOK_SECRET = TEST_SECRET;

let verifyWebhookSignature: typeof import("../drop-validation/client").verifyWebhookSignature;
before(async () => {
  ({ verifyWebhookSignature } = await import("../drop-validation/client"));
});

const NOW = 1_790_000_000;

function timedHeader(body: string, ts: number, secret = TEST_SECRET): string {
  const hex = createHmac("sha256", secret).update(`${ts}.${body}`, "utf8").digest("hex");
  return `t=${ts},v1=${hex}`;
}

test("timed — firma válida con timestamp actual → true", () => {
  const body = JSON.stringify({ session_id: "s_1", verdict: { status: "verified" } });
  assert.equal(verifyWebhookSignature(body, timedHeader(body, NOW), NOW), true);
});

test("timed — timestamp 4 minutos atrás sigue dentro de la tolerancia → true", () => {
  const body = "{}";
  assert.equal(verifyWebhookSignature(body, timedHeader(body, NOW - 240), NOW), true);
});

test("timed — timestamp 6 minutos atrás (replay) → false", () => {
  const body = "{}";
  assert.equal(verifyWebhookSignature(body, timedHeader(body, NOW - 360), NOW), false);
});

test("timed — timestamp 6 minutos en el futuro → false", () => {
  const body = "{}";
  assert.equal(verifyWebhookSignature(body, timedHeader(body, NOW + 360), NOW), false);
});

test("timed — SECURITY: secret incorrecto → false", () => {
  const body = JSON.stringify({ status: "verified" });
  assert.equal(verifyWebhookSignature(body, timedHeader(body, NOW, "otro-secret"), NOW), false);
});

test("timed — SECURITY: body alterado tras firmar → false", () => {
  const original = JSON.stringify({ status: "verified", user: "a" });
  const tampered = JSON.stringify({ status: "verified", user: "b" });
  assert.equal(verifyWebhookSignature(tampered, timedHeader(original, NOW), NOW), false);
});

test("timed — SECURITY: firma calculada sobre el body solo (sin `${t}.`) → false", () => {
  const body = "{}";
  const hexSinTs = createHmac("sha256", TEST_SECRET).update(body, "utf8").digest("hex");
  assert.equal(verifyWebhookSignature(body, `t=${NOW},v1=${hexSinTs}`, NOW), false);
});

test("timed — SECURITY: cambiar `t` en el header invalida la firma → false", () => {
  const body = "{}";
  const header = timedHeader(body, NOW).replace(`t=${NOW}`, `t=${NOW + 1}`);
  assert.equal(verifyWebhookSignature(body, header, NOW), false);
});

test("timed — header con whitespace alrededor se trimea → true", () => {
  const body = "{}";
  assert.equal(verifyWebhookSignature(body, `  ${timedHeader(body, NOW)}\n`, NOW), true);
});

test("timed — formatos malformados → false", () => {
  const body = "{}";
  const hex = "a".repeat(64);
  assert.equal(verifyWebhookSignature(body, `t=abc,v1=${hex}`, NOW), false);
  assert.equal(verifyWebhookSignature(body, `t=${NOW},v1=${hex.slice(0, 63)}`, NOW), false);
  assert.equal(verifyWebhookSignature(body, `v1=${hex},t=${NOW}`, NOW), false);
  assert.equal(verifyWebhookSignature(body, `t=${NOW}`, NOW), false);
});

test("legacy — el formato sha256= sigue funcionando tras el cambio", () => {
  const body = JSON.stringify({ status: "review" });
  const hex = createHmac("sha256", TEST_SECRET).update(body, "utf8").digest("hex");
  assert.equal(verifyWebhookSignature(body, `sha256=${hex}`, NOW), true);
});
