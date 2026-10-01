import { Venue, Waypoint } from "./types"
import { NewVenueInput } from "./venues"
import { apiUrl } from "@/lib/app-shell"

// Client-side access to shared venue maps on the server (see /api/venues). Reads
// are open; the owner secret for each venue this device created is kept in
// localStorage and presented when adding points or deleting. A signed-in
// account can own a venue too: the server then authorises by the session
// cookie the browser sends anyway, which is why writes are attempted even with
// no token here. Every call reports `configured` so the app falls back to
// device-local mode when there's no database, exactly as it behaves today.

const TOKEN_PREFIX = "wayfinder.venueToken."
const tokenKey = (id: string) => `${TOKEN_PREFIX}${id}`

export function getEditToken(id: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(tokenKey(id))
  } catch {
    return null
  }
}

function setEditToken(id: string, token: string) {
  try {
    window.localStorage.setItem(tokenKey(id), token)
  } catch {
    // Storage blocked — the venue is created server-side but this device won't be
    // able to prove ownership later. Acceptable; it can still be viewed.
  }
}

function clearEditToken(id: string) {
  try {
    window.localStorage.removeItem(tokenKey(id))
  } catch {}
}

// True for venues this device created and therefore holds the edit token for.
// A venue owned by the signed-in account is recognised by the `ownerId` the
// server reveals on it; callers check that alongside this.
export function ownsVenue(id: string): boolean {
  return getEditToken(id) !== null
}

// Attach every venue this device created to the signed-in account (see
// /api/venues/<id>/claim). Returns how many were claimed. Tokens stay in
// storage: they remain valid, and this device keeps working signed out.
export async function claimServerVenues(): Promise<number> {
  let ids: string[] = []
  try {
    ids = Object.keys(window.localStorage)
      .filter((k) => k.startsWith(TOKEN_PREFIX))
      .map((k) => k.slice(TOKEN_PREFIX.length))
  } catch {
    return 0
  }
  let claimed = 0
  for (const id of ids) {
    const editToken = getEditToken(id)
    if (!editToken) continue
    try {
      const res = await fetch(apiUrl(`/api/venues/${id}/claim`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editToken }),
      })
      const data = await res.json()
      if (data.ok) claimed++
    } catch {
      // A venue that could not be claimed now can be next time.
    }
  }
  return claimed
}

export async function fetchServerVenues(): Promise<{ configured: boolean; venues: Venue[] }> {
  try {
    const res = await fetch(apiUrl("/api/venues"), { cache: "no-store" })
    const data = await res.json()
    return { configured: !!data.configured, venues: Array.isArray(data.venues) ? data.venues : [] }
  } catch {
    return { configured: false, venues: [] }
  }
}

export async function createServerVenue(input: NewVenueInput): Promise<{ configured: boolean; venue?: Venue }> {
  try {
    const res = await fetch(apiUrl("/api/venues"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const data = await res.json()
    if (!data.configured) return { configured: false }
    if (data.venue && typeof data.editToken === "string") {
      setEditToken(data.venue.id, data.editToken)
      return { configured: true, venue: data.venue }
    }
    return { configured: true }
  } catch {
    return { configured: false }
  }
}

export async function addServerWaypoints(
  venueId: string,
  waypoints: Waypoint[]
): Promise<{ configured: boolean; ok: boolean; saved: Waypoint[] }> {
  // No token is not a refusal: the signed-in owner of the venue has none on a
  // second device, and the server authorises them by session.
  const editToken = getEditToken(venueId) ?? ""
  try {
    const res = await fetch(apiUrl(`/api/venues/${venueId}/waypoints`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editToken, waypoints }),
    })
    const data = await res.json()
    if (!data.configured) return { configured: false, ok: false, saved: [] }
    return { configured: true, ok: !!data.ok, saved: Array.isArray(data.waypoints) ? data.waypoints : [] }
  } catch {
    return { configured: false, ok: false, saved: [] }
  }
}

export async function deleteServerVenue(venueId: string): Promise<{ configured: boolean; ok: boolean }> {
  const editToken = getEditToken(venueId) ?? ""
  try {
    const res = await fetch(apiUrl(`/api/venues/${venueId}`), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editToken }),
    })
    const data = await res.json()
    if (data.ok) clearEditToken(venueId)
    return { configured: !!data.configured, ok: !!data.ok }
  } catch {
    return { configured: false, ok: false }
  }
}
