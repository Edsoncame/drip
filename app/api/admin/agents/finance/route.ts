import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getFinanceSummary } from "@/lib/agents-db";
import { totalBudgetUsd, getActiveStrategy } from "@/lib/strategy-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") ?? "month") as "today" | "week" | "month" | "all";

  const [finance, strategy] = await Promise.all([
    getFinanceSummary(period),
    getActiveStrategy(),
  ]);

  let budgetAllocated = 0;
  if (strategy) {
    budgetAllocated = await totalBudgetUsd(strategy.id);
  }

  return NextResponse.json({
    period,
    ai: finance,
    budget: {
      allocated_usd: budgetAllocated,
      strategy_name: strategy?.name ?? null,
    },
  });
}
