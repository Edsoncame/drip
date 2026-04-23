import { NextRequest, NextResponse } from "next/server";
import { ensureSanctionsSchema } from "@/lib/kyc/sanctions/schema";
import { fetchUif } from "@/lib/kyc/sanctions/fetch-uif";
import { fetchOfac } from "@/lib/kyc/sanctions/fetch-ofac";
import { fetchUn } from "@/lib/kyc/sanctions/fetch-un";
import { upsertSanctions, logFetch } from "@/lib/kyc/sanctions/upsert";
import type { SanctionsSource, SanctionsRecord } from "@/lib/kyc/sanctions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Cada fuente puede tomar 30-90s (descarga + parse + upserts). Total peor caso
// ~4min con las 3 en serie. Si hay memoria disponible corremos en paralelo.
export const maxDuration = 300;

const tag = "[cron/sanctions-refresh]";

type Fetcher = () => Promise<SanctionsRecord[]>;

const FETCHERS: Record<SanctionsSource, Fetcher> = {
  UIF_PE: () => fetchUif(),
  OFAC_SDN: () => fetchOfac(),
  UN_CONSOLIDATED: () => fetchUn(),
};

async function refreshOne(source: SanctionsSource): Promise<{
  source: SanctionsSource;
  status: "ok" | "failed";
  inserted: number;
  updated: number;
  deactivated: number;
  error: string | null;
}> {
  const startedAt = new Date();
  try {
    const records = await FETCHERS[source]();
    const summary = await upsertSanctions(source, records);
    const finishedAt = new Date();
    await logFetch({
      source,
      startedAt,
      finishedAt,
      status: "ok",
      summary,
      error: null,
    });
    console.log(
      `${tag} ${source} ok · inserted=${summary.inserted} updated=${summary.updated} deactivated=${summary.deactivated}`,
    );
    return { source, status: "ok", ...summary, error: null };
  } catch (err) {
    const finishedAt = new Date();
    const message = err instanceof Error ? err.message.slice(0, 500) : String(err);
    await logFetch({
      source,
      startedAt,
      finishedAt,
      status: "failed",
      summary: null,
      error: message,
    });
    console.error(`${tag} ${source} FAILED`, message);
    return { source, status: "failed", inserted: 0, updated: 0, deactivated: 0, error: message };
  }
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") !== null;
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!isVercelCron && !(cronSecret && authHeader === `Bearer ${cronSecret}`)) {
    const host = req.headers.get("host") ?? "";
    if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  await ensureSanctionsSchema();

  const sources: SanctionsSource[] = ["UIF_PE", "OFAC_SDN", "UN_CONSOLIDATED"];
  const results = await Promise.all(sources.map(refreshOne));

  const anyFailed = results.some((r) => r.status === "failed");
  return NextResponse.json(
    {
      ok: !anyFailed,
      results,
      ran_at: new Date().toISOString(),
    },
    { status: anyFailed ? 207 : 200 },
  );
}
