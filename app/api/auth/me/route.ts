import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase());

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const result = await query<{
    id: string; name: string; email: string; company: string; phone: string;
    ruc: string | null; dni_number: string | null; identity_verified: boolean | null;
  }>(
    "SELECT id, name, email, company, phone, ruc, dni_number, identity_verified FROM users WHERE id = $1",
    [session.userId]
  );

  const user = result.rows[0];
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
  return NextResponse.json({ user: { ...user, isAdmin } });
}
