/**
 * Tools adicionales para el agent-runner.
 *
 * - web_fetch: trae contenido de una URL y lo devuelve como texto plano
 * - web_search: busca en DuckDuckGo HTML (sin API key) y devuelve top 5 resultados
 * - generate_image: llama a Pollinations.ai y devuelve URL estable
 *
 * Se inyectan condicionalmente en el runner según el tipo de agente:
 * el diseñador recibe generate_image, seo/market-researcher reciben web_*.
 */

import { tool } from "ai";
import { z } from "zod";

/** Strip HTML → texto plano muy básico para no depender de jsdom/cheerio. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export const webFetchTool = tool({
  description:
    "Descarga el contenido de una URL pública (HTML, JSON o texto). Para HTML devuelve una versión de texto plano. Útil para investigar competidores, analizar landings, verificar stats públicas.",
  inputSchema: z.object({
    url: z.string().url().describe("URL completa incluyendo https://"),
    max_chars: z
      .number()
      .optional()
      .describe("Máximo de caracteres a devolver (default 8000)"),
  }),
  execute: async ({ url, max_chars }) => {
    const limit = max_chars ?? 8000;
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 FLUX-Agent-Bot/1.0",
          accept: "text/html,application/json,text/plain,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return { error: `HTTP ${res.status}`, url };
      }
      const ct = res.headers.get("content-type") ?? "";
      const raw = await res.text();
      let text = raw;
      if (ct.includes("html")) text = htmlToText(raw);
      if (text.length > limit) text = text.slice(0, limit) + "\n\n…[truncado]";
      return { url, content_type: ct, length: text.length, text };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "fetch failed",
        url,
      };
    }
  },
});

export const webSearchTool = tool({
  description:
    "Busca en DuckDuckGo y devuelve los top 5 resultados con título, URL y snippet. Úsalo para encontrar información pública reciente (competidores, stats, tendencias, empresas peruanas).",
  inputSchema: z.object({
    query: z.string().describe("Query de búsqueda en lenguaje natural"),
  }),
  execute: async ({ query }) => {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=pe-es`;
      const res = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { error: `HTTP ${res.status}`, results: [] };
      const html = await res.text();

      // Parser básico de los resultados del HTML de DDG
      const results: { title: string; url: string; snippet: string }[] = [];
      const blockRe = /<div class="result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
      const titleRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
      const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

      let m: RegExpExecArray | null;
      while ((m = blockRe.exec(html)) !== null && results.length < 5) {
        const block = m[1];
        const t = titleRe.exec(block);
        const s = snippetRe.exec(block);
        if (!t) continue;
        let link = t[1];
        // DDG wrappea con //duckduckgo.com/l/?uddg=... — extraemos la URL real
        const uddgMatch = link.match(/uddg=([^&]+)/);
        if (uddgMatch) link = decodeURIComponent(uddgMatch[1]);
        results.push({
          title: htmlToText(t[2]).slice(0, 200),
          url: link,
          snippet: s ? htmlToText(s[1]).slice(0, 300) : "",
        });
      }
      return { query, results, count: results.length };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "search failed",
        results: [],
      };
    }
  },
});

/**
 * Image generation con upgrade automático:
 *  - Si FAL_KEY env está seteado → usa FLUX 1.1 Pro Ultra via fal.ai (~$0.04/img, calidad pro)
 *  - Sino → fallback a Pollinations.ai (free, FLUX schnell, calidad mid)
 *
 * Para activar el upgrade: `vercel env add FAL_KEY production` con tu key de
 * https://fal.ai/dashboard/keys (cargá $5 mínimo en billing).
 *
 * El agente no se entera del cambio — sigue siendo `generate_image`. La
 * respuesta incluye `provider` para debug y trazabilidad de costos.
 */

async function genFalFluxPro(prompt: string): Promise<{ url: string; provider: "fal-flux-pro-ultra" } | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://fal.run/fal-ai/flux-pro/v1.1-ultra", {
      method: "POST",
      headers: {
        authorization: `Key ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: "16:9",
        output_format: "jpeg",
        num_images: 1,
        enable_safety_checker: true,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.warn(`[generate_image] fal.ai HTTP ${res.status}, fallback a Pollinations`);
      return null;
    }
    const data = (await res.json()) as { images?: { url: string }[] };
    const url = data.images?.[0]?.url;
    if (!url) return null;
    return { url, provider: "fal-flux-pro-ultra" };
  } catch (err) {
    console.warn(`[generate_image] fal.ai error, fallback a Pollinations:`, err);
    return null;
  }
}

export const generateImageTool = tool({
  description:
    "Genera una imagen con FLUX Pro (fal.ai) si está configurado, sino Pollinations.ai (free) como fallback. Devuelve URL estable. IMPORTANTE: NO generes MacBooks como protagonista fotorrealista — siempre ambiente, luz, escena; el MacBook se compone después con Apple CDN. Si vas a usar la imagen en blog/ad, después llamá upload_to_blob para persistirla.",
  inputSchema: z.object({
    prompt: z
      .string()
      .describe(
        "Prompt visual descriptivo en inglés (mejores resultados). Describe escena, luz, estilo, sin mencionar MacBook.",
      ),
    width: z.number().optional().describe("Ancho en pixels, default 1280"),
    height: z.number().optional().describe("Alto en pixels, default 720"),
    seed: z.number().optional().describe("Seed para reproducibilidad, default random"),
  }),
  execute: async ({ prompt, width, height, seed }) => {
    const w = width ?? 1280;
    const h = height ?? 720;
    const s = seed ?? Math.floor(Math.random() * 1_000_000);

    // Tier 1: FLUX Pro Ultra (si hay key)
    const pro = await genFalFluxPro(prompt);
    if (pro) {
      return {
        url: pro.url,
        prompt,
        width: w,
        height: h,
        seed: s,
        provider: pro.provider,
        markdown: `![${prompt.slice(0, 60)}](${pro.url})`,
      };
    }

    // Tier 2: Pollinations fallback
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt,
    )}?width=${w}&height=${h}&seed=${s}&nologo=true&model=flux`;
    return {
      url,
      prompt,
      width: w,
      height: h,
      seed: s,
      provider: "pollinations-flux-schnell",
      markdown: `![${prompt.slice(0, 60)}](${url})`,
    };
  },
});
