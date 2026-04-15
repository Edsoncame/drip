import { NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runAutopilotTick } from "@/lib/agent-autopilot";
import type { AgentId } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Dispara un tick de autopilot manual desde el admin.
 * El cron usa /api/cron/agents con un job especial.
 */
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    max?: number;
    ignoreCooldown?: boolean;
    onlyAgents?: AgentId[];
  };

  // Ejecutamos el primer agente sincrónico para feedback inmediato,
  // y dejamos el resto para after() si hay más de 1.
  // Opción simple: todo sincrónico con max limitado.
  const result = await runAutopilotTick({
    max: body.max ?? 3,
    ignoreCooldown: body.ignoreCooldown ?? false,
    onlyAgents: body.onlyAgents,
  });

  return NextResponse.json(result);
}
