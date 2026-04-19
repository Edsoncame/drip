/**
 * AI SDK tool wrappers para Google Ads.
 * Se inyectan al `sem-manager` (gestiona campañas) y `data-analyst` (lee métricas).
 */
import { tool } from "ai";
import { z } from "zod";
import {
  listCampaigns,
  getCampaignMetrics,
  pauseCampaign,
  enableCampaign,
  updateCampaignBudget,
  getAccountSummary,
  verifyConnection,
} from "./google-ads";

function envReady(): boolean {
  return !!(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_CUSTOMER_ID &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN
  );
}

function notConfigured() {
  return {
    error:
      "Google Ads no configurado — faltan env vars GOOGLE_ADS_*. Abrí Vercel → env vars.",
  };
}

export function googleAdsTools(readOnly: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {
    google_ads_verify: tool({
      description:
        "Verifica conexión con Google Ads y devuelve info de la cuenta (nombre, moneda, timezone).",
      inputSchema: z.object({}),
      execute: async () => {
        if (!envReady()) return notConfigured();
        return await verifyConnection();
      },
    }),
    google_ads_list_campaigns: tool({
      description:
        "Lista todas las campañas de Google Ads con su status y presupuesto diario.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!envReady()) return notConfigured();
        return { campaigns: await listCampaigns() };
      },
    }),
    google_ads_campaign_metrics: tool({
      description:
        "Métricas por campaña (impresiones, clicks, conversiones, CPA) en un rango. Devuelve una fila por cada campaña activa.",
      inputSchema: z.object({
        date_range: z
          .enum([
            "TODAY",
            "YESTERDAY",
            "LAST_7_DAYS",
            "LAST_14_DAYS",
            "LAST_30_DAYS",
            "THIS_MONTH",
            "LAST_MONTH",
          ])
          .default("LAST_30_DAYS"),
      }),
      execute: async ({ date_range }) => {
        if (!envReady()) return notConfigured();
        return { metrics: await getCampaignMetrics(date_range) };
      },
    }),
    google_ads_account_summary: tool({
      description:
        "Resumen agregado de la cuenta: spend total, clicks, impresiones, conversiones, CPA promedio.",
      inputSchema: z.object({
        date_range: z
          .enum([
            "TODAY",
            "YESTERDAY",
            "LAST_7_DAYS",
            "LAST_14_DAYS",
            "LAST_30_DAYS",
            "THIS_MONTH",
            "LAST_MONTH",
          ])
          .default("LAST_30_DAYS"),
      }),
      execute: async ({ date_range }) => {
        if (!envReady()) return notConfigured();
        return await getAccountSummary(date_range);
      },
    }),
  };

  if (!readOnly) {
    tools.google_ads_pause_campaign = tool({
      description:
        "Pausa una campaña de Google Ads. Usar con cautela — preferí pedir confirmación humana para campañas con spend alto.",
      inputSchema: z.object({
        campaign_id: z.string(),
        reason: z.string().describe("Motivo corto — para log"),
      }),
      execute: async ({ campaign_id, reason }) => {
        if (!envReady()) return notConfigured();
        await pauseCampaign(campaign_id);
        return { success: true, campaign_id, reason };
      },
    });
    tools.google_ads_enable_campaign = tool({
      description: "Reactiva una campaña pausada.",
      inputSchema: z.object({ campaign_id: z.string() }),
      execute: async ({ campaign_id }) => {
        if (!envReady()) return notConfigured();
        await enableCampaign(campaign_id);
        return { success: true, campaign_id };
      },
    });
    tools.google_ads_update_budget = tool({
      description:
        "Cambia el presupuesto diario de una campaña (en USD). Úsalo para escalar ganadoras o reducir perdedoras.",
      inputSchema: z.object({
        campaign_id: z.string(),
        new_daily_budget_usd: z.number().positive(),
      }),
      execute: async ({ campaign_id, new_daily_budget_usd }) => {
        if (!envReady()) return notConfigured();
        await updateCampaignBudget(campaign_id, new_daily_budget_usd);
        return { success: true, campaign_id, new_daily_budget_usd };
      },
    });
  }

  return tools;
}
