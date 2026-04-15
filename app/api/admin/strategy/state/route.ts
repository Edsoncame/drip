import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getActiveStrategy,
  listStrategies,
  listObjectives,
  listKpis,
  listTasks,
  listExperiments,
  listSemPlans,
  listBudget,
  listReports,
  listAttachments,
  totalBudgetUsd,
  getTasksSummary,
  getUpcomingTasks,
} from "@/lib/strategy-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [active, all] = await Promise.all([getActiveStrategy(), listStrategies()]);

  if (!active) {
    return NextResponse.json({
      hasStrategy: false,
      allStrategies: all,
      message: "No hay estrategia activa",
    });
  }

  const [
    objectives,
    kpis,
    tasks,
    upcoming,
    experiments,
    semPlans,
    budget,
    reports,
    attachments,
    tasksSummary,
    totalBudget,
  ] = await Promise.all([
    listObjectives(active.id),
    listKpis(active.id),
    listTasks(active.id),
    getUpcomingTasks(active.id, 30),
    listExperiments(active.id),
    listSemPlans(active.id),
    listBudget(active.id),
    listReports(active.id, 10),
    listAttachments(active.id),
    getTasksSummary(active.id),
    totalBudgetUsd(active.id),
  ]);

  return NextResponse.json({
    hasStrategy: true,
    strategy: active,
    allStrategies: all,
    objectives,
    kpis,
    tasks,
    upcoming,
    experiments,
    semPlans,
    budget,
    reports,
    attachments,
    tasksSummary,
    totalBudget,
  });
}
