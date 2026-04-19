import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/b2b/subscriptions
 *
 * Header: Authorization: Bearer flk_live_...
 * Scope:  subscriptions:read
 *
 * Devuelve las subscripciones del user_id dueño de la API key.
 * Útil para integraciones ERP que quieran saber qué equipos tiene asignados.
 *
 * Query params:
 *   status  — filtrar por status (preparing/shipped/delivered/...)
 *   limit   — default 50, max 200
 *   offset  — paginación
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "subscriptions:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

  const conds: string[] = ["user_id = $1"];
  const vals: unknown[] = [auth.apiKey.user_id];
  if (status) {
    conds.push(`status = $${vals.length + 1}`);
    vals.push(status);
  }

  const res = await query<{
    id: string;
    product_slug: string;
    product_name: string;
    months: number;
    monthly_price: string;
    status: string;
    billing_name: string | null;
    billing_company: string | null;
    apple_care: boolean;
    delivery_method: string | null;
    delivery_address: string | null;
    delivery_distrito: string | null;
    tracking_number: string | null;
    started_at: Date;
    ends_at: Date | null;
    next_billing_at: Date | null;
    shipped_at: Date | null;
    delivered_at: Date | null;
    payment_method: string | null;
    external_subscription_id: string | null;
  }>(
    `SELECT id, product_slug, product_name, months, monthly_price, status,
            billing_name, billing_company, apple_care,
            delivery_method, delivery_address, delivery_distrito, tracking_number,
            started_at, ends_at, next_billing_at, shipped_at, delivered_at,
            payment_method, external_subscription_id
     FROM subscriptions
     WHERE ${conds.join(" AND ")}
     ORDER BY started_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    vals,
  );

  return NextResponse.json({
    data: res.rows.map((r) => ({
      id: r.id,
      product: { slug: r.product_slug, name: r.product_name },
      plan: { months: r.months, monthly_price_usd: parseFloat(r.monthly_price) },
      status: r.status,
      billing: { name: r.billing_name, company: r.billing_company },
      apple_care: r.apple_care,
      delivery: {
        method: r.delivery_method,
        address: r.delivery_address,
        distrito: r.delivery_distrito,
        tracking_number: r.tracking_number,
        shipped_at: r.shipped_at,
        delivered_at: r.delivered_at,
      },
      dates: {
        started_at: r.started_at,
        ends_at: r.ends_at,
        next_billing_at: r.next_billing_at,
      },
      payment_method: r.payment_method,
      external_subscription_id: r.external_subscription_id,
    })),
    pagination: { limit, offset, returned: res.rows.length },
  });
}
