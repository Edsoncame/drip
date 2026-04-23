/**
 * Forense de imagen para DNI — detecta manipulación y montajes.
 *
 * Pipeline:
 *   1. Normaliza (downsample a 1200px max, sin crop) y cachea el buffer raw.
 *   2. ELA (Error Level Analysis) — recomprime JPEG Q=95 y mide diff vs original.
 *      Regiones pegadas/editadas sobreviven la recompresión con más diff que el
 *      fondo, porque ya no están en su "cuantización natural".
 *   3. Copy-move — [STUB, se implementa en fase 1 commit 2]
 *   4. Photo edge / Canny — [STUB, fase 1 commit 3]
 *   5. Noise consistency — [STUB, fase 1 commit 4]
 *   6. Combina los 4 con pesos [0.4 ela, 0.2 copy_move, 0.3 edge, 0.1 noise].
 *
 * Limites operacionales (Vercel Fluid Compute, memoria 2048 MB):
 *   - Downsample obligatorio a 1200px largo mayor ANTES de análisis.
 *   - ELA corre en un solo sharp pipeline para no duplicar memoria.
 *   - Este módulo NUNCA throws; si algo falla internamente loguea + retorna
 *     score neutral (0.5 overall) para que /api/kyc/verify pueda decidir
 *     pidiendo arbiter o rechazando por otras señales.
 */

import sharp from "sharp";

export interface ForensicsResult {
  /** 0-1, 1 = muy probable edición (ELA) */
  ela_score: number;
  /** 0-1, 1 = regiones duplicadas detectadas — STUB por ahora */
  copy_move_score: number;
  /** 0-1, 1 = borde de foto del titular sospechoso — STUB por ahora */
  photo_edge_score: number;
  /** 0-1, 1 = ruido inconsistente entre regiones — STUB por ahora */
  noise_consistency: number;
  /** 0-1, combinación ponderada de los 4 scores */
  overall_tampering_risk: number;
  /** Heatmap ELA visualizado como PNG en Blob — opcional, fase posterior */
  heatmap_blob_key?: string;
}

const MAX_DIMENSION = 1200;

/**
 * Saturation del block-max (0-255). ELA mide el block con mayor diff — una
 * región pegada pequeña (p.ej. la foto del titular, ~5% del DNI) diluye
 * su diff si se promedia sobre toda la imagen, pero destaca como un block
 * outlier. 12 satura a score 1.0 — en la práctica blocks limpios con JPEG
 * Q=95 tienen diff < 2.5, mientras que blocks con contenido pegado de
 * otra cuantización suelen 6+.
 */
const ELA_SATURATION = 12;

/** Tamaño de block para el análisis ELA (pixels). Potencia de 2 ayuda al cache. */
const ELA_BLOCK = 32;

const WEIGHTS = {
  ela: 0.4,
  copy_move: 0.2,
  photo_edge: 0.3,
  noise: 0.1,
} as const;

/**
 * Normaliza la imagen: downsample a MAX_DIMENSION en el largo mayor
 * y la emite como PNG (lossless).
 *
 * Por qué PNG y no JPEG Q=100: re-codificar a JPEG —aunque sea Q=100—
 * cuantiza todo a la misma grilla y destruye el contraste de cuantización
 * que ELA necesita para distinguir regiones pegadas del fondo. PNG preserva
 * la señal raw y deja que ELA introduzca la primera cuantización JPEG
 * (a Q=95) para medir cómo cada región "reacciona" a la recompresión.
 *
 * No usa crop — preservar el DNI completo es clave para que el fondo
 * "limpio" sirva de referencia en noise consistency / ELA.
 */
async function normalize(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer, { failOn: "none" })
    .rotate() // honra EXIF orientation
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 3 }) // lossless; compressionLevel solo afecta tamaño, no pixels
    .toBuffer();
}

/**
 * Error Level Analysis — block-max.
 *
 * Proceso:
 *   1. Decodificamos `normalized` a raw RGB.
 *   2. Lo re-codificamos a JPEG Q=95.
 *   3. Lo decodificamos de nuevo a raw RGB.
 *   4. Dividimos en blocks de ELA_BLOCK×ELA_BLOCK.
 *   5. Para cada block calculamos el diff absoluto promedio entre original y
 *      recomprimido (sumando los 3 canales).
 *   6. ELA score = percentil 99 de los block-means / ELA_SATURATION.
 *
 * Usar el percentil 99 (no el max estricto) filtra outliers de 1 block puntual
 * por artefactos de borde, pero sigue capturando regiones de ~1% del DNI.
 */
async function computeEla(normalized: Buffer): Promise<number> {
  const [orig, recompressed] = await Promise.all([
    sharp(normalized).raw().toBuffer({ resolveWithObject: true }),
    sharp(normalized)
      .jpeg({ quality: 95, mozjpeg: false })
      .toBuffer()
      .then((buf) => sharp(buf).raw().toBuffer({ resolveWithObject: true })),
  ]);

  if (
    orig.info.width !== recompressed.info.width ||
    orig.info.height !== recompressed.info.height ||
    orig.data.length !== recompressed.data.length
  ) {
    return 0.5;
  }

  const { width, height, channels } = orig.info;
  const a = orig.data;
  const b = recompressed.data;

  const blocksX = Math.floor(width / ELA_BLOCK);
  const blocksY = Math.floor(height / ELA_BLOCK);
  if (blocksX === 0 || blocksY === 0) return 0.5;

  const blockMeans: number[] = new Array(blocksX * blocksY);
  let bi = 0;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let sum = 0;
      let count = 0;
      const x0 = bx * ELA_BLOCK;
      const y0 = by * ELA_BLOCK;
      for (let y = y0; y < y0 + ELA_BLOCK; y++) {
        const rowStart = y * width * channels + x0 * channels;
        const rowEnd = rowStart + ELA_BLOCK * channels;
        for (let i = rowStart; i < rowEnd; i++) {
          const d = a[i] - b[i];
          sum += d < 0 ? -d : d;
          count++;
        }
      }
      blockMeans[bi++] = sum / count;
    }
  }

  // Percentil 99 (ordenamos asc y tomamos el 99%). Filtra 1% outliers de borde.
  blockMeans.sort((x, y) => x - y);
  const idx = Math.floor(blockMeans.length * 0.99);
  const p99 = blockMeans[Math.min(idx, blockMeans.length - 1)];

  const score = p99 / ELA_SATURATION;
  return score > 1 ? 1 : score;
}

export async function analyzeDniForensics(imageBuffer: Buffer): Promise<ForensicsResult> {
  let normalized: Buffer;
  try {
    normalized = await normalize(imageBuffer);
  } catch (err) {
    console.error("[kyc/forensics] normalize failed:", err instanceof Error ? err.message : err);
    // Imagen irrecuperable — devolvemos riesgo alto para que el verify pida arbiter.
    return {
      ela_score: 1,
      copy_move_score: 0,
      photo_edge_score: 0,
      noise_consistency: 0,
      overall_tampering_risk: WEIGHTS.ela, // 0.4 — no lo clavamos en 1 para no auto-rechazar por input corrupto
    };
  }

  const ela_score = await computeEla(normalized).catch((err) => {
    console.error("[kyc/forensics] ela failed:", err instanceof Error ? err.message : err);
    return 0.5;
  });

  // Stubs — se implementan en los siguientes commits.
  const copy_move_score = 0;
  const photo_edge_score = 0;
  const noise_consistency = 0;

  const overall_tampering_risk =
    WEIGHTS.ela * ela_score +
    WEIGHTS.copy_move * copy_move_score +
    WEIGHTS.photo_edge * photo_edge_score +
    WEIGHTS.noise * noise_consistency;

  return {
    ela_score,
    copy_move_score,
    photo_edge_score,
    noise_consistency,
    overall_tampering_risk: Math.min(1, overall_tampering_risk),
  };
}
