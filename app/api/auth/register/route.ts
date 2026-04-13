import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { generateUniqueReferralCode, applyReferralCode } from "@/lib/referrals";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, company, ruc, phone, referralCode, dniNumber, dniPhoto, selfiePhoto } = await req.json();

    // Validate
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Nombre, email y contraseña son requeridos" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    // Check duplicate
    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
    }

    // Hash & insert
    const passwordHash = await bcrypt.hash(password, 12);
    const myReferralCode = await generateUniqueReferralCode();

    const result = await query<{ id: string; name: string; email: string }>(
      `INSERT INTO users (name, email, password_hash, company, ruc, phone, referral_code, dni_number, dni_photo_url, selfie_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, email`,
      [name.trim(), email.toLowerCase(), passwordHash, company?.trim() || null, ruc?.trim() || null, phone?.trim() || null, myReferralCode, dniNumber?.trim() || null, dniPhoto || null, selfiePhoto || null]
    );

    const user = result.rows[0];

    // Apply incoming referral code if provided
    if (referralCode?.trim()) {
      await applyReferralCode(referralCode.trim(), user.id).catch(() => {
        // Non-fatal — don't block registration
      });
    }

    const token = await signToken({ userId: user.id, email: user.email, name: user.name });

    // Non-blocking welcome email
    sendWelcomeEmail({ to: user.email, name: user.name, referralCode: myReferralCode }).catch(() => {});

    const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Error al crear la cuenta. Intenta de nuevo." }, { status: 500 });
  }
}
