// A hospital's logo, served from here so that showing it never sends a
// patient's address to anyone else's server.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured } from "@/lib/db"
import { getLogo } from "@/lib/billing/store"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  if (!UUID.test(orgId) || !isDatabaseConfigured()) return new Response("Not found", { status: 404 })
  const logo = await getLogo(orgId).catch(() => null)
  if (!logo) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.type,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Security-Policy": "default-src 'none'",
    },
  })
}
