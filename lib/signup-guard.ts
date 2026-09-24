/**
 * Signup guard — defensa del registro público contra altas automatizadas.
 *
 * Entre el 10 y el 24 de setiembre de 2026 entraron 67 cuentas basura por
 * `POST /api/auth/register`: nombres aleatorios, teléfonos +51 inventados y
 * correos de terceros reales. Cada alta disparaba el correo de bienvenida
 * desde hola@fluxperu.com — 62 llegaron a desconocidos — y empujaba el
 * contacto a Drop Chat. La cuenta de Resend es compartida con Atipay,
 * Drop Chat y Securex, así que la reputación del remitente es de los cuatro.
 *
 * Tres barreras, ninguna depende de un servicio externo:
 *  1. Límite por IP (ventana corta y ventana diaria).
 *  2. Campo trampa: los bots llenan todo lo que encuentran en el payload.
 *  3. Tiempo mínimo de llenado: nadie tipea el formulario en menos de 2.5 s.
 *
 * La cuarta barrera vive en el endpoint: exigir el bloque `legal`, que el
 * formulario sí manda y el payload de los bots actuales no trae.
 *
 * Schema bootstrap idempotente, mismo patrón que `lib/legal-acceptance.ts`.
 */

import { query } from "./db";

export const MAX_PER_IP_HOUR = 3;
export const MAX_PER_IP_DAY = 10;
const MIN_FILL_MS = 2500;
/** Un formulario abierto hace más de 6 h ya no sirve como prueba de vida. */
const MAX_FILL_MS = 6 * 60 * 60 * 1000;

let schemaReady = false;

export async function ensureSignupGuardSchema(): Promise<void> {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS signup_attempts (
      id BIGSERIAL PRIMARY KEY,
      ip_address TEXT,
      email TEXT,
      outcome TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip
     ON signup_attempts(ip_address, created_at DESC);`,
  );
  schemaReady = true;
}

export function clientIpFrom(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}

export async function recordSignupAttempt(input: {
  ip: string | null;
  email: string | null;
  outcome: string;
  userAgent: string | null;
}): Promise<void> {
  try {
    await ensureSignupGuardSchema();
    await query(
      `INSERT INTO signup_attempts (ip_address, email, outcome, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [input.ip, input.email?.toLowerCase() ?? null, input.outcome, input.userAgent?.slice(0, 300) ?? null],
    );
  } catch (err) {
    // El registro de auditoría nunca debe tumbar un alta legítima.
    console.error("[signup-guard] no se pudo anotar el intento:", err);
  }
}

/**
 * Cuenta las altas exitosas de esa IP. Solo miramos las que terminaron en
 * cuenta creada: un bot que rebota contra el guard no se castiga dos veces,
 * y un cliente que se equivoca tres veces al tipear tampoco queda fuera.
 */
export async function isRateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  try {
    await ensureSignupGuardSchema();
    const res = await query<{ ultima_hora: string; ultimo_dia: string }>(
      `SELECT
         count(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')  AS ultima_hora,
         count(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day')   AS ultimo_dia
       FROM signup_attempts
       WHERE ip_address = $1 AND outcome = 'created'`,
      [ip],
    );
    const row = res.rows[0];
    if (!row) return false;
    return Number(row.ultima_hora) >= MAX_PER_IP_HOUR || Number(row.ultimo_dia) >= MAX_PER_IP_DAY;
  } catch (err) {
    // Si la consulta falla, dejamos pasar: preferimos un alta de más que
    // cerrarle la puerta a un cliente por un problema nuestro.
    console.error("[signup-guard] no se pudo consultar el límite:", err);
    return false;
  }
}

/** El campo trampa va oculto en el formulario: una persona nunca lo llena. */
export function looksAutomated(body: Record<string, unknown>): boolean {
  const trap = body.website;
  return typeof trap === "string" && trap.trim().length > 0;
}

/**
 * El formulario manda cuándo se abrió. Un envío instantáneo, o sin el dato,
 * no viene de alguien tipeando en la pantalla.
 */
export function filledTooFast(formOpenedAt: unknown): boolean {
  if (typeof formOpenedAt !== "number" || !Number.isFinite(formOpenedAt)) return true;
  const elapsed = Date.now() - formOpenedAt;
  return elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS;
}
