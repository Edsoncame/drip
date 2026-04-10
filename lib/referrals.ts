import { query } from "@/lib/db";

// Unambiguous chars — no O/0/I/1 confusion
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 7; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    const existing = await query("SELECT id FROM users WHERE referral_code = $1", [code]);
    if (existing.rows.length === 0) return code;
  }
  throw new Error("Could not generate unique referral code");
}

export async function applyReferralCode(
  referralCode: string,
  referredUserId: string
): Promise<{ ok: boolean; referrerId?: string }> {
  const referrer = await query<{ id: string }>(
    "SELECT id FROM users WHERE referral_code = $1",
    [referralCode.toUpperCase()]
  );

  if (referrer.rows.length === 0) return { ok: false };
  const referrerId = referrer.rows[0].id;
  if (referrerId === referredUserId) return { ok: false };

  // Record the referral (ignore duplicate errors)
  await query(
    `INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [referrerId, referredUserId]
  );

  // Tag the referred user
  await query(
    "UPDATE users SET referred_by_id = $1 WHERE id = $2 AND referred_by_id IS NULL",
    [referrerId, referredUserId]
  );

  return { ok: true, referrerId };
}
