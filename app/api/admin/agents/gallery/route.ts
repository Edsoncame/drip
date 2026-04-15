import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAllRecent, ensureSchema } from "@/lib/agents-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve TODO lo que los agentes produjeron (archivos en DB) con el
 * contenido completo para renderizar en el feed de galería.
 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureSchema();
  const files = await listAllRecent(100);

  return NextResponse.json({
    files: files.map((f) => ({
      id: f.id,
      agentId: f.agent_id,
      relPath: f.rel_path,
      content: f.content,
      size: f.size,
      createdAt: f.created_at.getTime(),
      updatedAt: f.updated_at.getTime(),
      createdBy: f.created_by,
    })),
    count: files.length,
  });
}
