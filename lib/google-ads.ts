/**
 * Google Ads API client for FLUX agents.
 *
 * Required env vars (set in Vercel → Settings → Environment Variables):
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *   GOOGLE_ADS_CUSTOMER_ID
 *   GOOGLE_ADS_REFRESH_TOKEN
 *
 * Uses the Google Ads REST API (v17) with OAuth2 client credentials flow.
 * The refresh token never expires unless revoked, so agents can operate 24/7.
 */

const GOOGLE_ADS_API_VERSION = "v17";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoogleAdsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  customerId: string;
  refreshToken: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED" | "REMOVED";
  budgetAmountMicros: number;
  advertisingChannelType: string;
}

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  ctr: number;
  averageCpc: number;
  roas: number;
}

export interface CreateCampaignInput {
  name: string;
  dailyBudgetSoles: number; // in PEN soles, converted to micros internally
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD, optional
}

// ---------------------------------------------------------------------------
// Config loader — reads from process.env, throws if missing
// ---------------------------------------------------------------------------

function loadConfig(): GoogleAdsConfig {
  const required = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_REFRESH_TOKEN",
  ] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `Missing env var: ${key}. Configure it in Vercel → Settings → Environment Variables.`
      );
    }
  }

  return {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    clientId: process.env.GOOGLE_ADS_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, ""),
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  };
}

// ---------------------------------------------------------------------------
// OAuth2 — get a fresh access token using the refresh token
// ---------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(config: GoogleAdsConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google OAuth2 token refresh failed: ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.value;
}

// ---------------------------------------------------------------------------
// Base request helper
// ---------------------------------------------------------------------------

async function adsRequest<T>(
  config: GoogleAdsConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const accessToken = await getAccessToken(config);
  const url = `${ADS_BASE_URL}/customers/${config.customerId}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": config.developerToken,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Ads API error (${res.status}): ${err}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// GAQL query helper
// ---------------------------------------------------------------------------

async function gaqlQuery<T>(
  config: GoogleAdsConfig,
  query: string
): Promise<T[]> {
  const data = await adsRequest<{ results?: T[] }>(
    config,
    "POST",
    "/googleAds:searchStream",
    { query }
  );
  return data.results ?? [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify connectivity — returns true if credentials are valid.
 * Use this after configuring env vars to confirm everything works.
 */
export async function verifyConnection(): Promise<{
  ok: boolean;
  customerId: string;
  message: string;
}> {
  try {
    const config = loadConfig();
    const results = await gaqlQuery<{ customer: { id: string; descriptiveName: string } }>(
      config,
      "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1"
    );

    if (results.length === 0) {
      return { ok: false, customerId: config.customerId, message: "No customer data returned" };
    }

    const customer = results[0].customer;
    return {
      ok: true,
      customerId: customer.id,
      message: `Connected to account: ${customer.descriptiveName} (${customer.id})`,
    };
  } catch (err) {
    return {
      ok: false,
      customerId: "",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * List all active (non-removed) campaigns with basic info.
 */
export async function listCampaigns(): Promise<Campaign[]> {
  const config = loadConfig();

  type Row = {
    campaign: {
      id: string;
      name: string;
      status: Campaign["status"];
      advertisingChannelType: string;
    };
    campaignBudget: { amountMicros: string };
  };

  const rows = await gaqlQuery<Row>(
    config,
    `SELECT
       campaign.id,
       campaign.name,
       campaign.status,
       campaign.advertising_channel_type,
       campaign_budget.amount_micros
     FROM campaign
     WHERE campaign.status != 'REMOVED'
     ORDER BY campaign.name`
  );

  return rows.map((r) => ({
    id: r.campaign.id,
    name: r.campaign.name,
    status: r.campaign.status,
    budgetAmountMicros: Number(r.campaignBudget?.amountMicros ?? 0),
    advertisingChannelType: r.campaign.advertisingChannelType,
  }));
}

/**
 * Get performance metrics for all active campaigns in a date range.
 * dateRange: e.g. "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH"
 */
export async function getCampaignMetrics(
  dateRange: string = "LAST_30_DAYS"
): Promise<CampaignMetrics[]> {
  const config = loadConfig();

  type Row = {
    campaign: { id: string; name: string };
    metrics: {
      impressions: string;
      clicks: string;
      costMicros: string;
      conversions: string;
      ctr: string;
      averageCpc: string;
      conversionsValue: string;
    };
  };

  const rows = await gaqlQuery<Row>(
    config,
    `SELECT
       campaign.id,
       campaign.name,
       metrics.impressions,
       metrics.clicks,
       metrics.cost_micros,
       metrics.conversions,
       metrics.ctr,
       metrics.average_cpc,
       metrics.conversions_value
     FROM campaign
     WHERE campaign.status = 'ENABLED'
       AND segments.date DURING ${dateRange}`
  );

  return rows.map((r) => {
    const costMicros = Number(r.metrics.costMicros ?? 0);
    const conversionsValue = Number(r.metrics.conversionsValue ?? 0);
    const roas = costMicros > 0 ? (conversionsValue * 1_000_000) / costMicros : 0;

    return {
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      impressions: Number(r.metrics.impressions ?? 0),
      clicks: Number(r.metrics.clicks ?? 0),
      costMicros,
      conversions: Number(r.metrics.conversions ?? 0),
      ctr: Number(r.metrics.ctr ?? 0),
      averageCpc: Number(r.metrics.averageCpc ?? 0),
      roas,
    };
  });
}

/**
 * Pause a campaign by ID.
 */
export async function pauseCampaign(campaignId: string): Promise<void> {
  const config = loadConfig();

  await adsRequest(config, "POST", "/campaigns:mutate", {
    operations: [
      {
        update: {
          resourceName: `customers/${config.customerId}/campaigns/${campaignId}`,
          status: "PAUSED",
        },
        updateMask: "status",
      },
    ],
  });
}

/**
 * Enable (unpause) a campaign by ID.
 */
export async function enableCampaign(campaignId: string): Promise<void> {
  const config = loadConfig();

  await adsRequest(config, "POST", "/campaigns:mutate", {
    operations: [
      {
        update: {
          resourceName: `customers/${config.customerId}/campaigns/${campaignId}`,
          status: "ENABLED",
        },
        updateMask: "status",
      },
    ],
  });
}

/**
 * Update the daily budget of a campaign.
 * Accepts soles (PEN) — converted to micros internally.
 */
export async function updateCampaignBudget(
  campaignId: string,
  dailyBudgetSoles: number
): Promise<void> {
  const config = loadConfig();

  // First get the budget resource name for this campaign
  type BudgetRow = { campaignBudget: { resourceName: string } };
  const rows = await gaqlQuery<BudgetRow>(
    config,
    `SELECT campaign_budget.resource_name
     FROM campaign
     WHERE campaign.id = '${campaignId}'
     LIMIT 1`
  );

  if (rows.length === 0) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const budgetResourceName = rows[0].campaignBudget.resourceName;
  const amountMicros = Math.round(dailyBudgetSoles * 1_000_000);

  await adsRequest(config, "POST", "/campaignBudgets:mutate", {
    operations: [
      {
        update: {
          resourceName: budgetResourceName,
          amountMicros,
        },
        updateMask: "amount_micros",
      },
    ],
  });
}

/**
 * Get a summary report suitable for agent reporting.
 * Returns total spend, clicks, impressions, conversions across all active campaigns.
 */
export async function getAccountSummary(dateRange: string = "LAST_30_DAYS"): Promise<{
  totalSpendSoles: number;
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  roas: number;
  campaignCount: number;
}> {
  const metrics = await getCampaignMetrics(dateRange);

  if (metrics.length === 0) {
    return {
      totalSpendSoles: 0,
      totalClicks: 0,
      totalImpressions: 0,
      totalConversions: 0,
      averageCtr: 0,
      averageCpc: 0,
      roas: 0,
      campaignCount: 0,
    };
  }

  const totalCostMicros = metrics.reduce((s, m) => s + m.costMicros, 0);
  const totalClicks = metrics.reduce((s, m) => s + m.clicks, 0);
  const totalImpressions = metrics.reduce((s, m) => s + m.impressions, 0);
  const totalConversions = metrics.reduce((s, m) => s + m.conversions, 0);

  // PEN exchange rate: 1 USD ≈ 3.75 PEN. Google stores cost in USD micros.
  const USD_TO_PEN = 3.75;
  const totalSpendSoles = (totalCostMicros / 1_000_000) * USD_TO_PEN;

  return {
    totalSpendSoles: Math.round(totalSpendSoles * 100) / 100,
    totalClicks,
    totalImpressions,
    totalConversions,
    averageCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    averageCpc: totalClicks > 0 ? totalCostMicros / totalClicks / 1_000_000 : 0,
    roas:
      totalCostMicros > 0
        ? metrics.reduce((s, m) => s + m.roas * m.costMicros, 0) / totalCostMicros
        : 0,
    campaignCount: metrics.length,
  };
}
