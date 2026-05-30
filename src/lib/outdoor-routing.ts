import { Coordinates, TransportMode, OutdoorLeg, OutdoorStep } from "./types"

const OSRM_BASE = "https://router.project-osrm.org/route/v1"

const OSRM_PROFILE: Record<TransportMode, string | null> = {
  walking:    "foot",
  wheelchair: "foot",
  cycling:    "bike",
  driving:    "driving",
  transit:    null,
}

type OsrmManeuverType =
  | "depart" | "arrive" | "turn" | "new name" | "continue"
  | "fork" | "merge" | "roundabout" | "exit roundabout"
  | "end of road" | "use lane" | "notification" | "rotary" | "exit rotary"

interface OsrmStep {
  name: string
  distance: number
  duration: number
  maneuver: { type: OsrmManeuverType; modifier?: string }
}

interface OsrmRoute {
  distance: number
  duration: number
  geometry: { type: "LineString"; coordinates: [number, number][] }
  legs: Array<{ steps: OsrmStep[] }>
}

interface OsrmResponse {
  code: string
  routes: OsrmRoute[]
}

function stepInstruction(step: OsrmStep): string {
  const { type, modifier } = step.maneuver
  const name = step.name ? ` onto ${step.name}` : ""
  if (type === "depart")  return `Head${name}`
  if (type === "arrive")  return "Arrive at destination"
  if (type === "turn" && modifier) return `Turn ${modifier}${name}`
  if (type === "continue" || type === "new name") return `Continue${name}`
  if (type === "fork" && modifier) return `Keep ${modifier}${name}`
  if (type === "merge")   return `Merge${name}`
  if (type === "roundabout" || type === "rotary") return `Take the roundabout${name}`
  if (type === "exit roundabout" || type === "exit rotary") return `Exit roundabout${name}`
  if (type === "end of road" && modifier) return `Turn ${modifier} at end of road${name}`
  return `Continue${name}`
}

export async function fetchOutdoorRoute(
  from: Coordinates,
  to: Coordinates,
  mode: TransportMode
): Promise<OutdoorLeg | null> {
  const profile = OSRM_PROFILE[mode]
  if (!profile) return null

  const url =
    `${OSRM_BASE}/${profile}` +
    `/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&steps=true`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data: OsrmResponse = await res.json()
    if (data.code !== "Ok" || !data.routes.length) return null

    const route = data.routes[0]
    const polyline: Coordinates[] = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))

    const steps: OutdoorStep[] = []
    for (const leg of route.legs) {
      for (const step of leg.steps) {
        if (step.distance < 1) continue
        steps.push({ instruction: stepInstruction(step), distance: Math.round(step.distance) })
      }
    }

    return {
      mode,
      polyline,
      distance: Math.round(route.distance),
      duration: Math.round(route.duration),
      steps,
    }
  } catch {
    return null
  }
}
