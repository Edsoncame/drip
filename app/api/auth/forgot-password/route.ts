import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "flux-dev-secret-only-for-local"
);

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const tag = "[auth/forgot-password]";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: true }); // Don't reveal invalid email
    }

    const result = await query<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE email = $1",
      [email]
    );

    // Always return success to avoid user enumeration
    if (result.rows.length === 0) {
      console.log(`${tag} reset requested for unknown email (suppressed)`);
      return NextResponse.json({ ok: true });
    }

    const user = result.rows[0];

    const token = await new SignJWT({ userId: user.id, type: "reset" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(SECRET);

    const resetUrl = `${APP_URL}/auth/nueva-password?token=${token}`;

    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
    console.log(`${tag} reset email sent to user=${user.id}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} error`, err);
    return NextResponse.json({ error: "Error al enviar el correo" }, { status: 500 });
  }
}
