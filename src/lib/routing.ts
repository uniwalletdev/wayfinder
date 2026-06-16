import { Waypoint, Route, RouteStep, Coordinates, TravelMode, SurveyTrail } from "./types"

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

function polylineLength(points: Coordinates[]): number {
  let d = 0
  for (let i = 1; i < points.length; i++) d += distanceMeters(points[i - 1], points[i])
  return d
}

// Drop consecutive near-identical points (e.g. where the start/end coincides
// with a trail node, or at the lift seam between two floor legs) so the drawn
// line has no zero-length segments.
function dedupePath(points: Coordinates[]): Coordinates[] {
  const out: Coordinates[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || distanceMeters(last, p) > 0.5) out.push(p)
  }
  return out
}

// ── Indoor path-finding along the mapped survey trails ───────────────────────
// GPS gives no usable indoor geometry, so a straight line to a waypoint cuts
// through walls. Instead we route along the breadcrumb trails a mapper actually
// walked: treat their points as a graph (consecutive points are walkable edges,
// near-touching points from different walks are stitched together), then take
// the shortest path from the start to the destination over that network.

const STITCH_DIST_M = 8 // join trail points from different walks that nearly touch
const ATTACH_DIST_M = 40 // how far the start/end may reach to join the network

function pathAlongTrails(from: Coordinates, to: Coordinates, trails: SurveyTrail[]): Coordinates[] | null {
  const nodes: Coordinates[] = [from, to]
  const adj = new Map<number, { to: number; w: number }[]>()
  const addEdge = (a: number, b: number) => {
    const w = distanceMeters(nodes[a], nodes[b])
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a)!.push({ to: b, w })
    adj.get(b)!.push({ to: a, w })
  }

  // Trail points become nodes; consecutive points within a walk are edges.
  const trailStart = nodes.length
  for (const t of trails) {
    let prev = -1
    for (const p of t.points) {
      const idx = nodes.length
      nodes.push(p)
      if (prev >= 0) addEdge(prev, idx)
      prev = idx
    }
  }
  if (nodes.length === trailStart) return null // no trail points to follow

  // Stitch near-touching trail nodes (crossings, parallel passes) so separate
  // walks form one connected network.
  for (let i = trailStart; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (distanceMeters(nodes[i], nodes[j]) <= STITCH_DIST_M) addEdge(i, j)
    }
  }

  // Attach the start (0) and end (1) to the nearest trail node within reach. If
  // either can't reach the network, give up so the caller draws a straight line.
  for (const endpoint of [0, 1]) {
    let best = -1
    let bestD = ATTACH_DIST_M
    for (let i = trailStart; i < nodes.length; i++) {
      const d = distanceMeters(nodes[endpoint], nodes[i])
      if (d <= bestD) { bestD = d; best = i }
    }
    if (best < 0) return null
    addEdge(endpoint, best)
  }

  // Dijkstra (array scan — the graph is small, a few hundred nodes at most).
  const n = nodes.length
  const dist = new Array(n).fill(Infinity)
  const prev = new Array(n).fill(-1)
  const done = new Array(n).fill(false)
  dist[0] = 0
  for (let it = 0; it < n; it++) {
    let u = -1
    let ud = Infinity
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i }
    if (u < 0 || u === 1) break
    done[u] = true
    for (const e of adj.get(u) ?? []) {
      if (dist[u] + e.w < dist[e.to]) {
        dist[e.to] = dist[u] + e.w
        prev[e.to] = u
      }
    }
  }
  if (!Number.isFinite(dist[1])) return null

  const path: Coordinates[] = []
  for (let at = 1; at >= 0; at = prev[at]) {
    path.push(nodes[at])
    if (at === 0) break
  }
  path.reverse()
  return path.length >= 2 ? path : null
}

export function buildRoute(
  from: Coordinates,
  fromFloor: number,
  destination: Waypoint,
  allWaypoints: Waypoint[],
  mode: TravelMode = "walking",
  trails: SurveyTrail[] = []
): Route {
  const steps: RouteStep[] = []
  let totalDistance = 0
  // The path the map draws — follows the mapped trails where they exist, and
  // connects through any intermediate waypoint (e.g. the lift) rather than a
  // single straight line. Falls back to a straight segment when a leg has no
  // trail to follow, so behaviour is unchanged for places nobody has walked yet.
  const floorTrails = (floor: number) => trails.filter((t) => t.floor === floor)
  const leg = (a: Coordinates, b: Coordinates, floor: number): Coordinates[] =>
    pathAlongTrails(a, b, floorTrails(floor)) ?? [a, b]

  let geometry: Coordinates[]

  if (fromFloor !== destination.floor) {
    // Find nearest lift on current floor
    const liftsOnFloor = allWaypoints.filter((w) => w.type === "lift" && w.floor === fromFloor)
    const nearestLift = liftsOnFloor.sort(
      (a, b) => distanceMeters(from, a.coordinates) - distanceMeters(from, b.coordinates)
    )[0]

    if (nearestLift) {
      const leg1 = leg(from, nearestLift.coordinates, fromFloor)
      const d1 = polylineLength(leg1)
      totalDistance += d1
      steps.push({
        instruction: `Head to ${nearestLift.name}`,
        distance: Math.round(d1),
        heading: bearing(from, nearestLift.coordinates),
        waypoint: nearestLift,
      })
      geometry = leg1.slice()
      steps.push({
        instruction: `Take lift to Floor ${destination.floor}`,
        distance: 0,
        heading: 0,
        floorChange: { from: fromFloor, to: destination.floor, via: "lift" },
      })

      const liftOnDestFloor =
        allWaypoints.find((w) => w.type === "lift" && w.floor === destination.floor && w.name.includes("Lift A")) ||
        allWaypoints.find((w) => w.type === "lift" && w.floor === destination.floor)

      if (liftOnDestFloor) {
        // The walker re-enters at the lift on the destination floor, so the
        // drawn path continues along that floor's trails to the destination.
        const leg2 = leg(liftOnDestFloor.coordinates, destination.coordinates, destination.floor)
        const d2 = polylineLength(leg2)
        totalDistance += d2
        steps.push({
          instruction: `Exit lift and head to ${destination.name}`,
          distance: Math.round(d2),
          heading: bearing(liftOnDestFloor.coordinates, destination.coordinates),
          waypoint: destination,
        })
        geometry = geometry.concat(leg2)
      } else {
        geometry.push(destination.coordinates)
      }
    } else {
      // No lift mapped on this floor — best effort straight/trail path.
      geometry = leg(from, destination.coordinates, fromFloor)
      const d = polylineLength(geometry)
      totalDistance += d
      steps.push({
        instruction: `${headingToInstruction(bearing(from, destination.coordinates))} toward ${destination.name}`,
        distance: Math.round(d),
        heading: bearing(from, destination.coordinates),
      })
    }
  } else {
    geometry = leg(from, destination.coordinates, destination.floor)
    const d = polylineLength(geometry)
    totalDistance += d
    steps.push({
      instruction: `${headingToInstruction(bearing(from, destination.coordinates))} toward ${destination.name}`,
      distance: Math.round(d),
      heading: bearing(from, destination.coordinates),
    })
  }

  geometry = dedupePath(geometry)
  if (geometry.length < 2) geometry = [from, destination.coordinates]

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
