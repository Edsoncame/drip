import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { upsertExpense, deleteExpense } from "@/lib/finance-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = "[admin/finance-expenses]";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    provider_slug?: string;
    period?: string;
    amount_usd?: number | string;
    amount_pen?: number | string;
    invoice_url?: string;
    notes?: string;
    paid_at?: string;
  };

  if (!body.provider_slug || !body.period || !/^\d{4}-\d{2}$/.test(body.period)) {
    return NextResponse.json(
      { error: "provider_slug + period (YYYY-MM) requeridos" },
      { status: 400 },
    );
  }

  const amountUsd = body.amount_usd !== undefined && body.amount_usd !== "" ? Number(body.amount_usd) : null;
  const amountPen = body.amount_pen !== undefined && body.amount_pen !== "" ? Number(body.amount_pen) : null;

  if (amountUsd === null && amountPen === null) {
    return NextResponse.json({ error: "amount_usd o amount_pen requerido" }, { status: 400 });
  }

  const row = await upsertExpense({
    provider_slug: body.provider_slug,
    period: body.period,
    amount_usd: amountUsd,
    amount_pen: amountPen,
    source: "manual",
    invoice_url: body.invoice_url?.trim() || null,
    notes: body.notes?.trim() || null,
    paid_at: body.paid_at ? new Date(body.paid_at) : null,
  });

  console.log(`${tag} ${session.email} upsert ${body.provider_slug} ${body.period} usd=${amountUsd} pen=${amountPen}`);
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  await deleteExpense(id);
  console.log(`${tag} ${session.email} deleted expense id=${id}`);
  return NextResponse.json({ ok: true });
}
