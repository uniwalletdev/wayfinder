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

// Perpendicular distance (metres) from a point to a single segment, via a local
// equirectangular projection around the segment's start — accurate at the short
// ranges an indoor/campus route spans, and cheap enough to run on every GPS fix.
function distanceToSegment(p: Coordinates, a: Coordinates, b: Coordinates): number {
  const mPerDegLat = 111320
  const mPerDegLng = 111320 * Math.cos((a.lat * Math.PI) / 180)
  const bx = (b.lng - a.lng) * mPerDegLng
  const by = (b.lat - a.lat) * mPerDegLat
  const px = (p.lng - a.lng) * mPerDegLng
  const py = (p.lat - a.lat) * mPerDegLat
  const len2 = bx * bx + by * by
  if (len2 === 0) return Math.hypot(px, py)
  let t = (px * bx + py * by) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - t * bx, py - t * by)
}

// Shortest distance (metres) from a point to a polyline — used while navigating
// to measure how far off the drawn route the walker has strayed.
export function distanceToPath(p: Coordinates, path: Coordinates[]): number {
  if (path.length === 0) return Infinity
  if (path.length === 1) return distanceMeters(p, path[0])
  let best = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const d = distanceToSegment(p, path[i], path[i + 1])
    if (d < best) best = d
  }
  return best
}

// Initial great-circle bearing from a→b, in degrees clockwise from north
// (0 = north, 90 = east). Exported for the live AR camera, which points its
// arrow at the next waypoint relative to the device's compass heading.
export function bearingBetween(a: Coordinates, b: Coordinates): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function bearing(a: Coordinates, b: Coordinates): number {
  return bearingBetween(a, b)
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

// ── Routing along walked trails ──────────────────────────────────────────────
// Survey Mode records the path the surveyor actually walked as SurveyTrail
// breadcrumbs. We treat those breadcrumbs as a network of walkable corridors:
// build a graph from them, snap the journey's start and end onto it, then follow
// the shortest path along it — so the drawn line hugs the mapped corridors
// instead of cutting a straight line through walls.

// Two breadcrumbs this close (metres), even from different walks, are treated as
// the same junction, so separate trails that cross or meet form one connected
// network rather than disjoint islands.
const TRAIL_STITCH_M = 6
// The walked path is legitimately longer than the straight line (corridors
// bend), but if snapping forces a wildly longer detour the snap is probably
// wrong — fall back to a straight line past this multiple of the direct distance.
const TRAIL_DETOUR_LIMIT = 8
// Safety valve: skip trail routing for pathologically long surveys so a route
// build can't stall on the O(n²) graph stitching below.
const TRAIL_MAX_NODES = 4000
// How far an end can sit from the nearest breadcrumb and still count as "on" the
// mapped network. Keeps trail-following to journeys whose ends are genuinely near
// walked corridors; anything further (a distant or geocoded place) stays straight.
const TRAIL_SNAP_MAX_M = 30

interface TrailGraph {
  nodes: Coordinates[]
  adj: number[][] // adj[i] = neighbour node indices
  weights: number[][] // weights[i][k] = length of edge adj[i][k] in metres
}

function buildTrailGraph(trails: SurveyTrail[]): TrailGraph {
  const nodes: Coordinates[] = []
  for (const t of trails) for (const p of t.points) nodes.push(p)

  const adj: number[][] = nodes.map(() => [])
  const weights: number[][] = nodes.map(() => [])
  const link = (i: number, j: number) => {
    const w = distanceMeters(nodes[i], nodes[j])
    adj[i].push(j)
    weights[i].push(w)
    adj[j].push(i)
    weights[j].push(w)
  }

  // Edges along each walked trail, in the order they were recorded.
  let base = 0
  for (const t of trails) {
    for (let k = 0; k < t.points.length - 1; k++) link(base + k, base + k + 1)
    base += t.points.length
  }
  // Stitch nearby breadcrumbs (from any walk) into shared junctions.
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (distanceMeters(nodes[i], nodes[j]) <= TRAIL_STITCH_M) link(i, j)
    }
  }
  return { nodes, adj, weights }
}

function nearestNode(g: TrailGraph, p: Coordinates): number {
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < g.nodes.length; i++) {
    const d = distanceMeters(p, g.nodes[i])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

// Shortest path (node indices) from start to goal over the trail graph, or null
// if they're in disconnected parts of the network. O(n²) Dijkstra — fine for the
// modest node counts a single survey produces.
function dijkstra(g: TrailGraph, start: number, goal: number): number[] | null {
  const n = g.nodes.length
  const dist = new Array<number>(n).fill(Infinity)
  const prev = new Array<number>(n).fill(-1)
  const done = new Array<boolean>(n).fill(false)
  dist[start] = 0

  for (let iter = 0; iter < n; iter++) {
    let u = -1
    let ud = Infinity
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i] < ud) {
        ud = dist[i]
        u = i
      }
    }
    if (u === -1 || u === goal) break
    done[u] = true
    const neigh = g.adj[u]
    const w = g.weights[u]
    for (let k = 0; k < neigh.length; k++) {
      const v = neigh[k]
      const nd = dist[u] + w[k]
      if (nd < dist[v]) {
        dist[v] = nd
        prev[v] = u
      }
    }
  }

  if (dist[goal] === Infinity) return null
  const path: number[] = []
  for (let at = goal; at !== -1; at = prev[at]) path.push(at)
  return path.reverse()
}

// Follow the walked trails on one floor from `from` to `to`. Returns the polyline
// (including the true start/end) and its length, or null when there are no usable
// trails, the ends can't be connected, or the snapped detour is implausibly long.
export function buildTrailPath(
  from: Coordinates,
  to: Coordinates,
  trails: SurveyTrail[]
): { geometry: Coordinates[]; distance: number } | null {
  const usable = trails.filter((t) => t.points.length >= 2)
  if (usable.length === 0) return null

  const g = buildTrailGraph(usable)
  if (g.nodes.length < 2 || g.nodes.length > TRAIL_MAX_NODES) return null

  const start = nearestNode(g, from)
  const goal = nearestNode(g, to)
  if (start === goal) return null // both ends snap to one point — no real path
  // Only follow the trails when both ends are genuinely near them.
  if (distanceMeters(from, g.nodes[start]) > TRAIL_SNAP_MAX_M) return null
  if (distanceMeters(to, g.nodes[goal]) > TRAIL_SNAP_MAX_M) return null

  const path = dijkstra(g, start, goal)
  if (!path || path.length < 2) return null

  const geometry = [from, ...path.map((i) => g.nodes[i]), to]
  let distance = 0
  for (let i = 0; i < geometry.length - 1; i++) {
    distance += distanceMeters(geometry[i], geometry[i + 1])
  }

  const straight = distanceMeters(from, to)
  if (distance > straight * TRAIL_DETOUR_LIMIT + 100) return null

  return { geometry, distance }
}

// One indoor leg: follow the floor's walked trails when they connect the two
// ends, otherwise a straight hop. Always returns both ends in the points list.
function indoorLeg(
  a: Coordinates,
  b: Coordinates,
  floor: number,
  trails: SurveyTrail[]
): { points: Coordinates[]; distance: number } {
  const path = buildTrailPath(a, b, trails.filter((t) => t.floor === floor))
  if (path) return { points: path.geometry, distance: path.distance }
  return { points: [a, b], distance: distanceMeters(a, b) }
}

export function buildRoute(
  from: Coordinates,
  fromFloor: number,
  destination: Waypoint,
  allWaypoints: Waypoint[],
  mode: TravelMode = "walking",
  // The surveyor's walked trails. When they connect the route's ends, the drawn
  // path follows them (the mapped corridors) instead of a straight line.
  trails: SurveyTrail[] = []
): Route {
  const steps: RouteStep[] = []
  // The path the map draws — follows the walked trails where available and is
  // connected through any intermediate waypoints (e.g. the lift) rather than a
  // single straight line to the destination.
  let geometry: Coordinates[] = []
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
      const leg1 = indoorLeg(from, nearestLift.coordinates, fromFloor, trails)
      totalDistance += leg1.distance
      geometry = leg1.points
      steps.push({
        instruction: `Head to ${nearestLift.name}`,
        distance: Math.round(leg1.distance),
        heading: bearing(from, nearestLift.coordinates),
        waypoint: nearestLift,
      })
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
        const leg2 = indoorLeg(liftOnDestFloor.coordinates, destination.coordinates, destination.floor, trails)
        totalDistance += leg2.distance
        geometry = geometry.concat(leg2.points)
        steps.push({
          instruction: `Exit lift and head to ${destination.name}`,
          distance: Math.round(leg2.distance),
          heading: bearing(liftOnDestFloor.coordinates, destination.coordinates),
          waypoint: destination,
        })
      } else {
        // No lift modelled on the destination floor — finish straight to the door.
        geometry.push(destination.coordinates)
      }
    } else {
      // No lift on the current floor — fall back to a direct hop.
      const leg = indoorLeg(from, destination.coordinates, fromFloor, trails)
      totalDistance += leg.distance
      geometry = leg.points
    }
  } else {
    const leg = indoorLeg(from, destination.coordinates, fromFloor, trails)
    totalDistance += leg.distance
    geometry = leg.points
    steps.push({
      instruction: `${headingToInstruction(bearing(from, destination.coordinates))} toward ${destination.name}`,
      distance: Math.round(leg.distance),
      heading: bearing(from, destination.coordinates),
    })
  }

  // Always hand back a drawable line, even in degenerate cases.
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

// Distance beyond which a ground-floor journey is treated as an outdoor trip
// worth routing along real streets/footpaths, even when the destination is one
// of the venue's own points rather than a typed-in search.
const OUTDOOR_DISTANCE_M = 350

// Whether to upgrade a journey to real street/footpath routing (Apple-Maps
// style). Always for typed/geocoded places (they sit outside the mapped floors);
// and for a far ground-to-ground hop, but only when the surveyor's own walked
// trails don't already connect the two ends — their mapped path wins if it does.
export function shouldRouteOutdoors(
  from: Coordinates,
  fromFloor: number,
  dest: Waypoint,
  trails: SurveyTrail[] = []
): boolean {
  if (isOutdoorDestination(dest)) return true
  if (fromFloor !== 0 || dest.floor !== 0) return false
  if (distanceMeters(from, dest.coordinates) <= OUTDOOR_DISTANCE_M) return false
  return buildTrailPath(from, dest.coordinates, trails.filter((t) => t.floor === 0)) === null
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
