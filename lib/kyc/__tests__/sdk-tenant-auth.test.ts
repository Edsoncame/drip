import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { authenticateTenant, type TenantLookupFn } from "../sdk/tenant-auth";
import type { DbSdkTenant } from "../sdk/schema";

function mockTenant(overrides: Partial<DbSdkTenant>): DbSdkTenant {
  return {
    id: "securex",
    name: "Securex",
    api_key_hash: bcrypt.hashSync("the-secret", 4),
    default_webhook_url: null,
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

test("authenticateTenant — header válido + secret correcto", async () => {
  const tenant = mockTenant({});
  const lookup: TenantLookupFn = async (id) => (id === "securex" ? tenant : null);
  const r = await authenticateTenant("Bearer securex:the-secret", lookup);
  assert.ok(r);
  assert.equal(r.tenant.id, "securex");
});

test("authenticateTenant — secret incorrecto → null", async () => {
  const tenant = mockTenant({});
  const lookup: TenantLookupFn = async () => tenant;
  const r = await authenticateTenant("Bearer securex:wrong-secret", lookup);
  assert.equal(r, null);
});

test("authenticateTenant — tenant no existe → null", async () => {
  const lookup: TenantLookupFn = async () => null;
  const r = await authenticateTenant("Bearer ghost:any-secret", lookup);
  assert.equal(r, null);
});

test("authenticateTenant — header sin Bearer → null", async () => {
  const r = await authenticateTenant("Token securex:the-secret", async () => null);
  assert.equal(r, null);
});

test("authenticateTenant — header sin colon → null", async () => {
  const r = await authenticateTenant("Bearer no-colon-in-here", async () => null);
  assert.equal(r, null);
});

test("authenticateTenant — colon al inicio (sin tenant_id) → null", async () => {
  const r = await authenticateTenant("Bearer :just-secret", async () => null);
  assert.equal(r, null);
});

test("authenticateTenant — colon al final (sin secret) → null", async () => {
  const r = await authenticateTenant("Bearer securex:", async () => null);
  assert.equal(r, null);
});

test("authenticateTenant — null header → null", async () => {
  const r = await authenticateTenant(null, async () => null);
  assert.equal(r, null);
});
