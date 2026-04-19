/**
 * FLUX Marketing Agents — definidos como ToolLoopAgent del AI SDK v6.
 *
 * Cada agente es una instancia reutilizable con model, instructions, tools
 * y stopWhen configurados. Se usan con:
 *   - agent.generate({ prompt }) → para ejecuciones server-side (runAgent)
 *   - agent.stream({ prompt, messages }) → para chat (Growth en /admin/agentes)
 *
 * Subagentes se delegan con el patrón nativo: un tool cuyo execute llama
 * a subagent.generate() y devuelve el resultado.
 */

import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { z } from "zod";
import { modelForAgent } from "./agent-models";
import { listOpenBlockers } from "./agent-blockers";
import { runningAgents } from "./agents-db";
import fs from "node:fs/promises";
import path from "node:path";
import { AGENTS_ROOT, AGENTS, type AgentId } from "./agents";
import {
  listAgentFiles,
  readAgentFile,
  writeAgentFile,
  ensureSchema,
  startRun,
  finishRun,
  calculateCost,
} from "./agents-db";
import { webFetchTool, webSearchTool, generateImageTool } from "./agent-tools";
import { strategyToolsForAgent } from "./strategy-tools";
import { codeToolsForProgrammer } from "./code-tools";
import { matchHandoffs } from "./agent-handoffs";
import { getActiveStrategy } from "./strategy-db";
import { FLUX_INFRA_CONTEXT } from "./flux-infra-context";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

async function loadSystemPrompt(agentId: AgentId): Promise<string> {
  try {
    return await fs.readFile(path.join(AGENTS_ROOT, agentId, "CLAUDE.md"), "utf8");
  } catch {
    return `Eres el agente ${agentId} del equipo de marketing de FLUX.`;
  }
}

async function filesContext(agentId: AgentId): Promise<string> {
  const files = await listAgentFiles(agentId);
  if (files.length === 0) return "(workspace vacío)";
  return files
    .slice(0, 20)
    .map((f) => `- ${f.rel_path} (${f.size}b, ${f.updated_at.toISOString()})`)
    .join("\n");
}

/** Tools extra por tipo de agente (web, imágenes, Meta). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extraToolsForAgent(agentId: AgentId): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extras: Record<string, any> = {};
  if (
    ["market-researcher", "seo-specialist", "data-analyst", "finance-controller"].includes(
      agentId,
    )
  ) {
    extras.web_fetch = webFetchTool;
    extras.web_search = webSearchTool;
  }
  if (agentId === "disenador-creativo") {
    extras.generate_image = generateImageTool;
  }
  if (["sem-manager", "content-creator", "customer-success"].includes(agentId)) {
    extras.web_fetch = webFetchTool;
  }
  // Meta Ads — se inyecta solo si hay credenciales. Si falta, el blocker
  // del env var correspondiente lo reporta y el agente lo ve.
  if (agentId === "sem-manager") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const meta = require("./meta-ads") as typeof import("./meta-ads");
      if (meta.metaAdsReady()) Object.assign(extras, meta.metaSemTools());
    } catch {}
  }
  if (agentId === "community-manager") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const meta = require("./meta-ads") as typeof import("./meta-ads");
      if (meta.metaCommunityReady()) Object.assign(extras, meta.metaCommunityTools());
    } catch {}
  }
  return extras;
}

// ═══════════════════════════════════════════════════════════════════════════
// File tools del workspace (DB-backed)
// ═══════════════════════════════════════════════════════════════════════════

function fileTools(agentId: AgentId, actor: string, filesWritten: { relPath: string; size: number }[]) {
  return {
    list_files: tool({
      description: "Lista todos los archivos de este agente",
      inputSchema: z.object({}),
      execute: async () => {
        const files = await listAgentFiles(agentId);
        return {
          count: files.length,
          files: files.map((f) => ({
            rel_path: f.rel_path,
            size: f.size,
            updated_at: f.updated_at.toISOString(),
          })),
        };
      },
    }),
    read_file: tool({
      description: "Lee un archivo del workspace",
      inputSchema: z.object({
        rel_path: z.string(),
      }),
      execute: async ({ rel_path }) => {
        const file = await readAgentFile(agentId, rel_path);
        if (!file) return { error: `not found: ${rel_path}` };
        return { rel_path: file.rel_path, content: file.content, size: file.size };
      },
    }),
    write_file: tool({
      description: "Crea/sobreescribe un archivo en el workspace. Persiste en DB.",
      inputSchema: z.object({
        rel_path: z.string(),
        content: z.string(),
      }),
      execute: async ({ rel_path, content }) => {
        const clean = rel_path.replace(/^\/+/, "").replace(/\.\.+/g, "");
        if (content.length > 200_000) return { error: "too large" };
        const saved = await writeAgentFile(agentId, clean, content, actor);
        filesWritten.push({ relPath: saved.rel_path, size: saved.size });
        return { ok: true, rel_path: saved.rel_path, size: saved.size };
      },
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Build a ToolLoopAgent for a given agentId
// ═══════════════════════════════════════════════════════════════════════════

export interface AgentRunResult {
  agentId: AgentId;
  success: boolean;
  text: string;
  filesWritten: { relPath: string; size: number }[];
  steps: number;
  error?: string;
  durationMs: number;
  handoffs?: { agent: AgentId; task: string }[];
}

/**
 * Crea un ToolLoopAgent configurado para un agente específico.
 *
 * Es una factory function que devuelve el agent instance + el array
 * mutable de filesWritten para trackear outputs.
 */
export async function buildAgent(
  agentId: AgentId,
  task: string,
  actor: string,
  maxSteps = 8,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: ToolLoopAgent<never, any, any>;
  filesWritten: { relPath: string; size: number }[];
}> {
  await ensureSchema();

  const isProgrammer = agentId === "programador-fullstack";
  const systemPromptBase = await loadSystemPrompt(agentId);
  const existingContext = await filesContext(agentId);

  // Contexto de estrategia activa
  let strategyBlock = "";
  try {
    const active = await getActiveStrategy();
    if (active) {
      strategyBlock = `\n\n---\n# ESTRATEGIA ACTIVA: ${active.name} (id ${active.id}, ${active.status})\nNorth Star: ${active.north_star_metric ?? "—"}\nPeríodo: ${active.start_date} → ${active.end_date}\nLlamá a get_strategy_context para ver objetivos/KPIs/tasks.`;
    }
  } catch {}

  const programmerOverride = isProgrammer
    ? `\n\n---\n# OVERRIDE PROGRAMADOR\nUsá SOLO tools con prefijo github_* para código (NO write_file/read_file del marketing workspace).`
    : "";

  const instructions = `${systemPromptBase.slice(0, 6000)}${strategyBlock}${programmerOverride}

${FLUX_INFRA_CONTEXT}

---

# MODO EJECUCIÓN AUTÓNOMA

Estás corriendo server-side como proceso real. Usá tus tools para ejecutar, no solo responder con texto.

## Archivos existentes
${existingContext}

## Protocolo
1. Decidí qué archivo(s) escribir
2. Si necesitás leer algo, usá read_file
3. Escribí con write_file (path relativo, ej: "briefs/2026-04-16-agencias.md")
4. Al final, respondé con resumen de 2-3 líneas de lo que hiciste + paths`;

  const filesWritten: { relPath: string; size: number }[] = [];

  // Merge tools
  const extras = extraToolsForAgent(agentId);
  const strategyTools = strategyToolsForAgent(agentId, actor);
  const programmerTools = isProgrammer ? codeToolsForProgrammer(actor) : {};
  const fTools = fileTools(agentId, actor, filesWritten);

  const allTools = {
    ...fTools,
    ...extras,
    ...strategyTools,
    ...programmerTools,
  };

  const agent = new ToolLoopAgent({
    id: agentId,
    model: modelForAgent(agentId),
    instructions,
    tools: allTools,
    stopWhen: stepCountIs(maxSteps),
    // `temperature` deprecated por Claude Opus 4.7 (conflicto con extended thinking).
    // Default=1.0 de Anthropic es fine para agentes.
    onStepFinish: async (step) => {
      // Log cada paso para debug
      const toolNames = step.toolCalls?.map((tc) => tc.toolName).join(", ");
      if (toolNames) {
        console.log(`[agent:${agentId}] step tools: ${toolNames}`);
      }
    },
  });

  return { agent, filesWritten };
}

// ═══════════════════════════════════════════════════════════════════════════
// Run an agent (replacement for old runAgent in agent-runner.ts)
// ═══════════════════════════════════════════════════════════════════════════

export async function runAgent({
  agentId,
  task,
  actor = "orquestador",
  maxSteps = 8,
  depth = 0,
}: {
  agentId: AgentId;
  task: string;
  actor?: string;
  maxSteps?: number;
  depth?: number;
}): Promise<AgentRunResult> {
  const start = Date.now();

  if (!AGENTS.some((a) => a.id === agentId)) {
    return {
      agentId, success: false, text: "", filesWritten: [], steps: 0,
      error: `agente desconocido: ${agentId}`, durationMs: Date.now() - start,
    };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      agentId, success: false, text: "", filesWritten: [], steps: 0,
      error: "ANTHROPIC_API_KEY no configurada", durationMs: Date.now() - start,
    };
  }

  const runRecord = await startRun(agentId, task, actor);

  try {
    const { agent, filesWritten } = await buildAgent(agentId, task, actor, maxSteps);

    const result = await agent.generate({
      prompt: `Tarea: ${task}`,
    });

    // Handoffs en cascada — profundidad 4 permite pipelines largos
    // (ej. market-researcher → estratega → copy → diseñador → community)
    const triggeredHandoffs: { agent: AgentId; task: string }[] = [];
    if (depth < 4 && filesWritten.length > 0) {
      const matches = matchHandoffs(agentId, filesWritten);
      for (const { rule, sourcePath } of matches) {
        const handoffTask = rule.then.taskTemplate({ sourceAgent: agentId, sourcePath });
        triggeredHandoffs.push({ agent: rule.then.agent, task: handoffTask });
      }
    }

    const durationMs = Date.now() - start;
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const costUsd = calculateCost(inputTokens, outputTokens, agentId);

    await finishRun(runRecord.id, {
      status: "done",
      text: result.text,
      filesWritten,
      durationMs,
      inputTokens,
      outputTokens,
      costUsd,
    });

    return {
      agentId,
      success: true,
      text: result.text,
      filesWritten,
      steps: result.steps?.length ?? 1,
      durationMs,
      handoffs: triggeredHandoffs.length > 0 ? triggeredHandoffs : undefined,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    await finishRun(runRecord.id, {
      status: "error",
      error: errMsg,
      filesWritten: [],
      durationMs,
    });
    return {
      agentId, success: false, text: "", filesWritten: [], steps: 0,
      error: errMsg, durationMs,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Build the Growth agent for chat (streaming)
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildGrowthAgent(actor: string): Promise<ToolLoopAgent<never, any, any>> {
  let claudeMd = "";
  try {
    claudeMd = await loadSystemPrompt("orquestador");
    if (claudeMd.length > 6000) claudeMd = claudeMd.slice(0, 6000) + "\n…";
  } catch {}

  const agentList = AGENTS.filter((a) => a.id !== "orquestador")
    .map((a) => `- \`${a.id}\` — ${a.title}: ${a.tagline}`)
    .join("\n");

  let strategyBlock = "";
  let attachmentsBlock = "";
  let recentOutputsBlock = "";
  let blockersBlock = "";
  let runningBlock = "";
  try {
    const active = await getActiveStrategy();
    const { listAttachments } = await import("./strategy-db");
    const { listAllRecent } = await import("./agents-db");

    if (active) {
      strategyBlock = `\n\n# ESTRATEGIA ACTIVA\n- **${active.name}** (id ${active.id}, ${active.status})\n- ${active.start_date} → ${active.end_date}\n- NSM: ${active.north_star_metric ?? "—"}`;
    } else {
      strategyBlock = `\n\n# SIN ESTRATEGIA ACTIVA\nUsá create_strategy → create_objective → create_kpi → schedule_task → activate_strategy para crear una.`;
    }

    const attachments = await listAttachments(active?.id ?? null);
    if (attachments.length > 0) {
      attachmentsBlock = `\n\n# ADJUNTOS (${attachments.length})\n${attachments.slice(0, 5).map((a) => `- ${a.title} (${a.content_type})`).join("\n")}`;
    }

    const recentFiles = await listAllRecent(10);
    if (recentFiles.length > 0) {
      recentOutputsBlock = `\n\n# OUTPUTS RECIENTES DEL EQUIPO\n${recentFiles.map((f) => `- [${f.agent_id}] ${f.rel_path} (${f.size}b)`).join("\n")}`;
    }

    // Blockers abiertos — el Growth tiene que saberlos ANTES de delegar
    const openBlockers = await listOpenBlockers();
    if (openBlockers.length > 0) {
      const byAgent = new Map<string, typeof openBlockers>();
      for (const b of openBlockers) {
        const arr = byAgent.get(b.agent_id) ?? [];
        arr.push(b);
        byAgent.set(b.agent_id, arr);
      }
      const lines = Array.from(byAgent.entries()).map(([agent, list]) => {
        const items = list
          .slice(0, 3)
          .map((b) => `  - [${b.severity}] ${b.title}`)
          .join("\n");
        return `- \`${agent}\` (${list.length}):\n${items}`;
      });
      blockersBlock = `\n\n# ⚠️ BLOCKERS ABIERTOS (${openBlockers.length})\nEstos agentes tienen alertas activas. Evitá delegarles tareas que requieran el recurso bloqueado, o abrí el panel para resolver:\n${lines.join("\n")}`;
    }

    // Agentes corriendo AHORA — evitar dobles delegaciones
    const busy = await runningAgents();
    if (busy.length > 0) {
      runningBlock = `\n\n# 🏃 AGENTES EN EJECUCIÓN (${busy.length})\n${busy.map((a) => `- \`${a}\``).join("\n")}\nNO deleges tareas adicionales a estos agentes hasta que terminen (usá list_running_agents para verificar).`;
    }
  } catch {}

  const instructions = `Eres el HEAD OF GROWTH de FLUX (fluxperu.com, alquiler mensual MacBooks, Perú).

${FLUX_INFRA_CONTEXT}

Pensás en AARRR, priorizás con PIE, sos data-first. Tenés 10+ agentes especializados.
Delegás research al equipo con delegate_to_agent ANTES de preguntarle al usuario.
Solo le preguntás al usuario DECISIONES ESTRATÉGICAS (segmento, budget, riesgo). Máximo 3-4 preguntas.

AGENTES:
${agentList}

FORMATO:
- [[agente:slug]] para mencionar — [[delegate:slug]]tarea[[/delegate]] para delegar
- [[plan]]pasos[[/plan]] para planes — [[flow]]diagrama[[/flow]] para flujos
- Markdown, imágenes con ![alt](url), archivos con [[file:path|label]]

${claudeMd}${strategyBlock}${blockersBlock}${runningBlock}${attachmentsBlock}${recentOutputsBlock}`;

  const tools = {
    ...strategyToolsForAgent("orquestador", actor),
    list_running_agents: tool({
      description:
        "Devuelve los agentes que están corriendo AHORA (status=running). Usá esto ANTES de delegar para evitar doble ejecución.",
      inputSchema: z.object({}),
      execute: async () => {
        const busy = await runningAgents();
        return { running: busy, count: busy.length };
      },
    }),
    list_open_blockers: tool({
      description:
        "Lista los blockers abiertos de todos los agentes (o de uno específico). Útil para entender por qué un agente no puede progresar.",
      inputSchema: z.object({
        agent_id: z.string().optional().describe("Filtrar por agente (opcional)"),
      }),
      execute: async ({ agent_id }) => {
        const list = await listOpenBlockers(agent_id as AgentId | undefined);
        return {
          count: list.length,
          blockers: list.map((b) => ({
            id: b.id,
            agent: b.agent_id,
            severity: b.severity,
            title: b.title,
            context_key: b.context_key,
          })),
        };
      },
    }),
  };

  console.log("[growth-agent] built with", Object.keys(tools).length, "tools, instructions:", instructions.length, "chars");

  return new ToolLoopAgent({
    id: "growth",
    model: modelForAgent("orquestador"),
    instructions,
    tools,
    stopWhen: stepCountIs(12),
    // `temperature` deprecated por Claude Opus 4.7 — default 1.0 es OK.
  });
}
