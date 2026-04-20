import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Metadata } from "next";
import AdminNav from "../AdminNav";
import ExpansionClient, { type OpportunityRow, type Totals } from "./ExpansionClient";

export const metadata: Metadata = {
  title: "Expansión | Admin FLUX",
  robots: { index: false, follow: false },
};

interface PrefetchResult {
  tableMissing: boolean;
  opportunities: OpportunityRow[];
  totals: Totals | null;
  error: string | null;
}

async function prefetch(): Promise<PrefetchResult> {
  try {
    const { rows } = await query<OpportunityRow>(`
      SELECT
        o.id::text,
        o.user_id,
        o.score,
        o.temperature,
        o.play_type,
        o.play_reason,
        o.signals,
        o.suggested_mrr_delta::text AS suggested_mrr_delta,
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
      LIMIT 500
    `);

    const { rows: aggRows } = await query<Totals>(`
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
    `);

    return {
      tableMissing: false,
      opportunities: rows,
      totals: aggRows[0] ?? null,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist/i.test(msg) || /42P01/.test(msg)) {
      return {
        tableMissing: true,
        opportunities: [],
        totals: null,
        error: null,
      };
    }
    return {
      tableMissing: false,
      opportunities: [],
      totals: null,
      error: msg,
    };
  }
}

export default async function ExpansionPage() {
  const session = await requireAdmin();
  if (!session) redirect("/");

  const initial = await prefetch();

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Top bar */}
      <div className="bg-white border-b border-[#E5E5E5] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logoflux.svg" alt="FLUX" className="h-7 w-auto" />
          <span className="text-xs font-600 px-2 py-0.5 bg-[#1B4FFF] text-white rounded-full">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#999999] hidden sm:block">{session.email}</span>
          <a href="/" className="text-sm text-[#666666] hover:text-[#1B4FFF] transition-colors">← Sitio</a>
        </div>
      </div>

      <AdminNav />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-800 text-[#18191F]">Expansión 🎯</h1>
            <p className="text-sm text-[#999999] mt-0.5">
              Account Expansion Engine — upsell, bundle, seat adicional y renovación con upgrade sobre tu base activa.
            </p>
          </div>
        </div>

        <ExpansionClient
          initialTableMissing={initial.tableMissing}
          initialOpportunities={initial.opportunities}
          initialTotals={initial.totals}
          initialError={initial.error}
        />
      </div>
    </div>
  );
}
