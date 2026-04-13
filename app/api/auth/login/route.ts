import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }

    const result = await query<{
      id: string; name: string; email: string; password_hash: string;
      is_admin: boolean; is_super_admin: boolean;
    }>(
      "SELECT id, name, email, password_hash, is_admin, is_super_admin FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    const user = result.rows[0];

    // Constant-time comparison to avoid timing attacks
    const validPassword = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, "$2b$12$invalidhashfortimingreasons");

    if (!user || !validPassword) {
      return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.is_admin,
      isSuperAdmin: user.is_super_admin,
    });

    const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Error al iniciar sesión. Intenta de nuevo." }, { status: 500 });
  }
}
