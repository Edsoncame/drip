/**
 * Sistema de autenticación de FLUX.
 *
 * Usa JWT firmado con HMAC-SHA256 (algoritmo HS256) almacenado en una cookie
 * httpOnly. Esto evita que JavaScript del navegador pueda leer la cookie
 * (mitigación contra XSS) y la cookie viaja en cada request automáticamente.
 *
 * Modelo de roles:
 *   - Usuario normal:    is_admin = false
 *   - Administrador:     is_admin = true
 *   - Super admin:       is_admin = true && is_super_admin = true
 *
 * El JWT incluye los claims `isAdmin` y `isSuperAdmin` para que el middleware
 * de Edge (proxy.ts) pueda verificarlos sin tocar la base de datos. Los server
 * components y route handlers usan `requireAdmin()` que consulta la DB en
 * tiempo real para tener el estado más reciente.
 *
 * Importante: si un usuario es promovido o degradado mientras tiene una sesión
 * activa, su JWT seguirá teniendo los claims viejos hasta que cierre sesión y
 * vuelva a iniciar. El check en `requireAdmin()` lo corrige porque siempre
 * lee de la DB.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "./db";

// ─── Configuración ─────────────────────────────────────────────────────────

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET env var is required in production");
}
// Encoded como Uint8Array porque jose requiere bytes, no strings
const SECRET = new TextEncoder().encode(jwtSecret ?? "flux-dev-secret-only-for-local");

const COOKIE_NAME = "flux_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Datos que viven dentro del JWT (claims). */
export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

/** Sesión enriquecida con el flag de admin garantizado en `true`. */
export interface AdminSession extends SessionPayload {
  isAdmin: true;
  isSuperAdmin: boolean;
}

// ─── Firma y verificación de JWT ────────────────────────────────────────────

/**
 * Genera un JWT firmado con los datos de la sesión.
 * Se llama desde `/api/auth/login` y `/api/auth/register`.
 */
export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

/**
 * Verifica un JWT y devuelve los claims si es válido.
 * Devuelve null si el token está expirado, mal firmado o ausente.
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Lectura de la sesión actual ────────────────────────────────────────────

/**
 * Lee la cookie del request actual y devuelve los datos del usuario si está
 * autenticado. Solo funciona en server components y route handlers (Node).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── Verificación de admin ──────────────────────────────────────────────────

/**
 * Lista de emails que se aceptan como super admin SIN consultar la DB.
 * Es un fallback histórico: antes de que existiera la columna `is_admin`
 * en `users`, los admins se identificaban únicamente por su email en esta
 * variable de entorno.
 *
 * Uso recomendado: dejar solo el email del super admin original como
 * "rescue access" en caso de que alguien borre accidentalmente todos los
 * admins de la DB.
 */
const LEGACY_ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Devuelve la sesión enriquecida si el usuario actual es admin, o null si no.
 *
 * **IMPORTANTE: consulta por `userId`, no por email.** Esto es deliberado:
 *   - Los emails pueden cambiarse desde el panel de admin (`/admin/usuarios`).
 *   - El JWT del usuario puede tener un email "viejo" hasta que cierre sesión.
 *   - El `userId` (UUID) en cambio nunca cambia.
 *
 * Si el usuario no está en la DB pero su email está en `ADMIN_EMAILS` (legacy),
 * lo aceptamos como super admin para evitar lockouts.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  const session = await getSession();
  if (!session) return null;

  const result = await query<{ email: string; is_admin: boolean; is_super_admin: boolean }>(
    `SELECT email, is_admin, is_super_admin FROM users WHERE id = $1`,
    [session.userId]
  );
  const row = result.rows[0];

  if (row?.is_admin) {
    return {
      ...session,
      email: row.email, // siempre devolver el email actual de la DB
      isAdmin: true,
      isSuperAdmin: row.is_super_admin,
    };
  }

  // Bootstrap legacy: si el usuario está en ADMIN_EMAILS, se le da acceso
  // total aunque la DB no lo reconozca como admin.
  if (LEGACY_ADMIN_EMAILS.includes(session.email.toLowerCase())) {
    return { ...session, isAdmin: true, isSuperAdmin: true };
  }

  return null;
}

// ─── Helpers para set/clear de la cookie ────────────────────────────────────

/**
 * Devuelve las opciones de la cookie de sesión para `cookies().set(...)`.
 * Se usa en login y register después de generar el token.
 */
export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  };
}

/**
 * Devuelve las opciones para limpiar la cookie en el logout.
 */
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
