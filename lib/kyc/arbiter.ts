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

/** Señales cuantitativas del pipeline forense (todas opcionales). */
export interface ArbiterForensicsSignals {
  forensics?: {
    ela_score: number;
    copy_move_score: number;
    photo_edge_score: number;
    noise_consistency: number;
    overall_tampering_risk: number;
  };
  template?: {
    layout_score: number;
    escudo_detected: boolean;
    photo_bbox_ok: boolean;
    mrz_region_ok: boolean;
    issues: string[];
  };
  age_consistency?: {
    estimated_age_low: number;
    estimated_age_high: number;
    dni_age: number;
    within_range: boolean;
    deviation_years: number;
  };
  duplicates?: {
    dni_reused_by_other_user: boolean;
    other_user_ids: string[];
    risk_score: number;
  };
}

export interface ArbiterInput extends ArbiterForensicsSignals {
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

**Señales forenses cuantitativas (opcionales, usá si vienen en el payload)**:
Cuando el payload incluya scores forenses, dales peso FUERTE en tu decisión:

- \`forensics.overall_tampering_risk > 0.5\` → fuerte señal de manipulación
  digital. Inclinate a rechazar salvo que el DNI visualmente se vea impecable
  y el resto de la evidencia sea sólida (puede haber falso positivo por
  scan con ruido alto). Documentá el score en \`reason\`.

- \`duplicates.dni_reused_by_other_user = true\` → RECHAZAR casi sin
  excepción. El mismo DNI fue usado por otro user_id en un intento previo de
  KYC. Un DNI legítimo pertenece a una sola persona. Solo ignorar si la
  historia apunta a un caso claro de typo en ingreso (y aun así preferí
  rechazar y pedir reintento).

- \`template.layout_score < 0.5\` + \`issues\` con regiones no detectadas →
  señal de documento fake (no coincide con el layout del DNI peruano
  auténtico). Inclinate a rechazar.

- \`age_consistency.within_range = false\` + \`deviation_years > 5\` →
  rostro en la selfie muy alejado de la edad calculada del DNI. Considerálo
  como evidencia de mismatch facial, pero tomalo con pinza: Rekognition
  AGE_RANGE tiene ±5 años de error típico, así que una desviación de 3-5
  años no alarma.

Al decidir, mencioná qué señales pesaron en \`reason\` (ej: "Rechazo por
forensics.overall=0.82 y layout=0.4" o "Apruebo, forensics limpio 0.12 y
face_score=87").

Respondés SIEMPRE con el tool \`emit_verdict\`. Jamás texto libre.`;

/**
 * Formatea las señales forenses opcionales como un bloque legible para Claude.
 * Si no vienen (KYC_FORENSICS_ENFORCE=false y caller no las pasó), retorna string vacío.
 */
function formatForensicsBlock(input: ArbiterForensicsSignals): string {
  const lines: string[] = [];
  if (input.forensics) {
    const f = input.forensics;
    lines.push(
      `\nSeñales forenses de imagen (overall_tampering_risk es la combinación ponderada):`,
      `- overall_tampering_risk: ${f.overall_tampering_risk.toFixed(3)}`,
      `  · ela_score=${f.ela_score.toFixed(3)} · copy_move=${f.copy_move_score.toFixed(3)} · photo_edge=${f.photo_edge_score.toFixed(3)} · noise_consistency=${f.noise_consistency.toFixed(3)}`,
    );
  }
  if (input.template) {
    const t = input.template;
    lines.push(
      `\nLayout del DNI (template matching vs DNI peruano auténtico):`,
      `- layout_score: ${t.layout_score.toFixed(3)}`,
      `  · escudo=${t.escudo_detected ? "sí" : "no"} · foto_bbox=${t.photo_bbox_ok ? "sí" : "no"} · mrz=${t.mrz_region_ok ? "sí" : "no"}`,
    );
    if (t.issues.length > 0) {
      lines.push(`  · issues: ${t.issues.slice(0, 3).join("; ")}`);
    }
  }
  if (input.age_consistency) {
    const a = input.age_consistency;
    lines.push(
      `\nConsistencia de edad (Rekognition vs DNI):`,
      `- dni_age=${a.dni_age} vs estimated=[${a.estimated_age_low}, ${a.estimated_age_high}] · within_range=${a.within_range} · deviation_years=${a.deviation_years}`,
    );
  }
  if (input.duplicates) {
    const d = input.duplicates;
    lines.push(
      `\nCross-user duplicates (mismo DNI usado en otros intentos KYC):`,
      `- dni_reused_by_other_user=${d.dni_reused_by_other_user} · risk_score=${d.risk_score.toFixed(3)}`,
    );
    if (d.other_user_ids.length > 0) {
      lines.push(`  · other_user_ids (max 3): ${d.other_user_ids.slice(0, 3).join(", ")}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

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

${formatForensicsBlock(input)}
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
