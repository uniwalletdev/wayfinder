// A single shared venue: read it (open, reachable by id regardless of listing),
// or delete it (owner-only, via the edit token). Next 16 route params are async.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured } from "@/lib/db"
import { getVenue, deleteVenue } from "@/lib/venues-db"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) return Response.json({ configured: false, venue: null })
  const { id } = await params
  try {
    const venue = await getVenue(id)
    if (!venue) return Response.json({ configured: true, venue: null }, { status: 404 })
    return Response.json({ configured: true, venue })
  } catch (err) {
    console.warn("Could not read venue:", err instanceof Error ? err.message : err)
    return Response.json({ configured: true, venue: null, error: "read_failed" }, { status: 200 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) return Response.json({ configured: false })
  const { id } = await params
  let body: { editToken?: unknown }
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const editToken = typeof body.editToken === "string" ? body.editToken : ""
  try {
    const ok = await deleteVenue(id, editToken)
    // Wrong/absent token, or unknown venue — don't reveal which.
    if (!ok) return Response.json({ configured: true, ok: false }, { status: 403 })
    return Response.json({ configured: true, ok: true })
  } catch (err) {
    console.warn("Could not delete venue:", err instanceof Error ? err.message : err)
    return Response.json({ configured: true, ok: false, error: "delete_failed" }, { status: 500 })
  }
}
