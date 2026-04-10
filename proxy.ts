import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "flux-dev-secret-only-for-local"
);

const COOKIE_NAME = "flux_session";

async function getSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { userId: string; email: string; name: string };
  } catch {
    return null;
  }
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Protect /admin ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const session = await getSessionFromRequest(req);
    if (!session || !ADMIN_EMAILS.includes(session.email.toLowerCase())) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // ── Protect /cuenta/* ───────────────────────────────────────────────────────
  if (pathname.startsWith("/cuenta")) {
    const session = await getSessionFromRequest(req);
    if (!session) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── Protect /api/subscriptions/* ────────────────────────────────────────────
  if (pathname.startsWith("/api/subscriptions")) {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ["/admin(.*)", "/cuenta(.*)", "/api/subscriptions(.*)"],
};
