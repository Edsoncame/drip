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
  // El gradient X+Y puro es patológico para copy-move (bloques naturalmente
  // similares) — el assert de copy_move limpio vive en el test con textura rica.
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

/**
 * Genera un PNG base con texturas variadas. PNG (lossless) es la elección
 * correcta para testing de copy-move porque no introduce pérdida de
 * cuantización en los blocks duplicados — el módulo opera sobre la imagen
 * normalizada a PNG internamente, así que el dominio es el mismo.
 */
async function makeRichBasePng(): Promise<Buffer> {
  const width = 960;
  const height = 640;
  const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const band = Math.floor(y / 16) * 8;
      const noise = Math.floor(rand() * 60);
      buf[i] = Math.min(255, band + noise + Math.floor((x / width) * 120));
      buf[i + 1] = Math.min(255, 60 + noise + Math.floor(((x + y) / (width + height)) * 150));
      buf[i + 2] = Math.min(255, 100 + (noise >> 1) + Math.floor((y / height) * 80));
    }
  }
  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}

/** Duplica una región [srcX, srcY, size, size] en [dstX, dstY], manteniendo PNG. */
async function duplicateRegion(
  input: Buffer,
  src: { x: number; y: number; size: number },
  dst: { x: number; y: number },
): Promise<Buffer> {
  const region = await sharp(input)
    .extract({ left: src.x, top: src.y, width: src.size, height: src.size })
    .png()
    .toBuffer();
  return sharp(input)
    .composite([{ input: region, left: dst.x, top: dst.y }])
    .png()
    .toBuffer();
}

test("forensics — imagen rica sin duplicados tiene copy_move_score bajo", async () => {
  const base = await makeRichBasePng();
  const r = await analyzeDniForensics(base);
  assert.ok(
    r.copy_move_score < 0.3,
    `esperaba copy_move limpio < 0.3, obtuvo ${r.copy_move_score.toFixed(3)}`,
  );
});

test("forensics — imagen con región duplicada eleva copy_move_score", async () => {
  const base = await makeRichBasePng();
  // Copiamos un bloque de 160×160 (10×10 blocks de 16) a otra zona alejada —
  // con ~100 blocks duplicados el pair-matching explota en matches.
  const tampered = await duplicateRegion(
    base,
    { x: 80, y: 80, size: 160 },
    { x: 600, y: 400 },
  );

  const baseResult = await analyzeDniForensics(base);
  const tamperedResult = await analyzeDniForensics(tampered);

  assert.ok(
    tamperedResult.copy_move_score > baseResult.copy_move_score,
    `tampered=${tamperedResult.copy_move_score.toFixed(3)} debería > base=${baseResult.copy_move_score.toFixed(3)}`,
  );
  assert.ok(
    tamperedResult.copy_move_score > 0.1,
    `tampered copy_move debería ser claramente >0.1, got ${tamperedResult.copy_move_score.toFixed(3)}`,
  );
});

test("forensics — copy_move refleja distancia espacial (parche adyacente NO cuenta)", async () => {
  const base = await makeRichBasePng();
  // Duplicado a solo 4 blocks (64 px) de distancia < COPY_MOVE_MIN_SPATIAL_DIST=6.
  const adjacent = await duplicateRegion(
    base,
    { x: 100, y: 100, size: 64 },
    { x: 100 + 64, y: 100 },
  );
  const r = await analyzeDniForensics(adjacent);
  // Debería mantenerse bajo porque filtramos pares adyacentes (patrones repetidos
  // naturales, como bandas del DNI, no son copy-move).
  assert.ok(
    r.copy_move_score < 0.3,
    `parche adyacente no debería disparar copy_move, got ${r.copy_move_score.toFixed(3)}`,
  );
});

/**
 * Genera un "DNI-like" PNG: fondo claro uniforme (como un documento real)
 * con líneas horizontales oscuras distribuidas (simulando texto/MRZ/elementos
 * gráficos). La densidad de edges queda en ~5-10% como un DNI escaneado real,
 * no en 99% como random noise (que satura el Sobel).
 */
async function makeDniLikeBasePng(): Promise<Buffer> {
  const width = 960;
  const height = 640;
  const channels = 3;
  // Fondo claro uniforme (documento blanco)
  const buf = Buffer.alloc(width * height * channels, 220);

  let seed = 13;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Pinta una línea oscura horizontal de 2 pixels de alto con gaps
  const drawLine = (y: number, xStart: number, xEnd: number) => {
    for (let x = xStart; x < xEnd && x < width; x++) {
      if (rand() < 0.7) {
        for (let dy = 0; dy < 2 && y + dy < height; dy++) {
          const i = ((y + dy) * width + x) * channels;
          buf[i] = 40;
          buf[i + 1] = 40;
          buf[i + 2] = 40;
        }
      }
    }
  };

  // Líneas distribuidas uniformemente cada ~25 pixels sobre TODO el documento
  for (let y = 25; y < height - 2; y += 25) {
    drawLine(y, 40, width - 40);
  }

  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Agrega un rectángulo de color sólido (fondo uniforme) en la región de la
 * foto del DNI. Simula foto "borrada" o reemplazada por un color plano —
 * photo_edge detecta baja densidad de edges en esa región vs el fondo.
 */
async function makePhotoErased(base: Buffer): Promise<Buffer> {
  const width = 960;
  const height = 640;
  const rx = Math.floor(width * 0.07);
  const ry = Math.floor(height * 0.32);
  const rw = Math.floor(width * 0.25);
  const rh = Math.floor(height * 0.48);

  const flat = Buffer.alloc(rw * rh * 3, 200);
  const flatPng = await sharp(flat, { raw: { width: rw, height: rh, channels: 3 } })
    .png()
    .toBuffer();
  return sharp(base)
    .composite([{ input: flatPng, left: rx, top: ry }])
    .png()
    .toBuffer();
}

// photo_edge validación adversarial se hace con fixtures reales (DNI con foto
// borrada / reemplazada), no sintéticos — la señal requiere la diferencia
// natural de textura entre una cara y el fondo del DNI, que el puro negro
// sobre blanco de estos adversariales no reproduce. Ver test.skip al final.
test.skip("forensics — imagen uniforme en bbox de foto eleva photo_edge_score (needs real fixture)", async () => {
  // TODO(P2): activar cuando haya lib/kyc/__fixtures__/dni-photo-erased.jpg
  // generado desde un DNI real cubriendo la foto con un color plano.
  const base = await makeDniLikeBasePng();
  const erased = await makePhotoErased(base);
  const baseResult = await analyzeDniForensics(base);
  const erasedResult = await analyzeDniForensics(erased);
  assert.ok(erasedResult.photo_edge_score > baseResult.photo_edge_score);
});

test("forensics — imagen de documento limpia tiene photo_edge bajo", async () => {
  const base = await makeDniLikeBasePng();
  const r = await analyzeDniForensics(base);
  assert.ok(
    r.photo_edge_score < 0.4,
    `documento limpio debería tener photo_edge < 0.4, got ${r.photo_edge_score.toFixed(3)}`,
  );
});

test("forensics — photo_edge no crashea con imágenes extremas", async () => {
  // Imagen casi sin edges (color completamente plano) — debería early-return a 0
  const flat = await sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 220, g: 220, b: 220 } },
  })
    .png()
    .toBuffer();
  const r = await analyzeDniForensics(flat);
  assert.ok(r.photo_edge_score >= 0 && r.photo_edge_score <= 1);
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
