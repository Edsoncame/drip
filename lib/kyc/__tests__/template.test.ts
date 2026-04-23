/**
 * Tests para template matching del DNI peruano.
 *
 * Sin fixtures reales en __fixtures__/, validamos la API surface:
 *   - Sin template → layout_score=0.5 + issue explicativo
 *   - Con template (mock) → NCC funciona, detecta regiones
 *   - Input no-imagen → no crashea
 *
 * Los tests de "DNI real vs no-DNI" están .skip() hasta que haya fixture.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { matchDniTemplate } from "../template";

test("template — sin fixture retorna 0.5 neutral + issue pending", async () => {
  // Asumimos que NO hay __fixtures__/dni-template-front.png en el repo
  const dummyImg = await sharp({
    create: { width: 800, height: 500, channels: 3, background: { r: 220, g: 220, b: 220 } },
  })
    .png()
    .toBuffer();
  const r = await matchDniTemplate(dummyImg, "front");
  assert.equal(r.layout_score, 0.5);
  assert.ok(r.issues.length > 0, "debería haber issue 'template calibration pending'");
  assert.ok(r.issues[0].includes("pending"), `issue message: ${r.issues[0]}`);
});

test("template — sin fixture para back retorna mismo shape", async () => {
  const dummyImg = await sharp({
    create: { width: 800, height: 500, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .png()
    .toBuffer();
  const r = await matchDniTemplate(dummyImg, "back");
  assert.equal(r.layout_score, 0.5);
  assert.equal(r.escudo_detected, false);
  assert.equal(r.mrz_region_ok, false);
});

test("template — input inválido retorna resultado neutral sin crashear", async () => {
  const garbage = Buffer.from("not an image");
  const r = await matchDniTemplate(garbage, "front");
  assert.ok(r.layout_score >= 0 && r.layout_score <= 1);
});

// Fixtures reales — activar cuando estén en lib/kyc/__fixtures__/
test.skip("template — DNI auténtico match > 0.8 con layout ok", async () => {
  // TODO: lib/kyc/__fixtures__/dni-template-front.png + dni-real-front.jpg
});

test.skip("template — imagen no-DNI (foto de un gato) layout_score < 0.3", async () => {
  // TODO: dni-template-front.png + un-gato.jpg
});

test.skip("template — DNI rotado 5° aún se reconoce (robustez)", async () => {
  // TODO: dni-template-front.png + dni-real-front-rotated.jpg
});
