import { GOSH_VENUE } from "../data/gosh-venue"
import { Venue, Coordinates, VenueEntrance } from "./types"

// Add more venues here; routing and geofencing are fully data-driven.
export const VENUE_REGISTRY: Venue[] = [GOSH_VENUE]

function haversineM(a: Coordinates, b: Coordinates): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function insideFootprint(venue: Venue, pos: Coordinates): boolean {
  const { latMin, latMax, lngMin, lngMax } = venue.footprint
  return pos.lat >= latMin && pos.lat <= latMax && pos.lng >= lngMin && pos.lng <= lngMax
}

/** Distance in metres from pos to the nearest point on the venue's footprint edge.
 *  Returns 0 if pos is inside the footprint. */
function distanceToFootprintEdgeM(venue: Venue, pos: Coordinates): number {
  if (insideFootprint(venue, pos)) return 0
  const { latMin, latMax, lngMin, lngMax } = venue.footprint
  const clampedLat = Math.max(latMin, Math.min(latMax, pos.lat))
  const clampedLng = Math.max(lngMin, Math.min(lngMax, pos.lng))
  return haversineM(pos, { lat: clampedLat, lng: clampedLng })
}

/** Returns the venue whose footprint contains pos, or null. */
export function venueContaining(pos: Coordinates): Venue | null {
  return VENUE_REGISTRY.find((v) => insideFootprint(v, pos)) ?? null
}

/** Returns the nearest venue whose centre is within maxDistM (default 500 m),
 *  or null if nothing is that close. */
export function nearestVenue(
  pos: Coordinates,
  maxDistM = 500
): { venue: Venue; distM: number } | null {
  let best: { venue: Venue; distM: number } | null = null
  for (const venue of VENUE_REGISTRY) {
    const distM = haversineM(pos, venue.center)
    if (distM <= maxDistM && (!best || distM < best.distM)) {
      best = { venue, distM }
    }
  }
  return best
}

/** Is pos within bufferM of any known venue (including inside)? */
export function isNearAnyVenue(pos: Coordinates, bufferM = 50): boolean {
  return VENUE_REGISTRY.some((v) => distanceToFootprintEdgeM(v, pos) <= bufferM)
}

/** Which venue owns this waypoint ID? */
export function venueOf(waypointId: string): Venue | null {
  return VENUE_REGISTRY.find((v) => v.waypoints.some((w) => w.id === waypointId)) ?? null
}

/** Best entrance for the given position.  Prefers accessible entrances when wheelchair=true. */
export function nearestEntrance(
  venue: Venue,
  pos: Coordinates,
  wheelchair = false
): VenueEntrance {
  const candidates = wheelchair
    ? venue.entrances.filter((e) => e.accessible)
    : venue.entrances
  const pool = candidates.length > 0 ? candidates : venue.entrances
  return pool.reduce((best, e) =>
    haversineM(pos, e.coordinates) < haversineM(pos, best.coordinates) ? e : best
  )
}

/** All waypoints across all venues (used for global search). */
export function allWaypoints() {
  return VENUE_REGISTRY.flatMap((v) => v.waypoints)
}
