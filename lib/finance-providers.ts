import { query } from "@/lib/db";

/**
 * Finanzas · Proveedores Tech/SaaS.
 *
 * Dos tablas: finance_providers (catálogo) + finance_expenses (ledger mensual).
 *
 * Algunos proveedores se auto-calculan desde otras fuentes:
 *   - anthropic: SUM(cost_usd) de marketing_agent_runs del mes
 *                 + KYC arbiter calls (aprox $0.05/verified borderline)
 *   - stripe:    2.9% + $0.30 × count(payments.status='validated') del mes
 */

export interface FinanceProvider {
  slug: string;
  name: string;
  category: string;
  website: string | null;
  billing_type: "subscription" | "usage" | "percentage" | "annual" | "one_time";
  typical_monthly_usd: string | null;
  currency: string;
  notes: string | null;
  active: boolean;
}

export interface FinanceExpense {
  id: number;
  provider_slug: string;
  period: string; // YYYY-MM
  amount_usd: string | null;
  amount_pen: string | null;
  source: "manual" | "anthropic-auto" | "stripe-auto";
  invoice_url: string | null;
  notes: string | null;
  paid_at: Date | null;
  created_at: Date;
}

export async function listProviders(): Promise<FinanceProvider[]> {
  const res = await query<FinanceProvider>(
    `SELECT * FROM finance_providers WHERE active = true ORDER BY category, name`,
  );
  return res.rows;
}

export async function listExpensesByPeriod(period: string): Promise<FinanceExpense[]> {
  const res = await query<FinanceExpense>(
    `SELECT * FROM finance_expenses WHERE period = $1 ORDER BY provider_slug`,
    [period],
  );
  return res.rows;
}

export async function upsertExpense(input: {
  provider_slug: string;
  period: string;
  amount_usd?: number | null;
  amount_pen?: number | null;
  source?: FinanceExpense["source"];
  invoice_url?: string | null;
  notes?: string | null;
  paid_at?: Date | null;
}): Promise<FinanceExpense> {
  const res = await query<FinanceExpense>(
    `INSERT INTO finance_expenses (provider_slug, period, amount_usd, amount_pen, source, invoice_url, notes, paid_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (provider_slug, period, source)
     DO UPDATE SET
       amount_usd = EXCLUDED.amount_usd,
       amount_pen = EXCLUDED.amount_pen,
       invoice_url = EXCLUDED.invoice_url,
       notes = EXCLUDED.notes,
       paid_at = EXCLUDED.paid_at
     RETURNING *`,
    [
      input.provider_slug,
      input.period,
      input.amount_usd ?? null,
      input.amount_pen ?? null,
      input.source ?? "manual",
      input.invoice_url ?? null,
      input.notes ?? null,
      input.paid_at ?? null,
    ],
  );
  return res.rows[0];
}

export async function deleteExpense(id: number): Promise<void> {
  await query(`DELETE FROM finance_expenses WHERE id = $1`, [id]);
}

/**
 * Calcula el gasto de Anthropic del mes desde marketing_agent_runs.cost_usd.
 * Esto NO incluye las calls del arbiter KYC (están en kyc_attempts.payload).
 */
export async function computeAnthropicSpend(period: string): Promise<number> {
  // period: YYYY-MM → rango del mes
  const [year, month] = period.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const res = await query<{ total: string | null }>(
    `SELECT COALESCE(SUM(cost_usd::numeric), 0) AS total
     FROM marketing_agent_runs
     WHERE started_at >= $1 AND started_at < $2`,
    [start, end],
  );
  const agentsCost = parseFloat(res.rows[0]?.total ?? "0") || 0;

  // KYC arbiter — ~$0.05 por call. Contamos attempts con arbiter_used=true.
  const kycRes = await query<{ arbiter_calls: string | null }>(
    `SELECT COUNT(*) AS arbiter_calls
     FROM kyc_attempts
     WHERE step = 'verify'
       AND payload->>'arbiter_used' = 'true'
       AND created_at >= $1 AND created_at < $2`,
    [start, end],
  );
  const arbiterCalls = parseInt(kycRes.rows[0]?.arbiter_calls ?? "0", 10) || 0;
  const arbiterCost = arbiterCalls * 0.05;

  return agentsCost + arbiterCost;
}

/**
 * Stripe fees del mes: 2.9% + $0.30 por payment validado.
 */
export async function computeStripeFees(period: string): Promise<number> {
  const [year, month] = period.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const res = await query<{ total_amount: string | null; tx_count: string | null }>(
    `SELECT COALESCE(SUM(amount::numeric), 0) AS total_amount,
            COUNT(*) AS tx_count
     FROM payments
     WHERE status = 'validated'
       AND payment_method = 'stripe'
       AND COALESCE(validated_at, created_at) >= $1
       AND COALESCE(validated_at, created_at) < $2`,
    [start, end],
  );
  const totalAmount = parseFloat(res.rows[0]?.total_amount ?? "0") || 0;
  const txCount = parseInt(res.rows[0]?.tx_count ?? "0", 10) || 0;
  return totalAmount * 0.029 + txCount * 0.3;
}

/**
 * Devuelve el dashboard completo del período: providers + expenses (merge
 * manual + auto-calculated).
 */
export async function getFinanceSnapshot(period: string) {
  const [providers, expenses, anthropicSpend, stripeFees] = await Promise.all([
    listProviders(),
    listExpensesByPeriod(period),
    computeAnthropicSpend(period),
    computeStripeFees(period),
  ]);

  const expensesBySlug = new Map<string, FinanceExpense[]>();
  for (const e of expenses) {
    const arr = expensesBySlug.get(e.provider_slug) ?? [];
    arr.push(e);
    expensesBySlug.set(e.provider_slug, arr);
  }

  const rows = providers.map((p) => {
    const entries = expensesBySlug.get(p.slug) ?? [];
    let autoUsd: number | null = null;

    if (p.slug === "anthropic") autoUsd = anthropicSpend;
    if (p.slug === "stripe") autoUsd = stripeFees;

    const manualUsd = entries
      .filter((e) => e.source === "manual")
      .reduce((sum, e) => sum + (parseFloat(e.amount_usd ?? "0") || 0), 0);
    const manualPen = entries
      .filter((e) => e.source === "manual")
      .reduce((sum, e) => sum + (parseFloat(e.amount_pen ?? "0") || 0), 0);

    return {
      provider: p,
      manual_usd: manualUsd,
      manual_pen: manualPen,
      auto_usd: autoUsd,
      total_usd: manualUsd + (autoUsd ?? 0),
      expenses: entries,
    };
  });

  const totalUsd = rows.reduce((sum, r) => sum + r.total_usd, 0);

  const byCategory = new Map<string, number>();
  for (const r of rows) {
    byCategory.set(r.provider.category, (byCategory.get(r.provider.category) ?? 0) + r.total_usd);
  }

  return {
    period,
    rows,
    totals: {
      total_usd: totalUsd,
      total_pen: rows.reduce((s, r) => s + r.manual_pen, 0),
      by_category: Array.from(byCategory.entries())
        .map(([category, usd]) => ({ category, usd }))
        .sort((a, b) => b.usd - a.usd),
    },
  };
}
