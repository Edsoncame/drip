/**
 * Extracción automática de datos de producto usando Claude vía Vercel AI Gateway.
 *
 * Acepta:
 *   - Una imagen (JPG/PNG/WebP) de la MacBook o de su ficha técnica
 *   - Texto pegado (descripción comercial, copy de Apple, etc.)
 *   - Ambos al mismo tiempo
 *
 * Devuelve un JSON con los campos del producto que se pueden mapear directo
 * al formulario de `/admin/productos`. El usuario puede editarlo después.
 *
 * Modelo: `anthropic/claude-sonnet-4.6` ruteado a través de Vercel AI Gateway.
 * Auth automática vía OIDC token (configurado con `vercel env pull`).
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGES = ["image/jpeg", "image/png", "image/webp"];

// Schema que el modelo debe respetar (Zod valida la salida automáticamente).
const ProductSchema = z.object({
  name: z
    .string()
    .describe("Nombre completo del producto, ej: 'MacBook Air 13\" — Apple M4'"),
  short_name: z
    .string()
    .describe("Nombre corto para tarjetas, ej: 'MacBook Air 13\"'"),
  chip: z.string().describe("Procesador. Ej: 'Apple M4', 'Apple M5 Pro'"),
  ram: z.string().describe("Memoria RAM con unidades. Ej: '16 GB', '24 GB'"),
  ssd: z
    .string()
    .describe("Almacenamiento con unidades. Ej: '256 GB SSD', '512 GB SSD'"),
  color: z
    .string()
    .describe("Color del equipo. Ej: 'Gris Espacial', 'Plata estelar', 'Negro Sideral'"),
  badge: z
    .string()
    .nullable()
    .describe("Etiqueta opcional como 'Nuevo 2026'. null si no aplica."),
  is_new: z.boolean().describe("True si es un modelo nuevo o destacado."),
  cost_usd: z
    .number()
    .nullable()
    .describe("Costo de compra en USD si se menciona. null si no se sabe."),
  specs: z
    .array(
      z.object({
        label: z
          .string()
          .describe("Nombre de la spec, ej: 'CPU', 'GPU', 'Pantalla', 'Batería', 'Peso'"),
        value: z
          .string()
          .describe("Valor de la spec, ej: '10 núcleos', '14.2\" Liquid Retina XDR', 'Hasta 24 horas'"),
      })
    )
    .describe("Lista de especificaciones técnicas detalladas."),
  includes: z
    .array(z.string())
    .describe(
      "Lo que viene en la caja, ej: ['Cable USB-C', 'Adaptador 70W', 'Guía rápida']"
    ),
});

const SYSTEM_PROMPT = `Eres un asistente que extrae información de productos MacBook para FLUX, una empresa peruana de alquiler de equipos Apple.

A partir de una imagen del producto y/o un texto descriptivo, extraes los datos técnicos en español (Perú) en formato estructurado.

Reglas:
- Usa siempre español de Perú (Gris Espacial, Plata, Negro Sideral, etc.)
- Para chip usa el formato exacto "Apple M4", "Apple M5 Pro", "Apple M5 Max"
- Para RAM y SSD incluye siempre las unidades ("16 GB", "512 GB SSD")
- Las specs deben incluir mínimo: Chip, CPU, GPU, RAM, SSD, Pantalla, Batería, Peso
- "includes" debe listar lo que típicamente viene con la MacBook: cable USB-C, adaptador de corriente con su wattaje, guía de inicio rápido
- Si no puedes determinar un campo, usa valores razonables por defecto basados en el modelo identificado
- No inventes precios. Si no hay costo en la fuente, devuelve cost_usd como null`;

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const formData = await req.formData();
    const text = (formData.get("text") as string | null)?.trim() ?? "";
    // Soporte para múltiples imágenes (máximo 3). El cliente puede enviar
    // varios archivos bajo la misma key "file" — getAll() devuelve todos.
    const files = formData.getAll("file").filter((f) => f instanceof File) as File[];

    if (!text && files.length === 0) {
      return NextResponse.json(
        { error: "Envía al menos un texto o una imagen" },
        { status: 400 }
      );
    }
    if (files.length > 3) {
      return NextResponse.json(
        { error: "Máximo 3 imágenes" },
        { status: 400 }
      );
    }

    // Build content parts for the user message
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image"; image: Buffer; mediaType: string }
    > = [];

    const instructionText = text
      ? `Extrae los datos del siguiente producto:\n\n${text}`
      : files.length > 1
        ? `Analiza las ${files.length} imágenes del producto y extrae sus datos técnicos. Úsalas como referencias complementarias (vistas distintas, ficha técnica, caja, etc.).`
        : "Extrae los datos del producto que aparece en la imagen.";

    content.push({ type: "text", text: instructionText });

    for (const file of files) {
      if (!ALLOWED_IMAGES.includes(file.type)) {
        return NextResponse.json(
          { error: `Archivo ${file.name}: solo JPG, PNG o WebP` },
          { status: 400 }
        );
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: `Archivo ${file.name}: máximo 8MB` },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      content.push({ type: "image", image: buffer, mediaType: file.type });
    }

    // Plain string model id -> routes through Vercel AI Gateway (OIDC auth).
    const result = await generateText({
      model: "anthropic/claude-sonnet-4.6",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output: Output.object({ schema: ProductSchema }),
      providerOptions: {
        gateway: {
          tags: ["feature:product-extraction", "env:production"],
        },
      },
    });

    console.log(`[admin/products/extract] ${session.email} extracted product data`);

    return NextResponse.json({
      ok: true,
      data: result.output,
    });
  } catch (err) {
    console.error("[admin/products/extract] error:", err);
    const msg = err instanceof Error ? err.message : "Error al procesar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
