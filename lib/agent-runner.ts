/**
 * Agent Runner — re-export desde flux-agents.ts (migrado a ToolLoopAgent).
 *
 * Este archivo mantiene backward compatibility para todos los importadores
 * existentes (autopilot, delegate, scheduler, etc.) que hacen:
 *   import { runAgent } from "@/lib/agent-runner"
 *
 * La implementación real ahora vive en flux-agents.ts usando ToolLoopAgent
 * del AI SDK v6 en vez del generateText manual.
 */

export { runAgent, buildAgent, buildGrowthAgent } from "./flux-agents";
export type { AgentRunResult } from "./flux-agents";
