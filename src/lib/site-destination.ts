import type { Venue, Waypoint } from "./types"

// A destination for a hospital that has no interior yet.
//
// Most of the NHS directory is a located pin: a real position (the site's
// geocoded postcode) and nothing to route to, so opening one of those
// hospitals showed an outline and a search that found nothing. The one thing
// every such site can honestly offer is directions TO it — the same thing a
// street-map app gives when you search a hospital by name. This waypoint is
// that: it sits at the site's location, is named for what it does, and says
// in its description that it is the address, not a door.
//
// Its id carries the "geo-" prefix the router treats as outdoor, so it gets
// real street routing (Mapbox, when configured) from wherever the walker is,
// and the "you're far from the venue" card — meant for indoor destinations —
// stays out of the way.
//
// Lives outside venues/ on purpose: the pipeline scans that folder for venue
// modules and refuses anything it cannot read as one.

const SITE_DESTINATION_PREFIX = "geo-site-"

export function isSiteOnly(v: Pick<Venue, "waypoints" | "floorPlans">): boolean {
  return v.waypoints.length === 0 && v.floorPlans.length === 0
}

export function siteDestination(v: Venue): Waypoint {
  const where = v.postcode ? `${v.postcode} · ` : ""
  return {
    id: `${SITE_DESTINATION_PREFIX}${v.id}`,
    name: "Directions to the hospital",
    type: "exit",
    coordinates: v.center,
    floor: 0,
    description: `${where}Routes to the site’s address — look for the main entrance when you arrive`,
  }
}
