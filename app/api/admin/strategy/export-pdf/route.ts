import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getStrategy,
  getActiveStrategy,
  listObjectives,
  listKpis,
  listTasks,
  listExperiments,
  listSemPlans,
  listBudget,
  listReports,
} from "@/lib/strategy-db";
import { query } from "@/lib/db";
import { generateStrategyPdf } from "@/lib/strategy-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get("id");

  const strategy = idParam
    ? await getStrategy(parseInt(idParam, 10))
    : await getActiveStrategy();
  if (!strategy) {
    return NextResponse.json({ error: "no strategy found" }, { status: 404 });
  }

  const [objectives, kpis, tasks, experiments, semPlans, budget, reports] =
    await Promise.all([
      listObjectives(strategy.id),
      listKpis(strategy.id),
      listTasks(strategy.id, "pending"),
      listExperiments(strategy.id),
      listSemPlans(strategy.id),
      listBudget(strategy.id),
      listReports(strategy.id, 1),
    ]);

  // Competidores sin función dedicada de list — query directa
  const compRes = await query<{
    id: number;
    strategy_id: number | null;
    competitor_name: string;
    ubicacion: string | null;
    servicios: string[] | null;
    canales_comunicacion: string[] | null;
    promociones: string[] | null;
    operaciones_inmediatas: string[] | null;
    operaciones_interbancarias: string[] | null;
    trayectoria: string | null;
    notas_adicionales: string | null;
    last_analyzed_at: Date | null;
    analyzed_by_agent: string | null;
    created_at: Date;
  }>(
    `SELECT * FROM marketing_competitor_benchmarks WHERE strategy_id = $1 OR strategy_id IS NULL ORDER BY competitor_name`,
    [strategy.id],
  );

  const pdfBytes = await generateStrategyPdf({
    strategy,
    objectives,
    kpis,
    tasks,
    experiments,
    semPlans,
    budget,
    competitors: compRes.rows,
    latestReport: reports[0] ?? null,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${strategy.slug}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
