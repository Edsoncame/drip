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
  }>(
    "SELECT id, name, email, company, phone FROM users WHERE id = $1",
    [session.userId]
  );

  const user = result.rows[0];
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
