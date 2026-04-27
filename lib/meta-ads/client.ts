/**
 * Meta Marketing API v21 — cliente HTTP puro.
 *
 * A diferencia de `lib/meta-ads.ts` (que expone tools del AI SDK para que los
 * agentes puedan operar Meta), este módulo exporta funciones **directas**
 * pensadas para ser invocadas desde route handlers admin (`app/api/admin/...`).
 *
 * Diseño:
 *   - Nada de Zod ni dependencia del AI SDK acá → 0 overhead, 0 ambigüedad.
 *   - Manejo de errores: la Graph API a veces devuelve HTTP 200 con `error`
 *     dentro del body, así que parseamos siempre y lanzamos `MetaApiError`
 *     con `code`, `subcode`, `error_user_msg` y `fbtrace_id` para debug.
 *   - Retry con backoff exponencial en 5xx + 429 + transient codes (1, 2, 4, 17, 32).
 *   - Lectura de env vars centralizada acá; soportamos los nombres "viejos"
 *     (`META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID`) y los "nuevos"
 *     (`META_AD_ACCOUNT_ID`) que Edson confirmó en abril 2026.
 *
 * Orden canónico para crear una campaña real:
 *   1) createCampaign({ name, objective: 'OUTCOME_LEADS', status: 'PAUSED', ... })
 *   2) createAdSet({ campaign_id, optimization_goal: 'OFFSITE_CONVERSIONS',
 *                    promoted_object: { pixel_id, custom_event_type: 'LEAD' }, targeting, ... })
 *   3) createAdCreative({ object_story_spec: { page_id, instagram_actor_id, link_data } })
 *   4) createAd({ adset_id, creative: { creative_id }, status: 'PAUSED' })
 *
 * Nota crítica: TODO arranca status=PAUSED. Edson activa manual desde Ads Manager.
 */

// ── Constantes ──────────────────────────────────────────────────────────────

export const META_API_VERSION = process.env.META_API_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Códigos transient de Meta donde tiene sentido reintentar.
// Ref: https://developers.facebook.com/docs/graph-api/guides/error-handling/
const RETRYABLE_CODES = new Set<number>([1, 2, 4, 17, 32, 341, 368, 613]);

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface MetaError {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
}

export class MetaApiError extends Error {
  readonly code?: number;
  readonly subcode?: number;
  readonly userMsg?: string;
  readonly fbtraceId?: string;
  readonly httpStatus: number;
  readonly endpoint: string;

  constructor(err: MetaError, httpStatus: number, endpoint: string) {
    const userPart = err.error_user_msg ? ` — ${err.error_user_msg}` : "";
    super(`Meta Graph error [${err.code ?? "?"}/${err.error_subcode ?? "-"}]: ${err.message}${userPart}`);
    this.name = "MetaApiError";
    this.code = err.code;
    this.subcode = err.error_subcode;
    this.userMsg = err.error_user_msg;
    this.fbtraceId = err.fbtrace_id;
    this.httpStatus = httpStatus;
    this.endpoint = endpoint;
  }

  isRetryable(): boolean {
    if (this.httpStatus >= 500) return true;
    if (this.httpStatus === 429) return true;
    if (this.code != null && RETRYABLE_CODES.has(this.code)) return true;
    return false;
  }
}

export type CampaignObjective =
  | "OUTCOME_LEADS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_SALES"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_APP_PROMOTION";

export type AdStatus = "PAUSED" | "ACTIVE" | "DELETED" | "ARCHIVED";

export type OptimizationGoal =
  | "OFFSITE_CONVERSIONS"
  | "LEAD_GENERATION"
  | "LINK_CLICKS"
  | "REACH"
  | "IMPRESSIONS"
  | "LANDING_PAGE_VIEWS"
  | "CONVERSATIONS";

export type BillingEvent = "IMPRESSIONS" | "LINK_CLICKS" | "THRUPLAY";

export interface MetaTargeting {
  geo_locations?: {
    countries?: string[];
    cities?: Array<{ key: string; radius?: number; distance_unit?: "kilometer" | "mile" }>;
    regions?: Array<{ key: string }>;
  };
  age_min?: number;
  age_max?: number;
  genders?: number[]; // [1]=male, [2]=female
  interests?: Array<{ id: string; name?: string }>;
  behaviors?: Array<{ id: string; name?: string }>;
  flexible_spec?: Array<Record<string, unknown>>;
  exclusions?: Record<string, unknown>;
  publisher_platforms?: Array<"facebook" | "instagram" | "audience_network" | "messenger">;
  facebook_positions?: string[];
  instagram_positions?: string[];
  device_platforms?: Array<"mobile" | "desktop">;
  locales?: number[];
  // Targeting B2B "expansion" (Detailed Targeting Expansion) lo puede setear Meta.
  targeting_automation?: { advantage_audience?: 0 | 1 };
}

export interface PromotedObject {
  pixel_id?: string;
  custom_event_type?: "LEAD" | "PURCHASE" | "COMPLETE_REGISTRATION" | "ADD_TO_CART" | "VIEW_CONTENT";
  page_id?: string;
  application_id?: string;
}

export interface CreateCampaignInput {
  name: string;
  objective: CampaignObjective;
  status?: AdStatus;
  special_ad_categories?: string[];
  buying_type?: "AUCTION" | "RESERVED";
  daily_budget_cents?: number;
  lifetime_budget_cents?: number;
}

export interface CreateAdSetInput {
  name: string;
  campaign_id: string;
  status?: AdStatus;
  daily_budget_cents?: number;
  lifetime_budget_cents?: number;
  optimization_goal: OptimizationGoal;
  billing_event: BillingEvent;
  bid_strategy?: "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP";
  bid_amount_cents?: number;
  promoted_object?: PromotedObject;
  targeting: MetaTargeting;
  start_time?: string; // ISO
  end_time?: string;   // ISO
  attribution_spec?: Array<{ event_type: string; window_days: number }>;
}

export interface CreateAdCreativeInput {
  name: string;
  page_id: string;
  instagram_actor_id?: string; // IG Business account id → cross-publish
  message?: string;
  link?: string;
  image_url?: string;
  image_hash?: string;
  video_id?: string;
  headline?: string;
  description?: string;
  call_to_action?: {
    type:
      | "LEARN_MORE"
      | "SIGN_UP"
      | "GET_QUOTE"
      | "CONTACT_US"
      | "BOOK_TRAVEL"
      | "APPLY_NOW"
      | "GET_OFFER"
      | "SUBSCRIBE";
    value?: { link?: string; lead_gen_form_id?: string };
  };
  // Para overrides totalmente custom (carousel, etc.)
  object_story_spec_override?: Record<string, unknown>;
}

export interface CreateAdInput {
  name: string;
  adset_id: string;
  creative_id: string;
  status?: AdStatus;
  tracking_specs?: Array<Record<string, unknown>>;
}

// ── Env vars helpers ────────────────────────────────────────────────────────

export function getMetaToken(): string {
  // Soportamos ambos nombres por compat con el código pre-abril-2026.
  const raw = process.env.META_ADS_ACCESS_TOKEN ?? process.env.META_GRAPH_ACCESS_TOKEN;
  if (!raw) {
    throw new Error(
      "META_ADS_ACCESS_TOKEN / META_GRAPH_ACCESS_TOKEN no está seteada. Generá un System User token en business.facebook.com/settings/system-users.",
    );
  }
  // Tokens copiados del panel a veces tienen whitespace/newlines.
  return raw.replace(/\s+/g, "");
}

export function getAdAccountId(): string {
  // Nuevo nombre canónico: META_AD_ACCOUNT_ID. Fallback al viejo META_ADS_ACCOUNT_ID.
  const raw = process.env.META_AD_ACCOUNT_ID ?? process.env.META_ADS_ACCOUNT_ID;
  if (!raw) throw new Error("META_AD_ACCOUNT_ID falta (formato: act_1234567890)");
  const clean = raw.replace(/\s+/g, "");
  return clean.startsWith("act_") ? clean : `act_${clean}`;
}

export function getPageId(): string {
  const raw = process.env.META_PAGE_ID;
  if (!raw) throw new Error("META_PAGE_ID falta");
  return raw.replace(/\s+/g, "");
}

export function getInstagramActorId(): string | undefined {
  const raw = process.env.META_INSTAGRAM_ID;
  if (!raw) return undefined;
  return raw.replace(/\s+/g, "");
}

export function getPixelId(): string {
  const raw = process.env.META_PIXEL_ID;
  if (!raw) throw new Error("META_PIXEL_ID falta — se necesita para optimizar a evento Lead");
  return raw.replace(/\s+/g, "");
}

// ── HTTP core con retry ─────────────────────────────────────────────────────

interface FetchOpts {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
  /** Si lo pasás, se incluye Idempotency-Key (solo recomendado en POSTs de creación) */
  idempotencyKey?: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function metaFetch<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const token = getMetaToken();
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", token);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
  };
  if (opts.body) {
    // Meta Graph API acepta tanto form-urlencoded como JSON. JSON es más limpio,
    // pero algunos endpoints históricamente tienen quirks. Para POSTs de creación
    // usamos JSON; siempre stringifying objetos anidados como JSON propio.
    init.body = JSON.stringify(stringifyNested(opts.body));
  }

  // Hasta 3 intentos: 0ms, 800ms, 2400ms
  const delays = [0, 800, 2400];
  let lastErr: unknown;
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    try {
      const res = await fetch(url.toString(), init);
      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new MetaApiError(
          { message: `Non-JSON response (${res.status}): ${text.slice(0, 300)}` },
          res.status,
          path,
        );
      }

      const errBody = (json as { error?: MetaError }).error;
      if (errBody) {
        const apiErr = new MetaApiError(errBody, res.status, path);
        if (apiErr.isRetryable() && delay !== delays[delays.length - 1]) {
          lastErr = apiErr;
          continue;
        }
        throw apiErr;
      }

      if (!res.ok) {
        const apiErr = new MetaApiError(
          { message: `HTTP ${res.status}: ${text.slice(0, 300)}` },
          res.status,
          path,
        );
        if (apiErr.isRetryable() && delay !== delays[delays.length - 1]) {
          lastErr = apiErr;
          continue;
        }
        throw apiErr;
      }

      return json as T;
    } catch (err) {
      // Network errors (fetch failed, AbortError, etc.) → retry
      if (err instanceof MetaApiError) throw err;
      lastErr = err;
      if (delay === delays[delays.length - 1]) {
        throw err;
      }
    }
  }
  throw lastErr;
}

/**
 * Meta Graph espera que objetos anidados (targeting, promoted_object, object_story_spec)
 * vengan como JSON-stringified strings cuando se envían como form data, pero como JSON
 * inline cuando se envía Content-Type: application/json. Acá usamos JSON, así que NO
 * stringificamos los nested — los pasamos tal cual. Esta función queda como hook por si
 * en el futuro hay que cambiar de modo.
 */
function stringifyNested(body: Record<string, unknown>): Record<string, unknown> {
  return body;
}

// ── Operaciones de creación ─────────────────────────────────────────────────

export async function createCampaign(input: CreateCampaignInput): Promise<{ id: string }> {
  const acct = getAdAccountId();
  const body: Record<string, unknown> = {
    name: input.name,
    objective: input.objective,
    status: input.status ?? "PAUSED",
    special_ad_categories: input.special_ad_categories ?? [],
    buying_type: input.buying_type ?? "AUCTION",
  };
  if (input.daily_budget_cents != null) body.daily_budget = input.daily_budget_cents;
  if (input.lifetime_budget_cents != null) body.lifetime_budget = input.lifetime_budget_cents;

  return await metaFetch<{ id: string }>(`/${acct}/campaigns`, {
    method: "POST",
    body,
  });
}

export async function createAdSet(input: CreateAdSetInput): Promise<{ id: string }> {
  const acct = getAdAccountId();
  const body: Record<string, unknown> = {
    name: input.name,
    campaign_id: input.campaign_id,
    status: input.status ?? "PAUSED",
    optimization_goal: input.optimization_goal,
    billing_event: input.billing_event,
    bid_strategy: input.bid_strategy ?? "LOWEST_COST_WITHOUT_CAP",
    targeting: input.targeting,
  };
  if (input.daily_budget_cents != null) body.daily_budget = input.daily_budget_cents;
  if (input.lifetime_budget_cents != null) body.lifetime_budget = input.lifetime_budget_cents;
  if (input.bid_amount_cents != null) body.bid_amount = input.bid_amount_cents;
  if (input.promoted_object) body.promoted_object = input.promoted_object;
  if (input.start_time) body.start_time = input.start_time;
  if (input.end_time) body.end_time = input.end_time;
  if (input.attribution_spec) body.attribution_spec = input.attribution_spec;

  return await metaFetch<{ id: string }>(`/${acct}/adsets`, {
    method: "POST",
    body,
  });
}

export async function createAdCreative(input: CreateAdCreativeInput): Promise<{ id: string }> {
  const acct = getAdAccountId();

  // Construimos el object_story_spec según tipo de creative.
  let objectStorySpec: Record<string, unknown>;
  if (input.object_story_spec_override) {
    objectStorySpec = {
      page_id: input.page_id,
      ...(input.instagram_actor_id ? { instagram_actor_id: input.instagram_actor_id } : {}),
      ...input.object_story_spec_override,
    };
  } else {
    const linkData: Record<string, unknown> = {};
    if (input.message) linkData.message = input.message;
    if (input.link) linkData.link = input.link;
    if (input.image_url) linkData.picture = input.image_url;
    if (input.image_hash) linkData.image_hash = input.image_hash;
    if (input.headline) linkData.name = input.headline;
    if (input.description) linkData.description = input.description;
    if (input.call_to_action) {
      linkData.call_to_action = {
        type: input.call_to_action.type,
        value: input.call_to_action.value ?? (input.link ? { link: input.link } : {}),
      };
    }

    objectStorySpec = {
      page_id: input.page_id,
      ...(input.instagram_actor_id ? { instagram_actor_id: input.instagram_actor_id } : {}),
      link_data: linkData,
    };
  }

  return await metaFetch<{ id: string }>(`/${acct}/adcreatives`, {
    method: "POST",
    body: {
      name: input.name,
      object_story_spec: objectStorySpec,
    },
  });
}

export async function createAd(input: CreateAdInput): Promise<{ id: string }> {
  const acct = getAdAccountId();
  return await metaFetch<{ id: string }>(`/${acct}/ads`, {
    method: "POST",
    body: {
      name: input.name,
      adset_id: input.adset_id,
      creative: { creative_id: input.creative_id },
      status: input.status ?? "PAUSED",
      ...(input.tracking_specs ? { tracking_specs: input.tracking_specs } : {}),
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** USD → centavos. Meta espera presupuestos en la unidad mínima de la currency. */
export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

/** URL profunda al campaign en Ads Manager para que Edson lo abra de un click. */
export function adsManagerUrl(campaignId: string): string {
  const acct = getAdAccountId().replace("act_", "");
  return `https://business.facebook.com/adsmanager/manage/campaigns?act=${acct}&selected_campaign_ids=${campaignId}`;
}

/** Devuelve true si todas las env vars necesarias para crear campañas están seteadas. */
export function metaAdsCreationReady(): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!process.env.META_ADS_ACCESS_TOKEN && !process.env.META_GRAPH_ACCESS_TOKEN) {
    missing.push("META_ADS_ACCESS_TOKEN");
  }
  if (!process.env.META_AD_ACCOUNT_ID && !process.env.META_ADS_ACCOUNT_ID) {
    missing.push("META_AD_ACCOUNT_ID");
  }
  if (!process.env.META_PAGE_ID) missing.push("META_PAGE_ID");
  if (!process.env.META_PIXEL_ID) missing.push("META_PIXEL_ID");
  return { ready: missing.length === 0, missing };
}
