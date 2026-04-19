/**
 * GA4 Data API — client para leer reportes de tráfico/conversiones.
 *
 * Usa el service account JSON de GOOGLE_SEARCH_CONSOLE_CREDENTIALS (el mismo
 * service account debe tener acceso Viewer al GA4 property).
 *
 * Env vars:
 *   GA4_PROPERTY_ID — formato numérico, ej: "123456789"
 *   GOOGLE_SEARCH_CONSOLE_CREDENTIALS — JSON del service account
 */

import { tool } from "ai";
import { z } from "zod";

const BASE_URL = "https://analyticsdata.googleapis.com/v1beta";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function loadCreds(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

// OAuth2 JWT flow — generamos un access token firmado con el service account.
async function getAccessToken(): Promise<string | null> {
  const creds = loadCreds();
  if (!creds) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
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

  // Firmar con la private key
  const crypto = await import("node:crypto");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer
    .sign(creds.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${signature}`;

  // Intercambiar JWT por access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    console.warn("[ga4] token exchange failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

interface RunReportInput {
  metrics: string[];
  dimensions?: string[];
  dateRanges: Array<{ startDate: string; endDate: string }>;
  limit?: number;
  orderBys?: Array<{ metric?: { metricName: string }; desc?: boolean }>;
}

async function runReport(body: RunReportInput): Promise<unknown> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) throw new Error("GA4_PROPERTY_ID no seteado");
  const token = await getAccessToken();
  if (!token) throw new Error("No se pudo obtener access token GA4");

  const res = await fetch(`${BASE_URL}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GA4 ${res.status}: ${await res.text().catch(() => "")}`);
  return await res.json();
}

function envReady(): boolean {
  return !!(process.env.GA4_PROPERTY_ID && process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS);
}

function notConfigured() {
  return {
    error:
      "GA4 Data API no configurado — falta GA4_PROPERTY_ID o GOOGLE_SEARCH_CONSOLE_CREDENTIALS (service account).",
  };
}

export function ga4Tools() {
  return {
    ga4_traffic_summary: tool({
      description:
        "Métricas de tráfico de fluxperu.com (sessions, users, engagement, bounce rate) en un rango.",
      inputSchema: z.object({
        start_date: z.string().describe("YYYY-MM-DD o '30daysAgo'/'7daysAgo'").default("30daysAgo"),
        end_date: z.string().default("yesterday"),
      }),
      execute: async ({ start_date, end_date }) => {
        if (!envReady()) return notConfigured();
        return await runReport({
          metrics: [
            { name: "activeUsers" } as unknown as string,
            { name: "sessions" } as unknown as string,
            { name: "screenPageViews" } as unknown as string,
            { name: "engagementRate" } as unknown as string,
            { name: "bounceRate" } as unknown as string,
            { name: "averageSessionDuration" } as unknown as string,
          ],
          dateRanges: [{ startDate: start_date, endDate: end_date }],
        });
      },
    }),

    ga4_top_pages: tool({
      description:
        "Páginas más visitadas en fluxperu.com (con pageviews, unique users y engagement).",
      inputSchema: z.object({
        start_date: z.string().default("30daysAgo"),
        end_date: z.string().default("yesterday"),
        limit: z.number().min(1).max(100).default(20),
      }),
      execute: async ({ start_date, end_date, limit }) => {
        if (!envReady()) return notConfigured();
        return await runReport({
          metrics: [
            { name: "screenPageViews" } as unknown as string,
            { name: "activeUsers" } as unknown as string,
            { name: "engagementRate" } as unknown as string,
          ],
          dimensions: [{ name: "pagePath" } as unknown as string],
          dateRanges: [{ startDate: start_date, endDate: end_date }],
          limit,
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        });
      },
    }),

    ga4_traffic_sources: tool({
      description:
        "Fuentes de tráfico (organic, direct, referral, paid social, etc.) con sessions y conversiones.",
      inputSchema: z.object({
        start_date: z.string().default("30daysAgo"),
        end_date: z.string().default("yesterday"),
      }),
      execute: async ({ start_date, end_date }) => {
        if (!envReady()) return notConfigured();
        return await runReport({
          metrics: [
            { name: "sessions" } as unknown as string,
            { name: "activeUsers" } as unknown as string,
            { name: "conversions" } as unknown as string,
          ],
          dimensions: [
            { name: "sessionDefaultChannelGroup" } as unknown as string,
            { name: "sessionSource" } as unknown as string,
          ],
          dateRanges: [{ startDate: start_date, endDate: end_date }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        });
      },
    }),

    ga4_conversions_breakdown: tool({
      description:
        "Breakdown de eventos de conversión por tipo (purchase, begin_checkout, sign_up, etc.)",
      inputSchema: z.object({
        start_date: z.string().default("30daysAgo"),
        end_date: z.string().default("yesterday"),
      }),
      execute: async ({ start_date, end_date }) => {
        if (!envReady()) return notConfigured();
        return await runReport({
          metrics: [
            { name: "eventCount" } as unknown as string,
            { name: "totalUsers" } as unknown as string,
          ],
          dimensions: [{ name: "eventName" } as unknown as string],
          dateRanges: [{ startDate: start_date, endDate: end_date }],
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        });
      },
    }),
  };
}
