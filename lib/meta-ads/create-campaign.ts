/**
 * Meta Ads — orquestador de creación de campaña Lead Gen.
 *
 * Crea una estructura estándar para FLUX:
 *   1 Campaign  (objective=OUTCOME_LEADS, status=PAUSED, special_ad_categories=[])
 *   ├── 3 AdSets (daily_budget=$6.66 c/u, optimization_goal=LEAD_GENERATION,
 *   │             billing_event=IMPRESSIONS) → ~$20/día total
 *   │   ├── 2 Ads por AdSet (creative variant A + B) → 6 ads totales
 *
 * Todo arranca PAUSED. El operador humano (Edson) activa manualmente desde
 * Ads Manager después de revisar.
 *
 * Uso:
 *   const result = await createLeadGenCampaign({
 *     campaignName: "FLUX — Empresas — Lima — 2026-Q3",
 *     adSets: [
 *       { name: "ICP-1 Startups", targeting: {...}, creatives: [...] },
 *       { name: "ICP-2 Agencias", targeting: {...}, creatives: [...] },
 *       { name: "ICP-3 Consultoras", targeting: {...}, creatives: [...] },
 *     ],
 *     landingUrl: "https://fluxperu.com/empresas",
 *   });
 *
 * Si dryRun=true, no se llama a Meta — devuelve los payloads que se MANDARÍAN.
 * Esto es invaluable para que un agente revise antes de quemar plata real.
 *
 * Persiste a la tabla `meta_campaigns` (creada vía /api/admin/meta-ads/migrate)
 * para auditoría completa: payload original + respuestas de Meta + IDs.
 */

import { query } from "@/lib/db";
import {
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  getPageId,
  getInstagramActorId,
  getPixelId,
  usdToCents,
  adsManagerUrl,
  metaAdsCreationReady,
  type MetaTargeting,
  type CreateAdCreativeInput,
} from "./client";

// ── Inputs ──────────────────────────────────────────────────────────────────

/**
 * Un AdSet dentro de la campaña. Cada uno tiene su propio targeting (ICP)
 * y un array de creatives. Por cada creative se crea 1 Ad.
 */
export interface CampaignAdSetSpec {
  /** Nombre del AdSet (Meta lo muestra en Ads Manager) */
  name: string;
  /** Targeting completo. Default: PE, 25-55, FB+IG feed */
  targeting?: MetaTargeting;
  /** Daily budget en USD. Default: $6.66/día (= 666 centavos) */
  dailyBudgetUsd?: number;
  /** Creatives a crear bajo este AdSet. Cada uno → 1 Ad. */
  creatives: Array<{
    name: string;
    message: string;          // copy del ad
    headline?: string;        // titular
    description?: string;     // subtítulo
    imageUrl?: string;        // URL pública (Vercel Blob)
    imageHash?: string;       // alternativa a imageUrl si ya subiste con /adimages
    callToActionType?:
      | "LEARN_MORE"
      | "SIGN_UP"
      | "GET_QUOTE"
      | "CONTACT_US"
      | "APPLY_NOW"
      | "GET_OFFER"
      | "SUBSCRIBE";
  }>;
}

export interface CreateLeadGenCampaignInput {
  /** Nombre de la campaña en Meta */
  campaignName: string;
  /** URL destino de los ads (landing en fluxperu.com) */
  landingUrl: string;
  /** AdSets a crear. Por defecto el caller manda 3, pero soportamos N. */
  adSets: CampaignAdSetSpec[];
  /**
   * Modo dry-run: si true, NO se llama a Meta. Devuelve los payloads que se
   * mandarían. Útil para que el agente revise antes de gastar.
   */
  dryRun?: boolean;
  /** UUID del admin que dispara — queda en `meta_campaigns.created_by` */
  createdByUserId?: string;
  /** Path opcional al brief/plan que generó la campaña (queda como referencia) */
  planFilePath?: string;
}

export interface CreateLeadGenCampaignResult {
  ok: boolean;
  dryRun: boolean;
  /** ID de la fila en `meta_campaigns` (siempre se inserta, hasta en dryRun) */
  metaCampaignsRowId?: number;
  /** ID de la campaña en Meta (vacío en dryRun) */
  campaignId: string;
  /** IDs de los AdSets creados (vacío en dryRun) */
  adSetIds: string[];
  /** IDs de los Ads creados (vacío en dryRun) */
  adIds: string[];
  /** IDs de los Creatives creados (vacío en dryRun) */
  creativeIds: string[];
  /** URL profunda al campaign en Ads Manager (solo si !dryRun) */
  adsManagerUrl?: string;
  /** Payloads que se enviaron a Meta — en dryRun es lo que SE ENVIARÍA */
  payloads: {
    campaign: Record<string, unknown>;
    adSets: Array<{ payload: Record<string, unknown>; creatives: Record<string, unknown>[]; ads: Record<string, unknown>[] }>;
  };
  /** Resumen humano para mostrar en UI */
  summary: string;
  /** Logs cronológicos de cada paso (útil para debug) */
  logs: Array<{ ts: string; step: string; ok: boolean; detail?: string }>;
}

// ── Defaults ────────────────────────────────────────────────────────────────

/** Targeting default para FLUX: Perú adultos profesionales, FB+IG feed. */
const DEFAULT_TARGETING: MetaTargeting = {
  geo_locations: { countries: ["PE"] },
  age_min: 25,
  age_max: 55,
  publisher_platforms: ["facebook", "instagram"],
  facebook_positions: ["feed"],
  instagram_positions: ["stream", "explore"],
  device_platforms: ["mobile", "desktop"],
  targeting_automation: { advantage_audience: 1 },
};

const DEFAULT_DAILY_BUDGET_USD = 6.66; // = 666 centavos USD

// ── Helpers ─────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

function buildCreativePayload(
  creativeName: string,
  message: string,
  link: string,
  pageId: string,
  igActorId: string | undefined,
  opts: {
    headline?: string;
    description?: string;
    imageUrl?: string;
    imageHash?: string;
    callToActionType?: CreateAdCreativeInput["call_to_action"] extends infer T
      ? T extends { type: infer U } ? U : never
      : never;
  },
): CreateAdCreativeInput {
  return {
    name: creativeName,
    page_id: pageId,
    instagram_actor_id: igActorId,
    message,
    link,
    headline: opts.headline,
    description: opts.description,
    image_url: opts.imageUrl,
    image_hash: opts.imageHash,
    call_to_action: opts.callToActionType
      ? { type: opts.callToActionType, value: { link } }
      : { type: "LEARN_MORE", value: { link } },
  };
}

// ── Persistencia DB ─────────────────────────────────────────────────────────

interface PersistInput {
  campaignName: string;
  campaignId: string | null;
  status: "PAUSED" | "DRY_RUN";
  totalDailyBudgetUsd: number;
  adSetIds: string[];
  adIds: string[];
  creativeIds: string[];
  payloads: CreateLeadGenCampaignResult["payloads"];
  rawResponse: Record<string, unknown>;
  createdByUserId?: string;
  planFilePath?: string;
}

async function persistCampaignRow(input: PersistInput): Promise<number | undefined> {
  // Si es dryRun no tenemos campaign_id real. Usamos un placeholder único
  // para no violar la constraint UNIQUE — lo borramos si Edson decide
  // promoverlo a real (no se persiste como meta_campaign final).
  const cid = input.campaignId ?? `dryrun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const res = await query<{ id: number }>(
      `INSERT INTO meta_campaigns (
         campaign_id, name, objective, status,
         daily_budget_usd, adset_ids, ad_ids, creative_ids,
         pixel_id, page_id, instagram_actor_id,
         created_by, plan_file_path, raw_payload, raw_response
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14::jsonb, $15::jsonb
       )
       ON CONFLICT (campaign_id) DO UPDATE SET
         updated_at = NOW(),
         status = EXCLUDED.status,
         adset_ids = EXCLUDED.adset_ids,
         ad_ids = EXCLUDED.ad_ids,
         creative_ids = EXCLUDED.creative_ids,
         raw_response = EXCLUDED.raw_response
       RETURNING id`,
      [
        cid,
        input.campaignName,
        "OUTCOME_LEADS",
        input.status,
        input.totalDailyBudgetUsd,
        input.adSetIds,
        input.adIds,
        input.creativeIds,
        process.env.META_PIXEL_ID ?? null,
        process.env.META_PAGE_ID ?? null,
        process.env.META_INSTAGRAM_ID ?? null,
        input.createdByUserId ?? null,
        input.planFilePath ?? null,
        JSON.stringify(input.payloads),
        JSON.stringify(input.rawResponse),
      ],
    );
    return res.rows[0]?.id;
  } catch (err) {
    // Si la migración no corrió, esto falla — lo logueamos pero NO tiramos
    // la operación de Meta (los IDs de Meta ya están creados).
    console.error("[create-campaign] persist failed:", err instanceof Error ? err.message : err);
    return undefined;
  }
}

async function persistRunRow(args: {
  campaignId: string | null;
  dryRun: boolean;
  status: "success" | "failed" | "partial";
  errorMessage?: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown>;
  logs: CreateLeadGenCampaignResult["logs"];
  createdByUserId?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO meta_campaign_runs (
         campaign_id, dry_run, status, error_message, payload, response, logs, created_by
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)`,
      [
        args.campaignId,
        args.dryRun,
        args.status,
        args.errorMessage ?? null,
        JSON.stringify(args.payload),
        JSON.stringify(args.response),
        JSON.stringify(args.logs),
        args.createdByUserId ?? null,
      ],
    );
  } catch (err) {
    console.error("[create-campaign] run-log failed:", err instanceof Error ? err.message : err);
  }
}

// ── Orquestador principal ───────────────────────────────────────────────────

export async function createLeadGenCampaign(
  input: CreateLeadGenCampaignInput,
): Promise<CreateLeadGenCampaignResult> {
  const logs: CreateLeadGenCampaignResult["logs"] = [];
  const adSetIds: string[] = [];
  const adIds: string[] = [];
  const creativeIds: string[] = [];

  // Validaciones
  if (!input.campaignName || input.campaignName.length < 3) {
    throw new Error("campaignName requerido (min 3 chars)");
  }
  if (!input.landingUrl || !/^https?:\/\//.test(input.landingUrl)) {
    throw new Error("landingUrl debe ser http(s)://");
  }
  if (!input.adSets || input.adSets.length === 0) {
    throw new Error("adSets requerido (min 1)");
  }
  for (const a of input.adSets) {
    if (!a.creatives || a.creatives.length === 0) {
      throw new Error(`AdSet "${a.name}" no tiene creatives`);
    }
  }

  // Si NO es dryRun, validamos que las env vars estén
  if (!input.dryRun) {
    const ready = metaAdsCreationReady();
    if (!ready.ready) {
      throw new Error(
        `Meta Ads no está listo para crear campañas. Falta(n): ${ready.missing.join(", ")}. Configurá en Vercel env vars y redeployá.`,
      );
    }
  }

  const totalDailyUsd = input.adSets.reduce(
    (sum, a) => sum + (a.dailyBudgetUsd ?? DEFAULT_DAILY_BUDGET_USD),
    0,
  );

  // Construimos los payloads (en dryRun, esto es todo lo que devolvemos)
  const pageId = input.dryRun ? (process.env.META_PAGE_ID ?? "DRYRUN_PAGE_ID") : getPageId();
  const igActorId = input.dryRun ? process.env.META_INSTAGRAM_ID : getInstagramActorId();
  const pixelId = input.dryRun ? (process.env.META_PIXEL_ID ?? "DRYRUN_PIXEL_ID") : getPixelId();

  const campaignPayload: Record<string, unknown> = {
    name: input.campaignName,
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
  };

  const adSetsPayloads: CreateLeadGenCampaignResult["payloads"]["adSets"] = input.adSets.map(spec => {
    const dailyBudgetCents = usdToCents(spec.dailyBudgetUsd ?? DEFAULT_DAILY_BUDGET_USD);
    const targeting = spec.targeting ?? DEFAULT_TARGETING;

    const adSetPayload: Record<string, unknown> = {
      name: spec.name,
      status: "PAUSED",
      daily_budget: dailyBudgetCents,
      optimization_goal: "LEAD_GENERATION",
      billing_event: "IMPRESSIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      promoted_object: { pixel_id: pixelId, custom_event_type: "LEAD" },
      targeting,
    };

    const creativesPayloads: Record<string, unknown>[] = spec.creatives.map(c => {
      const cre = buildCreativePayload(
        c.name,
        c.message,
        input.landingUrl,
        pageId,
        igActorId,
        {
          headline: c.headline,
          description: c.description,
          imageUrl: c.imageUrl,
          imageHash: c.imageHash,
          callToActionType: c.callToActionType ?? "LEARN_MORE",
        },
      );
      return cre as unknown as Record<string, unknown>;
    });

    const adsPayloads: Record<string, unknown>[] = spec.creatives.map(c => ({
      name: `${spec.name} — ${c.name}`,
      status: "PAUSED",
    }));

    return { payload: adSetPayload, creatives: creativesPayloads, ads: adsPayloads };
  });

  const payloadsForReturn: CreateLeadGenCampaignResult["payloads"] = {
    campaign: campaignPayload,
    adSets: adSetsPayloads,
  };

  // ─── DRY RUN ──────────────────────────────────────────────────────────
  if (input.dryRun) {
    logs.push({ ts: now(), step: "dryRun", ok: true, detail: "no Meta calls made" });
    const totalAds = input.adSets.reduce((s, a) => s + a.creatives.length, 0);
    const summary = `[DRY RUN] Campaña "${input.campaignName}" — ${input.adSets.length} AdSets, ${totalAds} Ads, $${totalDailyUsd.toFixed(2)}/día. Nada se envió a Meta.`;

    const rowId = await persistCampaignRow({
      campaignName: input.campaignName,
      campaignId: null,
      status: "DRY_RUN",
      totalDailyBudgetUsd: totalDailyUsd,
      adSetIds: [],
      adIds: [],
      creativeIds: [],
      payloads: payloadsForReturn,
      rawResponse: {},
      createdByUserId: input.createdByUserId,
      planFilePath: input.planFilePath,
    });

    await persistRunRow({
      campaignId: null,
      dryRun: true,
      status: "success",
      payload: payloadsForReturn as unknown as Record<string, unknown>,
      response: {},
      logs,
      createdByUserId: input.createdByUserId,
    });

    return {
      ok: true,
      dryRun: true,
      metaCampaignsRowId: rowId,
      campaignId: "",
      adSetIds: [],
      adIds: [],
      creativeIds: [],
      payloads: payloadsForReturn,
      summary,
      logs,
    };
  }

  // ─── EJECUCIÓN REAL ───────────────────────────────────────────────────
  let campaignId = "";
  const rawResponse: Record<string, unknown> = { steps: [] };
  const stepsLog = rawResponse.steps as unknown[];

  try {
    // 1) Campaign
    logs.push({ ts: now(), step: "createCampaign", ok: false, detail: "starting" });
    const campaignRes = await createCampaign({
      name: input.campaignName,
      objective: "OUTCOME_LEADS",
      status: "PAUSED",
      special_ad_categories: [],
      buying_type: "AUCTION",
    });
    campaignId = campaignRes.id;
    logs[logs.length - 1] = { ts: now(), step: "createCampaign", ok: true, detail: campaignId };
    stepsLog.push({ kind: "campaign", id: campaignId });

    // 2) Por cada AdSet → 3) Creatives → 4) Ads
    for (let i = 0; i < input.adSets.length; i++) {
      const spec = input.adSets[i];
      const dailyBudgetCents = usdToCents(spec.dailyBudgetUsd ?? DEFAULT_DAILY_BUDGET_USD);

      logs.push({ ts: now(), step: `createAdSet[${i}]`, ok: false, detail: spec.name });
      const adSetRes = await createAdSet({
        name: spec.name,
        campaign_id: campaignId,
        status: "PAUSED",
        daily_budget_cents: dailyBudgetCents,
        optimization_goal: "LEAD_GENERATION",
        billing_event: "IMPRESSIONS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        promoted_object: { pixel_id: pixelId, custom_event_type: "LEAD" },
        targeting: spec.targeting ?? DEFAULT_TARGETING,
      });
      adSetIds.push(adSetRes.id);
      logs[logs.length - 1] = { ts: now(), step: `createAdSet[${i}]`, ok: true, detail: adSetRes.id };
      stepsLog.push({ kind: "adset", id: adSetRes.id, name: spec.name });

      for (let j = 0; j < spec.creatives.length; j++) {
        const c = spec.creatives[j];
        const creativeName = c.name || `${spec.name} — creative ${j + 1}`;

        logs.push({ ts: now(), step: `createCreative[${i}.${j}]`, ok: false, detail: creativeName });
        const creativeRes = await createAdCreative(
          buildCreativePayload(creativeName, c.message, input.landingUrl, pageId, igActorId, {
            headline: c.headline,
            description: c.description,
            imageUrl: c.imageUrl,
            imageHash: c.imageHash,
            callToActionType: c.callToActionType ?? "LEARN_MORE",
          }),
        );
        creativeIds.push(creativeRes.id);
        logs[logs.length - 1] = {
          ts: now(),
          step: `createCreative[${i}.${j}]`,
          ok: true,
          detail: creativeRes.id,
        };
        stepsLog.push({ kind: "creative", id: creativeRes.id });

        logs.push({ ts: now(), step: `createAd[${i}.${j}]`, ok: false, detail: creativeName });
        const adRes = await createAd({
          name: `${spec.name} — ${creativeName}`,
          adset_id: adSetRes.id,
          creative_id: creativeRes.id,
          status: "PAUSED",
        });
        adIds.push(adRes.id);
        logs[logs.length - 1] = { ts: now(), step: `createAd[${i}.${j}]`, ok: true, detail: adRes.id };
        stepsLog.push({ kind: "ad", id: adRes.id });
      }
    }

    const totalAds = adIds.length;
    const summary = `Campaña "${input.campaignName}" creada en PAUSED — ${adSetIds.length} AdSets, ${totalAds} Ads, $${totalDailyUsd.toFixed(2)}/día. Revisar en Ads Manager y activar manualmente.`;

    const rowId = await persistCampaignRow({
      campaignName: input.campaignName,
      campaignId,
      status: "PAUSED",
      totalDailyBudgetUsd: totalDailyUsd,
      adSetIds,
      adIds,
      creativeIds,
      payloads: payloadsForReturn,
      rawResponse,
      createdByUserId: input.createdByUserId,
      planFilePath: input.planFilePath,
    });

    await persistRunRow({
      campaignId,
      dryRun: false,
      status: "success",
      payload: payloadsForReturn as unknown as Record<string, unknown>,
      response: rawResponse,
      logs,
      createdByUserId: input.createdByUserId,
    });

    return {
      ok: true,
      dryRun: false,
      metaCampaignsRowId: rowId,
      campaignId,
      adSetIds,
      adIds,
      creativeIds,
      payloads: payloadsForReturn,
      adsManagerUrl: adsManagerUrl(campaignId),
      summary,
      logs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logs.push({ ts: now(), step: "FATAL", ok: false, detail: msg });
    const isPartial = Boolean(campaignId);

    // Persistimos lo que sea que se haya creado, para que Edson pueda
    // limpiar manualmente desde Ads Manager si quiere.
    if (isPartial) {
      await persistCampaignRow({
        campaignName: input.campaignName,
        campaignId,
        status: "PAUSED",
        totalDailyBudgetUsd: totalDailyUsd,
        adSetIds,
        adIds,
        creativeIds,
        payloads: payloadsForReturn,
        rawResponse: { ...rawResponse, error: msg },
        createdByUserId: input.createdByUserId,
        planFilePath: input.planFilePath,
      });
    }

    await persistRunRow({
      campaignId: campaignId || null,
      dryRun: false,
      status: isPartial ? "partial" : "failed",
      errorMessage: msg,
      payload: payloadsForReturn as unknown as Record<string, unknown>,
      response: rawResponse,
      logs,
      createdByUserId: input.createdByUserId,
    });

    // Re-throw para que el endpoint devuelva 5xx
    throw err;
  }
}
