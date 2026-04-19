import { NextRequest, NextResponse } from "next/server";
import {
  pullVercelUsage,
  pullStripeReceivedInvoices,
  pullAwsRekognition,
  pullVercelBlobComputed,
  pullFixedCosts,
  checkBudgetAlerts,
} from "@/lib/finance-pullers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const tag = "[cron/finance]";

/**
 * Cron de finanzas — corre 1x al día:
 *   1. Pull Vercel API (hosting + Blob)
 *   2. Pull Stripe balance transactions (Atlas + fees)
 *   3. Check alerts (proveedores > typical × 1.5)
 *
 * Configurado en vercel.json: /api/cron/finance @ 0 8 * * * (8am UTC = 3am Lima)
 */
export async function GET(req: NextRequest) {
  // Vercel crons envían Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  console.log(`${tag} start period=${period}`);

  const [vercel, stripe, aws, blob, fixed, alerts] = await Promise.allSettled([
    pullVercelUsage(period),
    pullStripeReceivedInvoices(period),
    pullAwsRekognition(period),
    pullVercelBlobComputed(period),
    pullFixedCosts(period),
    checkBudgetAlerts({ period, threshold: 1.5 }),
  ]);

  const val = <T,>(p: PromiseSettledResult<T>) =>
    p.status === "fulfilled" ? p.value : { error: String(p.reason) };

  const summary = {
    period,
    vercel: val(vercel),
    stripe: val(stripe),
    aws_rekognition: val(aws),
    vercel_blob_computed: val(blob),
    fixed_costs: val(fixed),
    alerts_triggered: alerts.status === "fulfilled" ? alerts.value?.length ?? 0 : 0,
    alerts_detail: val(alerts),
  };

  console.log(`${tag} done`, JSON.stringify(summary));
  return NextResponse.json(summary);
}
