/**
 * Cliente de PostgreSQL para FLUX.
 *
 * Provee una única función `query(...)` que cualquier server component o route
 * handler puede usar. Internamente mantiene un Pool de conexiones reutilizable
 * para no crear conexiones nuevas en cada request.
 *
 * Por qué la lógica de SSL es "perezosa":
 * - Railway acepta conexiones SIN SSL en su proxy interno
 * - Pero también ofrece conexiones CON SSL (con certs autofirmados)
 * - No queremos hardcodear cuál usar — probamos primero sin SSL, y si falla
 *   reintenta con SSL (rejectUnauthorized:false para aceptar el cert self-signed)
 * - Una vez que sabemos cuál funciona, cacheamos el Pool y reutilizamos
 *
 * En desarrollo guardamos el pool en `globalThis._pgPool` para que sobreviva
 * a hot-reloads de Next.js (sin esto cada cambio de archivo abriría conexiones
 * nuevas y agotaría el límite del DB).
 */
import { Pool, QueryResultRow } from "pg";

// Permite cachear el pool en `globalThis` para que hot-reload de Next.js no
// cree conexiones nuevas en cada cambio de archivo durante desarrollo.
declare global {
   
  var _pgPool: Pool | undefined;
}

let _resolvedPool: Pool | undefined;

/**
 * Devuelve el Pool resuelto, probando primero sin SSL y luego con SSL.
 * Esta función solo se ejecuta una vez por proceso (después está cacheada).
 */
async function resolvePool(): Promise<Pool> {
  if (_resolvedPool) return _resolvedPool;
  if (globalThis._pgPool) {
    _resolvedPool = globalThis._pgPool;
    return _resolvedPool;
  }

  // Try without SSL first — Railway's PostgreSQL proxy often rejects SSL
  const noSslPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    max: 5,
  });

  try {
    await noSslPool.query("SELECT 1");
    _resolvedPool = noSslPool;
    if (process.env.NODE_ENV !== "production") globalThis._pgPool = noSslPool;
    return noSslPool;
  } catch {
    await noSslPool.end().catch(() => {});

    // Fallback: try with SSL (rejectUnauthorized:false for self-signed certs)
    const sslPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
    await sslPool.query("SELECT 1"); // throws if also fails
    _resolvedPool = sslPool;
    if (process.env.NODE_ENV !== "production") globalThis._pgPool = sslPool;
    return sslPool;
  }
}

/**
 * Ejecuta una query parametrizada contra Postgres.
 *
 * Usar siempre con parámetros (`$1`, `$2`, ...) — nunca interpolar strings,
 * porque eso abre la puerta a SQL injection.
 *
 * @example
 *   const result = await query(
 *     "SELECT id, name FROM users WHERE email = $1",
 *     ["user@example.com"]
 *   );
 *   const user = result.rows[0];
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  const pool = await resolvePool();
  return pool.query<T>(text, params);
}
