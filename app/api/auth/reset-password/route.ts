import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "flux-dev-secret");

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const { payload } = await jwtVerify(token, SECRET);
    if (payload.type !== "reset" || !payload.userId) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, payload.userId]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
  }
}
