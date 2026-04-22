/**
 * Google Search Console — client para SEO data.
 * Reutiliza el service account de GOOGLE_SEARCH_CONSOLE_CREDENTIALS.
 *
 * Env vars:
 *   GOOGLE_SEARCH_CONSOLE_CREDENTIALS — JSON service account (mismo que GA4)
 *   GSC_SITE_URL — ej: "https://www.fluxperu.com/" (tal como aparece en Search Console)
 */

import { tool } from "ai";
import { z } from "zod";

const BASE_URL = "https://www.googleapis.com/webmasters/v3";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

async function getAccessToken(): Promise<string | null> {
  const raw = process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS;
  if (!raw) return null;
  let creds: ServiceAccount;
  try {
    creds = JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const enc = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const unsigned = `${enc(header)}.${enc(claimSet)}`;
  const crypto = await import("node:crypto");
  const sig = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(creds.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

function envReady(): boolean {
  return !!(process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS && process.env.GSC_SITE_URL);
}

function notConfigured() {
  return {
    error:
      "GSC no configurado — falta GOOGLE_SEARCH_CONSOLE_CREDENTIALS o GSC_SITE_URL (ej: 'https://www.fluxperu.com/').",
  };
}

async function searchAnalytics(body: Record<string, unknown>): Promise<unknown> {
  // .trim() defensivo: si la env var se pega con un \n al final desde la UI
  // de Vercel, la URL resultante es inválida y la API devuelve 400 silencioso.
  const site = process.env.GSC_SITE_URL?.trim();
  if (!site) throw new Error("GSC_SITE_URL no seteado");
  const token = await getAccessToken();
  if (!token) throw new Error("No se pudo autenticar con Search Console");

  const url = `${BASE_URL}/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GSC ${res.status}: ${await res.text().catch(() => "")}`);
  return await res.json();
}

export function gscTools() {
  return {
    gsc_top_queries: tool({
      description:
        "Top queries de búsqueda que traen tráfico a fluxperu.com (con clicks, impresiones, CTR, posición).",
      inputSchema: z.object({
        start_date: z.string().describe("YYYY-MM-DD").default(() =>
          new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10),
        ),
        end_date: z.string().default(() => new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10)),
        limit: z.number().min(1).max(1000).default(50),
      }),
      execute: async ({ start_date, end_date, limit }) => {
        if (!envReady()) return notConfigured();
        return await searchAnalytics({
          startDate: start_date,
          endDate: end_date,
          dimensions: ["query"],
          rowLimit: limit,
        });
      },
    }),

    gsc_top_pages: tool({
      description:
        "Páginas de fluxperu.com que más tráfico reciben desde Google organic.",
      inputSchema: z.object({
        start_date: z.string().default(() =>
          new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10),
        ),
        end_date: z.string().default(() => new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10)),
        limit: z.number().min(1).max(1000).default(50),
      }),
      execute: async ({ start_date, end_date, limit }) => {
        if (!envReady()) return notConfigured();
        return await searchAnalytics({
          startDate: start_date,
          endDate: end_date,
          dimensions: ["page"],
          rowLimit: limit,
        });
      },
    }),

    gsc_query_performance: tool({
      description:
        "Performance de una query específica (matriz página × query) — para ver qué URL rankea por cada palabra.",
      inputSchema: z.object({
        query: z.string().describe("Ej: 'alquiler macbook lima'"),
        start_date: z.string().default(() =>
          new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10),
        ),
        end_date: z.string().default(() => new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10)),
      }),
      execute: async ({ query, start_date, end_date }) => {
        if (!envReady()) return notConfigured();
        return await searchAnalytics({
          startDate: start_date,
          endDate: end_date,
          dimensions: ["page"],
          dimensionFilterGroups: [
            {
              filters: [{ dimension: "query", operator: "equals", expression: query }],
            },
          ],
          rowLimit: 50,
        });
      },
    }),
  };
}
