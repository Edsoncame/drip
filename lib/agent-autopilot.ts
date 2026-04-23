/**
 * Modo Autopilot de los agentes.
 *
 * Los agentes ya tienen contexto completo (CLAUDE.md con rol, objetivos,
 * modos de operación, reglas). Autopilot les pregunta "¿qué harías ahora
 * si nadie te dice nada?" y los deja ejecutar solos.
 *
 * Protección: no repite agentes que ya corrieron en las últimas 6 horas
 * (cooldown), y procesa máximo N agentes por tick para no blowar función.
 */

import { runAgent, type AgentRunResult } from "./agent-runner";
import { AGENTS, type AgentId } from "./agents";
import { latestRunForAgent, runningAgents, getFinanceSummary } from "./agents-db";
import { runSchedulerTick } from "./task-scheduler";
import { autoDetectBlockers } from "./agent-blockers";

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 horas
const MAX_AGENTS_PER_TICK = 3;

/**
 * Techo de gasto diario del autopilot. Si el costo acumulado del día
 * ya excedió este valor, el tick termina sin correr agentes.
 * Configurable via env DAILY_AUTOPILOT_COST_CAP_USD. Default $20/día.
 */
const DAILY_COST_CAP_USD = Number(
  process.env.DAILY_AUTOPILOT_COST_CAP_USD ?? "20",
);

/**
 * Prompt proactivo genérico. El CLAUDE.md del agente ya está en el system
 * prompt del runner, así que acá solo le damos el "gatillo" y protocolo.
 */
function proactivePrompt(_agentId: AgentId): string {
  const today = new Date().toISOString().slice(0, 10);
  return `MODO AUTOPILOT — nadie te dio una tarea explícita.

Tenés tu CLAUDE.md como contexto completo: sabés qué es FLUX (plataforma peruana de alquiler mensual de MacBooks), sabés tu rol, tus modos, tus reglas y tus convenciones.

Tu trabajo ahora:

1. Usá list_files para ver qué ya escribiste recientemente.
2. Si tenés memory.md, recordá lo aprendido (si existe en tu workspace).
3. Decidí LA tarea más valiosa que podés ejecutar AHORA sin esperar instrucciones humanas.
   Ideas por rol (no son obligatorias — elegí lo más útil según tu contexto):
   - SEO: keyword scan long-tail, audit técnico, brief para content-creator sobre oportunidad nueva
   - Market-researcher: scan de Leasein/Rent a Mac vía web_fetch, análisis de segmento desatendido
   - Estratega: brief estratégico para audiencia no cubierta, revisión de posicionamiento
   - Copywriter: variaciones de copy para ángulo nuevo, email template que falte
   - Content-creator: artículo basado en oportunidad conocida, post LinkedIn founder-led
   - Community: calendario semanal de posts orgánicos, scripts de reels
   - SEM: plan de campaña para un segmento o canal que falte
   - Diseñador: set de visuales para una campaña pendiente
   - Data-analyst: reporte de hipótesis a validar con data disponible
   - Lead-qualifier: sin leads reales nuevos, escribí una memoria de mejores prácticas de scoring

4. EJECUTÁ esa tarea con tus tools disponibles. Escribí al menos UN archivo con write_file en tu subcarpeta correcta.
   - Nombre del archivo: \`[carpeta]/${today}-autopilot-[slug-corto].md\`
   - Incluí al final del contenido una nota: \`---\\n*(generado en modo autopilot · ${today})*\`

5. Si honestamente no hay nada valioso que hacer ahora (ej: ya hiciste lo importante recientemente, o la tarea requiere contexto externo que no tenés), respondé con UNA LÍNEA: \`SKIP: [razón corta]\` y NO escribas archivos. Es válido saltarse un turno.

Sé pragmático. Tu objetivo es que FLUX crezca en el mercado peruano de alquiler de MacBooks. Cada archivo que escribís tiene que aportar algo concreto — un análisis, una pieza lista, un plan accionable. No escribas ruido.`;
}

export interface AutopilotResult {
  tickedAt: string;
  agentsConsidered: number;
  agentsExecuted: number;
  costGuard?: {
    spentTodayUsd: number;
    capUsd: number;
    skipped: boolean;
  };
  scheduledTasks: {
    checked: number;
    executed: number;
    rescheduled: number;
  };
  results: {
    agent: AgentId;
    status: "executed" | "cooldown" | "busy" | "skipped" | "cost_cap";
    reason?: string;
    run?: AgentRunResult;
  }[];
}

/**
 * Elige y ejecuta la próxima tanda de agentes proactivos.
 *
 * Prioridad: primero los que NUNCA corrieron, después los que tienen el
 * run más viejo (pero fuera del cooldown).
 */
export async function runAutopilotTick(opts?: {
  max?: number;
  ignoreCooldown?: boolean;
  onlyAgents?: AgentId[];
}): Promise<AutopilotResult> {
  const max = opts?.max ?? MAX_AGENTS_PER_TICK;
  const now = Date.now();
  const results: AutopilotResult["results"] = [];

  // 0a. Cost guard — si ya gastamos el cap del día, abortamos antes de
  //     correr cualquier agente. Esto protege contra runaways por bugs
  //     o loops de delegación costosos.
  const todaySpend = await getFinanceSummary("today").catch(() => null);
  const spentTodayUsd = todaySpend?.totals.costUsd ?? 0;
  if (spentTodayUsd >= DAILY_COST_CAP_USD) {
    return {
      tickedAt: new Date().toISOString(),
      agentsConsidered: 0,
      agentsExecuted: 0,
      costGuard: {
        spentTodayUsd,
        capUsd: DAILY_COST_CAP_USD,
        skipped: true,
      },
      scheduledTasks: { checked: 0, executed: 0, rescheduled: 0 },
      results: [
        {
          agent: "orquestador",
          status: "cost_cap",
          reason: `Gasto del día $${spentTodayUsd.toFixed(2)} alcanzó el cap de $${DAILY_COST_CAP_USD.toFixed(2)}. Subí DAILY_AUTOPILOT_COST_CAP_USD si querés más.`,
        },
      ],
    };
  }

  // 0b. Auto-detectar blockers (env vars faltantes, etc). Si aparecen
  //     nuevos, se reportan solos; si el user configuró algo que faltaba,
  //     el blocker correspondiente se marca como resuelto.
  await autoDetectBlockers().catch((err) => {
    console.error("[autopilot] blocker detection error", err);
  });

  // 1. Corremos el scheduler de tasks due (estrategia) — prioridad sobre
  //    las tareas proactivas porque son tareas concretas con deadline.
  const scheduled = await runSchedulerTick({ maxTasks: 3 }).catch((err) => {
    console.error("[autopilot] scheduler error", err);
    return { checked: 0, executed: 0, rescheduled: 0, results: [] };
  });

  // Agentes candidatos (sin el orquestador — él no ejecuta, solo delega)
  const candidates = AGENTS.filter((a) => a.id !== "orquestador")
    .filter((a) => !opts?.onlyAgents || opts.onlyAgents.includes(a.id))
    .map((a) => a.id);

  const busy = new Set(await runningAgents());

  // Armar score por agente: menor score = mayor prioridad (más viejo)
  const scored: { agent: AgentId; lastRun: number; score: number }[] = [];
  for (const agentId of candidates) {
    if (busy.has(agentId)) {
      results.push({ agent: agentId, status: "busy" });
      continue;
    }
    const lastRun = await latestRunForAgent(agentId);
    const lastStart = lastRun?.started_at.getTime() ?? 0;
    if (!opts?.ignoreCooldown && lastStart > 0 && now - lastStart < COOLDOWN_MS) {
      results.push({
        agent: agentId,
        status: "cooldown",
        reason: `último run hace ${Math.round((now - lastStart) / 60000)}min, cooldown ${COOLDOWN_MS / 60000}min`,
      });
      continue;
    }
    scored.push({ agent: agentId, lastRun: lastStart, score: lastStart });
  }

  // Los más viejos primero (0 = nunca corrió = máxima prioridad)
  scored.sort((a, b) => a.score - b.score);
  const toRun = scored.slice(0, max);

  // EN PARALELO — los agentes corren al mismo tiempo. Un tick con 3 agentes
  // que antes tardaba 180s ahora tarda el tiempo del más lento (~60s).
  const parallelRuns = await Promise.all(
    toRun.map(({ agent }) =>
      runAgent({
        agentId: agent,
        task: proactivePrompt(agent),
        actor: "autopilot",
        maxSteps: 8,
        depth: 0,
      }).then((run) => ({ agent, run })),
    ),
  );
  for (const { agent, run } of parallelRuns) {
    results.push({ agent, status: "executed", run });
  }

  return {
    tickedAt: new Date().toISOString(),
    agentsConsidered: candidates.length,
    agentsExecuted: toRun.length,
    costGuard: {
      spentTodayUsd,
      capUsd: DAILY_COST_CAP_USD,
      skipped: false,
    },
    scheduledTasks: {
      checked: scheduled.checked,
      executed: scheduled.executed,
      rescheduled: scheduled.rescheduled,
    },
    results,
  };
}
