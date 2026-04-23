/**
 * Tests para helpers puros de calibration (percentile + breakdown).
 *
 * Correr con:
 *   node --test --import tsx lib/kyc/__tests__/calibration.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { percentile, breakdown } from "../calibration";

/* ────────────────────────────────────────────────────────────────── */
/* percentile()                                                        */
/* ────────────────────────────────────────────────────────────────── */

test("percentile — array vacío devuelve NaN", () => {
  assert.ok(Number.isNaN(percentile([], 0.5)));
});

test("percentile — array de 1 elemento devuelve ese elemento para cualquier p", () => {
  assert.equal(percentile([42], 0), 42);
  assert.equal(percentile([42], 0.5), 42);
  assert.equal(percentile([42], 0.99), 42);
  assert.equal(percentile([42], 1), 42);
});

test("percentile — P50 de [1,2,3,4] = 2.5 (interpolación lineal)", () => {
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
});

test("percentile — P0 y P100 = min y max", () => {
  const arr = [1, 2, 3, 4, 5];
  assert.equal(percentile(arr, 0), 1);
  assert.equal(percentile(arr, 1), 5);
});

test("percentile — distribución típica de scores KYC matchea expectativa numpy", () => {
  // Valores similares a overall_tampering_risk en DNIs legítimos:
  // mayoría baja, cola derecha suave.
  const scores = [0.05, 0.08, 0.12, 0.15, 0.18, 0.22, 0.28, 0.35, 0.45, 0.62];
  // P50 de 10 valores pre-sorteados: idx=4.5 → 0.18 + 0.5*(0.22-0.18) = 0.20
  assert.equal(percentile(scores, 0.5), 0.2);
  // P95: idx=8.55 → 0.45 + 0.55*(0.62-0.45) = 0.5435
  assert.ok(Math.abs(percentile(scores, 0.95) - 0.5435) < 1e-9);
});

test("percentile — requiere input sorteado ASC (no re-ordena)", () => {
  // Contrato: el caller debe haber sorteado. Si no lo hace, el resultado
  // es basura pero determinístico. breakdown() es el wrapper que sortea.
  const unsorted = [5, 1, 3, 2, 4];
  const asIfSorted = percentile(unsorted, 0.5); // toma idx=2 → 3
  assert.equal(asIfSorted, 3);
});

/* ────────────────────────────────────────────────────────────────── */
/* breakdown()                                                         */
/* ────────────────────────────────────────────────────────────────── */

test("breakdown — array vacío: n=0 y todos los percentiles NaN", () => {
  const b = breakdown([]);
  assert.equal(b.n, 0);
  assert.ok(Number.isNaN(b.p50));
  assert.ok(Number.isNaN(b.p95));
  assert.ok(Number.isNaN(b.max));
});

test("breakdown — descarta NaN e Infinity silenciosamente", () => {
  const b = breakdown([0.1, 0.2, NaN, Infinity, -Infinity, 0.3]);
  assert.equal(b.n, 3);
  assert.equal(b.p50, 0.2);
  assert.equal(b.max, 0.3);
});

test("breakdown — sortea internamente antes de percentilar", () => {
  const b = breakdown([0.62, 0.05, 0.28, 0.12, 0.45, 0.08, 0.18, 0.22, 0.35, 0.15]);
  assert.equal(b.n, 10);
  assert.equal(b.p50, 0.2);
  // Cola derecha (los scores sospechosos). Con 10 valores P95 interpola entre
  // pos 8 (0.45) y pos 9 (0.62) → 0.45 + 0.55*(0.62-0.45) = 0.5435
  assert.ok(Math.abs(b.p95 - 0.5435) < 1e-9);
  assert.equal(b.max, 0.62);
});

test("breakdown — un solo valor: P50=P95=P99=max", () => {
  const b = breakdown([0.42]);
  assert.equal(b.n, 1);
  assert.equal(b.p50, 0.42);
  assert.equal(b.p95, 0.42);
  assert.equal(b.p99, 0.42);
  assert.equal(b.max, 0.42);
});

test("breakdown — no muta el input", () => {
  const input = [3, 1, 2];
  breakdown(input);
  assert.deepEqual(input, [3, 1, 2]);
});

test("breakdown — threshold README §7 identificable: P95<0.4 y P99<0.6 son comparables", () => {
  // Simulación: 100 scans legítimos con distribución conservadora.
  const legit = Array.from({ length: 100 }, (_, i) => {
    // Valores concentrados abajo con cola suave
    if (i < 90) return 0.05 + (i / 90) * 0.25; // 0.05 → 0.30
    if (i < 98) return 0.30 + ((i - 90) / 8) * 0.08; // 0.30 → 0.38
    return 0.38 + ((i - 98) / 2) * 0.15; // 0.38 → 0.53
  });
  const b = breakdown(legit);
  assert.equal(b.n, 100);
  assert.ok(b.p95 < 0.4, `P95=${b.p95} no pasa el gate`);
  assert.ok(b.p99 < 0.6, `P99=${b.p99} no pasa el gate`);
});
