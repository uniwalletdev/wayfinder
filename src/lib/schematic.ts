import { Coordinates, SurveyTrail, Waypoint, WaypointType } from "./types"

// Turn a walked survey (breadcrumb trails) plus the points read/marked along it
// into a simple indoor floor schematic — corridors with real width and rooms
// sitting beside them — so a surveyed floor reads like a building interior
// instead of a thread of dots on a blank plan.
//
// Everything is produced as lat/lng polygons so it draws straight onto the
// Leaflet map and scales naturally as you zoom, the way a real plan would.

export interface SchematicRoom {
  id: string
  name: string
  type: WaypointType
  // Outline of the room, closed implicitly (first point repeated not required).
  polygon: Coordinates[]
  // Centre, for placing the label.
  center: Coordinates
}

export interface FloorSchematic {
  floor: number
  // Filled walkable corridor ribbons, one per walked trail segment.
  corridors: Coordinates[][]
  rooms: SchematicRoom[]
}

// Corridor half-width and room sizes, in metres. Tuned so a normal walk renders
// as a believable hallway with rooms that don't overlap the path.
const CORRIDOR_HALF_WIDTH = 1.4
const CORRIDOR_GAP = 0.4

const ROOM_SIZE: Record<WaypointType, [number, number]> = {
  ward: [5, 4],
  department: [5, 4],
  canteen: [5, 4],
  pharmacy: [3.5, 3],
  reception: [3.5, 3],
  lift: [2.4, 2.4],
  stairs: [2.8, 2.4],
  toilet: [2.6, 2.4],
  exit: [2.4, 2],
  other: [3, 3],
}

// --- Local metric projection ----------------------------------------------
// Work in metres on a flat plane around a reference point (equirectangular).
// Fine for the tens-of-metres spans of a single floor, and lets us offset and
// build rectangles with plain vector maths before converting back to lat/lng.

interface Vec {
  x: number // metres east
  y: number // metres north
}

const M_PER_LAT = 111320

function project(ref: Coordinates) {
  const mPerLng = M_PER_LAT * Math.cos((ref.lat * Math.PI) / 180)
  const toLocal = (c: Coordinates): Vec => ({
    x: (c.lng - ref.lng) * mPerLng,
    y: (c.lat - ref.lat) * M_PER_LAT,
  })
  const toCoord = (v: Vec): Coordinates => ({
    lat: ref.lat + v.y / M_PER_LAT,
    lng: ref.lng + v.x / mPerLng,
  })
  return { toLocal, toCoord }
}

function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y }
}
function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y }
}
function scale(a: Vec, k: number): Vec {
  return { x: a.x * k, y: a.y * k }
}
function len(a: Vec): number {
  return Math.hypot(a.x, a.y)
}
function norm(a: Vec): Vec {
  const l = len(a)
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}
// Left-hand normal of a direction vector.
function leftNormal(d: Vec): Vec {
  return { x: -d.y, y: d.x }
}

// Build a ribbon polygon around a polyline by offsetting each vertex along the
// averaged normal of its adjacent segments, then closing left-side-forward and
// right-side-back. Good enough visually for gentle indoor walks.
function ribbon(points: Vec[], halfWidth: number): Vec[] | null {
  if (points.length < 2) return null

  const dirs: Vec[] = []
  for (let i = 0; i < points.length - 1; i++) {
    dirs.push(norm(sub(points[i + 1], points[i])))
  }

  const left: Vec[] = []
  const right: Vec[] = []
  for (let i = 0; i < points.length; i++) {
    const dPrev = dirs[i - 1] ?? dirs[i]
    const dNext = dirs[i] ?? dirs[i - 1]
    const n = norm(add(leftNormal(dPrev), leftNormal(dNext)))
    if (n.x === 0 && n.y === 0) continue
    left.push(add(points[i], scale(n, halfWidth)))
    right.push(sub(points[i], scale(n, halfWidth)))
  }
  if (left.length < 2) return null

  return [...left, ...right.reverse()]
}

// Nearest point on a polyline to p, plus the local segment direction there —
// used to decide which way to push a room off the corridor.
function nearestOnPolyline(p: Vec, line: Vec[]): { point: Vec; dir: Vec; dist: number } {
  let best = { point: line[0], dir: { x: 1, y: 0 }, dist: Infinity }
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]
    const b = line[i + 1]
    const ab = sub(b, a)
    const t = Math.max(0, Math.min(1, (sub(p, a).x * ab.x + sub(p, a).y * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)))
    const proj = add(a, scale(ab, t))
    const d = len(sub(p, proj))
    if (d < best.dist) best = { point: proj, dir: norm(ab), dist: d }
  }
  return best
}

// Rectangle of size w×h centred at c, aligned so its width runs along `along`.
function rect(c: Vec, w: number, h: number, along: Vec): Vec[] {
  const u = norm(along)
  const v = leftNormal(u)
  const hw = w / 2
  const hh = h / 2
  return [
    add(c, add(scale(u, -hw), scale(v, -hh))),
    add(c, add(scale(u, hw), scale(v, -hh))),
    add(c, add(scale(u, hw), scale(v, hh))),
    add(c, add(scale(u, -hw), scale(v, hh))),
  ]
}

// Build a schematic for one floor from its trails and the waypoints on it.
// Returns null when there's nothing walked to base a layout on.
export function buildFloorSchematic(
  floor: number,
  trails: SurveyTrail[],
  waypoints: Waypoint[]
): FloorSchematic | null {
  const floorTrails = trails.filter((t) => t.floor === floor && t.points.length >= 2)
  if (floorTrails.length === 0) return null

  // Reference point: first trail vertex. All maths is relative to it.
  const ref = floorTrails[0].points[0]
  const { toLocal, toCoord } = project(ref)

  const localTrails = floorTrails.map((t) => t.points.map(toLocal))

  const corridors: Coordinates[][] = []
  for (const lt of localTrails) {
    const r = ribbon(lt, CORRIDOR_HALF_WIDTH)
    if (r) corridors.push(r.map(toCoord))
  }

  // Place each waypoint as a room beside the nearest corridor. Push it off the
  // corridor centreline by half the corridor + a small gap + half the room, on
  // whichever side the point already leans toward (defaulting to the left).
  const floorWaypoints = waypoints.filter((w) => w.floor === floor)
  const rooms: SchematicRoom[] = []
  for (const w of floorWaypoints) {
    const p = toLocal(w.coordinates)
    let nearest = { point: p, dir: { x: 1, y: 0 }, dist: Infinity }
    for (const lt of localTrails) {
      const cand = nearestOnPolyline(p, lt)
      if (cand.dist < nearest.dist) nearest = cand
    }

    const n = leftNormal(nearest.dir)
    // `nearest.dir` runs in the surveyor's walking direction, so the side read
    // from the footage (the walker's own left/right) maps straight onto it.
    // When the footage didn't resolve a side, fall back to which side of the
    // corridor the point already leans toward (defaulting left when on the line).
    let side: number
    if (w.side === "left") {
      side = 1
    } else if (w.side === "right") {
      side = -1
    } else {
      const sideDot = sub(p, nearest.point).x * n.x + sub(p, nearest.point).y * n.y
      side = sideDot < -0.05 ? -1 : 1
    }

    const [rw, rh] = ROOM_SIZE[w.type] ?? ROOM_SIZE.other
    const offset = CORRIDOR_HALF_WIDTH + CORRIDOR_GAP + rh / 2
    const center = add(nearest.point, scale(n, side * offset))
    const poly = rect(center, rw, rh, nearest.dir)

    rooms.push({
      id: w.id,
      name: w.name,
      type: w.type,
      polygon: poly.map(toCoord),
      center: toCoord(center),
    })
  }

  return { floor, corridors, rooms }
}
