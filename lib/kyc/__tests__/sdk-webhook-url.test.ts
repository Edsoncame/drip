import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidWebhookUrl } from "../sdk/webhook-url";

test("webhook-url — https público válido pasa", () => {
  assert.equal(isValidWebhookUrl("https://securex.pe/api/kyc-webhook"), true);
  assert.equal(isValidWebhookUrl("https://api.example.com:8443/hook"), true);
});

test("webhook-url — bloquea http://", () => {
  assert.equal(isValidWebhookUrl("http://securex.pe/api/kyc-webhook"), false);
});

test("webhook-url — bloquea esquemas no http", () => {
  assert.equal(isValidWebhookUrl("file:///etc/passwd"), false);
  assert.equal(isValidWebhookUrl("data:text/plain,hello"), false);
  assert.equal(isValidWebhookUrl("ftp://example.com"), false);
});

test("webhook-url — bloquea localhost/loopback", () => {
  assert.equal(isValidWebhookUrl("https://localhost/hook"), false);
  assert.equal(isValidWebhookUrl("https://app.localhost/hook"), false);
  assert.equal(isValidWebhookUrl("https://127.0.0.1/hook"), false);
  assert.equal(isValidWebhookUrl("https://127.5.6.7/hook"), false);
  assert.equal(isValidWebhookUrl("https://0.0.0.0/hook"), false);
});

test("webhook-url — bloquea IPs privadas RFC1918", () => {
  assert.equal(isValidWebhookUrl("https://10.0.0.1/hook"), false);
  assert.equal(isValidWebhookUrl("https://192.168.1.1/hook"), false);
  assert.equal(isValidWebhookUrl("https://172.16.0.1/hook"), false);
  assert.equal(isValidWebhookUrl("https://172.31.255.255/hook"), false);
});

test("webhook-url — 172.x fuera de RFC1918 sí pasa", () => {
  // 172.32.x está fuera del rango privado 172.16-31
  assert.equal(isValidWebhookUrl("https://172.32.0.1/hook"), true);
  assert.equal(isValidWebhookUrl("https://172.15.0.1/hook"), true);
});

test("webhook-url — bloquea metadata service AWS/GCP/Azure", () => {
  assert.equal(isValidWebhookUrl("https://169.254.169.254/latest/meta-data/"), false);
});

test("webhook-url — bloquea IPv6 loopback + link-local + ULA", () => {
  assert.equal(isValidWebhookUrl("https://[::1]/hook"), false);
  assert.equal(isValidWebhookUrl("https://[fe80::1]/hook"), false);
  assert.equal(isValidWebhookUrl("https://[fc00::1]/hook"), false);
  assert.equal(isValidWebhookUrl("https://[fd12::1]/hook"), false);
});

test("webhook-url — strings basura rechazados", () => {
  assert.equal(isValidWebhookUrl("not-a-url"), false);
  assert.equal(isValidWebhookUrl(""), false);
  assert.equal(isValidWebhookUrl("https://"), false);
});
