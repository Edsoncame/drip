import fs from "node:fs/promises";
import path from "node:path";
import { statSync } from "node:fs";

/**
 * FLUX Marketing Agent Suite — filesystem reader.
 *
 * Prioridad para localizar el workspace:
 *   1. env AGENTS_ROOT (override explícito)
 *   2. `<cwd>/data/flux-marketing` — carpeta bundleada para producción Vercel
 *   3. `/Users/securex07/flux-marketing` — ruta absoluta del workspace local de Edson
 *
 * Solo lectura, jamás escribe.
 */

function resolveAgentsRoot(): string {
  if (process.env.AGENTS_ROOT) return process.env.AGENTS_ROOT;
  const bundled = path.join(process.cwd(), "data", "flux-marketing");
  try {
    if (statSync(bundled).isDirectory()) return bundled;
  } catch {}
  return "/Users/securex07/flux-marketing";
}

export const AGENTS_ROOT = resolveAgentsRoot();

export type AgentId =
  | "orquestador"
  | "estratega-oferta"
  | "copy-lanzamiento"
  | "disenador-creativo"
  | "seo-specialist"
  | "content-creator"
  | "sem-manager"
  | "community-manager"
  | "data-analyst"
  | "lead-qualifier"
  | "market-researcher";

export type AgentRole = "orchestrator" | "strategy" | "copy" | "design" | "growth" | "data" | "leads" | "research";

export type AgentAccessory =
  | "crown"
  | "glasses-clipboard"
  | "pen"
  | "beret"
  | "magnifier"
  | "books"
  | "chart"
  | "phone"
  | "laptop"
  | "binoculars"
  | "dashboard";

export interface AgentMeta {
  id: AgentId;
  name: string;
  role: AgentRole;
  title: string;
  tagline: string;
  color: string;
  colorDark: string;
  x: number; // 0-100 grid position
  y: number;
  cluster: "pipeline" | "growth" | "data" | "research";
  accessory: AgentAccessory;
  catchphrases: string[];
}

export const AGENTS: AgentMeta[] = [
  {
    id: "orquestador",
    name: "Orquestador",
    role: "orchestrator",
    title: "Conductor del equipo",
    tagline: "Coordina los 9 agentes en pipelines autónomos",
    color: "#FFB547",
    colorDark: "#D97706",
    x: 50, y: 14, cluster: "pipeline",
    accessory: "crown",
    catchphrases: [
      "¿En qué te ayudo, jefe?",
      "Pongo al equipo a trabajar y te aviso",
      "Dime qué lanzamos hoy",
      "Listo para armar el pipeline",
    ],
  },
  {
    id: "estratega-oferta",
    name: "Estratega",
    role: "strategy",
    title: "Estratega de oferta",
    tagline: "Define posicionamiento, promesa y ángulos",
    color: "#A78BFA",
    colorDark: "#7C3AED",
    x: 22, y: 36, cluster: "pipeline",
    accessory: "glasses-clipboard",
    catchphrases: [
      "Déjame pensar el ángulo",
      "¿Quién es la audiencia real?",
      "Tengo una hipótesis que va a funcionar",
      "Primero el posicionamiento, después el copy",
    ],
  },
  {
    id: "copy-lanzamiento",
    name: "Copywriter",
    role: "copy",
    title: "Copy de lanzamiento",
    tagline: "Redacta emails, ads, hooks, bullets",
    color: "#F472B6",
    colorDark: "#DB2777",
    x: 50, y: 36, cluster: "pipeline",
    accessory: "pen",
    catchphrases: [
      "¿Necesitas un hook?",
      "Tres variaciones saliendo ya",
      "Tranquilo, el jefe está mirando",
      "Esa frase la pulo en 30 segundos",
    ],
  },
  {
    id: "disenador-creativo",
    name: "Diseñador",
    role: "design",
    title: "Diseñador creativo",
    tagline: "Genera visuales vía Pollinations + Apple CDN",
    color: "#60A5FA",
    colorDark: "#1B4FFF",
    x: 78, y: 36, cluster: "pipeline",
    accessory: "beret",
    catchphrases: [
      "Ya vengo, estoy en modo creativo",
      "¿16:9 o 1:1?",
      "Dame 3 minutos y tengo 3 visuales",
      "Apple CDN + ambiente generado, magia",
    ],
  },
  {
    id: "seo-specialist",
    name: "SEO",
    role: "growth",
    title: "SEO specialist",
    tagline: "Keyword research, audits, content briefs",
    color: "#34D399",
    colorDark: "#059669",
    x: 12, y: 60, cluster: "growth",
    accessory: "magnifier",
    catchphrases: [
      "Te encontré keyword con 2.4K volumen",
      "Leasein está vulnerable en long-tail",
      "Necesitamos indexar esto ya",
      "Mirando el SERP ahora mismo",
    ],
  },
  {
    id: "content-creator",
    name: "Editor",
    role: "growth",
    title: "Content creator",
    tagline: "Blogs largos, LinkedIn founder-led, newsletters",
    color: "#FBBF24",
    colorDark: "#B45309",
    x: 31, y: 60, cluster: "growth",
    accessory: "books",
    catchphrases: [
      "¿Blog o LinkedIn founder-led?",
      "1800 palabras calidad editorial",
      "Tengo data peruana, nadie más la tiene",
      "Escribiendo con contexto local",
    ],
  },
  {
    id: "sem-manager",
    name: "SEM",
    role: "growth",
    title: "SEM manager",
    tagline: "Planes Google/Meta/LinkedIn Ads",
    color: "#FB7185",
    colorDark: "#BE123C",
    x: 50, y: 60, cluster: "growth",
    accessory: "chart",
    catchphrases: [
      "CPA objetivo: $15",
      "¿Google o Meta primero?",
      "Plan listo, falta que lo subas",
      "Negative keywords agregadas",
    ],
  },
  {
    id: "community-manager",
    name: "Community",
    role: "growth",
    title: "Community manager",
    tagline: "Calendario orgánico IG/LinkedIn/TikTok/FB",
    color: "#F0ABFC",
    colorDark: "#A21CAF",
    x: 69, y: 60, cluster: "growth",
    accessory: "phone",
    catchphrases: [
      "Viste qué trend está pegando?",
      "Reel listo, 18 segundos",
      "¿IG story o carrusel?",
      "Engagement subió 12% esta semana",
    ],
  },
  {
    id: "data-analyst",
    name: "Analista",
    role: "data",
    title: "Data analyst",
    tagline: "MRR, LTV, CAC, funnel, cohorts",
    color: "#38BDF8",
    colorDark: "#0369A1",
    x: 88, y: 60, cluster: "data",
    accessory: "laptop",
    catchphrases: [
      "MRR +8% vs mes pasado",
      "Tenemos una anomalía en el funnel",
      "LTV/CAC = 3.2, saludable",
      "Query corriendo, 2 segundos",
    ],
  },
  {
    id: "lead-qualifier",
    name: "Scout",
    role: "leads",
    title: "Lead qualifier",
    tagline: "BANT scoring + validación RUC + drafts",
    color: "#FACC15",
    colorDark: "#A16207",
    x: 38, y: 82, cluster: "data",
    accessory: "binoculars",
    catchphrases: [
      "Lead Hot detectado 🔥",
      "RUC validado, empresa activa",
      "Este score da 82, vale la pena",
      "Te dejé el draft listo para enviar",
    ],
  },
  {
    id: "market-researcher",
    name: "Research",
    role: "research",
    title: "Market researcher",
    tagline: "Competencia, audiencia, tendencias, market sizing",
    color: "#06B6D4",
    colorDark: "#0E7490",
    x: 62, y: 82, cluster: "research",
    accessory: "dashboard",
    catchphrases: [
      "Leasein bajó precio ayer",
      "El segmento agencias pesa $2.4M/año",
      "Encontré un insight que cambia todo",
      "Tengo data, no corazonadas",
      "TAM peruano: 14K PyMEs con fit",
    ],
  },
];

export function getAgent(id: AgentId): AgentMeta | undefined {
  return AGENTS.find((a) => a.id === id);
}

export interface FileEntry {
  path: string;
  name: string;
  size: number;
  mtime: number;
  kind: "file" | "dir";
}

export interface AgentState {
  id: AgentId;
  exists: boolean;
  filesCount: number;
  latestFiles: FileEntry[];
  memory: string | null;
  lastActivity: number | null;
  outputFolders: string[];
}

const IGNORED = new Set([".DS_Store", ".git", "node_modules", ".claude", ".mcp.json"]);

async function safeStat(p: string) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

async function walkLimited(dir: string, max: number): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  async function rec(current: string, depth: number) {
    if (out.length >= max || depth > 4) return;
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (IGNORED.has(e.name)) continue;
      if (e.name.startsWith(".")) continue;
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        await rec(full, depth + 1);
      } else {
        const st = await safeStat(full);
        if (!st) continue;
        out.push({
          path: full,
          name: e.name,
          size: st.size,
          mtime: st.mtimeMs,
          kind: "file",
        });
      }
      if (out.length >= max) return;
    }
  }
  await rec(dir, 0);
  return out;
}

export async function readAgentState(id: AgentId): Promise<AgentState> {
  const dir = path.join(AGENTS_ROOT, id);
  const st = await safeStat(dir);

  // Archivos estáticos del bundle (CLAUDE.md, README.md, memory.md, etc)
  const staticFiles: FileEntry[] = st && st.isDirectory() ? await walkLimited(dir, 200) : [];

  // Archivos dinámicos escritos por el agente desde la DB
  const { listAgentFiles } = await import("./agents-db").catch(() => ({ listAgentFiles: null }));
  let dbFiles: FileEntry[] = [];
  if (listAgentFiles) {
    try {
      const rows = await listAgentFiles(id);
      dbFiles = rows.map((r) => ({
        path: `db://${id}/${r.rel_path}`,
        name: r.rel_path.split("/").pop() || r.rel_path,
        size: r.size,
        mtime: r.updated_at.getTime(),
        kind: "file" as const,
      }));
    } catch {
      // DB puede no estar disponible (tabla recién creada, etc)
    }
  }

  const allFiles = [...staticFiles, ...dbFiles];
  allFiles.sort((a, b) => b.mtime - a.mtime);

  let memory: string | null = null;
  try {
    memory = await fs.readFile(path.join(dir, "memory.md"), "utf8");
    if (memory.length > 4000) memory = memory.slice(0, 4000) + "\n\n…";
  } catch {}

  const subdirs: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !IGNORED.has(e.name) && !e.name.startsWith(".")) {
        subdirs.push(e.name);
      }
    }
  } catch {}

  const exists = !!(st && st.isDirectory()) || dbFiles.length > 0;
  const lastActivity = allFiles[0]?.mtime ?? (st ? st.mtimeMs : null);

  return {
    id,
    exists,
    filesCount: allFiles.length,
    latestFiles: allFiles.slice(0, 12),
    memory,
    lastActivity,
    outputFolders: subdirs,
  };
}

export async function readAllAgentStates(): Promise<AgentState[]> {
  return Promise.all(AGENTS.map((a) => readAgentState(a.id)));
}

export async function agentsRootExists(): Promise<boolean> {
  const st = await safeStat(AGENTS_ROOT);
  return !!(st && st.isDirectory());
}

export async function readFileSafe(absPath: string): Promise<{ content: string; size: number } | null> {
  // Archivos dinámicos desde la DB → formato "db://agentId/rel/path.md"
  if (absPath.startsWith("db://")) {
    const rest = absPath.slice(5);
    const slash = rest.indexOf("/");
    if (slash < 0) return null;
    const agentId = rest.slice(0, slash) as AgentId;
    const relPath = rest.slice(slash + 1);
    if (!AGENTS.some((a) => a.id === agentId)) return null;
    try {
      const { readAgentFile } = await import("./agents-db");
      const file = await readAgentFile(agentId, relPath);
      if (!file) return null;
      return { content: file.content, size: file.size };
    } catch {
      return null;
    }
  }

  // Archivos estáticos del FS bundleado
  if (!absPath.startsWith(AGENTS_ROOT + path.sep) && absPath !== AGENTS_ROOT) return null;
  const st = await safeStat(absPath);
  if (!st || !st.isFile()) return null;
  if (st.size > 512 * 1024) {
    const buf = await fs.readFile(absPath);
    return { content: buf.slice(0, 512 * 1024).toString("utf8") + "\n\n… (truncado)", size: st.size };
  }
  const content = await fs.readFile(absPath, "utf8");
  return { content, size: st.size };
}

export interface ActivityEvent {
  id: string;
  ts: number;
  agent: AgentId;
  kind: "file-created" | "file-modified";
  file: string;
  relPath: string;
}

/**
 * Deriva eventos recientes mirando mtime de todos los archivos
 * de todos los agentes en los últimos N días. No hay DB, es feed
 * derivado puramente del filesystem.
 */
export async function recentActivity(limit = 40): Promise<ActivityEvent[]> {
  const all: ActivityEvent[] = [];

  // Estáticos del bundle
  for (const agent of AGENTS) {
    const files = await walkLimited(path.join(AGENTS_ROOT, agent.id), 150);
    for (const f of files) {
      all.push({
        id: `${agent.id}:${f.path}:${f.mtime}`,
        ts: f.mtime,
        agent: agent.id,
        kind: "file-modified",
        file: f.name,
        relPath: `${agent.id}/${path.relative(path.join(AGENTS_ROOT, agent.id), f.path)}`,
      });
    }
  }

  // Dinámicos de la DB
  try {
    const { listAllRecent } = await import("./agents-db");
    const rows = await listAllRecent(limit * 2);
    for (const r of rows) {
      all.push({
        id: `db:${r.agent_id}:${r.rel_path}:${r.updated_at.getTime()}`,
        ts: r.updated_at.getTime(),
        agent: r.agent_id,
        kind: r.created_at.getTime() === r.updated_at.getTime() ? "file-created" : "file-modified",
        file: r.rel_path.split("/").pop() || r.rel_path,
        relPath: `${r.agent_id}/${r.rel_path}`,
      });
    }
  } catch {}

  all.sort((a, b) => b.ts - a.ts);
  return all.slice(0, limit);
}

/**
 * Lee el CLAUDE.md del orquestador para usar como system prompt
 * en la API de chat con el orquestador.
 */
export async function readOrchestratorSystemPrompt(): Promise<string> {
  try {
    const claudeMd = await fs.readFile(path.join(AGENTS_ROOT, "orquestador", "CLAUDE.md"), "utf8");
    return claudeMd;
  } catch {
    return "Eres el Orquestador del equipo de marketing de FLUX.";
  }
}
