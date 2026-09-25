// A single shared venue: read it (open, reachable by id regardless of listing),
// or delete it (owner-only, via the edit token). Next 16 route params are async.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured } from "@/lib/db"
import { currentUserId } from "@/lib/auth"
import { getVenue, deleteVenue } from "@/lib/venues-db"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) return Response.json({ configured: false, venue: null })
  const { id } = await params
  try {
    const venue = await getVenue(id, await currentUserId())
    if (!venue) return Response.json({ configured: true, venue: null }, { status: 404 })
    return Response.json({ configured: true, venue })
  } catch (err) {
    console.warn("Could not read venue:", err instanceof Error ? err.message : err)
    return Response.json({ configured: true, venue: null, error: "read_failed" }, { status: 200 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // The other write routes cap and limit; a delete is a write too, and an
  // unbounded body here was the one place a request could still buffer
  // arbitrary JSON, and the one write a loop could hammer at the database.
  const limited = rateLimit(request, "venue-write", LIMITS.venueWrite.limit, LIMITS.venueWrite.windowMs)
  if (limited) return limited

  if (!isDatabaseConfigured()) return Response.json({ configured: false })
  const { id } = await params
  const read = await readCappedJson<{ editToken?: unknown }>(request, BODY_LIMITS.venue)
  const body = read.ok ? read.body : {}
  const editToken = typeof body.editToken === "string" ? body.editToken : ""
  try {
    const ok = await deleteVenue(id, editToken, await currentUserId())
    // Wrong/absent token, or unknown venue — don't reveal which.
    if (!ok) return Response.json({ configured: true, ok: false }, { status: 403 })
    return Response.json({ configured: true, ok: true })
  } catch (err) {
    console.warn("Could not delete venue:", err instanceof Error ? err.message : err)
    return Response.json({ configured: true, ok: false, error: "delete_failed" }, { status: 500 })
  }
}
