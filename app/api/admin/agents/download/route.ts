import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { AGENTS, type AgentId, AGENTS_ROOT } from "@/lib/agents";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IGNORED = new Set([".DS_Store", ".git", "node_modules", ".claude", ".mcp.json"]);

async function collectFiles(dir: string, base: string, out: { rel: string; abs: string }[], depth = 0) {
  if (depth > 5) return;
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (IGNORED.has(e.name) || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await collectFiles(full, base, out, depth + 1);
    } else if (/\.(md|txt|json|ts|tsx|sql|csv)$/i.test(e.name)) {
      out.push({ rel: path.relative(base, full), abs: full });
    }
  }
}

/**
 * Genera un "bundle markdown" con TODO el workspace de un agente
 * concatenado. No zip — un solo .md legible con fences por archivo.
 * Más útil que un zip para revisar todo de golpe.
 */
export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent") as AgentId | null;
  const all = searchParams.get("all") === "1";

  const targets: AgentId[] = all
    ? AGENTS.map((a) => a.id)
    : agent && AGENTS.some((a) => a.id === agent)
      ? [agent]
      : [];

  if (targets.length === 0) {
    return NextResponse.json({ error: "missing agent" }, { status: 400 });
  }

  let bundle = `# FLUX Marketing Agents — Bundle\n\nGenerado: ${new Date().toISOString()}\n\n`;

  for (const id of targets) {
    const dir = path.join(AGENTS_ROOT, id);
    const files: { rel: string; abs: string }[] = [];
    await collectFiles(dir, dir, files);
    files.sort((a, b) => a.rel.localeCompare(b.rel));

    bundle += `\n\n---\n\n# Agente: \`${id}\`\n\n`;
    for (const f of files) {
      try {
        const content = await fs.readFile(f.abs, "utf8");
        const ext = path.extname(f.rel).slice(1) || "text";
        bundle += `\n## \`${f.rel}\`\n\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
      } catch {}
    }
  }

  const filename = all
    ? `flux-agents-bundle-${new Date().toISOString().slice(0, 10)}.md`
    : `${agent}-bundle-${new Date().toISOString().slice(0, 10)}.md`;

  return new NextResponse(bundle, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
