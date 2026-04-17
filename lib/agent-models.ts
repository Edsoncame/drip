/**
 * Asignación de modelos Claude por agente.
 *
 * Los agentes de razonamiento pesado (orquestación, estrategia, análisis,
 * research, código) corren en Opus 4.7 para ir más rápido y con mejor criterio.
 * Los de ejecución repetitiva (copy, diseño, SEO, content, SEM, community,
 * leads) se quedan en Sonnet 4.6 — 5x más barato y suficiente para la tarea.
 *
 * Precios:
 *   Sonnet 4.6: $3 / $15 por M tokens (input / output)
 *   Opus 4.7:   $15 / $75 por M tokens
 */

import { anthropic } from "@ai-sdk/anthropic";
import type { AgentId } from "./agents";

export const OPUS_AGENTS: readonly AgentId[] = [
  "orquestador",
  "estratega-oferta",
  "data-analyst",
  "market-researcher",
  "programador-fullstack",
] as const;

export type ModelSlug = "claude-opus-4-7" | "claude-sonnet-4-6";

export function modelSlugForAgent(agentId: AgentId | string): ModelSlug {
  return (OPUS_AGENTS as readonly string[]).includes(agentId)
    ? "claude-opus-4-7"
    : "claude-sonnet-4-6";
}

export function modelForAgent(agentId: AgentId) {
  return anthropic(modelSlugForAgent(agentId));
}

export const MODEL_PRICING: Record<
  ModelSlug,
  { inputPerToken: number; outputPerToken: number }
> = {
  "claude-sonnet-4-6": {
    inputPerToken: 3.0 / 1_000_000,
    outputPerToken: 15.0 / 1_000_000,
  },
  "claude-opus-4-7": {
    inputPerToken: 15.0 / 1_000_000,
    outputPerToken: 75.0 / 1_000_000,
  },
};
