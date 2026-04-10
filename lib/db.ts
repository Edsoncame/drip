import { Pool, QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

let _resolvedPool: Pool | undefined;

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
  } catch (e1) {
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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  const pool = await resolvePool();
  return pool.query<T>(text, params);
}
