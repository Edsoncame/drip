/**
 * Template matching del DNI peruano.
 *
 * Detecta si una imagen tiene el layout esperado de un DNI auténtico
 * chequeando 3 regiones clave:
 *   1. Escudo nacional (esquina superior izquierda, anverso)
 *   2. Foto del titular (lado izquierdo-medio, anverso)
 *   3. Región MRZ (banda inferior, reverso)
 *
 * Usa normalized cross-correlation (NCC) contra fixtures auténticos del DNI
 * peruano. La salida es un score layout 0-1 y flags por cada región.
 *
 * Estado actual (2026-04-22):
 *   El algoritmo NCC está implementado y funciona cuando hay fixtures reales
 *   en lib/kyc/__fixtures__/dni-template-{front,back}.png. Sin fixtures, la
 *   función retorna un resultado "pending calibration" con layout_score 0.5
 *   (neutral — no afirma ni niega) y un issue explicativo. Esto permite que
 *   la Fase 4 del pipeline lo integre al verify/arbiter ya, y cuando el
 *   admin coloque las imágenes reales el signal se activa sin deploy.
 */

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

export interface TemplateMatchResult {
  /** 0-1, 1 = layout correcto */
  layout_score: number;
  /** escudo nacional detectado en posición esperada */
  escudo_detected: boolean;
  /** caja de la foto del titular en posición esperada */
  photo_bbox_ok: boolean;
  /** región MRZ en el lugar correcto (solo back) */
  mrz_region_ok: boolean;
  /** descripciones human-readable para el arbiter */
  issues: string[];
}

const TEMPLATE_DIR = path.join(__dirname, "__fixtures__");
/** Resolución a la que se normaliza la imagen query + el template. */
const TEMPLATE_NORM_WIDTH = 800;
/** Score NCC ≥ este umbral = región detectada. */
const NCC_MIN = 0.7;

interface TemplateRegion {
  /** Nombre human-readable para el resultado */
  key: "escudo_detected" | "photo_bbox_ok" | "mrz_region_ok";
  /** Label para issues */
  label: string;
  /** Coordenadas esperadas en fracciones del template (x, y, w, h) */
  bbox: { x: number; y: number; w: number; h: number };
}

/** Regiones esperadas en el DNI peruano anverso. Fracciones del template normalizado. */
const FRONT_REGIONS: TemplateRegion[] = [
  {
    key: "escudo_detected",
    label: "escudo nacional",
    bbox: { x: 0.03, y: 0.03, w: 0.12, h: 0.18 },
  },
  {
    key: "photo_bbox_ok",
    label: "foto del titular",
    bbox: { x: 0.07, y: 0.32, w: 0.25, h: 0.48 },
  },
];

const BACK_REGIONS: TemplateRegion[] = [
  {
    key: "mrz_region_ok",
    label: "banda MRZ",
    bbox: { x: 0.02, y: 0.75, w: 0.96, h: 0.22 },
  },
];

async function loadTemplate(side: "front" | "back"): Promise<Buffer | null> {
  const p = path.join(TEMPLATE_DIR, `dni-template-${side}.png`);
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

/**
 * Normaliza imagen a TEMPLATE_NORM_WIDTH (largo mayor), devuelve grayscale raw.
 */
async function normalizeGrayscale(buf: Buffer): Promise<{
  data: Uint8Array;
  width: number;
  height: number;
}> {
  const { data, info } = await sharp(buf, { failOn: "none" })
    .rotate()
    .resize({ width: TEMPLATE_NORM_WIDTH, fit: "inside", withoutEnlargement: false })
    .grayscale()
    .toColorspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

interface Region {
  data: Uint8Array;
  width: number;
  height: number;
}

function extractRegion(
  src: { data: Uint8Array; width: number; height: number },
  bbox: { x: number; y: number; w: number; h: number },
): Region {
  const x0 = Math.floor(src.width * bbox.x);
  const y0 = Math.floor(src.height * bbox.y);
  const w = Math.floor(src.width * bbox.w);
  const h = Math.floor(src.height * bbox.h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[y * w + x] = src.data[(y0 + y) * src.width + (x0 + x)];
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * Normalized cross-correlation entre dos regiones del mismo tamaño.
 * Retorna -1 a 1 (1 = match perfecto, 0 = no correlation, -1 = anti-correlated).
 */
function ncc(a: Region, b: Region): number {
  if (a.width !== b.width || a.height !== b.height) return 0;
  const n = a.data.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a.data[i];
    sumB += b.data[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a.data[i] - meanA;
    const db = b.data[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const denom = Math.sqrt(denA * denB);
  if (denom < 1e-6) return 0;
  return num / denom;
}

export async function matchDniTemplate(
  imageBuffer: Buffer,
  side: "front" | "back",
): Promise<TemplateMatchResult> {
  const regions = side === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const template = await loadTemplate(side);

  const base: TemplateMatchResult = {
    layout_score: 0.5,
    escudo_detected: false,
    photo_bbox_ok: false,
    mrz_region_ok: false,
    issues: [],
  };

  if (!template) {
    base.issues.push(
      `template calibration pending: coloca lib/kyc/__fixtures__/dni-template-${side}.png con un DNI auténtico anonimizado para activar este signal`,
    );
    return base;
  }

  let queryImg, templateImg;
  try {
    [queryImg, templateImg] = await Promise.all([
      normalizeGrayscale(imageBuffer),
      normalizeGrayscale(template),
    ]);
  } catch (err) {
    base.issues.push(`normalize failed: ${err instanceof Error ? err.message : "unknown"}`);
    base.layout_score = 0;
    return base;
  }

  // Si las dimensiones no coinciden lo mínimo, no podemos comparar.
  if (
    Math.abs(queryImg.width - templateImg.width) > 100 ||
    Math.abs(queryImg.height - templateImg.height) > 100
  ) {
    base.issues.push(
      `dimension mismatch: query ${queryImg.width}×${queryImg.height} vs template ${templateImg.width}×${templateImg.height}`,
    );
    base.layout_score = 0.2;
    return base;
  }

  const scores: number[] = [];
  for (const region of regions) {
    const tplRegion = extractRegion(templateImg, region.bbox);
    const qryRegion = extractRegion(queryImg, region.bbox);
    const score = ncc(tplRegion, qryRegion);
    scores.push(score);
    const detected = score >= NCC_MIN;
    (base as unknown as Record<string, boolean>)[region.key] = detected;
    if (!detected) {
      base.issues.push(`${region.label}: NCC ${score.toFixed(2)} < ${NCC_MIN} (no detectado)`);
    }
  }

  // layout_score = promedio simple de NCC scores, clampeado a [0, 1]
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  base.layout_score = Math.max(0, Math.min(1, avg));
  return base;
}
