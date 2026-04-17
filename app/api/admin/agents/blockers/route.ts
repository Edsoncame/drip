import { NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  listOpenBlockers,
  resolveBlocker,
  ignoreBlocker,
  autoDetectBlockers,
  reportBlocker,
  getBlockerById,
} from "@/lib/agent-blockers";
import { runAgent } from "@/lib/flux-agents";
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
    const blocker = await getBlockerById(body.blocker_id);
    await resolveBlocker(body.blocker_id, session.email);

    // Auto-verificación + reanudación: el agente verifica que el fix
    // funcionó y retoma las tareas pendientes
    if (blocker && AGENTS.some((a) => a.id === blocker.agent_id)) {
      after(async () => {
        try {
          await runAgent({
            agentId: blocker.agent_id as AgentId,
            task: `BLOCKER RESUELTO — Edson acaba de resolver el bloqueo "${blocker.title}".

Tu trabajo ahora:
1. VERIFICÁ que el fix funciona — probá usar la funcionalidad que estaba bloqueada (ej: si faltaba GITHUB_TOKEN, intentá github_list_files; si faltaba META_ADS_ACCESS_TOKEN, intentá una query de prueba; si faltaba GA4, verificá la config)
2. Si funciona → escribí un archivo de confirmación en tu workspace con el resultado del test
3. Si NO funciona → reportá un nuevo blocker con report_blocker explicando qué sigue fallando
4. Después de verificar, llamá a get_strategy_context para ver si hay tareas pendientes tuyas
5. Si hay una tarea con tu owner_agent_id que está pending, EJECUTALA ahora
6. Si no hay tareas pending, hacé lo más valioso según tu CLAUDE.md (modo autopilot)

Contexto del blocker resuelto:
- Título: ${blocker.title}
- Descripción: ${blocker.description}
- Severidad: ${blocker.severity}
- Fuente: ${blocker.source}`,
            actor: `blocker-resolved:${session.email}`,
            maxSteps: 8,
            depth: 0,
          });
        } catch (err) {
          console.error("[blocker-resolve] auto-verify failed", err);
        }
      });
    }

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
