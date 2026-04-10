import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const tag = "[auth/google]";

export async function GET(req: NextRequest) {
  if (!GOOGLE_CLIENT_ID) {
    console.warn(`${tag} GOOGLE_CLIENT_ID not set`);
    return NextResponse.json({ error: "Google OAuth no configurado" }, { status: 503 });
  }
  console.log(`${tag} initiating OAuth flow`);

  // CSRF state — random nonce stored in short-lived cookie
  const state = randomBytes(16).toString("hex");

  // Optional redirect after login
  const redirect = req.nextUrl.searchParams.get("redirect") ?? "/";

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    state,
    prompt: "select_account",
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );

  // Store state + redirect destination in cookies (expire in 10 min)
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  res.cookies.set("oauth_redirect", redirect, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return res;
}
