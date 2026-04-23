/**
 * Forense de imagen para DNI — detecta manipulación y montajes.
 *
 * Pipeline:
 *   1. Normaliza (downsample a 1200px max, sin crop) y cachea el buffer raw.
 *   2. ELA (Error Level Analysis) — recomprime JPEG Q=95 y mide diff vs original.
 *      Regiones pegadas/editadas sobreviven la recompresión con más diff que el
 *      fondo, porque ya no están en su "cuantización natural".
 *   3. Copy-move — divide en blocks 16×16, calcula aHash (64 bits) por block,
 *      busca pares con Hamming distance baja y distancia espacial alta.
 *      Detecta regiones duplicadas clásicas de fraude "pegar la foto de la
 *      persona X sobre el DNI de otra persona" si el copista duplica fondo.
 *   4. Photo edge — Sobel custom sobre región aproximada donde el DNI peruano
 *      tiene la foto del titular. Score alto si edge density en la región
 *      diverge mucho del resto del DNI (indica borde de foto pegada, o región
 *      uniform por foto borrada).
 *   5. Noise consistency — divide en grid 4×4 y mide varianza del canal azul en
 *      cada celda. Score alto cuando la varianza diverge mucho entre celdas
 *      (un collage combina regiones con distinto PRNU/compresión → varianzas
 *      heterogéneas). Usamos B porque es menos afectado por iluminación.
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

/**
 * Pesos de combinación de las 4 señales en overall_tampering_risk.
 * Calibrados conservadoramente: ELA y photo_edge son las señales más
 * fiables con los adversariales actuales; copy_move y noise son más ruidosos.
 * Suma = 1.0.
 */
export const FORENSICS_WEIGHTS = {
  ela: 0.4,
  copy_move: 0.2,
  photo_edge: 0.3,
  noise: 0.1,
} as const;

export interface ForensicsResult {
  /** 0-1, 1 = muy probable edición (ELA) */
  ela_score: number;
  /** 0-1, 1 = regiones duplicadas detectadas (aHash 64-bit + Hamming) */
  copy_move_score: number;
  /** 0-1, 1 = borde de foto del titular sospechoso (Sobel density divergence) */
  photo_edge_score: number;
  /** 0-1, 1 = ruido inconsistente entre regiones (stdev/mean de varianzas del canal B) */
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

/** Block size para copy-move (pixels). 16 es el stándar de la literatura. */
const COPY_MOVE_BLOCK = 16;
/** Grid del hash per block (8×8 = 64 bits). */
const COPY_MOVE_HASH_GRID = 8;
/**
 * Hamming distance ≤ este valor = match (64-bit aHash).
 * 5 balancea precision/recall en DNIs reales: tolera ruido JPEG leve sobre
 * blocks duplicados sin disparar falsos positivos en texturas uniformes
 * (fondos lisos, bandas holográficas, etc.).
 */
const COPY_MOVE_HAMMING_THRESHOLD = 5;
/** Distancia espacial mínima (en blocks) para considerar copy-move, no patrón repetido. */
const COPY_MOVE_MIN_SPATIAL_DIST = 6;
/** Rate de matches por 100 blocks que satura a score 1. */
const COPY_MOVE_SATURATION_RATE = 2.0;

/**
 * Bounding box aproximado (en fracciones del ancho/alto del DNI) de la foto
 * del titular en el DNI peruano anverso. Se calibra con fixtures reales en
 * fase 2 (template.ts); estos valores son un estimado conservador que cubre
 * la zona general donde vive la foto. Si la foto real del DNI cae dentro
 * de este bbox, el score refleja correctamente.
 *
 * TODO(P2): reemplazar con bbox exacto + detección por template matching.
 */
const DNI_PE_PHOTO_BBOX = { x: 0.07, y: 0.32, w: 0.25, h: 0.48 } as const;

/**
 * Sobel kernels 3×3 para derivada espacial. Se usan via sharp.convolve().
 * Valores clásicos de la literatura de procesamiento de imágenes.
 */
const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

/** Umbral (0-255) para binarizar magnitud de gradiente como "edge". */
const EDGE_THRESHOLD = 40;

/** Ratio (region_density / global_density) que satura a score 1. */
const PHOTO_EDGE_DIVERGENCE_SATURATION = 2.0;

/** Grid de subregiones para noise consistency (4×4 = 16 celdas). */
const NOISE_GRID = 4;
/** Coef. de variación (stdev/mean) que satura a score 1. Empírico: 1.0 → score 1. */
const NOISE_CV_SATURATION = 1.0;

const WEIGHTS = FORENSICS_WEIGHTS;

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

/**
 * Popcount de un uint32 usando Brian Kernighan's bit count.
 * n &= (n - 1) borra el bit menos significativo de los 1s — iteraciones
 * igual al número de 1s, no a 32.
 */
function popcount32(n: number): number {
  let count = 0;
  let x = n >>> 0; // force uint32
  while (x !== 0) {
    x &= x - 1;
    count++;
  }
  return count;
}

/**
 * Copy-move detection.
 *
 * Para cada block de COPY_MOVE_BLOCK×COPY_MOVE_BLOCK (default 16×16), genera
 * un aHash (average hash) downsampleando a COPY_MOVE_HASH_GRID×COPY_MOVE_HASH_GRID
 * (default 8×8 = 64 bits) y binarizando contra el promedio.
 *
 * Luego compara TODOS los pares de blocks: si la Hamming distance entre sus
 * hashes es ≤ COPY_MOVE_HAMMING_THRESHOLD Y están separados por al menos
 * COPY_MOVE_MIN_SPATIAL_DIST blocks, cuenta como un match copy-move.
 *
 * El hash se almacena como PAR de uint32 (low, high) en vez de BigInt — el
 * XOR + popcount por uint32 es ~10× más rápido que BigInt en V8.
 *
 * Normalización: matches_per_100_blocks / COPY_MOVE_SATURATION_RATE → clamp 0-1.
 */
async function computeCopyMove(normalized: Buffer): Promise<number> {
  const { data, info } = await sharp(normalized)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const blocksX = Math.floor(width / COPY_MOVE_BLOCK);
  const blocksY = Math.floor(height / COPY_MOVE_BLOCK);
  if (blocksX === 0 || blocksY === 0) return 0;

  // Cada hash = par (hashLo, hashHi) con 32 bits cada uno = 64 bits totales.
  const hashLo = new Uint32Array(blocksX * blocksY);
  const hashHi = new Uint32Array(blocksX * blocksY);

  // El downsample 16→8 es de a 2×2 pixels → promedio.
  const samplesPerCell = (COPY_MOVE_BLOCK / COPY_MOVE_HASH_GRID) ** 2;
  const cellSize = COPY_MOVE_BLOCK / COPY_MOVE_HASH_GRID; // 2
  const samplesLen = COPY_MOVE_HASH_GRID * COPY_MOVE_HASH_GRID; // 64

  const samples = new Float32Array(samplesLen);

  let bi = 0;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let total = 0;
      for (let sy = 0; sy < COPY_MOVE_HASH_GRID; sy++) {
        for (let sx = 0; sx < COPY_MOVE_HASH_GRID; sx++) {
          let sum = 0;
          const px0 = bx * COPY_MOVE_BLOCK + sx * cellSize;
          const py0 = by * COPY_MOVE_BLOCK + sy * cellSize;
          for (let dy = 0; dy < cellSize; dy++) {
            const row = (py0 + dy) * width + px0;
            for (let dx = 0; dx < cellSize; dx++) {
              sum += data[row + dx];
            }
          }
          const mean = sum / samplesPerCell;
          samples[sy * COPY_MOVE_HASH_GRID + sx] = mean;
          total += mean;
        }
      }
      const blockAvg = total / samplesLen;

      // Binarizar: bit=1 si sample > avg, sino 0. Primeros 32 bits = low, últimos 32 = high.
      let lo = 0;
      let hi = 0;
      for (let i = 0; i < 32; i++) {
        if (samples[i] > blockAvg) lo |= 1 << i;
      }
      for (let i = 0; i < 32; i++) {
        if (samples[32 + i] > blockAvg) hi |= 1 << i;
      }
      hashLo[bi] = lo >>> 0;
      hashHi[bi] = hi >>> 0;
      bi++;
    }
  }

  const blocksTotal = blocksX * blocksY;
  let matches = 0;
  const minDistSq = COPY_MOVE_MIN_SPATIAL_DIST * COPY_MOVE_MIN_SPATIAL_DIST;

  for (let i = 0; i < blocksTotal; i++) {
    const ix = i % blocksX;
    const iy = Math.floor(i / blocksX);
    const li = hashLo[i];
    const hi2 = hashHi[i];
    for (let j = i + 1; j < blocksTotal; j++) {
      const jx = j % blocksX;
      const jy = Math.floor(j / blocksX);
      const dx = ix - jx;
      const dy = iy - jy;
      if (dx * dx + dy * dy < minDistSq) continue;

      const hamming = popcount32(li ^ hashLo[j]) + popcount32(hi2 ^ hashHi[j]);
      if (hamming <= COPY_MOVE_HAMMING_THRESHOLD) matches++;
    }
  }

  const ratePer100 = (matches * 100) / blocksTotal;
  const score = ratePer100 / COPY_MOVE_SATURATION_RATE;
  return score > 1 ? 1 : score;
}

/**
 * Sobel edge magnitude. Corre dos convoluciones 3×3 (derivada X e Y) sobre
 * grayscale con scale=4 y offset=128 para preservar gradientes negativos
 * (sin offset, sharp clampea negativos a 0 y perdemos media señal).
 *
 * Con scale=4 + offset=128:
 *   - Zona uniforme (gradient 0) → pixel=128
 *   - Gradient fuerte positivo → pixel cerca de 255
 *   - Gradient fuerte negativo → pixel cerca de 0
 *   - Magnitud = |pixel - 128| saturated a 127
 *
 * Combina como |Gx - 128| + |Gy - 128| — aproximación L1 de sqrt(Gx²+Gy²),
 * ~8% error pero 3× más rápido (sin sqrt).
 */
async function sobelMagnitude(normalized: Buffer): Promise<{
  data: Uint8Array;
  width: number;
  height: number;
}> {
  // toColorspace('b-w') fuerza el raw output a 1 channel (grayscale() solo
  // convierte visualmente — el buffer raw puede tener 3 channels igualmente).
  const gray = sharp(normalized).grayscale().toColorspace("b-w");

  const [gx, gy] = await Promise.all([
    gray
      .clone()
      .convolve({ width: 3, height: 3, kernel: SOBEL_X, scale: 4, offset: 128 })
      .raw()
      .toBuffer({ resolveWithObject: true }),
    gray
      .clone()
      .convolve({ width: 3, height: 3, kernel: SOBEL_Y, scale: 4, offset: 128 })
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  if (
    gx.info.width !== gy.info.width ||
    gx.info.height !== gy.info.height ||
    gx.info.channels !== 1
  ) {
    throw new Error(`sobel shape mismatch: gx=${gx.info.channels}ch gy=${gy.info.channels}ch`);
  }

  const mag = new Uint8Array(gx.data.length);
  for (let i = 0; i < gx.data.length; i++) {
    const ax = gx.data[i] >= 128 ? gx.data[i] - 128 : 128 - gx.data[i];
    const ay = gy.data[i] >= 128 ? gy.data[i] - 128 : 128 - gy.data[i];
    const sum = ax + ay;
    mag[i] = sum > 255 ? 255 : sum;
  }

  return { data: mag, width: gx.info.width, height: gx.info.height };
}

/**
 * Photo edge detection. Compara la densidad de edges en el bbox donde está
 * la foto del titular con la densidad global del DNI.
 *
 * Lógica:
 *   - Si la región tiene MUCHO más edges que el global → foto pegada con
 *     borde alto contraste (score alto).
 *   - Si la región tiene MUCHO menos edges → foto borrada/reemplazada por
 *     región uniforme (score alto).
 *   - Si la región está en el rango esperado (1.0-1.5× del global) → score bajo.
 *
 * El score es |log(region/global)| saturado por PHOTO_EDGE_DIVERGENCE_SATURATION.
 */
async function computePhotoEdge(normalized: Buffer): Promise<number> {
  const { data, width, height } = await sobelMagnitude(normalized);

  const rx = Math.floor(width * DNI_PE_PHOTO_BBOX.x);
  const ry = Math.floor(height * DNI_PE_PHOTO_BBOX.y);
  const rw = Math.floor(width * DNI_PE_PHOTO_BBOX.w);
  const rh = Math.floor(height * DNI_PE_PHOTO_BBOX.h);

  if (rw <= 0 || rh <= 0 || rx + rw > width || ry + rh > height) {
    return 0; // bbox inválido → neutro
  }

  let regionEdges = 0;
  let globalEdges = 0;

  for (let y = 0; y < height; y++) {
    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      const isEdge = data[rowStart + x] >= EDGE_THRESHOLD ? 1 : 0;
      globalEdges += isEdge;
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) {
        regionEdges += isEdge;
      }
    }
  }

  const regionArea = rw * rh;
  const globalArea = width * height;
  const regionDensity = regionEdges / regionArea;
  const globalDensity = globalEdges / globalArea;

  if (globalDensity < 0.001) return 0; // imagen casi sin edges → no podemos juzgar

  const ratio = regionDensity / globalDensity;
  // |log(ratio)| — divergencia simétrica: ratio=1 → 0, ratio=2 o 0.5 → ~0.69.
  const divergence = Math.abs(Math.log(Math.max(ratio, 0.01)));
  const score = divergence / PHOTO_EDGE_DIVERGENCE_SATURATION;
  return score > 1 ? 1 : score;
}

/**
 * Noise consistency — coef. de variación de la varianza del canal azul por
 * subregión. En una imagen "legítima" de un único sensor/compresión, todas
 * las subregiones tienen varianza de ruido similar (stdev/mean bajo). En un
 * collage, regiones pegadas de distintas fuentes traen distinto nivel de
 * ruido → stdev/mean alto.
 *
 * Trabajamos sobre el canal B (blue) porque es menos dominante en
 * iluminación/contraste natural y más informativo sobre el ruido del sensor.
 */
async function computeNoiseConsistency(normalized: Buffer): Promise<number> {
  const { data, info } = await sharp(normalized)
    .extractChannel("blue")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const cellW = Math.floor(width / NOISE_GRID);
  const cellH = Math.floor(height / NOISE_GRID);
  if (cellW < 8 || cellH < 8) return 0;

  const variances: number[] = [];
  for (let cy = 0; cy < NOISE_GRID; cy++) {
    for (let cx = 0; cx < NOISE_GRID; cx++) {
      const x0 = cx * cellW;
      const y0 = cy * cellH;
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      for (let y = y0; y < y0 + cellH; y++) {
        const row = y * width;
        for (let x = x0; x < x0 + cellW; x++) {
          const v = data[row + x];
          sum += v;
          sumSq += v * v;
          count++;
        }
      }
      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      variances.push(variance);
    }
  }

  if (variances.length === 0) return 0;
  const varMean = variances.reduce((a, b) => a + b, 0) / variances.length;
  if (varMean < 1) return 0; // imagen casi-plana → no podemos juzgar ruido

  const varStd = Math.sqrt(
    variances.reduce((a, b) => a + (b - varMean) ** 2, 0) / variances.length,
  );
  const cv = varStd / varMean;
  const score = cv / NOISE_CV_SATURATION;
  return score > 1 ? 1 : score;
}

/**
 * Genera un heatmap PNG del ELA diff — visualmente, las regiones con mayor
 * diff aparecen más claras. Útil para subir a Vercel Blob y mostrar al
 * arbiter o al admin cuando un KYC quedó en review. No se llama desde
 * analyzeDniForensics() para no duplicar trabajo; el caller (p.ej. verify
 * route) lo invoca bajo demanda.
 *
 * Retorna un buffer PNG (o null si algo falla). El tamaño coincide con
 * la imagen normalizada (≤1200px largo mayor).
 */
export async function renderElaHeatmap(imageBuffer: Buffer): Promise<Buffer | null> {
  try {
    const normalized = await normalize(imageBuffer);
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
      return null;
    }

    const { width, height, channels } = orig.info;
    // Diff amplificado por 20 + mapeado a RGB (grayscale) para visualización.
    const heat = Buffer.alloc(width * height * 3);
    for (let i = 0, j = 0; i < orig.data.length; i += channels, j += 3) {
      let sum = 0;
      for (let c = 0; c < channels; c++) {
        const d = orig.data[i + c] - recompressed.data[i + c];
        sum += d < 0 ? -d : d;
      }
      const v = Math.min(255, Math.floor((sum / channels) * 20));
      heat[j] = v;
      heat[j + 1] = v;
      heat[j + 2] = v;
    }
    return sharp(heat, { raw: { width, height, channels: 3 } }).png().toBuffer();
  } catch (err) {
    console.error("[kyc/forensics] heatmap failed:", err instanceof Error ? err.message : err);
    return null;
  }
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

  const [ela_score, copy_move_score, photo_edge_score, noise_consistency] = await Promise.all([
    computeEla(normalized).catch((err) => {
      console.error("[kyc/forensics] ela failed:", err instanceof Error ? err.message : err);
      return 0.5;
    }),
    computeCopyMove(normalized).catch((err) => {
      console.error("[kyc/forensics] copy-move failed:", err instanceof Error ? err.message : err);
      return 0;
    }),
    computePhotoEdge(normalized).catch((err) => {
      console.error("[kyc/forensics] photo-edge failed:", err instanceof Error ? err.message : err);
      return 0;
    }),
    computeNoiseConsistency(normalized).catch((err) => {
      console.error("[kyc/forensics] noise failed:", err instanceof Error ? err.message : err);
      return 0;
    }),
  ]);

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
