import { Pool } from "pg"

// Singleton pool — reused across requests in the same container
const globalForPg = globalThis as unknown as { pool: Pool | undefined }

export const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("railway.app")
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
  })

if (process.env.NODE_ENV !== "production") globalForPg.pool = pool

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(sql, params)
  return result.rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
