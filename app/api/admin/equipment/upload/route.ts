import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import convert from "heic-convert";
import { requireAdmin } from "@/lib/auth";

// La conversión HEIC usa libheif (WASM) en Node; forzamos runtime Node y damos margen de tiempo.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
// Fallback por extensión: algunos navegadores envían HEIC con file.type vacío.
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"];
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  heic: "image/heic", heif: "image/heif", pdf: "application/pdf",
};

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const kind = (formData.get("kind") as string) || "misc"; // "factura" | "vault"
  const codigo = (formData.get("codigo") as string) || "equipment";

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  // Acepta por MIME, o por extensión cuando el navegador manda file.type vacío (típico en HEIC).
  const typeOk = ALLOWED.includes(file.type) || (!file.type && ALLOWED_EXT.includes(ext));
  if (!typeOk) {
    return NextResponse.json({ error: "Solo JPG, PNG, WebP, HEIC o PDF" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Máximo 15MB" }, { status: 400 });
  }

  const safeCode = codigo.replace(/[^a-zA-Z0-9_-]/g, "_");

  // HEIC/HEIF (fotos de iPhone) no se ven en Chrome/Firefox: convertimos a JPG
  // en el servidor para que el archivo guardado se vea en cualquier navegador.
  const isHeic = file.type === "image/heic" || file.type === "image/heif"
    || (!file.type && (ext === "heic" || ext === "heif"));

  let body: File | Buffer = file;
  let outExt = ext;
  let contentType = file.type || EXT_MIME[ext] || "application/octet-stream";

  if (isHeic) {
    try {
      const inputBuffer = Buffer.from(await file.arrayBuffer());
      // libheif espera un Buffer/Uint8Array en runtime; el tipo declara ArrayBufferLike.
      const jpgBuffer = await convert({ buffer: inputBuffer as unknown as ArrayBufferLike, format: "JPEG", quality: 0.85 });
      body = Buffer.from(jpgBuffer);
      outExt = "jpg";
      contentType = "image/jpeg";
    } catch {
      return NextResponse.json({ error: "No se pudo procesar la foto HEIC. Intenta con JPG o PNG." }, { status: 400 });
    }
  }

  const path = `equipment/${safeCode}/${kind}-${Date.now()}.${outExt}`;

  const blob = await put(path, body, {
    access: "public",
    addRandomSuffix: false,
    contentType,
  });

  return NextResponse.json({ url: blob.url });
}
