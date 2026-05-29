// Server-side structured logging — visible in Vercel Runtime Logs / Observability.
// Emits one JSON line per event so logs are filterable and greppable.

type Level = "info" | "warn" | "error"

function emit(level: Level, scope: string, msg: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    msg,
    ...(meta ?? {}),
  })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const slog = {
  info: (scope: string, msg: string, meta?: Record<string, unknown>) => emit("info", scope, msg, meta),
  warn: (scope: string, msg: string, meta?: Record<string, unknown>) => emit("warn", scope, msg, meta),
  error: (scope: string, error: unknown, meta?: Record<string, unknown>) => {
    const e = error as Error
    emit("error", scope, e?.message ?? String(error), { ...(meta ?? {}), stack: e?.stack })
  },
}

// Wraps an App Router handler: logs method/path/status/duration, and full error + stack on throw.
export function withLog<A extends unknown[]>(
  scope: string,
  handler: (req: Request, ...rest: A) => Promise<Response>
) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    const start = Date.now()
    const path = (() => { try { return new URL(req.url).pathname } catch { return req.url } })()
    try {
      const res = await handler(req, ...rest)
      slog.info(scope, `${req.method} ${path} -> ${res.status}`, { ms: Date.now() - start })
      return res
    } catch (error) {
      slog.error(scope, error, { method: req.method, path, ms: Date.now() - start })
      throw error
    }
  }
}
