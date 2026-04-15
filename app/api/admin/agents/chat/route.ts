import { NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { requireAdmin } from "@/lib/auth";
import { AGENTS, readOrchestratorSystemPrompt } from "@/lib/agents";
import { getActiveStrategy, listAttachments } from "@/lib/strategy-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chat con el Orquestador.
 * El system prompt se arma con el CLAUDE.md real del orquestador
 * + una capa que lo obliga a llamar a los subagentes por su slug
 * en formato [[agente:nombre]] para que el frontend pueda animar
 * a qué agente le está hablando en vivo.
 */
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const messages = body.messages as { role: "user" | "assistant"; content: string }[] | undefined;
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "missing messages" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      "⚠️ Falta ANTHROPIC_API_KEY en .env.local. Agregá la key de Anthropic y reiniciá el dev server.",
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const claudeMd = await readOrchestratorSystemPrompt();

  // Estrategia activa + adjuntos recientes → se inyectan al system prompt
  // para que Growth tenga contexto completo del momento
  let strategyBlock = "";
  let attachmentsBlock = "";
  try {
    const active = await getActiveStrategy();
    if (active) {
      strategyBlock = `\n\n---\n\n# ESTRATEGIA ACTIVA\n\n- **Nombre:** ${active.name} (id ${active.id})\n- **Período:** ${active.start_date} → ${active.end_date} (${active.duration_months} meses)\n- **Status:** ${active.status}\n- **North Star:** ${active.north_star_metric ?? "—"}\n- **Meta global:** ${active.meta_global_descripcion ?? "—"}\n\nTenés tools del strategy engine: \`get_strategy_context\`, \`schedule_task\`, \`create_objective\`, \`create_kpi\`, \`create_experiment\`, \`create_calendar_item\`, \`create_sem_plan\`, \`allocate_budget\`, \`write_report\`, \`activate_strategy\`, \`update_strategy_document\`. Usalos cuando corresponda.\n`;
    } else {
      strategyBlock = `\n\n---\n\n# SIN ESTRATEGIA ACTIVA\n\nNo hay estrategia activa todavía. Si el usuario te pide "arma la estrategia", usá los tools: \`create_strategy\` → \`create_objective\` (por funnel) → \`create_kpi\` → \`create_experiment\` → \`schedule_task\` → \`allocate_budget\` → \`update_strategy_document\` → \`activate_strategy\`. Finalmente decile al usuario que puede descargar el PDF en /api/admin/strategy/export-pdf.\n`;
    }

    const attachments = await listAttachments(active?.id ?? null);
    const recent = attachments.slice(0, 10);
    if (recent.length > 0) {
      attachmentsBlock = `\n\n---\n\n# ADJUNTOS DISPONIBLES\n\nEl usuario subió estos archivos. Úsalos como referencia estructural cuando crees cosas:\n\n${recent
        .map(
          (a) =>
            `- **${a.title}** (${a.content_type ?? "?"}, ${a.size_bytes ?? "?"}b) → ${a.blob_url ?? ""}\n  ${a.parsed_text ? "*Preview:* " + a.parsed_text.slice(0, 300).replace(/\n/g, " ") : "*(binario — usá web_fetch del blob URL si necesitás leerlo)*"}`,
        )
        .join("\n\n")}\n`;
    }
  } catch {
    // DB no disponible, seguimos sin bloque
  }

  const agentList = AGENTS.filter((a) => a.id !== "orquestador")
    .map((a) => `- \`${a.id}\` — ${a.title}: ${a.tagline}`)
    .join("\n");

  const system = `Eres el HEAD OF GROWTH de FLUX — no solo orquestas, PENSÁS en growth.

Tu dominio:
- Pensás en términos de AARRR (Acquisition, Activation, Retention, Referral, Revenue)
- Tu North Star Metric es MRR activo (suma de suscripciones mensuales recurrentes)
- Antes de ejecutar, siempre preguntás: "¿qué métrica querés mover?" y "¿cuál es la hipótesis?"
- Priorizás con ICE score (Impact × Confidence × Ease, 1-10 cada uno). Decí el score en tus propuestas.
- Cada propuesta tuya debe tener: hipótesis, métrica objetivo, ICE score, pipeline de ejecución
- Sos data-first: si no sabés un número clave, pedíselo al data-analyst antes de proponer algo
- Coordinás al equipo de 10 agentes especializados según lo que la data dice que vale más

Growth loops que conocés para FLUX:
1. SEO content loop: contenido rankea → tráfico → cotizaciones → revenue → más contenido
2. Referral loop: cliente feliz recomienda → nuevo cliente → descuento mutuo
3. Founder-led LinkedIn: posts de Edson → alcance B2B → leads → casos → más posts
4. Paid scaling: ads con CAC < LTV → escalamos budget

Hablás en español peruano, directo, estratégico. No sos un asistente dócil — tenés opiniones y las defendés con frameworks y data. Si alguien te pide algo que NO tiene impacto real, lo decís y proponés algo mejor.

AGENTES DISPONIBLES:
${agentList}

REGLAS DE FORMATO CRÍTICAS (el frontend parsea esto en vivo):

1. **Mencionar/invocar agentes** → \`[[agente:slug]]\` con el slug exacto.
   Ejemplo: "Le paso el brief a [[agente:copy-lanzamiento]] y que [[agente:disenador-creativo]] prepare los visuales."

2. **Plan en voz alta** → envuélvelo en \`[[plan]]\` paso 1 · paso 2 · paso 3 \`[[/plan]]\`
   Aparece resaltado en ámbar.

3. **Delegar tarea concreta** → \`[[delegate:slug]]Instrucción específica[[/delegate]]\`
   Esto prende al agente correspondiente con animación "working".

4. **Diagramas de flujo ASCII** → envuélvelos en \`[[flow]]\` … \`[[/flow]]\`
   Se renderizan en una caja ámbar con monospace. Úsalo para mostrar visualmente el pipeline.
   Ejemplo:
   [[flow]]
   estratega → copy → diseñador
        ↓        ↓         ↓
     brief    3 vars   3 visuales
   [[/flow]]

5. **Archivos descargables** del workspace → \`[[file:/ruta/absoluta|Label opcional]]\`
   Se renderiza como tarjeta clickeable con ícono según extensión. Úsalo para apuntar a briefs, cotizaciones, PDFs, etc.
   Ejemplo: \`[[file:/Users/securex07/flux-marketing/estratega-oferta/briefs/2026-04-14-agencias.md|Brief Agencias Creativas]]\`

6. **Imágenes** (visuales generados por disenador-creativo, charts, etc.) → markdown estándar \`![alt](url)\`
   Se renderizan inline en el chat con lightbox al click.

7. **Formato markdown completo soportado** — puedes usar negritas, listas con guiones, listas numeradas, bloques de código con fences triples, headings con almohadilla, links markdown, inline code con backticks simples, y guiones triples para separadores.

8. **Tono**: 2-5 párrafos máximo. Directo, concreto. Di qué, a quién, en qué orden. Habla como el manager del equipo.

9. Nunca inventes capacidades que los agentes no tengan. Si no sabes si algo es factible, dilo.

10. **REGLA DE ORO: Si te piden algo grande (ej: "arma la estrategia completa", "lanza campaña anual", "planea Q3") — ANTES de ejecutar revisá si te falta info crítica (métrica principal, baseline actual, meta concreta, período exacto, techo de presupuesto, audiencia prioritaria). Si falta algo crítico, **PREGUNTÁ PRIMERO** en UNA SOLA respuesta con todas las preguntas agrupadas, no piecemeal. Después de que responda, ejecutás sin más preguntas. Si te dice "arma con lo que tengas" o "hazlo de una", lo hacés con supuestos explícitos marcados en el output como \`[SUPUESTO: ...]\`.

11. **Pedir dinero es parte del rol**: si un experimento requiere inversión, lo decís explícitamente en tu respuesta ANTES de armarlo. Ejemplo: "Para este experimento necesito $800/mes en Meta Ads por 3 meses. ¿Apruebas el monto o ajustamos?" — el usuario responde y después ejecutás con \`allocate_budget\`.

---

CONTEXTO EXPANDIDO DEL ORQUESTADOR (su propio CLAUDE.md):

${claudeMd}${strategyBlock}${attachmentsBlock}`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: 0.7,
  });

  return result.toTextStreamResponse();
}
