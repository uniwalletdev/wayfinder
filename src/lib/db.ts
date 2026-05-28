import { Pool } from "pg"
import { slog } from "./logger"

const globalForPg = globalThis as unknown as { pool: Pool | undefined }

const connectionString =
  process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL

if (!connectionString) {
  slog.error("db", "No DATABASE_URL / DATABASE_PUBLIC_URL set — DB calls will fail")
}

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

pool.on("error", (err) => slog.error("db.pool", err))

if (process.env.NODE_ENV !== "production") globalForPg.pool = pool

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now()
  try {
    const result = await pool.query(sql, params)
    const ms = Date.now() - start
    if (ms > 500) slog.warn("db", "slow query", { ms, sql: sql.replace(/\s+/g, " ").trim().slice(0, 200) })
    return result.rows as T[]
  } catch (error) {
    slog.error("db", error, {
      sql: sql.replace(/\s+/g, " ").trim().slice(0, 300),
      paramCount: params?.length ?? 0,
    })
    throw error
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
