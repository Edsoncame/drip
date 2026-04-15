import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  listOpenBlockers,
  resolveBlocker,
  ignoreBlocker,
  autoDetectBlockers,
  reportBlocker,
} from "@/lib/agent-blockers";
import type { AgentId } from "@/lib/agents";
import { AGENTS } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — lista todos los blockers abiertos (opcional ?agent=slug). */
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent") as AgentId | null;
  const autodetect = searchParams.get("autodetect") === "1";

  if (autodetect) {
    await autoDetectBlockers();
  }

  const blockers = await listOpenBlockers(agent ?? undefined);
  return NextResponse.json({
    blockers: blockers.map((b) => ({
      id: b.id,
      agent_id: b.agent_id,
      title: b.title,
      description: b.description,
      steps_to_fix: b.steps_to_fix,
      severity: b.severity,
      source: b.source,
      created_at: b.created_at.getTime(),
    })),
  });
}

/** POST — resolver / ignorar / crear manualmente. */
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: "resolve" | "ignore" | "create";
    blocker_id?: number;
    agent_id?: AgentId;
    title?: string;
    description?: string;
    steps_to_fix?: string;
    severity?: "info" | "warning" | "critical";
  };

  if (body.action === "resolve" && body.blocker_id) {
    await resolveBlocker(body.blocker_id, session.email);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "ignore" && body.blocker_id) {
    await ignoreBlocker(body.blocker_id, session.email);
    return NextResponse.json({ ok: true });
  }
  if (
    body.action === "create" &&
    body.agent_id &&
    body.title &&
    body.description &&
    body.steps_to_fix
  ) {
    if (!AGENTS.some((a) => a.id === body.agent_id)) {
      return NextResponse.json({ error: "unknown agent" }, { status: 400 });
    }
    const b = await reportBlocker({
      agentId: body.agent_id,
      title: body.title,
      description: body.description,
      stepsToFix: body.steps_to_fix,
      severity: body.severity ?? "warning",
      source: `user:${session.email}`,
    });
    return NextResponse.json({ ok: true, blocker_id: b.id });
  }

  return NextResponse.json({ error: "invalid action or missing fields" }, { status: 400 });
}
