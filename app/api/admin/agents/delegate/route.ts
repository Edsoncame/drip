import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runAgent } from "@/lib/agent-runner";
import type { AgentId } from "@/lib/agents";
import { AGENTS } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ejecuta un subagente con una tarea. El chat del Orquestador dispara esto
 * automáticamente cuando parsea [[delegate:slug]]task[[/delegate]] en el stream.
 */
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    agent?: string;
    task?: string;
  };
  const agentId = body.agent as AgentId | undefined;
  const task = body.task;

  if (!agentId || !task) {
    return NextResponse.json({ error: "missing agent or task" }, { status: 400 });
  }
  if (!AGENTS.some((a) => a.id === agentId)) {
    return NextResponse.json({ error: `unknown agent: ${agentId}` }, { status: 400 });
  }
  if (agentId === "orquestador") {
    return NextResponse.json(
      { error: "no se puede delegar al propio orquestador" },
      { status: 400 },
    );
  }

  const result = await runAgent({
    agentId,
    task,
    actor: session.email,
    maxSteps: 6,
  });

  return NextResponse.json(result);
}
