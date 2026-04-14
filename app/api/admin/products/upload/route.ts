/**
 * Upload de imagen de producto con compresión automática.
 *
 * Acepta JPG/PNG/WebP. Antes de subir a Vercel Blob:
 *   1. Redimensiona a máximo 1200x900 (suficiente para mostrar en cualquier
 *      lugar del sitio sin perder nitidez)
 *   2. Convierte a WebP con calidad 82 (formato moderno, mucho más liviano
 *      que JPG/PNG sin pérdida visible)
 *   3. Aplica compresión "lossless when possible"
 *
 * Esto reduce típicamente una foto de Apple (~500 KB - 2 MB) a 30-80 KB,
 * lo que mejora drásticamente el LCP (Largest Contentful Paint) en los
 * cards del catálogo.
 */

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";

const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

// Dimensiones target del card de producto (mantiene aspect ratio 4:3)
const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 900;

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const slug = (formData.get("slug") as string) || "product";

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Solo JPG, PNG o WebP" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Máximo 8MB" }, { status: 400 });
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // Pipeline de centrado automático:
    //
    // 1. trim() recorta bordes transparentes o de un solo color (típico en
    //    imágenes de Apple con fondo blanco o alfa). Así el producto queda
    //    "pegado" a los bordes del bounding box real.
    //
    // 2. resize con fit: "contain" lo vuelve a colocar dentro de un canvas
    //    de TARGET_WIDTH x TARGET_HEIGHT, centrado, con fondo transparente
    //    (si era PNG/WebP) o blanco.
    //
    // El resultado: todas las imágenes quedan perfectamente centradas sin
    // importar cómo venían del origen, manteniendo la proporción del
    // producto original.
    const optimized = await sharp(inputBuffer)
      .trim({ background: "#ffffff", threshold: 10 })
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: "contain",
        withoutEnlargement: false,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .webp({ quality: 82, effort: 6 })
      .toBuffer();

    const safe = slug.replace(/[^a-zA-Z0-9_-]/g, "_") || "product";
    const path = `products/${safe}-${Date.now()}.webp`;

    const blob = await put(path, optimized, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
    });

    const compressionPct = Math.round((1 - optimized.length / inputBuffer.length) * 100);
    console.log(
      `[admin/products/upload] ${session.email} uploaded ${path} ` +
      `(${(inputBuffer.length / 1024).toFixed(1)} KB -> ${(optimized.length / 1024).toFixed(1)} KB, ${compressionPct}% smaller)`
    );

    return NextResponse.json({
      url: blob.url,
      originalSize: inputBuffer.length,
      optimizedSize: optimized.length,
      compressionPct,
    });
  } catch (err) {
    console.error("[admin/products/upload] error:", err);
    const msg = err instanceof Error ? err.message : "Error al procesar imagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
