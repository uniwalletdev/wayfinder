import { MapLocation, Route, RouteStep, Coordinates } from "./types"

function distanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function bearing(a: Coordinates, b: Coordinates): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function headingToInstruction(deg: number): string {
  if (deg > 337.5 || deg <= 22.5) return "Head north"
  if (deg <= 67.5) return "Head north-east"
  if (deg <= 112.5) return "Head east"
  if (deg <= 157.5) return "Head south-east"
  if (deg <= 202.5) return "Head south"
  if (deg <= 247.5) return "Head south-west"
  if (deg <= 292.5) return "Head west"
  return "Head north-west"
}

/** Where, inside the destination building, the location sits. */
function arrivalDetail(dest: MapLocation): string {
  const bits: string[] = []
  if (dest.building && dest.building !== "Site entrance") bits.push(dest.building)
  if (dest.floorLabel) bits.push(dest.floorLabel)
  if (dest.sideLabel) bits.push(dest.sideLabel)
  return bits.join(" · ")
}

/**
 * Builds a simple campus route from the user's position to a destination's
 * building. Room-level coordinates aren't in the source data, so navigation is
 * to the correct building, then the arrival step states the floor / side.
 */
export function buildRoute(from: Coordinates, destination: MapLocation): Route {
  const steps: RouteStep[] = []
  const d = distanceMeters(from, destination.coordinates)
  const heading = bearing(from, destination.coordinates)

  if (d > 8) {
    const where =
      destination.building && destination.building !== "Site entrance"
        ? destination.building
        : destination.name
    steps.push({
      instruction: `${headingToInstruction(heading)} toward ${where}`,
      distance: Math.round(d),
      heading,
    })
  }

  const detail = arrivalDetail(destination)
  steps.push({
    instruction: detail
      ? `${destination.name} — ${detail}`
      : `You have arrived at ${destination.name}`,
    distance: 0,
    heading: 0,
    waypoint: destination,
  })

  return {
    steps,
    totalDistance: Math.round(d),
    estimatedMinutes: Math.max(1, Math.round(d / 75)),
    destination,
  }
}
