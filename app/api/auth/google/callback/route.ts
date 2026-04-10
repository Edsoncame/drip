import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { signToken, sessionCookieOptions } from "@/lib/auth";

const tag = "[auth/google/callback]";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  error?: string;
}

interface GoogleUserInfo {
  sub: string;       // Google user ID
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  // User denied access
  if (errorParam) {
    console.warn(`${tag} user denied access: ${errorParam}`);
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // CSRF state check
  const storedState = req.cookies.get("oauth_state")?.value;
  const redirect = req.cookies.get("oauth_redirect")?.value ?? "/";

  if (!code || !state || state !== storedState) {
    console.warn(`${tag} state mismatch or missing code`);
    return NextResponse.redirect(new URL("/auth/login?error=oauth", req.url));
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error(`${tag} missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET`);
    return NextResponse.redirect(new URL("/auth/login?error=config", req.url));
  }

  try {
    // 1 — Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens: GoogleTokenResponse = await tokenRes.json();
    if (tokens.error || !tokens.access_token) {
      console.error(`${tag} token exchange failed`, tokens.error);
      return NextResponse.redirect(new URL("/auth/login?error=oauth", req.url));
    }

    // 2 — Get user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser: GoogleUserInfo = await userInfoRes.json();

    if (!googleUser.email || !googleUser.email_verified) {
      console.warn(`${tag} unverified or missing email sub=${googleUser.sub}`);
      return NextResponse.redirect(new URL("/auth/login?error=email", req.url));
    }

    // 3 — Find or create user in DB
    const email = googleUser.email.toLowerCase();
    const existing = await query<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE email = $1",
      [email]
    );

    let user: { id: string; name: string; email: string };

    if (existing.rows.length > 0) {
      // Existing user — log them in
      user = existing.rows[0];
      console.log(`${tag} existing user signed in via Google id=${user.id}`);
    } else {
      // New user — create account (no password_hash, Google-only)
      const created = await query<{ id: string; name: string; email: string }>(
        `INSERT INTO users (name, email, password_hash, google_id, avatar_url)
         VALUES ($1, $2, NULL, $3, $4)
         RETURNING id, name, email`,
        [googleUser.name, email, googleUser.sub, googleUser.picture ?? null]
      );
      user = created.rows[0];
      console.log(`${tag} new user created via Google id=${user.id}`);
    }

    // 4 — Issue session cookie
    const token = await signToken({ userId: user.id, email: user.email, name: user.name });
    const res = NextResponse.redirect(new URL(redirect, req.url));
    res.cookies.set(sessionCookieOptions(token));

    // Clear OAuth state cookies
    res.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
    res.cookies.set("oauth_redirect", "", { maxAge: 0, path: "/" });

    return res;
  } catch (err) {
    console.error(`${tag} unexpected error`, err);
    return NextResponse.redirect(new URL("/auth/login?error=server", req.url));
  }
}
