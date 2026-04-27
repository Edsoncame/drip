/**
 * Blog Tools — herramientas constrained para que content-creator publique
 * artículos en /blog sin acceso completo al repo.
 *
 * Pattern:
 *  - El agente entrega title + description + category + content_html
 *  - El tool genera el slug, calcula reading time, crea el page.tsx con
 *    BlogArticleLayout, y actualiza lib/blog.ts agregando la entrada nueva.
 *  - Todo se commitea atómico vía GitHub API (igual que code-tools).
 *
 * Restricciones de seguridad:
 *  - Solo escribe a app/(main)/blog/<slug>/page.tsx y lib/blog.ts
 *  - Validamos slug (lowercase + hyphens) — bloquea path traversal
 *  - content_html es trusted (agente interno) y va vía dangerouslySetInnerHTML
 */

import { tool } from "ai";
import { z } from "zod";

const GITHUB_API = "https://api.github.com";

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN env var no configurada.");
  }
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "flux-content-creator-agent",
  };
}

function repoConfig() {
  return {
    owner: process.env.GITHUB_OWNER || "Edsoncame",
    repo: process.env.GITHUB_REPO || "drip",
    branch: process.env.GITHUB_DEFAULT_BRANCH || "main",
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function estimateReadingTime(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").length;
  const minutes = Math.max(1, Math.round(words / 250));
  return `${minutes} min`;
}

async function githubGetFile(
  path: string,
): Promise<{ content: string; sha: string } | null> {
  const { owner, repo, branch } = repoConfig();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path}: HTTP ${res.status}`);
  const data = (await res.json()) as { content: string; encoding: string; sha: string };
  return {
    content: Buffer.from(data.content, data.encoding as BufferEncoding).toString("utf8"),
    sha: data.sha,
  };
}

async function githubPutFile(
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ commit_sha: string; commit_url: string }> {
  const { owner, repo, branch } = repoConfig();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body: Record<string, unknown> = {
    message,
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
    throw new Error(`GitHub PUT ${path}: HTTP ${res.status} ${detail}`);
  }
  const data = (await res.json()) as { commit: { sha: string; html_url: string } };
  return { commit_sha: data.commit.sha, commit_url: data.commit.html_url };
}

function renderPostFile(slug: string, contentHtml: string): string {
  // Escape backticks/${ in content to prevent template literal injection
  const safe = contentHtml.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return `import type { Metadata } from "next";
import BlogArticleLayout from "@/components/BlogArticleLayout";
import { getBlogPost } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fluxperu.com";
const SLUG = "${slug}";

export async function generateMetadata(): Promise<Metadata> {
  const post = getBlogPost(SLUG);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: \`\${BASE}/blog/\${SLUG}\` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
  };
}

const CONTENT = \`${safe}\`;

export default function Post() {
  return (
    <BlogArticleLayout slug={SLUG}>
      <div dangerouslySetInnerHTML={{ __html: CONTENT }} />
    </BlogArticleLayout>
  );
}
`;
}

function insertEntryInBlogIndex(
  currentBlogTs: string,
  entry: {
    slug: string;
    title: string;
    description: string;
    date: string;
    readingTime: string;
    category: string;
  },
): string {
  // Insertamos antes del primer `{` después de `blogPosts: BlogPost[] = [`
  const marker = "export const blogPosts: BlogPost[] = [";
  const idx = currentBlogTs.indexOf(marker);
  if (idx === -1) throw new Error("No encontré el array blogPosts en lib/blog.ts");
  const insertAt = idx + marker.length;
  const newEntry = `
  {
    slug: "${entry.slug}",
    title: ${JSON.stringify(entry.title)},
    description: ${JSON.stringify(entry.description)},
    date: "${entry.date}",
    readingTime: "${entry.readingTime}",
    category: "${entry.category}",
  },`;
  return currentBlogTs.slice(0, insertAt) + newEntry + currentBlogTs.slice(insertAt);
}

export function blogTools(actor: string) {
  return {
    publish_blog_post: tool({
      description:
        "Publica un artículo nuevo en el blog de FLUX (/blog/<slug>). Crea el page.tsx + actualiza lib/blog.ts con la entrada del índice. Vercel auto-deploya en ~90s. content_html debe ser HTML válido (h2/h3/p/ul/li/strong/em/a). NO incluyas <html>/<body>, ni <h1> (eso lo pone BlogArticleLayout). Slug se autogenera del title si no lo pasás.",
      inputSchema: z.object({
        title: z.string().min(10).max(120),
        description: z.string().min(40).max(200).describe("SEO description (40-200 chars)"),
        category: z
          .enum(["Finanzas", "Guías", "Comparativas", "Tributario", "Contabilidad"])
          .describe("Categoría visible en el listado"),
        content_html: z
          .string()
          .min(500)
          .describe("HTML del cuerpo del artículo (sin h1). Usá h2/h3/p/ul/li/strong/em/a."),
        slug: z.string().optional().describe("Override del slug. Default: derivado del title."),
      }),
      execute: async ({ title, description, category, content_html, slug }) => {
        const finalSlug = slug ? slugify(slug) : slugify(title);
        if (!/^[a-z0-9-]+$/.test(finalSlug)) {
          return { error: `slug inválido: ${finalSlug}` };
        }
        const today = new Date().toISOString().slice(0, 10);
        const readingTime = estimateReadingTime(content_html);

        const postPath = `app/(main)/blog/${finalSlug}/page.tsx`;
        const indexPath = "lib/blog.ts";

        // Verificar que el slug no exista
        const existing = await githubGetFile(postPath);
        if (existing) {
          return { error: `El slug "${finalSlug}" ya existe. Usá uno distinto.` };
        }

        // 1) Update lib/blog.ts (insertar entry al inicio del array)
        const blogTs = await githubGetFile(indexPath);
        if (!blogTs) return { error: "lib/blog.ts no existe" };
        const updated = insertEntryInBlogIndex(blogTs.content, {
          slug: finalSlug,
          title,
          description,
          date: today,
          readingTime,
          category,
        });
        const indexCommitMsg = `feat(blog): nuevo post "${title.slice(0, 50)}"\n\nCo-Authored-By: ${actor}`;
        const indexResult = await githubPutFile(indexPath, updated, indexCommitMsg, blogTs.sha);

        // 2) Crear page.tsx
        const postContent = renderPostFile(finalSlug, content_html);
        const postCommitMsg = `feat(blog): contenido de ${finalSlug}\n\nCo-Authored-By: ${actor}`;
        const postResult = await githubPutFile(postPath, postContent, postCommitMsg);

        return {
          ok: true,
          slug: finalSlug,
          url: `https://www.fluxperu.com/blog/${finalSlug}`,
          reading_time: readingTime,
          index_commit: indexResult.commit_url,
          post_commit: postResult.commit_url,
          message:
            "Post publicado. Vercel deploya en ~90s. Verificá la URL después de ese tiempo.",
        };
      },
    }),
  };
}
