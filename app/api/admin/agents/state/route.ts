import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { AGENTS, agentsRootExists, readAllAgentStates, recentActivity } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rootExists = await agentsRootExists();
  if (!rootExists) {
    return NextResponse.json({
      agents: AGENTS,
      states: AGENTS.map((a) => ({
        id: a.id,
        exists: false,
        filesCount: 0,
        latestFiles: [],
        memory: null,
        lastActivity: null,
        outputFolders: [],
      })),
      activity: [],
      now: Date.now(),
      rootExists: false,
    });
  }

  const [states, activity] = await Promise.all([readAllAgentStates(), recentActivity(50)]);

  return NextResponse.json({
    agents: AGENTS,
    states,
    activity,
    now: Date.now(),
    rootExists: true,
  });
}
