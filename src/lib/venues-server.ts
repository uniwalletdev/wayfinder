import { Venue, Waypoint } from "./types"
import { NewVenueInput } from "./venues"

// Client-side access to shared venue maps on the server (see /api/venues). Reads
// are open; the owner secret for each venue this device created is kept in
// localStorage and presented when adding points or deleting. Every call reports
// `configured` so the app falls back to device-local mode when there's no
// database, exactly as it behaves today.

const tokenKey = (id: string) => `wayfinder.venueToken.${id}`

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
export function ownsVenue(id: string): boolean {
  return getEditToken(id) !== null
}

export async function fetchServerVenues(): Promise<{ configured: boolean; venues: Venue[] }> {
  try {
    const res = await fetch("/api/venues", { cache: "no-store" })
    const data = await res.json()
    return { configured: !!data.configured, venues: Array.isArray(data.venues) ? data.venues : [] }
  } catch {
    return { configured: false, venues: [] }
  }
}

export async function createServerVenue(input: NewVenueInput): Promise<{ configured: boolean; venue?: Venue }> {
  try {
    const res = await fetch("/api/venues", {
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
  const editToken = getEditToken(venueId)
  if (!editToken) return { configured: true, ok: false, saved: [] }
  try {
    const res = await fetch(`/api/venues/${venueId}/waypoints`, {
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
  const editToken = getEditToken(venueId)
  if (!editToken) return { configured: true, ok: false }
  try {
    const res = await fetch(`/api/venues/${venueId}`, {
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
