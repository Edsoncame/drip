import { NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runAgent } from "@/lib/agent-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const tag = "[kick-orquestador]";

/**
 * Despierta al orquestador (Growth) para que evalúe el estado actual y
 * delegue lo que crea necesario. Se usa cuando el autopilot no lo agenda
 * (nunca lo hace — él no ejecuta, solo delega) y el admin quiere forzar
 * una ronda de trabajo sin escribir en el chat.
 *
 * Respuesta inmediata ({ started: true }) y ejecución en background vía after().
 * El cliente debe hacer poll a /api/admin/agents/state para ver los nuevos runs.
 */
export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY en Vercel env vars." },
      { status: 400 },
    );
  }

  const task = `MODO AUTOPILOT ORQUESTADOR — te disparo manualmente desde el panel.

Tu trabajo ahora:

1. Usá \`list_running_agents\` para ver quién está corriendo ya (no dupliques).
2. Usá \`list_open_blockers\` para ver quién está bloqueado y por qué.
3. Revisá la ESTRATEGIA ACTIVA y los OUTPUTS RECIENTES que ya están en tu system prompt.
4. Decidí la próxima acción más valiosa para FLUX (mercado peruano de alquiler mensual de MacBooks).
5. DELEGÁ esa tarea a 1-3 subagentes usando \`delegate_to_agent\` — no trates de hacerla vos mismo.
6. Si todo está cubierto y no hay nada urgente, respondé una línea: "SKIP: [razón corta]".

Sé concreto. Una ronda de delegaciones bien pensadas vale más que 10 genéricas.`;

  after(async () => {
    try {
      console.log(`${tag} disparando orquestador…`);
      const result = await runAgent({
        agentId: "orquestador",
        task,
        actor: "kick-manual",
        maxSteps: 12,
        depth: 0,
      });
      console.log(
        `${tag} finalizado success=${result.success} steps=${result.steps} duration=${result.durationMs}ms files=${result.filesWritten.length} handoffs=${result.handoffs?.length ?? 0}`,
      );
    } catch (err) {
      console.error(`${tag} ERROR`, err);
    }
  });

  return NextResponse.json({ started: true });
}
