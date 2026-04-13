import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "./db";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET env var is required in production");
}
const SECRET = new TextEncoder().encode(jwtSecret ?? "flux-dev-secret-only-for-local");

const COOKIE_NAME = "flux_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE,
    path: "/",
  };
}

/**
 * Returns admin session if current user is admin, otherwise null.
 * Admin status is stored in users.is_admin (DB). Legacy ADMIN_EMAILS env var
 * is used as bootstrap fallback (so the first super admin can sign in before
 * the DB column was added).
 */
const LEGACY_ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export interface AdminSession extends SessionPayload {
  isAdmin: true;
  isSuperAdmin: boolean;
}

export async function requireAdmin(): Promise<AdminSession | null> {
  const session = await getSession();
  if (!session) return null;

  // Query by userId (JWT may have stale email if user renamed since login)
  const result = await query<{ email: string; is_admin: boolean; is_super_admin: boolean }>(
    `SELECT email, is_admin, is_super_admin FROM users WHERE id = $1`,
    [session.userId]
  );
  const row = result.rows[0];

  if (row?.is_admin) {
    return {
      ...session,
      email: row.email, // fresh email from DB
      isAdmin: true,
      isSuperAdmin: row.is_super_admin,
    };
  }
  // Legacy bootstrap via env var (before is_admin column existed)
  if (LEGACY_ADMIN_EMAILS.includes(session.email.toLowerCase())) {
    return { ...session, isAdmin: true, isSuperAdmin: true };
  }
  return null;
}

export function clearCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  };
}
