import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { refreshExpansionOpportunities } from "@/lib/expansion-engine";

/**
 * /api/admin/expansion
 * --------------------
 * GET  → lista oportunidades (filtrable por ?status= &temperature= &limit=)
 *        con JOIN a users para incluir name/email/company/phone.
 *
 * POST → dispara refreshExpansionOpportunities() (compute + upsert).
 *        Devuelve { detected, inserted, updated }.
 *
 * Ambos protegidos con requireAdmin().
 *
 * Nota: si la tabla todavía no existe, las queries fallan con 42P01.
 * El cliente UI puede mostrar un CTA "Ejecutar migración"
 * apuntando a POST /api/admin/expansion/migrate.
 */

const tag = "[admin/expansion]";

const VALID_STATUSES = ["new", "contacted", "in_conversation", "won", "lost", "snoozed"] as const;
const VALID_TEMPERATURES = ["hot", "warm", "cold"] as const;

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status"); // csv o single
  const temperature = url.searchParams.get("temperature");
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number.parseInt(limitRaw ?? "200", 10) || 200, 1), 500);

  const where: string[] = [];
  const vals: (string | number | string[])[] = [];
  let idx = 1;

  if (statusParam) {
    const statuses = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is typeof VALID_STATUSES[number] =>
        (VALID_STATUSES as readonly string[]).includes(s)
      );
    if (statuses.length > 0) {
      where.push(`o.status = ANY($${idx}::text[])`);
      vals.push(statuses);
      idx++;
    }
  }

  if (temperature && (VALID_TEMPERATURES as readonly string[]).includes(temperature)) {
    where.push(`o.temperature = $${idx}`);
    vals.push(temperature);
    idx++;
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const { rows } = await query<{
      id: string;
      user_id: string;
      score: number;
      temperature: string;
      play_type: string;
      play_reason: string;
      signals: unknown;
      suggested_mrr_delta: string | null;
      status: string;
      contacted_at: string | null;
      won_at: string | null;
      lost_reason: string | null;
      snoozed_until: string | null;
      admin_notes: string | null;
      created_at: string;
      updated_at: string;
      user_name: string;
      user_email: string;
      user_company: string | null;
      user_phone: string | null;
      user_ruc: string | null;
    }>(
      `
      SELECT
        o.id::text,
        o.user_id,
        o.score,
        o.temperature,
        o.play_type,
        o.play_reason,
        o.signals,
        o.suggested_mrr_delta,
        o.status,
        o.contacted_at,
        o.won_at,
        o.lost_reason,
        o.snoozed_until,
        o.admin_notes,
        o.created_at,
        o.updated_at,
        u.name    AS user_name,
        u.email   AS user_email,
        u.company AS user_company,
        u.phone   AS user_phone,
        u.ruc     AS user_ruc
      FROM expansion_opportunities o
      JOIN users u ON u.id = o.user_id
      ${whereSql}
      ORDER BY
        CASE o.status
          WHEN 'new' THEN 0
          WHEN 'contacted' THEN 1
          WHEN 'in_conversation' THEN 2
          WHEN 'snoozed' THEN 3
          WHEN 'won' THEN 4
          WHEN 'lost' THEN 5
          ELSE 6
        END,
        o.score DESC,
        o.created_at DESC
      LIMIT $${idx}
      `,
      [...vals, limit]
    );

    // Aggregate totals (sin filtros, siempre sobre el set completo)
    const { rows: agg } = await query<{
      total: string;
      hot: string;
      warm: string;
      cold: string;
      open: string;
      won: string;
      lost: string;
      potential_mrr: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE temperature = 'hot')::text  AS hot,
        COUNT(*) FILTER (WHERE temperature = 'warm')::text AS warm,
        COUNT(*) FILTER (WHERE temperature = 'cold')::text AS cold,
        COUNT(*) FILTER (WHERE status IN ('new','contacted','in_conversation'))::text AS open,
        COUNT(*) FILTER (WHERE status = 'won')::text  AS won,
        COUNT(*) FILTER (WHERE status = 'lost')::text AS lost,
        COALESCE(SUM(suggested_mrr_delta) FILTER (WHERE status IN ('new','contacted','in_conversation')), 0)::text AS potential_mrr
      FROM expansion_opportunities
      `
    );

    return NextResponse.json({
      ok: true,
      opportunities: rows,
      totals: agg[0] ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 42P01 = undefined_table. Devolvemos 409 con hint para que la UI muestre el CTA de migración.
    if (/relation .* does not exist/i.test(msg) || /42P01/.test(msg)) {
      return NextResponse.json(
        {
          error: "La tabla expansion_opportunities no existe todavía.",
          code: "TABLE_MISSING",
          hint: "POST /api/admin/expansion/migrate para crearla.",
        },
        { status: 409 }
      );
    }
    console.error(`${tag} GET failed:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const result = await refreshExpansionOpportunities();
    console.log(
      `${tag} ${session.email} refresh — detected=${result.detected} inserted=${result.inserted} updated=${result.updated}`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist/i.test(msg) || /42P01/.test(msg)) {
      return NextResponse.json(
        {
          error: "La tabla expansion_opportunities no existe todavía.",
          code: "TABLE_MISSING",
          hint: "POST /api/admin/expansion/migrate para crearla.",
        },
        { status: 409 }
      );
    }
    console.error(`${tag} POST refresh failed:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
