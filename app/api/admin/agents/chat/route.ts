import { NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { requireAdmin } from "@/lib/auth";
import { AGENTS, readOrchestratorSystemPrompt } from "@/lib/agents";

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

  const agentList = AGENTS.filter((a) => a.id !== "orquestador")
    .map((a) => `- \`${a.id}\` — ${a.title}: ${a.tagline}`)
    .join("\n");

  const system = `Eres el ORQUESTADOR del equipo de marketing de FLUX.
Tienes 9 subagentes a tu disposición y coordinas pipelines autónomos entre ellos.
Hablas en español peruano, directo, sin formalismos. Eres el "manager" del equipo.

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

---

CONTEXTO EXPANDIDO DEL ORQUESTADOR (su propio CLAUDE.md):

${claudeMd}`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: 0.7,
  });

  return result.toTextStreamResponse();
}
