import { Pool } from "pg"

const globalForPg = globalThis as unknown as { pool: Pool | undefined }

const connectionString =
  process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL

const isRemote =
  connectionString &&
  !connectionString.includes("localhost") &&
  !connectionString.includes("127.0.0.1")

export const pool =
  globalForPg.pool ??
  new Pool({
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
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
