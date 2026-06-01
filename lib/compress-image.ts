/**
 * Comprime y normaliza una imagen EN EL NAVEGADOR antes de subirla.
 *
 * Por qué: Vercel corta cualquier request con body > 4.5 MB antes de que
 * corra la función (devuelve "Request Entity Too Large", no JSON). Las fotos
 * HEIC del iPhone suelen pesar 4-6 MB. Esto:
 *   - Convierte HEIC/HEIF → JPEG (vía heic2any, carga dinámica solo si hace falta).
 *   - Redimensiona a un máximo razonable y recomprime a JPEG.
 * Resultado: el archivo llega chico (<4.5 MB) y ya en un formato que se ve en
 * cualquier navegador. Los PDFs y no-imágenes pasan sin tocar.
 */
export async function compressImage(file: File, maxDim = 1800, quality = 0.85): Promise<File> {
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

  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new File([blob], file.name.replace(/\.\w+$/i, ".jpg"), { type: "image/jpeg" });
  ctx.drawImage(img, 0, 0, width, height);

  const outBlob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!outBlob) return new File([blob], file.name.replace(/\.\w+$/i, ".jpg"), { type: "image/jpeg" });
  return new File([outBlob], file.name.replace(/\.\w+$/i, ".jpg"), { type: "image/jpeg" });
}
