import "server-only"
import { readCappedJson } from "../rate-limit"

// Small helpers shared by the /api/admin routes.

export const noStore = { "Cache-Control": "no-store" }

export function ok(body: unknown): Response {
  return Response.json(body, { headers: noStore })
}

export function fail(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({ error, ...extra }, { status, headers: noStore })
}

export function intParam(url: URL, name: string, fallback: number, min: number, max: number): number {
  const n = Number(url.searchParams.get(name))
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback
}

export function textParam(url: URL, name: string, max = 120): string | undefined {
  const v = url.searchParams.get(name)?.trim()
  return v ? v.slice(0, max) : undefined
}

// A back office change carries a small JSON object.
export async function body(request: Request): Promise<Record<string, unknown> | null> {
  const read = await readCappedJson<Record<string, unknown>>(request, 8 * 1024)
  return read.ok && read.body && typeof read.body === "object" && !Array.isArray(read.body) ? read.body : null
}

export function failed(what: string, err: unknown): Response {
  console.warn(`Back office: could not ${what}:`, err instanceof Error ? err.message : err)
  return fail(500, `${what.replace(/\s+/g, "_")}_failed`)
}
