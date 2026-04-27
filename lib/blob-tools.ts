/**
 * Blob Tools — sube imágenes/archivos a Vercel Blob para que los agentes
 * tengan URLs persistentes (no como Pollinations.ai que es volátil).
 *
 * Uso típico:
 *   1. disenador-creativo / content-creator genera imagen con generate_image
 *      → recibe URL de Pollinations
 *   2. Llama a upload_to_blob con esa URL
 *      → recibe URL estable de Vercel Blob
 *   3. Usa la URL Blob en publish_blog_post / ig_publish_image / meta_create_ad_creative
 */

import { tool } from "ai";
import { z } from "zod";
import { put } from "@vercel/blob";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function safeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function inferExtension(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("svg")) return "svg";
  return "bin";
}

export function blobTools() {
  return {
    upload_to_blob: tool({
      description:
        "Descarga una imagen pública (ej: URL de Pollinations.ai) y la guarda en Vercel Blob, devolviendo una URL persistente. Usalo después de generate_image antes de pasar la imagen a publish_blog_post / meta_create_ad_creative / ig_publish_image. Soporta png/jpg/webp/gif/svg, máx 8MB.",
      inputSchema: z.object({
        source_url: z
          .string()
          .url()
          .describe("URL pública de la imagen a copiar (ej: image.pollinations.ai/...)"),
        folder: z
          .enum(["blog", "ads", "social", "branding", "misc"])
          .optional()
          .default("misc")
          .describe("Carpeta lógica en Blob para organización."),
        filename_hint: z
          .string()
          .optional()
          .describe("Nombre base sugerido (sin extensión). Default: timestamp."),
      }),
      execute: async ({ source_url, folder, filename_hint }) => {
        try {
          if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return {
              error:
                "BLOB_READ_WRITE_TOKEN env var no configurada. Vercel Blob no disponible.",
            };
          }

          const fetchRes = await fetch(source_url, {
            headers: {
              "user-agent": "Mozilla/5.0 (compatible; flux-marketing-agent/1.0)",
            },
            signal: AbortSignal.timeout(30000),
          });
          if (!fetchRes.ok) {
            return { error: `source HTTP ${fetchRes.status}` };
          }
          const contentType = fetchRes.headers.get("content-type") ?? "image/png";
          if (!contentType.startsWith("image/")) {
            return { error: `content-type no es imagen: ${contentType}` };
          }
          const buf = await fetchRes.arrayBuffer();
          if (buf.byteLength > MAX_BYTES) {
            return { error: `imagen excede ${MAX_BYTES / 1024 / 1024}MB` };
          }

          const ext = inferExtension(contentType);
          const base = filename_hint
            ? safeFilename(filename_hint)
            : `${Date.now()}`;
          const pathname = `marketing/${folder}/${base}.${ext}`;

          const uploaded = await put(pathname, Buffer.from(buf), {
            access: "public",
            contentType,
            addRandomSuffix: true,
            allowOverwrite: false,
          });

          return {
            ok: true,
            url: uploaded.url,
            pathname: uploaded.pathname,
            size_bytes: buf.byteLength,
            content_type: contentType,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "upload failed" };
        }
      },
    }),
  };
}
