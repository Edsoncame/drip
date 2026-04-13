import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const result = await query<{
    id: string; name: string; email: string; company: string; phone: string;
    ruc: string | null; dni_number: string | null; identity_verified: boolean | null;
    is_admin: boolean;
  }>(
    "SELECT id, name, email, company, phone, ruc, dni_number, identity_verified, is_admin FROM users WHERE id = $1",
    [session.userId]
  );

  const user = result.rows[0];
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: { ...user, isAdmin: user.is_admin } });
}
