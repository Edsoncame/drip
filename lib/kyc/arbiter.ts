/**
 * Arbiter IA para casos KYC borderline.
 *
 * Cuando el pipeline clásico (OCR + match Jaro-Winkler + Rekognition face +
 * liveness) devuelve `review` —típicamente porque el nombre del form no
 * coincide al 100% con el DNI o el score facial quedó en rango medio—, este
 * arbiter consulta a Claude Opus con vision sobre TODA la evidencia y emite
 * un veredicto definitivo: verified o rejected.
 *
 * Ventajas:
 *   - Elimina la cola humana de `review` (el user sabe al instante si
 *     entra al pago o tiene que reintentar).
 *   - Claude puede tolerar variaciones de nombre razonables (apodos, orden
 *     distinto de apellidos, abreviaciones) que el algoritmo fijo rechaza.
 *   - Claude también puede rechazar casos que el algoritmo deja pasar
 *     (ej: selfie con pose correcta pero persona distinta).
 *
 * Costo ≈ $0.05 por caso (input: 2 imágenes + texto, ~2k tokens; output:
 * ~300 tokens). Solo se ejecuta en review → volumen bajo.
 */

import { generateText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export interface ArbiterInput {
  /** Datos que el usuario ingresó en el form */
  formName: string;
  formDniNumber: string;
  /** Datos extraídos del DNI por OCR */
  scanApellidoPaterno: string | null;
  scanApellidoMaterno: string | null;
  scanPrenombres: string | null;
  scanDniNumber: string | null;
  /** Scores del pipeline clásico */
  nameScore: number; // Jaro-Winkler 0..1
  faceScore: number; // AWS Rekognition similarity 0..100
  livenessPassed: boolean;
  /** URLs a los blobs para la vision API (ambos en Vercel Blob) */
  dniImageUrl: string;
  selfieImageUrl: string;
}

export interface ArbiterVerdict {
  verdict: "verified" | "rejected";
  /** Razón en lenguaje natural, para log + posible notificación al user */
  reason: string;
  /** Confianza propia del arbiter (0..1) — útil para triage interno */
  confidence: number;
  /** Aspectos específicos que Claude chequeó */
  checks: {
    face_same_person: boolean;
    name_reasonable_match: boolean;
    dni_looks_real: boolean;
  };
}

const VerdictSchema = z.object({
  verdict: z.enum(["verified", "rejected"]),
  reason: z
    .string()
    .describe(
      "Razón breve (1-2 oraciones) en español peruano, tuteo. Si rechazás, sé específico sobre qué falló.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Qué tan seguro estás del veredicto, de 0 (nada) a 1 (totalmente)."),
  checks: z.object({
    face_same_person: z
      .boolean()
      .describe("¿La persona del DNI y la selfie son la misma?"),
    name_reasonable_match: z
      .boolean()
      .describe(
        "¿El nombre del formulario coincide razonablemente con el del DNI (permitiendo orden distinto, apodos, acentos faltantes)?",
      ),
    dni_looks_real: z
      .boolean()
      .describe("¿El DNI se ve real y no manipulado/falsificado?"),
  }),
});

const SYSTEM_PROMPT = `Eres un auditor senior de KYC para Flux (renta de MacBooks en Perú).

Tu trabajo: mirar toda la evidencia de un caso de verificación de identidad
borderline y decidir si APROBAR (verified) o RECHAZAR (rejected). No existe
"review" como opción — tenés que decidir.

**Contexto del negocio**: son rentas mensuales por 8-24 meses con pago
automático por tarjeta. Un fraude significa perder el equipo (~USD $1000-
$2500). Una rechazada incorrectamente significa perder un cliente legítimo.
Balance: ser estricto con falsificaciones claras, pero tolerante con
diferencias menores de nombre (muy común en Perú: la gente escribe solo un
apellido, o invierte el orden, o abrevia "María del Pilar" a "Mariap").

**Qué evaluar**:
1. La persona de la selfie debe ser la misma que la foto del DNI. Aunque
   haya algunos años de diferencia o distinta iluminación, fijate en
   estructura facial, cejas, ojos, forma del mentón.
2. El nombre del form vs el del DNI. Matches OK:
   - Orden invertido de apellidos (DNI: "Perez Garcia Juan", form: "Juan Garcia Perez")
   - Sin acentos en uno pero sí en el otro
   - Un solo apellido cuando el DNI tiene dos
   - Acortamientos razonables (José → Pepe es OK, pero "Juan" → "Pedro" NO)
3. El DNI no debe verse manipulado digitalmente (texturas raras,
   inconsistencias en tipografía, bordes borrosos en zona de foto, etc.)
4. El número de DNI del form debe igualar el del DNI escaneado (tolerancia cero acá).

**Reglas duras (→ rejected sin debate)**:
- Rostros claramente distintos (persona distinta).
- DNI con señales de photoshop o edición.
- Número de DNI del form != número del DNI escaneado.

**Criterio para aprobar**:
- Match facial plausible + nombre razonablemente cercano + DNI se ve real.

Respondés SIEMPRE con el tool \`emit_verdict\`. Jamás texto libre.`;

export async function arbitrateKyc(input: ArbiterInput): Promise<ArbiterVerdict> {
  const userPrompt = `Caso KYC a revisar:

Datos del formulario (ingresados por el user):
- Nombre: ${input.formName}
- DNI: ${input.formDniNumber}

Datos extraídos del DNI por OCR:
- Apellido paterno: ${input.scanApellidoPaterno ?? "(no leído)"}
- Apellido materno: ${input.scanApellidoMaterno ?? "(no leído)"}
- Prenombres: ${input.scanPrenombres ?? "(no leído)"}
- Número DNI: ${input.scanDniNumber ?? "(no leído)"}

Scores del pipeline automático:
- Similitud de nombre (Jaro-Winkler): ${input.nameScore.toFixed(3)} (umbral auto-pass = 0.90)
- Similitud facial (AWS Rekognition): ${input.faceScore.toFixed(1)}% (umbral auto-pass = 85%)
- Liveness (3 frames con giros): ${input.livenessPassed ? "PASÓ" : "FALLÓ"}

Imágenes adjuntas:
1. Foto del DNI (anverso) — la foto oficial
2. Selfie central del usuario (primer frame)

Emití veredicto con el tool emit_verdict.`;

  const result = await generateText({
    model: anthropic("claude-opus-4-7"),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image", image: new URL(input.dniImageUrl), mediaType: "image/jpeg" },
          { type: "image", image: new URL(input.selfieImageUrl), mediaType: "image/jpeg" },
        ],
      },
    ],
    tools: {
      emit_verdict: tool({
        description: "Emite el veredicto KYC final basado en toda la evidencia visual y textual.",
        inputSchema: VerdictSchema,
      }),
    },
    toolChoice: { type: "tool", toolName: "emit_verdict" },
    maxRetries: 2,
  });

  const call = result.toolCalls?.[0];
  if (!call || call.toolName !== "emit_verdict") {
    throw new Error("arbiter: Claude no devolvió tool call");
  }
  return call.input as ArbiterVerdict;
}
