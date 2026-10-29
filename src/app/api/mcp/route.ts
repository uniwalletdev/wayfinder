// The Findway app in ChatGPT, and any other MCP client: MCP's Streamable HTTP
// transport, stateless (src/lib/mcp/server.ts). POST a JSON-RPC message and get
// JSON back. There is no event stream to open, so GET and DELETE are refused as
// the transport says a server without one must. Read-only public map data and
// no sign-in, so there is nothing for a cross-site page to abuse; the limits
// are there to keep a loop from pinning an instance.
//
// Nothing a client sends is stored: the question is answered and forgotten.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { SEED_VENUES } from "@/lib/venues"
import { siteUrl } from "@/lib/site-url"
import { handleBody, parseError } from "@/lib/mcp/server"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"

const JSON_HEADERS = { "cache-control": "no-store" }

export async function POST(request: Request) {
  const limited = rateLimit(request, "mcp", LIMITS.mcp.limit, LIMITS.mcp.windowMs)
  if (limited) return limited
  const read = await readCappedJson<unknown>(request, BODY_LIMITS.mcp)
  if (!read.ok) {
    if (read.reason === "too_large") return Response.json({ error: "too_large" }, { status: 413 })
    return Response.json(parseError(), { status: 400, headers: JSON_HEADERS })
  }
  const reply = handleBody(read.body, { venues: SEED_VENUES, base: siteUrl() })
  // Only notifications (or responses) came in: accepted, nothing to say.
  if (reply === null) return new Response(null, { status: 202 })
  return Response.json(reply, { headers: JSON_HEADERS })
}

function notOffered() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } })
}

export const GET = notOffered
export const DELETE = notOffered
