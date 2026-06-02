/**
 * Comprime y normaliza una imagen EN EL NAVEGADOR antes de subirla.
 *
 * Por qué: Vercel corta cualquier request con body > 4.5 MB antes de que
 * corra la función (devuelve "Request Entity Too Large", no JSON). Las fotos
 * HEIC del iPhone suelen pesar 4-6 MB. Esto:
 *   - Convierte HEIC/HEIF → JPEG (vía heic2any, carga dinámica solo si hace falta).
 *   - Redimensiona a un máximo razonable y recomprime a JPEG.
 *   - Opcional (reframe): recorta el espacio en blanco y reencuadra el producto
 *     a un marco 4:3 estándar, para que todas las fotos del catálogo se vean del
 *     mismo tamaño sin importar cómo venían encuadradas.
 * Los PDFs y no-imágenes pasan sin tocar.
 */
interface Opts { maxDim?: number; quality?: number; reframe?: boolean }

export async function compressImage(file: File, opts: Opts = {}): Promise<File> {
  const { maxDim = 1800, quality = 0.85, reframe = false } = opts;
  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic && !file.type.startsWith("image/")) return file; // PDF u otros: sin cambios

  let blob: Blob = file;
  if (isHeic) {
    const heic2any = (await import("heic2any")).default as (o: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality });
    blob = Array.isArray(out) ? out[0] : out;
  }

  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const done = () => new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  const out = (b: Blob | null) => new File([b ?? blob], file.name.replace(/\.\w+$/i, ".jpg"), { type: "image/jpeg" });
  if (!ctx) return out(null);

  if (reframe) {
    // 1) Detecta el recuadro del producto (recorta blanco/transparente alrededor).
    const tmp = document.createElement("canvas");
    tmp.width = img.width; tmp.height = img.height;
    const tctx = tmp.getContext("2d")!;
    tctx.drawImage(img, 0, 0);
    const box = contentBounds(tctx, img.width, img.height);

    // 2) Marco 4:3 de salida con el producto centrado al ~88% del lado largo.
    const OUT_W = 1600, OUT_H = 1200, FILL = 0.9;
    canvas.width = OUT_W; canvas.height = OUT_H;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    const scale = Math.min((OUT_W * FILL) / box.w, (OUT_H * FILL) / box.h);
    const dw = box.w * scale, dh = box.h * scale;
    ctx.drawImage(img, box.x, box.y, box.w, box.h, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);
    return out(await done());
  }

  // Sin reframe: solo redimensionar al máximo.
  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  canvas.width = width; canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);
  return out(await done());
}

/** Bounding box del contenido (descarta píxeles casi-blancos o transparentes). */
function contentBounds(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, w, h).data; }
  catch { return { x: 0, y: 0, w, h }; } // canvas tainted → no recorta
  let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 600)); // submuestreo para velocidad
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
      // Fondo = transparente, o blanco/gris claro casi neutro (cubre degradados suaves).
      const isBg = a < 14 || (mn > 222 && (mx - mn) < 20);
      if (!isBg) {
        found = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return { x: 0, y: 0, w, h };
  // Margen de seguridad de un par de píxeles
  const pad = step;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
