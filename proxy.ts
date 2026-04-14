/**
 * Edge middleware de FLUX (en Next.js 16 se llama `proxy.ts` en lugar de
 * `middleware.ts`).
 *
 * Se ejecuta ANTES de que la request llegue al server component / route
 * handler, en el **Edge Runtime** de Vercel. Eso significa:
 *   - Sin acceso directo a Postgres (`pg` no funciona en Edge).
 *   - Sin filesystem.
 *   - Sin la mayoría de Node APIs.
 *   - Latencia muy baja (corre cerca del usuario).
 *
 * Lo único que SÍ podemos hacer es leer cookies y verificar el JWT con `jose`,
 * que sí es Edge-compatible.
 *
 * Por eso el flag `isAdmin` viaja DENTRO del JWT: así el proxy puede decidir
 * si dejar pasar al usuario sin tocar la base de datos.
 *
 * Rutas protegidas:
 *   - `/admin/*`           solo admins
 *   - `/cuenta/*`          solo usuarios autenticados
 *   - `/api/subscriptions` solo usuarios autenticados
 */
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
    return payload as {
      userId: string;
      email: string;
      name: string;
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
    };
  } catch {
    return null;
  }
}

// Legacy bootstrap: only used for users whose JWT was issued before the
// is_admin column existed. Real admin check happens in requireAdmin() (Node runtime).
const LEGACY_ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Protect /admin ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    // Allow if JWT has isAdmin claim (new flow) OR legacy env var match
    const isAdmin = session.isAdmin === true || LEGACY_ADMIN_EMAILS.includes(session.email.toLowerCase());
    if (!isAdmin) {
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
