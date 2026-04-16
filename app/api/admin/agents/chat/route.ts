import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildGrowthAgent } from "@/lib/flux-agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Chat con el Head of Growth.
 *
 * Usa ToolLoopAgent del AI SDK v6. El agent tiene:
 * - instructions desde CLAUDE.md + strategy context + attachments + outputs recientes
 * - 20+ tools: strategy engine + delegate_to_agent + blockers
 * - stopWhen: stepCountIs(12)
 * - Streaming con agent.stream().toTextStreamResponse()
 */
export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const messages = body.messages as { role: "user" | "assistant"; content: string }[] | undefined;
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "missing messages" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        "⚠️ Falta ANTHROPIC_API_KEY en Vercel env vars.",
        { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    console.log("[chat] building Growth agent...");
    const agent = await buildGrowthAgent(session.email);
    console.log("[chat] streaming response...");

    const result = await agent.stream({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    return result.toTextStreamResponse();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error("[chat] FATAL", errorMessage, stack);
    return new Response(
      `⚠️ Error: ${errorMessage}\n\n${stack?.slice(0, 500) ?? ""}`,
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
}
