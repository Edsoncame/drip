import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { generateUniqueReferralCode, applyReferralCode } from "@/lib/referrals";
import { sendWelcomeEmail, safeSend } from "@/lib/email";
import { fireSyncToDropchat } from "@/lib/dropchat-sync";
import { ensureLegalSchema, recordLegalAcceptance } from "@/lib/legal-acceptance";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, company, ruc, phone, referralCode, legal } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Nombre, email y contraseña son requeridos" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const myReferralCode = await generateUniqueReferralCode();

    // KYC no se pide en registro — se valida al alquilar. kyc_status default 'pending'.
    const result = await query<{ id: string; name: string; email: string }>(
      `INSERT INTO users (name, email, password_hash, company, ruc, phone, referral_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email`,
      [
        name.trim(),
        email.toLowerCase(),
        passwordHash,
        company?.trim() || null,
        ruc?.trim() || null,
        phone?.trim() || null,
        myReferralCode,
      ]
    );

    const user = result.rows[0];

    if (referralCode?.trim()) {
      await applyReferralCode(referralCode.trim(), user.id).catch(() => {});
    }

    const token = await signToken({ userId: user.id, email: user.email, name: user.name });

    void safeSend("auth_register_welcome", () =>
      sendWelcomeEmail({ to: user.email, name: user.name, referralCode: myReferralCode }),
    );

    // Drop Chat sync real-time — nuevo cliente
    fireSyncToDropchat(user.id);

    // Auditoría legal: registrar la aceptación del TyC v2 + firma digital +
    // autorización del pagaré incompleto. Si falla, no bloqueamos el signup —
    // el cliente sigue registrado pero la auditoría queda vacía y el log lo
    // captura para revisión humana.
    if (legal && legal.accepted) {
      await ensureLegalSchema().catch(() => {});
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null;
      await recordLegalAcceptance({
        userId: user.id,
        termsVersion: legal.terms_version || "2026-04-28",
        signatureName: legal.signature_name || name,
        signatureDocument: legal.signature_document || ruc || null,
        scrollCompleted: !!legal.scroll_completed,
        pagareAuthorized: !!legal.pagare_authorized,
        ipAddress: ip,
        userAgent: legal.user_agent || req.headers.get("user-agent") || null,
        signedAt: legal.signed_at ? new Date(legal.signed_at) : new Date(),
      }).catch((err) => {
        console.error("[register] legal acceptance log failed:", err);
      });
    }

    const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Error al crear la cuenta. Intenta de nuevo." }, { status: 500 });
  }
}
