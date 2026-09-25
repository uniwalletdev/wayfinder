// Attach a venue this device created anonymously to the signed-in account, by
// presenting the venue's edit token. This is what makes signing in worth
// anything for a mapper: the venue then follows the person, not the phone.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured } from "@/lib/db"
import { currentUserId } from "@/lib/auth"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"
import { claimVenue } from "@/lib/venues-db"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "venue-write", LIMITS.venueWrite.limit, LIMITS.venueWrite.windowMs)
  if (limited) return limited

  if (!isDatabaseConfigured()) return Response.json({ configured: false })
  const userId = await currentUserId()
  if (!userId) return Response.json({ configured: true, ok: false, error: "not_signed_in" }, { status: 401 })

  const { id } = await params
  const read = await readCappedJson<{ editToken?: unknown }>(request, BODY_LIMITS.venue)
  const editToken = read.ok && typeof read.body.editToken === "string" ? read.body.editToken : ""
  try {
    const ok = await claimVenue(id, editToken, userId)
    // Wrong token, unknown venue, or owned by someone else — don't say which.
    if (!ok) return Response.json({ configured: true, ok: false }, { status: 403 })
    return Response.json({ configured: true, ok: true })
  } catch (err) {
    console.warn("Could not claim venue:", err instanceof Error ? err.message : err)
    return Response.json({ configured: true, ok: false, error: "claim_failed" }, { status: 500 })
  }
}
