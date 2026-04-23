/**
 * Tests para forense de imagen KYC.
 *
 * Adversariales programáticos (Fase 1):
 *   - CLEAN: gradiente JPEG estándar, sin manipulación.
 *   - TAMPERED: mismo gradiente con un bloque de ruido de alta frecuencia
 *     pegado encima. Como el bloque no vive en la cuantización natural
 *     del JPEG original, ELA genera diff mucho mayor que en el fondo.
 *
 * Fixtures reales de DNI auténtico/adulterado van en fase posterior — los
 * tests que los necesitan quedarán marcados con `.skip()` hasta que
 * agregues las imágenes en lib/kyc/__fixtures__/.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { analyzeDniForensics } from "../forensics";

/** Crea un JPEG "limpio": gradiente suave de 800x500, calidad 90. */
async function makeCleanJpeg(): Promise<Buffer> {
  const width = 800;
  const height = 500;
  const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      buf[i] = Math.floor((x / width) * 255);          // R gradient X
      buf[i + 1] = Math.floor((y / height) * 255);     // G gradient Y
      buf[i + 2] = 128;                                // B flat
    }
  }
  return sharp(buf, { raw: { width, height, channels } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/** Toma un JPEG y le pega encima un bloque de ruido no-cuantizado. */
async function makeTamperedJpeg(clean: Buffer): Promise<Buffer> {
  const patchSize = 120;
  const channels = 3;
  const patch = Buffer.alloc(patchSize * patchSize * channels);
  // Ruido uniforme random — rompe la distribución del JPEG original.
  for (let i = 0; i < patch.length; i++) {
    patch[i] = Math.floor(Math.random() * 256);
  }
  const patchImg = await sharp(patch, {
    raw: { width: patchSize, height: patchSize, channels },
  })
    .png()
    .toBuffer();

  return sharp(clean)
    .composite([{ input: patchImg, top: 180, left: 320 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

test("forensics — imagen limpia devuelve ELA score bajo", async () => {
  const clean = await makeCleanJpeg();
  const r = await analyzeDniForensics(clean);

  assert.ok(r.ela_score >= 0 && r.ela_score <= 1, "ela_score fuera de [0,1]");
  assert.ok(
    r.ela_score < 0.35,
    `esperaba ELA limpio < 0.35, obtuvo ${r.ela_score.toFixed(3)}`,
  );
  assert.equal(r.copy_move_score, 0, "stub copy_move debe ser 0");
  assert.equal(r.photo_edge_score, 0, "stub photo_edge debe ser 0");
  assert.equal(r.noise_consistency, 0, "stub noise debe ser 0");
});

test("forensics — imagen con bloque adulterado sube ELA vs limpia", async () => {
  const clean = await makeCleanJpeg();
  const tampered = await makeTamperedJpeg(clean);

  const cleanResult = await analyzeDniForensics(clean);
  const tamperedResult = await analyzeDniForensics(tampered);

  // La adulterada TIENE que tener más ELA que la limpia. No comparamos contra
  // un umbral absoluto porque depende del azar del ruido, pero la dirección
  // debe ser inequívoca.
  assert.ok(
    tamperedResult.ela_score > cleanResult.ela_score,
    `tampered=${tamperedResult.ela_score.toFixed(3)} debería > clean=${cleanResult.ela_score.toFixed(3)}`,
  );
  assert.ok(
    tamperedResult.ela_score > 0.05,
    `tampered ELA debería ser claramente >0, got ${tamperedResult.ela_score.toFixed(3)}`,
  );
});

test("forensics — input no-imagen retorna resultado neutral sin crashear", async () => {
  const garbage = Buffer.from("this is not an image at all, just text");
  const r = await analyzeDniForensics(garbage);

  assert.ok(r.ela_score >= 0 && r.ela_score <= 1);
  assert.ok(r.overall_tampering_risk >= 0 && r.overall_tampering_risk <= 1);
});

test("forensics — imagen enorme se downsamplea y no revienta memoria", async () => {
  // 4000x2500 pixels (10MP) — bien arriba del max de 1200px.
  const width = 4000;
  const height = 2500;
  const channels = 3;
  const buf = Buffer.alloc(width * height * channels, 128);
  const big = await sharp(buf, { raw: { width, height, channels } })
    .jpeg({ quality: 85 })
    .toBuffer();

  const r = await analyzeDniForensics(big);
  assert.ok(r.ela_score >= 0 && r.ela_score <= 1);
});

// Fixtures reales — marcados skip hasta que existan en lib/kyc/__fixtures__/
test.skip("forensics — DNI auténtico fixture tiene overall_tampering_risk < 0.2", async () => {
  // TODO: colocar lib/kyc/__fixtures__/dni-real-front.jpg (real, anonimizado)
  // const fs = await import("node:fs/promises");
  // const path = await import("node:path");
  // const buf = await fs.readFile(path.join(__dirname, "../__fixtures__/dni-real-front.jpg"));
  // const r = await analyzeDniForensics(buf);
  // assert.ok(r.overall_tampering_risk < 0.2);
});

test.skip("forensics — DNI con foto montada fixture supera 0.6", async () => {
  // TODO: generar lib/kyc/__fixtures__/dni-tampered-front.jpg
  // (script auxiliar: tomar dni-real-front.jpg, pegar otra cara encima con GIMP,
  // exportar JPEG Q=90). Esto valida ELA + copy-move + photo-edge conjuntos.
});
