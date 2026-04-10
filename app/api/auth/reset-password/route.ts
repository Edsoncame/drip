import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "flux-dev-secret-only-for-local"
);

const tag = "[auth/reset-password]";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body as { token?: string; password?: string };

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    let payload;
    try {
      ({ payload } = await jwtVerify(token, SECRET));
    } catch (err) {
      console.warn(`${tag} invalid or expired token`, err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
    }

    if (payload.type !== "reset" || !payload.userId) {
      console.warn(`${tag} token missing type/userId`, { type: payload.type });
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, payload.userId]);
    console.log(`${tag} password updated for user=${payload.userId}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} unexpected error`, err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
