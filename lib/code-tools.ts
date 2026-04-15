/**
 * Code Tools — herramientas que el Programador Full Stack usa para
 * editar el repo de FLUX desde el server-side (Vercel).
 *
 * Como Vercel serverless tiene filesystem read-only, NO podemos:
 * - Escribir en el repo local
 * - Ejecutar git commit / git push
 * - Correr npm / npx
 *
 * PERO sí podemos usar la GitHub API para:
 * - Leer archivos (GET /repos/{owner}/{repo}/contents/{path})
 * - Escribir archivos con commit atómico (PUT /contents/{path})
 * - Listar directorios (GET /git/trees/{ref}?recursive=1)
 * - Buscar código (GET /search/code)
 * - Ver commits recientes (GET /commits)
 * - Verificar status de deploys (GET /commits/{sha}/status)
 *
 * Cuando el Programador hace write_file, commitea directo a main con
 * un mensaje convencional. Vercel detecta el push y auto-deploya. El
 * Programador después llama a check_deploy_status para verificar que
 * el build pasó (Vercel reporta status al commit vía GitHub checks).
 */

import { tool } from "ai";
import { z } from "zod";

const GITHUB_API = "https://api.github.com";

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN env var no configurada. Necesitás un Personal Access Token con scope 'repo' en Vercel env vars.",
    );
  }
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "flux-programador-agent",
  };
}

function repoConfig() {
  return {
    owner: process.env.GITHUB_OWNER || "Edsoncame",
    repo: process.env.GITHUB_REPO || "drip",
    branch: process.env.GITHUB_DEFAULT_BRANCH || "main",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// github_read_file
// ═══════════════════════════════════════════════════════════════════════════

export function githubReadFileTool() {
  return tool({
    description:
      "Lee el contenido actual de un archivo del repo de FLUX desde GitHub. Devuelve el contenido, SHA, y tamaño. Usá esto antes de write_file para obtener el SHA necesario para updates.",
    inputSchema: z.object({
      path: z.string().describe("Ruta relativa al root del repo. Ej: 'app/page.tsx', 'lib/auth.ts'"),
      ref: z
        .string()
        .optional()
        .describe("Branch o commit SHA. Default: main"),
    }),
    execute: async ({ path, ref }) => {
      try {
        const { owner, repo, branch } = repoConfig();
        const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref || branch}`;
        const res = await fetch(url, { headers: githubHeaders() });
        if (res.status === 404) {
          return { error: "not_found", path };
        }
        if (!res.ok) {
          return { error: `HTTP ${res.status}`, detail: await res.text() };
        }
        const data = (await res.json()) as {
          content: string;
          encoding: string;
          sha: string;
          size: number;
          path: string;
        };
        const content = Buffer.from(data.content, "base64").toString("utf8");
        return {
          path: data.path,
          sha: data.sha,
          size: data.size,
          content,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "unknown" };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// github_write_file — commit directo a main
// ═══════════════════════════════════════════════════════════════════════════

export function githubWriteFileTool(actor: string) {
  return tool({
    description:
      "Crea o actualiza un archivo en el repo de FLUX y commitea directamente a main. Vercel va a detectar el push y auto-deployar en 60-90s. Si estás ACTUALIZANDO un archivo existente, PASÁ el sha que obtuviste con github_read_file — si no, el PUT falla. Si estás CREANDO uno nuevo, NO pases sha. El commit message debe ser convencional: 'feat:', 'fix:', 'refactor:', 'docs:', 'chore:'. Siempre incluye Co-Authored-By al final.",
    inputSchema: z.object({
      path: z.string().describe("Ruta relativa al root del repo"),
      content: z.string().describe("Contenido COMPLETO del archivo (no delta)"),
      commit_message: z
        .string()
        .describe("Mensaje convencional: 'feat: descripcion', 'fix: ...', etc. Multilínea OK."),
      sha: z
        .string()
        .optional()
        .describe(
          "SHA del archivo existente (requerido para update). Obtenelo de github_read_file. Omitir si es archivo nuevo.",
        ),
    }),
    execute: async ({ path, content, commit_message, sha }) => {
      try {
        const { owner, repo, branch } = repoConfig();
        const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
        const body: Record<string, unknown> = {
          message: commit_message.includes("Co-Authored-By")
            ? commit_message
            : `${commit_message}\n\nCo-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>\nCo-Authored-By: ${actor}`,
          content: Buffer.from(content, "utf8").toString("base64"),
          branch,
        };
        if (sha) body.sha = sha;
        const res = await fetch(url, {
          method: "PUT",
          headers: { ...githubHeaders(), "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const detail = await res.text();
          return { error: `HTTP ${res.status}`, detail };
        }
        const data = (await res.json()) as {
          content: { sha: string; path: string; size: number };
          commit: { sha: string; html_url: string; message: string };
        };
        return {
          ok: true,
          file_sha: data.content.sha,
          commit_sha: data.commit.sha,
          commit_url: data.commit.html_url,
          path: data.content.path,
          size: data.content.size,
          message:
            "Archivo commiteado a main. Vercel va a auto-deployar en 60-90s. Llamá a check_deploy_status con el commit_sha para verificar.",
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "unknown" };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// github_list_files — tree recursivo
// ═══════════════════════════════════════════════════════════════════════════

export function githubListFilesTool() {
  return tool({
    description:
      "Lista archivos del repo (recursivo) filtrando por path prefix. Usá esto para explorar la estructura antes de tocar código. Ej: path_prefix='app/admin' lista todo bajo esa carpeta.",
    inputSchema: z.object({
      path_prefix: z
        .string()
        .optional()
        .describe("Filtro por prefix de path. Ej: 'app/', 'lib/'. Vacío = raíz."),
      max: z.number().optional().describe("Máximo de archivos, default 200"),
    }),
    execute: async ({ path_prefix, max }) => {
      try {
        const { owner, repo, branch } = repoConfig();
        const limit = max ?? 200;
        const url = `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
        const res = await fetch(url, { headers: githubHeaders() });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const data = (await res.json()) as {
          tree: { path: string; type: string; size?: number; sha: string }[];
          truncated: boolean;
        };
        const filtered = data.tree
          .filter((t) => t.type === "blob")
          .filter((t) => !path_prefix || t.path.startsWith(path_prefix))
          .slice(0, limit)
          .map((t) => ({ path: t.path, size: t.size, sha: t.sha }));
        return {
          count: filtered.length,
          truncated: data.truncated,
          files: filtered,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "unknown" };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// github_search_code
// ═══════════════════════════════════════════════════════════════════════════

export function githubSearchCodeTool() {
  return tool({
    description:
      "Busca patrón/keyword en el código del repo usando GitHub Code Search API. Útil para encontrar dónde se usa una función, variable, o importa. Devuelve los top 10 resultados con path y fragmento del match.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Query de búsqueda. Podés usar qualifiers: 'useAdmin language:ts', 'streamText path:app/api'",
        ),
    }),
    execute: async ({ query }) => {
      try {
        const { owner, repo } = repoConfig();
        const url = `${GITHUB_API}/search/code?q=${encodeURIComponent(
          query + ` repo:${owner}/${repo}`,
        )}&per_page=10`;
        const res = await fetch(url, { headers: githubHeaders() });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const data = (await res.json()) as {
          total_count: number;
          items: {
            path: string;
            name: string;
            sha: string;
            html_url: string;
            repository: { name: string };
          }[];
        };
        return {
          total: data.total_count,
          results: data.items.map((i) => ({
            path: i.path,
            name: i.name,
            url: i.html_url,
          })),
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "unknown" };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// github_get_recent_commits
// ═══════════════════════════════════════════════════════════════════════════

export function githubRecentCommitsTool() {
  return tool({
    description:
      "Lista los últimos N commits del repo para saber qué cambió recientemente y no pisar trabajo de otro agente.",
    inputSchema: z.object({
      limit: z.number().optional().describe("Cuántos commits, default 10"),
    }),
    execute: async ({ limit }) => {
      try {
        const { owner, repo, branch } = repoConfig();
        const n = limit ?? 10;
        const url = `${GITHUB_API}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${n}`;
        const res = await fetch(url, { headers: githubHeaders() });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const data = (await res.json()) as {
          sha: string;
          commit: { message: string; author: { name: string; date: string } };
          html_url: string;
        }[];
        return {
          commits: data.map((c) => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split("\n")[0],
            author: c.commit.author.name,
            date: c.commit.author.date,
            url: c.html_url,
          })),
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "unknown" };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// check_deploy_status — vía GitHub combined status
// ═══════════════════════════════════════════════════════════════════════════

export function checkDeployStatusTool() {
  return tool({
    description:
      "Verifica el status del deploy de Vercel para un commit específico. Vercel reporta el status vía GitHub combined statuses. Devuelve: pending/success/failure + contexts (Vercel preview, Vercel production, TypeScript check si hay). Esperá al menos 60s después de commitear antes de llamar esto.",
    inputSchema: z.object({
      commit_sha: z
        .string()
        .describe("SHA del commit a chequear (largo, ej: 'abc123de...' full 40 chars)"),
    }),
    execute: async ({ commit_sha }) => {
      try {
        const { owner, repo } = repoConfig();
        const url = `${GITHUB_API}/repos/${owner}/${repo}/commits/${commit_sha}/status`;
        const res = await fetch(url, { headers: githubHeaders() });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        const data = (await res.json()) as {
          state: "pending" | "success" | "failure" | "error";
          total_count: number;
          statuses: {
            context: string;
            state: string;
            description: string;
            target_url: string;
            updated_at: string;
          }[];
          sha: string;
        };

        // También buscar check runs (nuevo formato)
        const checksUrl = `${GITHUB_API}/repos/${owner}/${repo}/commits/${commit_sha}/check-runs`;
        const checksRes = await fetch(checksUrl, { headers: githubHeaders() });
        const checks = checksRes.ok
          ? ((await checksRes.json()) as {
              check_runs: {
                name: string;
                status: string;
                conclusion: string | null;
                details_url: string;
              }[];
            })
          : { check_runs: [] };

        return {
          overall_state: data.state,
          total_contexts: data.total_count,
          statuses: data.statuses.map((s) => ({
            context: s.context,
            state: s.state,
            description: s.description,
            url: s.target_url,
          })),
          check_runs: checks.check_runs.map((c) => ({
            name: c.name,
            status: c.status,
            conclusion: c.conclusion,
            url: c.details_url,
          })),
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "unknown" };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// github_delete_file
// ═══════════════════════════════════════════════════════════════════════════

export function githubDeleteFileTool(actor: string) {
  return tool({
    description:
      "Borra un archivo del repo con un commit directo a main. Requiere el sha del archivo (obtenelo con github_read_file). Vercel va a re-deployar automáticamente.",
    inputSchema: z.object({
      path: z.string(),
      sha: z.string().describe("SHA del archivo obtenido con github_read_file"),
      commit_message: z.string(),
    }),
    execute: async ({ path, sha, commit_message }) => {
      try {
        const { owner, repo, branch } = repoConfig();
        const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
        const body = {
          message: `${commit_message}\n\nCo-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>\nCo-Authored-By: ${actor}`,
          sha,
          branch,
        };
        const res = await fetch(url, {
          method: "DELETE",
          headers: { ...githubHeaders(), "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          return { error: `HTTP ${res.status}`, detail: await res.text() };
        }
        const data = (await res.json()) as { commit: { sha: string; html_url: string } };
        return {
          ok: true,
          commit_sha: data.commit.sha,
          commit_url: data.commit.html_url,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "unknown" };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Toolset del Programador Full Stack
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function codeToolsForProgrammer(actor: string): Record<string, any> {
  return {
    github_read_file: githubReadFileTool(),
    github_write_file: githubWriteFileTool(actor),
    github_list_files: githubListFilesTool(),
    github_search_code: githubSearchCodeTool(),
    github_recent_commits: githubRecentCommitsTool(),
    github_delete_file: githubDeleteFileTool(actor),
    check_deploy_status: checkDeployStatusTool(),
  };
}
