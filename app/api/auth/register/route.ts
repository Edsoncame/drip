import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { generateUniqueReferralCode, applyReferralCode } from "@/lib/referrals";
import { sendWelcomeEmail, safeSend } from "@/lib/email";
import { fireSyncToDropchat } from "@/lib/dropchat-sync";
import { ensureLegalSchema, recordLegalAcceptance } from "@/lib/legal-acceptance";
import {
  clientIpFrom,
  filledTooFast,
  isRateLimited,
  looksAutomated,
  recordSignupAttempt,
} from "@/lib/signup-guard";

/** Mensaje único para todo lo que huele a alta automatizada: no le damos
 *  pistas al bot sobre cuál barrera lo frenó. */
const BLOCKED = "No pudimos crear la cuenta. Escríbenos a hola@fluxperu.com y te ayudamos.";

export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req.headers);
  const userAgent = req.headers.get("user-agent");

  try {
    const body = await req.json();
    const { name, email, password, company, ruc, phone, referralCode, legal, formOpenedAt } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Nombre, email y contraseña son requeridos" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    // El teléfono ya se validaba en pantalla; ahora también acá, porque los
    // bots no pasan por la pantalla.
    if (!/^\+\d{7,15}$/.test(String(phone ?? "").trim())) {
      return NextResponse.json({ error: "Ingresa un teléfono válido con código de país" }, { status: 400 });
    }

    // --- Barreras contra altas automatizadas -------------------------------
    if (looksAutomated(body) || filledTooFast(formOpenedAt)) {
      await recordSignupAttempt({ ip, email, outcome: "blocked_bot", userAgent });
      return NextResponse.json({ error: BLOCKED }, { status: 400 });
    }

    // Aceptación de términos: obligatoria y, de paso, es lo que separa al
    // formulario real de un POST armado a mano.
    if (!legal?.accepted) {
      await recordSignupAttempt({ ip, email, outcome: "blocked_sin_legal", userAgent });
      return NextResponse.json(
        { error: "Debes aceptar los Términos de servicio y la Política de privacidad" },
        { status: 400 },
      );
    }

    if (await isRateLimited(ip)) {
      await recordSignupAttempt({ ip, email, outcome: "blocked_rate", userAgent });
      return NextResponse.json(
        { error: "Ya se crearon varias cuentas desde esta conexión. Escríbenos a hola@fluxperu.com y te ayudamos." },
        { status: 429 },
      );
    }
    // -----------------------------------------------------------------------

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
    await recordSignupAttempt({ ip, email, outcome: "created", userAgent });

    if (referralCode?.trim()) {
      await applyReferralCode(referralCode.trim(), user.id).catch(() => {});
    }

    const token = await signToken({ userId: user.id, email: user.email, name: user.name });

    void safeSend("auth_register_welcome", () =>
      sendWelcomeEmail({ to: user.email, name: user.name, referralCode: myReferralCode }),
    );

    // Drop Chat sync real-time — nuevo cliente
    fireSyncToDropchat(user.id);

    // Auditoría legal: registrar la aceptación del TyC + firma digital +
    // autorización del pagaré incompleto. Si falla, no bloqueamos el signup —
    // el cliente sigue registrado pero la auditoría queda vacía y el log lo
    // captura para revisión humana.
    await ensureLegalSchema().catch(() => {});
    await recordLegalAcceptance({
      userId: user.id,
      termsVersion: legal.terms_version || "2026-04-28",
      signatureName: legal.signature_name || name,
      signatureDocument: legal.signature_document || ruc || null,
      scrollCompleted: !!legal.scroll_completed,
      pagareAuthorized: !!legal.pagare_authorized,
      ipAddress: ip,
      userAgent: legal.user_agent || userAgent || null,
      signedAt: legal.signed_at ? new Date(legal.signed_at) : new Date(),
    }).catch((err) => {
      console.error("[register] legal acceptance log failed:", err);
    });

    const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Error al crear la cuenta. Intenta de nuevo." }, { status: 500 });
  }
}
