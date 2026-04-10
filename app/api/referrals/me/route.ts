import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

const tag = "[referrals/me]";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    // Get my referral code
    const userRow = await query<{ referral_code: string | null }>(
      "SELECT referral_code FROM users WHERE id = $1",
      [session.userId]
    );
    const referralCode = userRow.rows[0]?.referral_code ?? null;

    // Count how many people I referred
    const statsRow = await query<{ total: string; rewarded: string }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'rewarded') AS rewarded
       FROM referrals
       WHERE referrer_id = $1`,
      [session.userId]
    );

    const total = parseInt(statsRow.rows[0]?.total ?? "0", 10);
    const rewarded = parseInt(statsRow.rows[0]?.rewarded ?? "0", 10);

    // Get the list of referred users (name + date)
    const referredRows = await query<{ name: string; created_at: string; status: string }>(
      `SELECT u.name, r.created_at, r.status
       FROM referrals r
       JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [session.userId]
    );

    console.log(`${tag} user=${session.userId} code=${referralCode} total=${total}`);

    return NextResponse.json({
      referralCode,
      stats: { total, rewarded },
      referred: referredRows.rows,
    });
  } catch (err) {
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: "Error al cargar referidos" }, { status: 500 });
  }
}
