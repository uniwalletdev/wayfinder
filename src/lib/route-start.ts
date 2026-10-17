// Where a route starts, and why.
//
// The everyday start is the walker's live position. When there is none —
// location off, or no fix yet — the app used to start quietly from the centre
// of the site and still call it "Your location", so every walk looked a minute
// long and nobody could tell where it began. The start is now said out loud:
// the main entrance when the venue has one, else the centre of the site, each
// labelled as what it is, and the walker can pick any mapped place instead.
import { Coordinates, Waypoint } from "./types"

export type RouteStartKind = "chosen" | "live" | "entrance" | "centre"

export interface RouteStart {
  kind: RouteStartKind
  coordinates: Coordinates
  floor: number
  // The place the start is, when it is one (chosen, or the entrance standing
  // in); null for a live position or the centre of the site.
  waypoint: Waypoint | null
  // What the From row says.
  label: string
  // Why a stand-in is standing in: "location is off", "finding your location".
  note?: string
}

export type LocationStatus = "requesting" | "active" | "denied"

const MAIN = /\bmain\b/i
const NOT_PUBLIC = /ambulance|emergency|staff|goods|delivery|service|fire|private/i

// The venue's main entrance: an entrance named "Main Entrance" (or with "main"
// in it), else any public entrance, else any entrance at all — never an
// ambulance, staff or goods door while a public one exists. Ties go to the
// venue's opening floor, then to list order, so the answer is stable.
export function mainEntrance(waypoints: Waypoint[], openingFloor?: number): Waypoint | null {
  const doors = waypoints.filter((w) => w.type === "exit")
  if (!doors.length) return null
  const tier = (w: Waypoint) => (NOT_PUBLIC.test(w.name) ? 2 : MAIN.test(w.name) ? 0 : 1)
  const offOpening = (w: Waypoint) => (openingFloor !== undefined && w.floor !== openingFloor ? 1 : 0)
  return doors.slice().sort((a, b) => tier(a) - tier(b) || offOpening(a) - offOpening(b) || doors.indexOf(a) - doors.indexOf(b))[0]
}

export function resolveRouteStart(input: {
  // A place the walker picked to start from; null for the default.
  origin: Waypoint | null
  // The walker's position when there is one: a GPS fix, or the demo or poster anchor.
  position: Coordinates | null
  location: LocationStatus
  currentFloor: number
  waypoints: Waypoint[]
  venueCenter: Coordinates
  venueName: string
  openingFloor: number
}): RouteStart {
  const { origin, position } = input
  if (origin) return { kind: "chosen", coordinates: origin.coordinates, floor: origin.floor, waypoint: origin, label: origin.name }
  if (position) return { kind: "live", coordinates: position, floor: input.currentFloor, waypoint: null, label: "Your location" }
  const note = input.location === "requesting" ? "finding your location" : "location is off"
  const door = mainEntrance(input.waypoints, input.openingFloor)
  if (door) return { kind: "entrance", coordinates: door.coordinates, floor: door.floor, waypoint: door, label: door.name, note }
  return { kind: "centre", coordinates: input.venueCenter, floor: input.currentFloor, waypoint: null, label: `Centre of ${input.venueName}`, note }
}

// What a figure the app does not know shows as.
export const UNKNOWN = "—"

// The walk time as the card shows it: "~" when any leg of the route is a
// straight line through unmapped space, so a guess reads as a guess, and a
// dash when there is no journey to time (a route of no length starts where it
// ends, which means the start is not really known): never a made-up "1 min".
export function formatMinutes(route: { estimatedMinutes: number; approximate?: boolean; totalDistance?: number }): string {
  if (route.totalDistance !== undefined && route.totalDistance <= 0) return UNKNOWN
  const m = route.estimatedMinutes
  // An hour or more reads in hours ("2 h 15 min"), not "135 min".
  const time = m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`
  return `${route.approximate ? "~" : ""}${time}`
}

// Whether a route's start is where the walker really is, for a journey that
// leaves the building (an address, or directions to a hospital): a place they
// picked, or a live fix. The entrance or site centre standing in for an
// unknown position, and the demo position on site, are not: a journey from
// there to the hospital is no journey at all.
export function startIsReal(start: Pick<RouteStart, "kind">, positionAccuracy: number): boolean {
  return start.kind === "chosen" || (start.kind === "live" && positionAccuracy > 0)
}
