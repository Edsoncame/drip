/**
 * Tests para age consistency — mockeamos la detección Rekognition con
 * `AgeDetectFn` inyectado, así no tocamos AWS en el test runner.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAgeConsistency, ageFromDob } from "../age-consistency";

test("ageFromDob — fecha válida", () => {
  const age = ageFromDob("1990-05-15", new Date(2026, 4, 15));
  assert.equal(age, 36);
});

test("ageFromDob — antes del cumpleaños del año", () => {
  const age = ageFromDob("1990-08-15", new Date(2026, 4, 15));
  assert.equal(age, 35);
});

test("ageFromDob — formato inválido retorna NaN", () => {
  assert.ok(isNaN(ageFromDob("15/05/1990")));
  assert.ok(isNaN(ageFromDob("")));
});

test("age-consistency — dni_age dentro del rango Rekognition → within_range", async () => {
  const mockDetect = async () => ({ low: 33, high: 40 });
  // hoy 2026-04-22, DNI dob 1990 → age 36 → debe estar en [33-3, 40+3] = [30, 43]
  const r = await checkAgeConsistency(
    Buffer.alloc(10),
    "1990-04-22",
    mockDetect,
    3,
  );
  assert.equal(r.within_range, true);
  assert.equal(r.deviation_years, 0);
  assert.equal(r.estimated_age_low, 33);
  assert.equal(r.estimated_age_high, 40);
});

test("age-consistency — dni_age muy por debajo del rango", async () => {
  const mockDetect = async () => ({ low: 40, high: 50 });
  // DNI dice 2010 → age 15 → tolerancia [37, 53] → fuera
  const r = await checkAgeConsistency(
    Buffer.alloc(10),
    "2010-04-22",
    mockDetect,
    3,
  );
  assert.equal(r.within_range, false);
  assert.ok(r.deviation_years > 20, `deviation=${r.deviation_years}`);
});

test("age-consistency — dni_age muy por encima del rango (selfie joven, DNI viejo)", async () => {
  const mockDetect = async () => ({ low: 18, high: 25 });
  const r = await checkAgeConsistency(
    Buffer.alloc(10),
    "1960-04-22",
    mockDetect,
    3,
  );
  assert.equal(r.within_range, false);
  assert.ok(r.deviation_years > 30, `deviation=${r.deviation_years}`);
});

test("age-consistency — Rekognition falla → no flag (within_range=true, deviation=0)", async () => {
  const mockDetect = async () => null;
  const r = await checkAgeConsistency(Buffer.alloc(10), "1990-04-22", mockDetect, 3);
  assert.equal(r.within_range, true);
  assert.equal(r.deviation_years, 0);
});

test("age-consistency — DOB inválido retorna shape vacío", async () => {
  const mockDetect = async () => ({ low: 30, high: 40 });
  const r = await checkAgeConsistency(Buffer.alloc(10), "not-a-date", mockDetect, 3);
  assert.equal(r.dni_age, 0);
  assert.equal(r.within_range, false);
});
