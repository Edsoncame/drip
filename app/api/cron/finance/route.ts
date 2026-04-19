import { NextRequest, NextResponse } from "next/server";
import {
  pullVercelUsage,
  pullStripeReceivedInvoices,
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

  const [vercelResult, stripeResult, alerts] = await Promise.allSettled([
    pullVercelUsage(period),
    pullStripeReceivedInvoices(period),
    checkBudgetAlerts({ period, threshold: 1.5 }),
  ]);

  const summary = {
    period,
    vercel: vercelResult.status === "fulfilled" ? vercelResult.value : { error: String(vercelResult.reason) },
    stripe: stripeResult.status === "fulfilled" ? stripeResult.value : { error: String(stripeResult.reason) },
    alerts_triggered: alerts.status === "fulfilled" ? alerts.value?.length ?? 0 : 0,
    alerts_detail: alerts.status === "fulfilled" ? alerts.value : { error: String(alerts.reason) },
  };

  console.log(`${tag} done`, JSON.stringify(summary));
  return NextResponse.json(summary);
}
