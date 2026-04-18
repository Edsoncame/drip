/**
 * OCR de DNI peruano con Claude Opus 4.7 vision.
 *
 * En AI SDK v6 `generateObject` fue removido. Usamos `generateText` con
 * tool calling forzado — Anthropic internamente implementa structured
 * output como un tool call, así que este patrón es más estable y
 * funciona con cualquier SDK wrapper.
 *
 * Costo por scan:
 *   - imagen 1024×768 JPEG ~150KB → ~1500 tokens input
 *   - respuesta estructurada → ~500 tokens output
 *   - Opus 4.7: $15/M input + $75/M output
 *   - ≈ $0.06 por OCR (acepta para KYC, no para scraping masivo)
 */

import { generateText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export const DniOcrSchema = z.object({
  dni_number: z
    .string()
    .describe("8 dígitos numéricos del DNI peruano. Devolvé solo dígitos."),
  apellido_paterno: z
    .string()
    .describe("Primer apellido (paterno) en mayúsculas, sin acentos."),
  apellido_materno: z
    .string()
    .describe("Segundo apellido (materno) en mayúsculas, sin acentos."),
  prenombres: z
    .string()
    .describe("Nombres (uno o más) en mayúsculas, sin acentos."),
  fecha_nacimiento: z
    .string()
    .describe("Fecha de nacimiento en formato YYYY-MM-DD."),
  sexo: z
    .enum(["M", "F"])
    .describe("Sexo: M (masculino) o F (femenino)."),
  fecha_emision: z
    .string()
    .optional()
    .describe("Fecha de emisión YYYY-MM-DD. Omitir si no se ve."),
  fecha_caducidad: z
    .string()
    .optional()
    .describe("Fecha de caducidad YYYY-MM-DD. Omitir si no se ve."),
  mrz_raw: z
    .string()
    .optional()
    .describe("Si es DNIe y se ve la MRZ (3 líneas < al reverso), devolvé el texto exacto de las 3 líneas separadas por \\n."),
  es_dnie: z
    .boolean()
    .describe("true si es DNI electrónico (tiene chip visible y MRZ), false si es DNI antiguo."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confianza general de la extracción (0-1)."),
  quality_issues: z
    .array(z.string())
    .describe("Lista de problemas: 'blur', 'glare', 'partial', 'rotated', 'dark', 'fake-suspect'. Vacío si OK."),
});

export type DniOcr = z.infer<typeof DniOcrSchema>;

const SYSTEM_PROMPT = `Sos un especialista en OCR de documentos de identidad peruanos. Tu trabajo es extraer con precisión los datos del DNI que ves en la imagen.

Reglas estrictas:
- Devolvé los nombres en MAYÚSCULAS y SIN acentos (el DNI peruano los imprime así). Mantené la Ñ como Ñ.
- Los dígitos del DNI son exactamente 8 números. Si ves un DNI antiguo de 7 dígitos, dejalo como está.
- Las fechas las emitís en ISO YYYY-MM-DD.
- Si el documento NO es un DNI peruano, devolvé confidence: 0 y agregá "fake-suspect" en quality_issues.
- Si la imagen está muy borrosa, rotada >30°, o casi negra, devolvé lo que puedas pero bajá confidence y marcá quality_issues.
- No inventes campos que no podés leer. Si un campo no se ve claro, devolvé cadena vacía.
- Para MRZ: solo devolvela si realmente ves las 3 líneas con formato ICAO (< < < < ...) al reverso. Sino, omitir.

CRÍTICO: Devolvé los datos exclusivamente llamando al tool "extract_dni". No uses texto libre.`;

export async function extractDniFields(
  imageBytes: Buffer | Uint8Array,
  mimeType: string,
): Promise<DniOcr> {
  const mediaType = mimeType.includes("png")
    ? "image/png"
    : mimeType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

  const result = await generateText({
    model: anthropic("claude-opus-4-7"),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extrae los datos del DNI peruano que ves en la imagen. Usá el tool extract_dni para devolver el resultado.",
          },
          {
            type: "image",
            image: imageBytes,
            mediaType,
          },
        ],
      },
    ],
    tools: {
      extract_dni: tool({
        description: "Devolvé los datos estructurados extraídos del DNI peruano",
        inputSchema: DniOcrSchema,
      }),
    },
    toolChoice: { type: "tool", toolName: "extract_dni" },
    maxRetries: 2,
    // `temperature` está deprecated en Claude Opus 4.7 (extended thinking).
    // El determinismo lo conseguimos con toolChoice forzado + schema Zod.
  });

  const call = result.toolCalls?.[0];
  if (!call || call.toolName !== "extract_dni") {
    throw new Error("Claude no devolvió tool call extract_dni");
  }
  // input ya está validado por el SDK contra el Zod schema
  return call.input as DniOcr;
}
