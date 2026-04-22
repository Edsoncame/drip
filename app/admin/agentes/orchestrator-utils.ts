import type { AgentId, AgentMeta, AgentState } from "@/lib/agents";
import type { AgentMood } from "./PixelAvatar";

/**
 * Parses orchestrator stream for [[agente:slug]], [[plan]]…[[/plan]],
 * and [[delegate:slug]]…[[/delegate]] tokens. Returns the plain-text
 * response for rendering + an event list to drive scene animations.
 */
export function parseOrchestratorText(text: string) {
  const events: { agent: AgentId; kind: "mention" | "delegate"; message?: string }[] = [];
  let plan: string | null = null;

  const planMatch = text.match(/\[\[plan\]\]([\s\S]*?)\[\[\/plan\]\]/);
  if (planMatch) plan = planMatch[1].trim();

  const delegateRe = /\[\[delegate:([a-z-]+)\]\]([\s\S]*?)\[\[\/delegate\]\]/g;
  let dm: RegExpExecArray | null;
  while ((dm = delegateRe.exec(text)) !== null) {
    events.push({ agent: dm[1] as AgentId, kind: "delegate", message: dm[2].trim() });
  }

  const mentionRe = /\[\[agente:([a-z-]+)\]\]/g;
  let mm: RegExpExecArray | null;
  while ((mm = mentionRe.exec(text)) !== null) {
    events.push({ agent: mm[1] as AgentId, kind: "mention" });
  }

  const clean = text
    .replace(/\[\[plan\]\]([\s\S]*?)\[\[\/plan\]\]/g, "")
    .replace(/\[\[delegate:[a-z-]+\]\]([\s\S]*?)\[\[\/delegate\]\]/g, "$1")
    .replace(/\[\[agente:([a-z-]+)\]\]/g, "@$1")
    .trim();

  return { clean, events, plan };
}

/**
 * Deriva un mood desde el estado real del agente + un toque de aleatoriedad
 * que rota cada N minutos para que el equipo se sienta vivo.
 *
 * Heurísticas:
 *   - isRunning = motivated
 *   - awakeUntil futuro = motivated (recién despertado)
 *   - sin lastActivity = sleepy
 *   - < 5 min = motivated
 *   - < 10 min = normal
 *   - > 10 min con muchos archivos = stressed
 *   - fallback = sleepy
 */
export function computeMood(
  agent: AgentMeta,
  state: AgentState | undefined,
  seed: number,
  awakeUntil = 0,
): AgentMood {
  if (state?.isRunning) return "motivated";
  if (Date.now() < awakeUntil) return "motivated";
  if (!state || state.lastActivity === null) return "sleepy";

  const age = Date.now() - state.lastActivity;
  const MIN = 60 * 1000;

  if (age < 5 * MIN) return "motivated";
  if (age < 10 * MIN) return "normal";

  if (state.filesCount > 20) return "stressed";
  return "sleepy";
}

export function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}
