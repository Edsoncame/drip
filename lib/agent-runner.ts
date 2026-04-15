/**
 * Agent Runner server-side.
 *
 * Ejecuta un subagente con un tool loop Claude:
 *   - Carga CLAUDE.md del agente como system prompt (desde el bundle estático)
 *   - Da al modelo herramientas para leer/escribir/listar archivos en la DB
 *   - Corre el loop hasta que el modelo termina (sin tool calls) o se agotan los pasos
 *
 * Los archivos escritos persisten en `marketing_agent_files` (Postgres).
 * Esto hace que los agentes estén "vivos" en producción sin necesidad de
 * que el usuario corra Claude Code local.
 */

import { generateText, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { AGENTS_ROOT, AGENTS, type AgentId } from "./agents";
import {
  listAgentFiles,
  readAgentFile,
  writeAgentFile,
  ensureSchema,
} from "./agents-db";

export interface AgentRunResult {
  agentId: AgentId;
  success: boolean;
  text: string;
  filesWritten: { relPath: string; size: number }[];
  steps: number;
  error?: string;
  durationMs: number;
}

/**
 * Lee el CLAUDE.md estático del agente (del bundle en `data/flux-marketing/`)
 * y lo devuelve como system prompt.
 */
async function loadAgentSystemPrompt(agentId: AgentId): Promise<string> {
  try {
    const p = path.join(AGENTS_ROOT, agentId, "CLAUDE.md");
    return await fs.readFile(p, "utf8");
  } catch {
    return `Eres el agente ${agentId} del equipo de marketing de FLUX.`;
  }
}

/**
 * Resumen corto de archivos existentes del agente para dar contexto inicial
 * al modelo sin volcar contenido completo.
 */
async function filesContext(agentId: AgentId): Promise<string> {
  const files = await listAgentFiles(agentId);
  if (files.length === 0) return "(workspace vacío todavía)";
  return files
    .slice(0, 20)
    .map((f) => `- ${f.rel_path} (${f.size} bytes, actualizado ${f.updated_at.toISOString()})`)
    .join("\n");
}

/**
 * Ejecuta un subagente con una tarea. Retorna el texto final + los archivos
 * que escribió. Maneja errores capturando excepciones para que nunca crashee
 * al caller.
 *
 * @param agentId  slug del agente (ej: "seo-specialist")
 * @param task     instrucción en lenguaje natural
 * @param actor    quién disparó la ejecución (email del admin, "orquestador", etc)
 * @param maxSteps máximo de iteraciones del tool loop (default 6)
 */
export async function runAgent({
  agentId,
  task,
  actor = "orquestador",
  maxSteps = 6,
}: {
  agentId: AgentId;
  task: string;
  actor?: string;
  maxSteps?: number;
}): Promise<AgentRunResult> {
  const start = Date.now();
  const filesWritten: { relPath: string; size: number }[] = [];

  if (!AGENTS.some((a) => a.id === agentId)) {
    return {
      agentId,
      success: false,
      text: "",
      filesWritten: [],
      steps: 0,
      error: `agente desconocido: ${agentId}`,
      durationMs: Date.now() - start,
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      agentId,
      success: false,
      text: "",
      filesWritten: [],
      steps: 0,
      error: "ANTHROPIC_API_KEY no configurada",
      durationMs: Date.now() - start,
    };
  }

  await ensureSchema();

  const systemPromptBase = await loadAgentSystemPrompt(agentId);
  const existingContext = await filesContext(agentId);

  const systemPrompt = `${systemPromptBase}

---

# MODO EJECUCIÓN AUTÓNOMA

Estás corriendo en el servidor de FLUX como proceso real — NO eres un chatbot que habla, sos un agente que EJECUTA tareas y escribe archivos persistentes.

## Herramientas disponibles

- **read_file(rel_path)**: leer un archivo tuyo existente
- **list_files()**: listar los archivos que ya tenés escritos
- **write_file(rel_path, content)**: CREAR o SOBREESCRIBIR un archivo. El path es relativo a tu workspace (ej: "briefs/2026-04-14-agencias.md"). Usá extensión .md por default.

## Convenciones de archivos

- Organizá los outputs en las subcarpetas que menciona tu CLAUDE.md (briefs/, drafts/, reports/, leads/hot/, etc.)
- Nombres: \`YYYY-MM-DD-[slug-corto].md\` en general
- Los archivos son markdown completo — podés usar headings, listas, tablas, code blocks, imágenes con markdown
- Un reporte típico debería ser rico: TL;DR arriba, contexto, hallazgos, próximos pasos

## Contexto inicial — archivos existentes en tu workspace

${existingContext}

## Protocolo

1. Pensá qué archivo(s) tenés que escribir para cumplir la tarea
2. Si necesitás leer algo existente primero, usá read_file
3. Escribí el/los archivo(s) con write_file
4. Terminá tu respuesta con un resumen corto (2-3 líneas) de lo que hiciste + ruta(s) del/los archivo(s) creado(s)

**Importante**: No respondas solo con texto — tu trabajo es escribir archivos. Si no escribiste nada, la tarea no se considera terminada.`;

  try {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: systemPrompt,
      prompt: `Tarea del orquestador: ${task}`,
      stopWhen: stepCountIs(maxSteps),
      tools: {
        list_files: tool({
          description: "Lista todos los archivos existentes de este agente con path, tamaño y fecha",
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
          description: "Lee el contenido completo de un archivo propio del agente",
          inputSchema: z.object({
            rel_path: z.string().describe("Ruta relativa del archivo dentro del workspace del agente"),
          }),
          execute: async ({ rel_path }) => {
            const file = await readAgentFile(agentId, rel_path);
            if (!file) return { error: `archivo no existe: ${rel_path}` };
            return { rel_path: file.rel_path, content: file.content, size: file.size };
          },
        }),
        write_file: tool({
          description:
            "CREA o SOBREESCRIBE un archivo markdown en el workspace del agente. Esto es lo que persiste el trabajo.",
          inputSchema: z.object({
            rel_path: z
              .string()
              .describe(
                "Ruta relativa dentro del workspace. Ej: 'briefs/2026-04-14-agencias.md'. NO usar ../ ni paths absolutos.",
              ),
            content: z.string().describe("Contenido completo del archivo en markdown"),
          }),
          execute: async ({ rel_path, content }) => {
            // Sanitización: sin path traversal
            const clean = rel_path.replace(/^\/+/, "").replace(/\.\.+/g, "");
            if (clean !== rel_path) {
              return { error: "path inválido — sin ../ ni paths absolutos" };
            }
            if (content.length > 200_000) {
              return { error: "archivo demasiado grande (>200kb)" };
            }
            const saved = await writeAgentFile(agentId, clean, content, actor);
            filesWritten.push({ relPath: saved.rel_path, size: saved.size });
            return {
              ok: true,
              rel_path: saved.rel_path,
              size: saved.size,
              updated_at: saved.updated_at.toISOString(),
            };
          },
        }),
      },
    });

    return {
      agentId,
      success: true,
      text: result.text,
      filesWritten,
      steps: result.steps?.length ?? 1,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      agentId,
      success: false,
      text: "",
      filesWritten,
      steps: 0,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
