import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/b2b/payments
 * Scope: payments:read
 *
 * Query:
 *   subscription_id — filtrar por sub específica
 *   status          — pending / validated / overdue / upcoming
 *   limit           — default 50, max 200
 *   offset
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "payments:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get("subscription_id");
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

  const conds: string[] = ["user_id = $1"];
  const vals: unknown[] = [auth.apiKey.user_id];
  if (subscriptionId) {
    conds.push(`subscription_id = $${vals.length + 1}`);
    vals.push(subscriptionId);
  }
  if (status) {
    conds.push(`status = $${vals.length + 1}`);
    vals.push(status);
  }

  const res = await query<{
    id: string;
    subscription_id: string;
    amount: string;
    currency: string;
    period_label: string;
    due_date: Date;
    status: string;
    payment_method: string;
    validated_at: Date | null;
    invoice_number: string | null;
    invoice_url: string | null;
  }>(
    `SELECT id, subscription_id, amount, currency, period_label, due_date, status,
            payment_method, validated_at, invoice_number, invoice_url
     FROM payments
     WHERE ${conds.join(" AND ")}
     ORDER BY due_date DESC
     LIMIT ${limit} OFFSET ${offset}`,
    vals,
  );

  return NextResponse.json({
    data: res.rows.map((r) => ({
      id: r.id,
      subscription_id: r.subscription_id,
      amount: parseFloat(r.amount),
      currency: r.currency,
      period: r.period_label,
      due_date: r.due_date,
      status: r.status,
      payment_method: r.payment_method,
      validated_at: r.validated_at,
      invoice: r.invoice_number
        ? { number: r.invoice_number, url: r.invoice_url }
        : null,
    })),
    pagination: { limit, offset, returned: res.rows.length },
  });
}
