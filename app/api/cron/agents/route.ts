import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent-runner";
import { runAutopilotTick } from "@/lib/agent-autopilot";
import type { AgentId } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron endpoint para los agentes autónomos.
 *
 * Vercel Cron hace GET con header `authorization: Bearer $CRON_SECRET`.
 * El query param `?job=weekly-seo-scan` determina qué pipeline corre.
 *
 * Jobs disponibles:
 *   - weekly-seo-scan     → lunes 9am: seo-specialist revisa posiciones
 *   - weekly-compet-scan  → lunes 10am: market-researcher scan competidores
 *   - monthly-data-report → día 1 8am: data-analyst reporte mensual
 *   - weekly-content-cal  → viernes 10am: community-manager calendario semanal
 */

interface CronJob {
  agent: AgentId;
  task: string;
  maxSteps?: number;
}

const JOBS: Record<string, CronJob> = {
  "weekly-seo-scan": {
    agent: "seo-specialist",
    task: `Weekly SERP scan. Hacé web_search de las keywords principales de FLUX: "alquiler macbook lima", "alquiler macbook peru", "rentar mac pyme", "leasing macbook lima". Para cada una: detectá qué sitios rankean top 5 y si FLUX está o no. Escribí un reporte en audits/YYYY-MM-DD-weekly-serp.md con TL;DR, tabla de posiciones, y 3 oportunidades accionables.`,
  },
  "weekly-compet-scan": {
    agent: "market-researcher",
    task: `Weekly competitive scan. Hacé web_fetch de las landings principales de competidores: https://leasein.pe, https://leasein.pe/precios (si existe), https://rentamac.com.pe. Detectá cualquier cambio de pricing, messaging, nuevas campañas o features. Escribí reporte en competitor-analysis/YYYY-MM-DD-weekly-scan.md con TL;DR, cambios detectados, y implicaciones para FLUX.`,
  },
  "monthly-data-report": {
    agent: "data-analyst",
    task: `Monthly report. Generá un reporte mensual completo con las métricas clave del mes pasado de FLUX: MRR, nuevos clientes, churn rate, LTV estimado, CAC por canal, funnel completo (visita→signup→cotización→pago). Marca anomalías si hay. Escribí en reports/monthly/YYYY-MM.md con formato ejecutivo.`,
  },
  "weekly-content-cal": {
    agent: "community-manager",
    task: `Armá el calendario editorial de la próxima semana. 4 posts/semana × 4 plataformas (IG, LinkedIn, TikTok, Facebook), balanceados entre educativo/social proof/producto/cultura. Usá temas de actualidad del mercado peruano MacBook/freelance/trabajo remoto. Guardá en calendar/YYYY-WW.md con grid de 7 días y los copy cortos listos.`,
  },
};

export async function GET(req: Request) {
  // Validación del CRON_SECRET (Vercel manda Bearer token)
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobKey = searchParams.get("job");
  if (!jobKey) {
    return NextResponse.json(
      { error: "missing job param", jobs: [...Object.keys(JOBS), "autopilot"] },
      { status: 400 },
    );
  }

  // Job especial: autopilot — corre N agentes proactivamente
  if (jobKey === "autopilot") {
    // Antes del tick, limpiamos runs colgados (>10min en 'running').
    // Esto evita que el orquestador vea "todos ocupados" y no delegue.
    const { cleanupStuckRuns } = await import("@/lib/agents-db");
    const cleaned = await cleanupStuckRuns().catch(() => 0);
    const max = parseInt(searchParams.get("max") ?? "3", 10);
    const result = await runAutopilotTick({ max });
    return NextResponse.json({ job: "autopilot", stuckCleaned: cleaned, ...result });
  }

  const job = JOBS[jobKey];
  if (!job) {
    return NextResponse.json(
      { error: `unknown job: ${jobKey}`, jobs: [...Object.keys(JOBS), "autopilot"] },
      { status: 404 },
    );
  }

  const result = await runAgent({
    agentId: job.agent,
    task: job.task,
    actor: `cron:${jobKey}`,
    maxSteps: job.maxSteps ?? 8,
    depth: 0,
  });

  return NextResponse.json({
    job: jobKey,
    agent: job.agent,
    ...result,
  });
}
