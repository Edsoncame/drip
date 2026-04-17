/**
 * Meta Ads + Graph API service.
 *
 * Expone tools para que sem-manager y community-manager puedan:
 *  - Listar/leer campañas y ad sets
 *  - Ver insights (spend, impressions, clicks, CPA, ROAS)
 *  - Pausar/reanudar campañas y ad sets (nunca crear — se evita gasto accidental)
 *  - Publicar posts en la Página de Facebook
 *  - Publicar en Instagram Business (media container → publish)
 *
 * Credenciales necesarias (env vars):
 *  - META_ADS_ACCESS_TOKEN        → System User token long-lived
 *  - META_ADS_ACCOUNT_ID          → "act_1234567890"
 *  - META_PAGE_ID                 → ID numérico de la Página
 *  - META_INSTAGRAM_ID            → IG Business Account ID (opcional)
 *  - META_API_VERSION             → opcional, default v19.0
 *
 * Lecciones de la conexión de Drop Chat a Flux (abril 2026):
 *  - El token puede venir con whitespace/newlines → `replace(/\s+/g, "")` obligatorio
 *  - Los errores de Graph API vienen en `body.error.message`, a veces 200 con error dentro
 *  - Page tokens != User tokens != System User tokens — este archivo asume System User
 */

import { tool } from "ai";
import { z } from "zod";

const API_VERSION = process.env.META_API_VERSION ?? "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;

function getToken(): string {
  const raw = process.env.META_ADS_ACCESS_TOKEN;
  if (!raw) {
    throw new Error(
      "META_ADS_ACCESS_TOKEN no está seteada. Generá un System User token en business.facebook.com/settings/system-users y pegalo en Vercel env.",
    );
  }
  // Los tokens copiados desde el panel de Meta a veces tienen saltos de línea
  return raw.replace(/\s+/g, "");
}

function requireAdAccount(): string {
  const acct = process.env.META_ADS_ACCOUNT_ID;
  if (!acct) throw new Error("META_ADS_ACCOUNT_ID falta (formato: act_1234567890)");
  return acct.startsWith("act_") ? acct : `act_${acct}`;
}

function requirePageId(): string {
  const p = process.env.META_PAGE_ID;
  if (!p) throw new Error("META_PAGE_ID falta");
  return p.replace(/\s+/g, "");
}

function requireIgId(): string {
  const p = process.env.META_INSTAGRAM_ID;
  if (!p) throw new Error("META_INSTAGRAM_ID falta — conectá Instagram Business a la Página primero");
  return p.replace(/\s+/g, "");
}

type GraphError = { message?: string; code?: number; type?: string };

async function metaFetch(
  path: string,
  opts: {
    method?: "GET" | "POST" | "DELETE";
    query?: Record<string, string | number | undefined>;
    body?: Record<string, unknown>;
  } = {},
): Promise<unknown> {
  const token = getToken();
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", token);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json" },
  };
  if (opts.body) init.body = JSON.stringify(opts.body);

  const res = await fetch(url.toString(), init);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Graph API respondió no-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const maybeError = (json as { error?: GraphError }).error;
  if (maybeError) {
    throw new Error(`Meta Graph error [${maybeError.code ?? "?"}]: ${maybeError.message ?? "unknown"}`);
  }
  if (!res.ok) {
    throw new Error(`Graph API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return json;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEM Manager tools (ads)
// ═══════════════════════════════════════════════════════════════════════════

export function metaSemTools() {
  return {
    meta_list_campaigns: tool({
      description:
        "Lista todas las campañas de la Ad Account de Flux. Devuelve id, nombre, estado, objetivo, presupuesto diario/total.",
      inputSchema: z.object({
        limit: z.number().min(1).max(100).optional().default(25),
      }),
      execute: async ({ limit }) => {
        const data = (await metaFetch(`/${requireAdAccount()}/campaigns`, {
          query: {
            fields: "id,name,status,objective,daily_budget,lifetime_budget,created_time,stop_time",
            limit,
          },
        })) as { data: unknown[] };
        return { campaigns: data.data };
      },
    }),

    meta_campaign_insights: tool({
      description:
        "Métricas de una campaña: spend, impressions, clicks, CTR, CPC, conversiones, ROAS. Rango configurable.",
      inputSchema: z.object({
        campaign_id: z.string(),
        date_preset: z
          .enum(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month", "last_month"])
          .optional()
          .default("last_7d"),
      }),
      execute: async ({ campaign_id, date_preset }) => {
        const data = (await metaFetch(`/${campaign_id}/insights`, {
          query: {
            fields:
              "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,action_values,purchase_roas",
            date_preset,
          },
        })) as { data: unknown[] };
        return { insights: data.data };
      },
    }),

    meta_pause_campaign: tool({
      description:
        "Pausa una campaña (status=PAUSED). Úsala cuando una campaña tiene CPA >2x del objetivo o ROAS <1.",
      inputSchema: z.object({
        campaign_id: z.string(),
        reason: z.string().describe("Razón breve, queda en logs"),
      }),
      execute: async ({ campaign_id, reason }) => {
        await metaFetch(`/${campaign_id}`, {
          method: "POST",
          body: { status: "PAUSED" },
        });
        return { ok: true, campaign_id, reason };
      },
    }),

    meta_resume_campaign: tool({
      description: "Reactiva una campaña previamente pausada (status=ACTIVE).",
      inputSchema: z.object({ campaign_id: z.string() }),
      execute: async ({ campaign_id }) => {
        await metaFetch(`/${campaign_id}`, {
          method: "POST",
          body: { status: "ACTIVE" },
        });
        return { ok: true, campaign_id };
      },
    }),

    meta_list_ad_accounts: tool({
      description:
        "Lista las Ad Accounts accesibles con el System User token. Útil para debug de credenciales.",
      inputSchema: z.object({}),
      execute: async () => {
        const data = (await metaFetch(`/me/adaccounts`, {
          query: { fields: "id,name,account_status,currency,timezone_name,amount_spent" },
        })) as { data: unknown[] };
        return { ad_accounts: data.data };
      },
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Community Manager tools (orgánico Page + IG)
// ═══════════════════════════════════════════════════════════════════════════

export function metaCommunityTools() {
  return {
    fb_publish_post: tool({
      description:
        "Publica un post en la Página de Facebook de Flux. Soporta texto solo o texto + link (con preview automático).",
      inputSchema: z.object({
        message: z.string().min(1).max(5000),
        link: z.string().url().optional(),
      }),
      execute: async ({ message, link }) => {
        const body: Record<string, unknown> = { message };
        if (link) body.link = link;
        const res = (await metaFetch(`/${requirePageId()}/feed`, {
          method: "POST",
          body,
        })) as { id: string };
        return { ok: true, post_id: res.id };
      },
    }),

    ig_publish_image: tool({
      description:
        "Publica una imagen en Instagram Business. Flujo de 2 pasos: crea un media container con la URL de la imagen, luego lo publica. La imagen debe ser pública (URL de CDN, Blob, etc.).",
      inputSchema: z.object({
        image_url: z.string().url().describe("URL pública de la imagen"),
        caption: z.string().max(2200).optional(),
      }),
      execute: async ({ image_url, caption }) => {
        const ig = requireIgId();
        const container = (await metaFetch(`/${ig}/media`, {
          method: "POST",
          body: { image_url, caption },
        })) as { id: string };
        const published = (await metaFetch(`/${ig}/media_publish`, {
          method: "POST",
          body: { creation_id: container.id },
        })) as { id: string };
        return { ok: true, media_id: published.id };
      },
    }),

    ig_insights: tool({
      description:
        "Insights de la cuenta de Instagram Business: impresiones, alcance, engagement, follower_count. Últimos 7 días por default.",
      inputSchema: z.object({
        metrics: z
          .string()
          .optional()
          .default("impressions,reach,profile_views,follower_count")
          .describe("Lista de métricas separadas por coma"),
        period: z.enum(["day", "week", "days_28"]).optional().default("week"),
      }),
      execute: async ({ metrics, period }) => {
        const data = (await metaFetch(`/${requireIgId()}/insights`, {
          query: { metric: metrics, period },
        })) as { data: unknown[] };
        return { insights: data.data };
      },
    }),

    fb_page_insights: tool({
      description:
        "Insights de la Página de Facebook (page_impressions, page_engaged_users, page_fan_adds).",
      inputSchema: z.object({
        period: z.enum(["day", "week", "days_28"]).optional().default("week"),
      }),
      execute: async ({ period }) => {
        const data = (await metaFetch(`/${requirePageId()}/insights`, {
          query: {
            metric: "page_impressions,page_engaged_users,page_fan_adds",
            period,
          },
        })) as { data: unknown[] };
        return { insights: data.data };
      },
    }),
  };
}

/**
 * Heurística simple para saber si el agente puede usar Meta Ads tools.
 * Si no, el blocker del env var correspondiente lo reporta.
 */
export function metaAdsReady(): boolean {
  return Boolean(process.env.META_ADS_ACCESS_TOKEN && process.env.META_ADS_ACCOUNT_ID);
}

export function metaCommunityReady(): boolean {
  return Boolean(process.env.META_ADS_ACCESS_TOKEN && process.env.META_PAGE_ID);
}
