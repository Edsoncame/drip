import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signSessionToken,
  verifySessionToken,
  extractBearer,
} from "../sdk/session-token";

test("sdk-token — roundtrip (sign → verify)", async () => {
  const { token, expiresAt } = await signSessionToken({
    session_id: "sess-123",
    tenant_id: "securex",
  });
  assert.ok(token.split(".").length === 3);
  assert.ok(expiresAt.getTime() > Date.now());

  const payload = await verifySessionToken(token);
  assert.ok(payload);
  assert.equal(payload.session_id, "sess-123");
  assert.equal(payload.tenant_id, "securex");
});

test("sdk-token — token expirado retorna null", async () => {
  const { token } = await signSessionToken(
    { session_id: "s", tenant_id: "t" },
    -10, // negative TTL → ya expiró
  );
  const payload = await verifySessionToken(token);
  assert.equal(payload, null);
});

test("sdk-token — token basura retorna null", async () => {
  const p = await verifySessionToken("no-un-jwt");
  assert.equal(p, null);
});

test("sdk-token — token firmado con otro secret no valida", async () => {
  // Simulamos "otro secret" firmando con SignJWT directo
  const { SignJWT } = await import("jose");
  const fakeSecret = new TextEncoder().encode("OTHER");
  const forged = await new SignJWT({ session_id: "x", tenant_id: "y" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("flux-kyc")
    .setAudience("flux-kyc-sdk")
    .setExpirationTime("10m")
    .sign(fakeSecret);
  const payload = await verifySessionToken(forged);
  assert.equal(payload, null);
});

test("extractBearer — header válido", () => {
  assert.equal(extractBearer("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(extractBearer("bearer xyz"), "xyz");
});

test("extractBearer — sin header, sin bearer, null", () => {
  assert.equal(extractBearer(null), null);
  assert.equal(extractBearer(""), null);
  assert.equal(extractBearer("Token abc"), null);
  assert.equal(extractBearer("Bearer "), null);
});
