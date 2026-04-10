import { Pool, QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool() {
  const isLocal = process.env.DATABASE_URL?.includes("localhost") ||
                  process.env.DATABASE_URL?.includes("127.0.0.1") ||
                  process.env.DATABASE_URL?.includes("railway.internal");
  // DATABASE_SSL=false → disable SSL (for Railway proxies that don't support it)
  // DATABASE_SSL=true  → force SSL with rejectUnauthorized:false
  // default            → SSL for non-local connections
  const sslEnv = process.env.DATABASE_SSL;
  const useSSL = sslEnv === "false" ? false
               : isLocal ? false
               : { rejectUnauthorized: false };

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL,
    max: 10,
  });
}

// Re-use pool across hot reloads in dev
const pool = globalThis._pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis._pgPool = pool;

export default pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  const result = await pool.query<T>(text, params);
  return result;
}
