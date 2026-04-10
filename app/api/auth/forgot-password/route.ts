import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "flux-dev-secret");

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

    const result = await query<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    // Always return success to avoid user enumeration
    if (result.rows.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const user = result.rows[0];

    // Create a short-lived reset token (1h)
    const token = await new SignJWT({ userId: user.id, type: "reset" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(SECRET);

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/nueva-password?token=${token}`;

    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("forgot-password error:", err);
    return NextResponse.json({ error: "Error al enviar el correo" }, { status: 500 });
  }
}
