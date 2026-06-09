import { Waypoint, Route, RouteStep, Coordinates, TravelMode } from "./types"

// Geocoded destinations (beyond the hospital's mapped floors) carry a "geo-"
// id. Those are the ones worth routing along real streets/footpaths; indoor
// waypoints stay on the offline waypoint path.
export function isOutdoorDestination(w: Waypoint): boolean {
  return w.id.startsWith("geo-")
}

const WALK_SPEED_M_PER_MIN = 80

// Walking speed in metres/min per mode, used to estimate indoor ETAs (outdoor
// ETAs come straight from the Directions API).
const SPEED_BY_MODE: Record<TravelMode, number> = {
  walking: WALK_SPEED_M_PER_MIN,
  cycling: 250,
  driving: 500,
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
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

export function buildRoute(
  from: Coordinates,
  fromFloor: number,
  destination: Waypoint,
  allWaypoints: Waypoint[],
  mode: TravelMode = "walking"
): Route {
  const steps: RouteStep[] = []
  // The path the map draws — connected through any intermediate waypoints
  // (e.g. the lift) rather than a single straight line to the destination.
  const geometry: Coordinates[] = [from]
  let totalDistance = 0

  if (fromFloor !== destination.floor) {
    // Find nearest lift on current floor
    const liftsOnFloor = allWaypoints.filter(
      (w) => w.type === "lift" && w.floor === fromFloor
    )
    const nearestLift = liftsOnFloor.sort(
      (a, b) => distanceMeters(from, a.coordinates) - distanceMeters(from, b.coordinates)
    )[0]

    if (nearestLift) {
      const d1 = distanceMeters(from, nearestLift.coordinates)
      totalDistance += d1
      steps.push({
        instruction: `Head to ${nearestLift.name}`,
        distance: Math.round(d1),
        heading: bearing(from, nearestLift.coordinates),
        waypoint: nearestLift,
      })
      geometry.push(nearestLift.coordinates)
      steps.push({
        instruction: `Take lift to Floor ${destination.floor}`,
        distance: 0,
        heading: 0,
        floorChange: { from: fromFloor, to: destination.floor, via: "lift" },
      })

      const liftOnDestFloor = allWaypoints.find(
        (w) => w.type === "lift" && w.floor === destination.floor && w.name.includes("Lift A")
      ) || allWaypoints.find((w) => w.type === "lift" && w.floor === destination.floor)

      if (liftOnDestFloor) {
        // The walker re-enters at the lift on the destination floor, so the
        // drawn path continues from there to the destination.
        geometry.push(liftOnDestFloor.coordinates)
        const d2 = distanceMeters(liftOnDestFloor.coordinates, destination.coordinates)
        totalDistance += d2
        steps.push({
          instruction: `Exit lift and head to ${destination.name}`,
          distance: Math.round(d2),
          heading: bearing(liftOnDestFloor.coordinates, destination.coordinates),
          waypoint: destination,
        })
      }
    }
  } else {
    const d = distanceMeters(from, destination.coordinates)
    totalDistance += d
    steps.push({
      instruction: `${headingToInstruction(bearing(from, destination.coordinates))} toward ${destination.name}`,
      distance: Math.round(d),
      heading: bearing(from, destination.coordinates),
    })
  }

  geometry.push(destination.coordinates)

  steps.push({
    instruction: `You have arrived at ${destination.name}`,
    distance: 0,
    heading: 0,
    waypoint: destination,
  })

  const floorChanges = steps.filter((s) => s.floorChange).length

  return {
    steps,
    totalDistance: Math.round(totalDistance),
    estimatedMinutes: Math.max(1, Math.round(totalDistance / SPEED_BY_MODE[mode])),
    floorChanges,
    geometry,
    mode,
    outdoor: false,
  }
}

interface DirectionsResponse {
  geometry?: Coordinates[]
  distance?: number
  duration?: number
  error?: string
}

// Fetch a real street/footpath route from our Directions proxy and fold it into
// a Route. Returns null on any failure so the caller can fall back to the
// offline straight-line/waypoint route.
export async function fetchOutdoorRoute(
  from: Coordinates,
  destination: Waypoint,
  mode: TravelMode,
  signal?: AbortSignal
): Promise<Route | null> {
  try {
    const params = new URLSearchParams({
      from: `${from.lat},${from.lng}`,
      to: `${destination.coordinates.lat},${destination.coordinates.lng}`,
      mode,
    })
    const res = await fetch(`/api/directions?${params}`, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as DirectionsResponse
    if (data.error || !data.geometry || data.geometry.length < 2) return null

    const distance = data.distance ?? 0
    const minutes = data.duration
      ? Math.max(1, Math.round(data.duration / 60))
      : Math.max(1, Math.round(distance / SPEED_BY_MODE[mode]))

    return {
      steps: [
        {
          instruction: `${headingToInstruction(bearing(from, destination.coordinates))} toward ${destination.name}`,
          distance,
          heading: bearing(from, destination.coordinates),
        },
        { instruction: `You have arrived at ${destination.name}`, distance: 0, heading: 0, waypoint: destination },
      ],
      totalDistance: distance,
      estimatedMinutes: minutes,
      floorChanges: 0,
      geometry: data.geometry,
      mode,
      outdoor: true,
    }
  } catch {
    return null
  }
}
