// OpenStreetMap indoor mapping → a Findway venue.
//
// OSM's Simple Indoor Tagging draws a building's inside as polygons tagged
// indoor=room|corridor|area (with level=*), walls, doors, lifts and stairs,
// and names rooms the way the signs do. This turns one hospital's indoor
// elements (scripts/world/fetch-indoor.mjs, `out geom`) into what the app
// needs to navigate it: a floor plan image per level, drawn here as SVG; a
// waypoint for every named or recognisable room, lift, stair and entrance;
// and corridor centre-lines for routing.ts to follow — taken from
// highway=corridor ways where mappers drew them, and otherwise from the
// medial axis of the corridor polygons (scripts/maps/lib/skeleton.mjs, the
// same method the traced NHS sheets use).
//
// Floors are OSM levels as they are: level 0 is the ground floor, which is
// internal floor 0 in the app, level -1 is Basement 1. No venue-specific floor
// naming is invented.
//
// Data © OpenStreetMap contributors, ODbL 1.0. Every venue and every plan
// carries the attribution.
import { makeGrid, fillPolygon, thin, traceSkeleton, simplify, pruneSpurs } from "../../maps/lib/skeleton.mjs"

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)"
const M_PER_LAT = 111320
const mPerLng = (lat) => M_PER_LAT * Math.cos((lat * Math.PI) / 180)

// What an indoor venue needs before it is worth shipping: fewer rooms than
// this is a single ward someone started, not a hospital you can navigate.
export const MIN_ROOMS = 8
export const MIN_NAMED = 4

// ---- tags -------------------------------------------------------------------

// "0;1", "-1", "0-2" → integer levels; mezzanines ("0.5") are left out, the app
// has no half floors.
export function parseLevels(value) {
  if (value === undefined || value === null) return []
  const out = new Set()
  for (const part of String(value).split(";")) {
    const p = part.trim()
    if (!p) continue
    const range = p.match(/^(-?\d+)\s*(?:-|–|to)\s*(-?\d+)$/)
    if (range) {
      const a = Number(range[1])
      const b = Number(range[2])
      if (Math.abs(b - a) > 60) continue
      for (let x = Math.min(a, b); x <= Math.max(a, b); x++) out.add(x)
      continue
    }
    if (/^-?\d+$/.test(p)) out.add(Number(p))
  }
  return [...out].sort((a, b) => a - b)
}

const levelsOf = (tags) => {
  const l = parseLevels(tags.level)
  return l.length ? l : parseLevels(tags.repeat_on)
}

const WORDS = {
  cafe: "Café", restaurant: "Restaurant", food_court: "Food court", canteen: "Canteen", kiosk: "Kiosk",
  pharmacy: "Pharmacy", chemist: "Pharmacy", toilets: "Toilets", reception_desk: "Reception", waiting_room: "Waiting room",
  chapel: "Chapel", place_of_worship: "Chapel", library: "Library", atm: "Cash machine", bank: "Bank", shop: "Shop",
  laboratory: "Laboratory", radiology: "Radiology", emergency: "Emergency department", icu: "Intensive care",
  surgery: "Surgery", cardiology: "Cardiology", oncology: "Oncology", paediatrics: "Paediatrics", pediatrics: "Paediatrics",
  maternity: "Maternity", neurology: "Neurology", orthopaedics: "Orthopaedics", orthopedics: "Orthopaedics", dialysis: "Dialysis",
  physiotherapy: "Physiotherapy", psychiatry: "Psychiatry", dentistry: "Dentistry", ophthalmology: "Ophthalmology",
  dermatology: "Dermatology", urology: "Urology", gynaecology: "Gynaecology", gynecology: "Gynaecology", blood_check: "Blood tests",
  vaccination: "Vaccination", nurse: "Nurses' station", office: "Office", kitchen: "Kitchen", storage: "Storage",
  technical: "Plant room", locker: "Lockers", changing_room: "Changing room", prayer_room: "Prayer room", lounge: "Lounge",
  classroom: "Classroom", lecture_hall: "Lecture hall", conference: "Conference room", security: "Security",
  information: "Information", lost_and_found: "Lost property", parking: "Parking", bicycle_parking: "Bicycle parking",
}
const humanise = (v) => {
  if (!v) return null
  const key = String(v).split(";")[0].trim().toLowerCase()
  if (WORDS[key]) return WORDS[key]
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

const WARD_RE = /\b(ward|station|unit|wing)\b|\bstation\b|\bbettenstation\b|\bservice\b|\bafdeling\b|\bunité\b/i
const DEPT_RE = /\b(department|clinic|clinique|klinik|ambulanz|poli|outpatients?|radiolog|imaging|laborator|labor|surgery|theatre|oncolog|cardiolog|neurolog|orthop|dialys|maternity|paediatric|pediatric|urgence|notaufnahme|emergency|a&e|spoed|physio|therapy|pharmac|apotheke|x-ray|mri|ct\b|scanner|consult|praxis|dentist|ophthalm|dermatolog|urolog|gyn)/i

// What kind of place a tagged element is, in the app's vocabulary.
export function classify(tags, name = "") {
  const t = tags
  const room = (t.room ?? "").toLowerCase()
  if (t.highway === "elevator" || t.elevator === "yes" || room === "elevator" || room === "lift" || t.indoor === "elevator") return "lift"
  if (t.highway === "steps" || t.stairs === "yes" || room === "stairs" || room === "staircase" || room === "stairway" || t.indoor === "stairs") return "stairs"
  if (t.entrance && t.entrance !== "no") return "exit"
  if (t.amenity === "toilets" || room === "toilets" || room === "toilet" || t.toilets) return "toilet"
  if (t.amenity === "reception_desk" || room === "reception" || t.healthcare === "reception" || t.reception === "yes" || t.office === "reception") return "reception"
  if (["cafe", "restaurant", "food_court", "canteen", "fast_food", "vending_machine"].includes(t.amenity) || ["canteen", "cafe", "cafeteria", "restaurant", "kitchen"].includes(room) || t.shop === "bakery" || t.shop === "coffee") return "canteen"
  if (t.amenity === "pharmacy" || t.healthcare === "pharmacy" || t.shop === "chemist" || room === "pharmacy") return "pharmacy"
  if (room === "ward" || room === "patient_room" || room === "bedroom" || t.healthcare === "ward" || (name && WARD_RE.test(name))) return "ward"
  if (t.healthcare || t.amenity === "clinic" || t.amenity === "doctors" || t.amenity === "hospital" || room === "department" || room === "clinic" || room === "laboratory" || room === "surgery" || room === "consulting" || room === "treatment" || room === "examination" || t["healthcare:speciality"] || (name && DEPT_RE.test(name))) return "department"
  return "other"
}

// A name for the element: what it is signed as, else what its tags say it
// is. null for an anonymous room, which gets no waypoint.
export function nameOf(tags, type) {
  const t = tags
  const given = (t["name:en"] && !t.name ? t["name:en"] : t.name)?.trim()
  if (given) return given
  const spec = humanise(t["healthcare:speciality"])
  if (spec && type === "department") return spec
  if (type === "lift") return t.ref ? `Lift ${t.ref}` : "Lift"
  if (type === "stairs") return t.ref ? `Stairs ${t.ref}` : "Stairs"
  if (type === "exit") return t.entrance === "main" ? "Main entrance" : t.entrance === "emergency" ? "Emergency entrance" : "Entrance"
  if (type === "toilet") return t.wheelchair === "yes" ? "Accessible toilet" : "Toilets"
  if (type === "reception") return "Reception"
  if (type === "canteen") return humanise(t.amenity) ?? humanise(t.room) ?? "Café"
  if (type === "pharmacy") return "Pharmacy"
  const tagged = humanise(t.healthcare && t.healthcare !== "yes" ? t.healthcare : null) ?? humanise(t.amenity) ?? humanise(t.shop) ?? humanise(t.office)
  if (tagged) return tagged
  const room = (t.room ?? "").toLowerCase()
  if (room && !["room", "yes", "area", "corridor", "hall", "space", "other", "unknown"].includes(room)) {
    const r = humanise(room)
    return t.ref ? `${r} ${t.ref}` : r
  }
  if (t.ref) return `Room ${t.ref}`
  return null
}

// ---- geometry ---------------------------------------------------------------

const closed = (pts) => pts.length > 3 && pts[0].lat === pts[pts.length - 1].lat && pts[0].lon === pts[pts.length - 1].lon

// Join a multipolygon's member ways into rings by matching endpoints.
function assembleRings(ways) {
  const pool = ways.map((w) => w.slice()).filter((w) => w.length > 1)
  const rings = []
  while (pool.length) {
    let ring = pool.shift()
    let grew = true
    while (!closed(ring) && grew) {
      grew = false
      const end = ring[ring.length - 1]
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i]
        const a = w[0]
        const b = w[w.length - 1]
        if (a.lat === end.lat && a.lon === end.lon) {
          ring = ring.concat(w.slice(1))
          pool.splice(i, 1)
          grew = true
          break
        }
        if (b.lat === end.lat && b.lon === end.lon) {
          ring = ring.concat(w.slice(0, -1).reverse())
          pool.splice(i, 1)
          grew = true
          break
        }
      }
    }
    if (closed(ring)) rings.push(ring)
  }
  return rings
}

// The polygon(s) of an element: [{ outer, inners }], each ring a list of
// {lat, lon}. null for a node or an open way.
export function polygonsOf(el) {
  if (el.type === "way") {
    const g = el.geometry ?? []
    return closed(g) ? [{ outer: g, inners: [] }] : null
  }
  if (el.type === "relation") {
    const outers = assembleRings((el.members ?? []).filter((m) => m.type === "way" && m.role !== "inner" && m.geometry).map((m) => m.geometry))
    const inners = assembleRings((el.members ?? []).filter((m) => m.type === "way" && m.role === "inner" && m.geometry).map((m) => m.geometry))
    if (!outers.length) return null
    // Each hole belongs to the outer ring that contains its first point.
    return outers.map((outer) => ({ outer, inners: inners.filter((r) => pointInRing(r[0], outer)) }))
  }
  return null
}

export function lineOf(el) {
  if (el.type !== "way") return null
  const g = el.geometry ?? []
  return g.length >= 2 && !closed(g) ? g : null
}

function pointInRing(p, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.lon > p.lon !== b.lon > p.lon && p.lat < ((b.lat - a.lat) * (p.lon - a.lon)) / (b.lon - a.lon) + a.lat) inside = !inside
  }
  return inside
}

// Area-weighted centroid in degrees (good enough at room scale), falling back
// to the bounding-box centre for a degenerate ring.
export function centroidOf(ring) {
  // Relative to the first vertex: products of raw longitudes lose the
  // precision a room needs.
  const ox = ring[0].lon
  const oy = ring[0].lat
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xj = ring[j].lon - ox, yj = ring[j].lat - oy
    const xi = ring[i].lon - ox, yi = ring[i].lat - oy
    const f = xj * yi - xi * yj
    a += f
    cx += (xj + xi) * f
    cy += (yj + yi) * f
  }
  if (Math.abs(a) < 1e-16) {
    const b = bboxOf(ring)
    return { lat: (b.s + b.n) / 2, lon: (b.w + b.e) / 2 }
  }
  return { lat: oy + cy / (3 * a), lon: ox + cx / (3 * a) }
}

export function bboxOf(points) {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity
  for (const p of points) {
    if (p.lat < s) s = p.lat
    if (p.lat > n) n = p.lat
    if (p.lon < w) w = p.lon
    if (p.lon > e) e = p.lon
  }
  return { s, w, n, e }
}

const r6 = (n) => Number(n.toFixed(6))
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "place"

// ---- the build --------------------------------------------------------------

// raw: { hospital: { id, country, name, city, lat, lng }, elements }
// Returns { venue, plans: Map<floor, svg>, stats } or { reason } when the
// mapping is too thin to ship.
export function buildIndoorVenue(raw, { id, country, generatedAt }) {
  const els = raw.elements ?? []
  const hospital = raw.hospital

  // 1. Sort the elements into what they are, per level.
  const rooms = []      // { el, polys, levels, type, name, tags }
  const corridors = []  // polygons tagged indoor=corridor (or area)
  const levelOutlines = []
  const walls = []
  const doors = []
  const lines = []      // routable ways: highway=corridor|footway|steps…
  const points = []     // lifts, stairs, entrances, named points
  const buildings = []
  for (const el of els) {
    const t = el.tags ?? {}
    const polys = polygonsOf(el)
    const line = lineOf(el)
    const levels = levelsOf(t)
    if (t.building || t["building:part"]) {
      if (polys) buildings.push({ polys, tags: t })
      // A building outline carries its entrances as nodes; those arrive as
      // their own elements. Nothing else to take from it.
      if (!t.indoor) continue
    }
    if (t.indoor === "level" && polys) {
      for (const L of levels) levelOutlines.push({ polys, level: L, tags: t })
      continue
    }
    if (t.indoor === "wall" && line) {
      for (const L of levels) walls.push({ line, level: L })
      continue
    }
    if (t.indoor === "corridor" || t.indoor === "area") {
      if (polys) for (const L of levels) corridors.push({ polys, level: L, kind: t.indoor })
      else if (line) for (const L of levels) lines.push({ line, level: L })
      // A named corridor/area (an atrium, a hall) is a place too.
      if (t.name && polys) rooms.push({ el, polys, levels, tags: t })
      continue
    }
    if (t.indoor === "room" && polys) {
      rooms.push({ el, polys, levels, tags: t })
      continue
    }
    if (el.type === "node" && (t.door || t.entrance)) {
      if (t.entrance && t.entrance !== "no") points.push({ el, tags: t, levels: levels.length ? levels : [0] })
      else for (const L of levels) doors.push({ lat: el.lat, lon: el.lon, level: L })
      continue
    }
    if (["corridor", "footway", "path", "steps", "elevator", "pedestrian"].includes(t.highway) && line) {
      for (const L of levels) lines.push({ line, level: L, steps: t.highway === "steps" })
      continue
    }
    if ((t.highway === "elevator" || t.elevator === "yes" || t.stairs === "yes" || t.highway === "steps") && levels.length) {
      if (polys) rooms.push({ el, polys, levels, tags: t })
      else points.push({ el, tags: t, levels })
      continue
    }
    // Anything else named and levelled (a shop node, a reception desk).
    if (levels.length && (t.name || t.amenity || t.healthcare || t.shop) && !t.building) {
      if (polys) rooms.push({ el, polys, levels, tags: t })
      else if (el.type === "node") points.push({ el, tags: t, levels })
    }
  }

  const roomCount = rooms.filter((r) => r.tags.indoor === "room").length
  if (roomCount < MIN_ROOMS) return { reason: `${roomCount} rooms` }

  // 2. The venue's extent: everything indoor, padded. A building the indoor
  //    mapping sits in is drawn too, so the plan does not float in space.
  const pts = []
  for (const r of rooms) for (const p of r.polys) pts.push(...p.outer)
  for (const c of corridors) for (const p of c.polys) pts.push(...p.outer)
  for (const o of levelOutlines) for (const p of o.polys) pts.push(...p.outer)
  for (const l of lines) pts.push(...l.line)
  const inner = bboxOf(pts)
  const shownBuildings = buildings.filter((b) => b.polys.some((p) => p.outer.some((q) => q.lat >= inner.s && q.lat <= inner.n && q.lon >= inner.w && q.lon <= inner.e) || pointInRing({ lat: (inner.s + inner.n) / 2, lon: (inner.w + inner.e) / 2 }, p.outer)))
  const midLat = (inner.s + inner.n) / 2
  const kx = mPerLng(midLat)
  const padLat = Math.max((inner.n - inner.s) * 0.06, 6 / M_PER_LAT)
  const padLng = Math.max((inner.e - inner.w) * 0.06, 6 / kx)
  const bounds = { s: inner.s - padLat, n: inner.n + padLat, w: inner.w - padLng, e: inner.e + padLng }
  const W = (bounds.e - bounds.w) * kx
  const H = (bounds.n - bounds.s) * M_PER_LAT
  if (W > 2500 || H > 2500) return { reason: `indoor extent ${Math.round(W)}×${Math.round(H)} m — several sites tagged as one` }
  const px = (p) => [(p.lon - bounds.w) * kx, (bounds.n - p.lat) * M_PER_LAT]
  const toLatLng = ([x, y]) => ({ lat: r6(bounds.n - y / M_PER_LAT), lng: r6(bounds.w + x / kx) })

  // 3. Floors: every level with a room or corridor on it.
  const floorSet = new Set()
  for (const r of rooms) for (const L of r.levels) floorSet.add(L)
  for (const c of corridors) floorSet.add(c.level)
  const floors = [...floorSet].sort((a, b) => a - b).filter((L) => L >= -5 && L <= 40)
  if (!floors.length) return { reason: "no levelled rooms" }

  // 4. Waypoints.
  const waypoints = []
  const used = new Map()
  const addWaypoint = (name, type, p, floor, tags) => {
    // One waypoint per place: a lift mapped as both a node and a room, a
    // room split into two polygons with the same name.
    const dup = waypoints.find((w) => w.floor === floor && w.name === name && w.type === type && Math.hypot((w.coordinates.lat - p.lat) * M_PER_LAT, (w.coordinates.lng - p.lon) * kx) < 4)
    if (dup) return
    const base = `${slug(name)}-${floor < 0 ? `b${-floor}` : `f${floor}`}`
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    const w = { id: n ? `${base}-${n + 1}` : base, name, type, coordinates: { lat: r6(p.lat), lng: r6(p.lon) }, floor }
    const desc = [tags["addr:unit"] && `Unit ${tags["addr:unit"]}`, tags.ref && !name.includes(tags.ref) && `Room ${tags.ref}`, tags.operator, tags.description].filter(Boolean)
    if (desc.length) w.description = desc.join(" · ")
    if (tags.opening_hours) w.hours = tags.opening_hours
    waypoints.push(w)
  }
  for (const r of rooms) {
    const type = classify(r.tags, r.tags.name ?? "")
    const name = nameOf(r.tags, type)
    if (!name) continue
    const c = centroidOf(r.polys[0].outer)
    for (const L of r.levels) if (floorSet.has(L)) addWaypoint(name, type, c, L, r.tags)
  }
  for (const p of points) {
    const type = classify(p.tags, p.tags.name ?? "")
    const name = nameOf(p.tags, type)
    if (!name) continue
    const at = { lat: p.el.lat, lon: p.el.lon }
    for (const L of p.levels) if (floorSet.has(L)) addWaypoint(name, type, at, L, p.tags)
  }
  const named = waypoints.filter((w) => !["lift", "stairs", "exit", "toilet"].includes(w.type))
  const namedPlaces = new Set(named.map((w) => w.name)).size
  if (namedPlaces < MIN_NAMED) return { reason: `${namedPlaces} named places` }

  // 5. Corridor centre-lines per floor.
  const trails = []
  let corridorM = 0
  const pushTrail = (floor, pathPx) => {
    if (pathPx.length < 2) return
    let len = 0
    for (let i = 0; i + 1 < pathPx.length; i++) len += Math.hypot(pathPx[i + 1][0] - pathPx[i][0], pathPx[i + 1][1] - pathPx[i][1])
    if (len < 1) return
    corridorM += len
    trails.push({ id: `osm-${floor < 0 ? `b${-floor}` : `f${floor}`}-${trails.length + 1}`, floor, points: pathPx.map(toLatLng) })
  }
  for (const L of floors) {
    for (const l of lines) if (l.level === L) pushTrail(L, l.line.map(px))
    const polysHere = corridors.filter((c) => c.level === L && c.kind === "corridor")
    if (!polysHere.length) continue
    // Medial axis of the corridor polygons, all of a floor in one grid so
    // adjoining corridors give one connected network.
    let cell = 0.4
    while ((W / cell) * (H / cell) > 9e6) cell *= 1.5
    const gw = Math.ceil(W / cell)
    const gh = Math.ceil(H / cell)
    const grid = makeGrid(gw, gh)
    const toCell = (p) => {
      const [x, y] = px(p)
      return [x / cell, y / cell]
    }
    for (const c of polysHere) for (const poly of c.polys) fillPolygon(grid, [poly.outer, ...poly.inners].map((r) => r.map(toCell)), 1)
    const skel = thin(grid.cells, gw, gh)
    let found = traceSkeleton(skel, gw, gh)
    found = pruneSpurs(found, 3 / cell)
    found = found.map((l) => simplify(l, 0.6 / cell)).filter((l) => {
      let len = 0
      for (let i = 0; i + 1 < l.length; i++) len += Math.hypot(l[i + 1][0] - l[i][0], l[i + 1][1] - l[i][1])
      return len * cell >= 3
    })
    for (const l of found) pushTrail(L, l.map(([cx, cy]) => [(cx + 0.5) * cell, (cy + 0.5) * cell]))
  }

  // 6. Floor plans, one SVG per floor.
  const plans = new Map()
  const floorPlans = []
  for (const L of floors) {
    const svg = renderFloor({
      W, H, px, level: L,
      buildings: shownBuildings,
      outlines: levelOutlines.filter((o) => o.level === L),
      corridors: corridors.filter((c) => c.level === L),
      rooms: rooms.filter((r) => r.levels.includes(L)),
      walls: walls.filter((w) => w.level === L),
      doors: doors.filter((d) => d.level === L),
      lines: lines.filter((l) => l.level === L),
      hospital: hospital.name,
    })
    plans.set(L, svg)
    floorPlans.push({
      id: L < 0 ? `b${-L}` : `l${L}`,
      floor: L,
      label: L === 0 ? "Ground Floor" : L < 0 ? `Basement ${-L}` : `Floor ${L}`,
      imageUrl: `/floorplans/osm/${id}/${L < 0 ? `b${-L}` : `l${L}`}.svg`,
      bounds: [[r6(bounds.s), r6(bounds.w)], [r6(bounds.n), r6(bounds.e)]],
    })
  }

  // 7. The venue.
  const prefer = (re) => waypoints.find((w) => re.test(w.name))?.name
  const quick = [
    prefer(/^main entrance$/i) ?? prefer(/entrance/i),
    prefer(/reception|information|accueil|empfang|receptie/i),
    prefer(/emergency|urgence|notaufnahme|spoed|a&e/i),
    prefer(/pharmac|apotheke|apotheek/i),
    prefer(/caf|restaurant|canteen|kantine/i),
  ].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 5)
  const venue = {
    id,
    slug: slug(hospital.name),
    name: hospital.name,
    subtitle: [hospital.city, "Indoor map from OpenStreetMap"].filter(Boolean).join(" · "),
    category: "hospital",
    center: toLatLng([W / 2, H / 2]),
    defaultZoom: 18,
    floorPlans,
    waypoints,
    trails,
    visibility: "public",
    verified: false,
    country,
    ...(quick.length ? { quickAccess: quick } : {}),
    dataSource: OSM_ATTRIBUTION,
    ...(generatedAt ? { updatedAt: generatedAt } : {}),
  }
  const stats = { rooms: roomCount, waypoints: waypoints.length, named: namedPlaces, floors: floors.length, trails: trails.length, corridorM: Math.round(corridorM), extentM: [Math.round(W), Math.round(H)] }
  return { venue, plans, stats }
}

// ---- drawing ----------------------------------------------------------------

const FILL = {
  toilet: "#e0f2fe", lift: "#fef3c7", stairs: "#fef3c7", exit: "#dcfce7", reception: "#eef2ff",
  canteen: "#fdf2f8", pharmacy: "#ecfdf5", ward: "#f0fdf4", department: "#f5f3ff", other: "#ffffff",
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const f1 = (n) => (Math.round(n * 10) / 10).toString()
const pathOf = (polys, px) =>
  polys
    .map((poly) => [poly.outer, ...poly.inners].map((ring) => ring.map((p, i) => `${i ? "L" : "M"}${f1(px(p)[0])} ${f1(px(p)[1])}`).join("") + "Z").join(""))
    .join("")

// The words of a label laid out in up to two lines at the largest size that
// fits the room, or nothing when none does — a plan crowded with clipped text
// is worse than one with fewer labels.
function fitLabel(name, w, h) {
  const words = name.split(/\s+/)
  for (const fs of [1.8, 1.5, 1.25, 1.0, 0.85]) {
    const lineW = (s) => s.length * fs * 0.56
    if (lineW(name) <= w * 0.92 && fs * 1.3 <= h) return { lines: [name], fs }
    if (words.length > 1 && fs * 2.5 <= h) {
      let best = null
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(" ")
        const b = words.slice(i).join(" ")
        const width = Math.max(lineW(a), lineW(b))
        if (width <= w * 0.92 && (!best || width < best.width)) best = { lines: [a, b], fs, width }
      }
      if (best) return best
    }
  }
  return null
}

function renderFloor({ W, H, px, level, buildings, outlines, corridors, rooms, walls, doors, lines, hospital }) {
  const out = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(W)} ${f1(H)}" font-family="Arial, Helvetica, sans-serif">`)
  out.push(`<title>${esc(hospital)} — ${level === 0 ? "Ground Floor" : level < 0 ? `Basement ${-level}` : `Floor ${level}`}</title>`)
  // The building, so unmapped parts of the floor still read as building.
  for (const b of buildings) out.push(`<path d="${pathOf(b.polys, px)}" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="0.3" fill-rule="evenodd"/>`)
  for (const o of outlines) out.push(`<path d="${pathOf(o.polys, px)}" fill="#f8fafc" stroke="#334155" stroke-width="0.35" fill-rule="evenodd"/>`)
  for (const c of corridors) out.push(`<path d="${pathOf(c.polys, px)}" fill="${c.kind === "corridor" ? "#f1f5f9" : "#f8fafc"}" stroke="#cbd5e1" stroke-width="0.12" fill-rule="evenodd"/>`)
  const labels = []
  for (const r of rooms) {
    const type = classify(r.tags, r.tags.name ?? "")
    const name = nameOf(r.tags, type)
    out.push(`<path d="${pathOf(r.polys, px)}" fill="${FILL[type] ?? "#ffffff"}" stroke="#64748b" stroke-width="0.18" fill-rule="evenodd"/>`)
    if (!name) continue
    const b = bboxOf(r.polys[0].outer)
    const [x0, y0] = px({ lat: b.n, lon: b.w })
    const [x1, y1] = px({ lat: b.s, lon: b.e })
    const c = centroidOf(r.polys[0].outer)
    const [cx, cy] = px(c)
    const fit = fitLabel(name, x1 - x0, y1 - y0)
    if (!fit) continue
    const lh = fit.fs * 1.15
    const top = cy - ((fit.lines.length - 1) * lh) / 2
    labels.push(`<text x="${f1(cx)}" y="${f1(top)}" font-size="${fit.fs}" fill="#1e293b" text-anchor="middle" dominant-baseline="middle">${fit.lines.map((l, i) => `<tspan x="${f1(cx)}" dy="${i ? f1(lh) : 0}">${esc(l)}</tspan>`).join("")}</text>`)
  }
  for (const w of walls) out.push(`<polyline points="${w.line.map((p) => px(p).map(f1).join(",")).join(" ")}" fill="none" stroke="#334155" stroke-width="0.3" stroke-linecap="round"/>`)
  // Where mappers drew the walking lines, a faint trace of them shows the way
  // through parts with no corridor polygon.
  for (const l of lines) out.push(`<polyline points="${l.line.map((p) => px(p).map(f1).join(",")).join(" ")}" fill="none" stroke="#cbd5e1" stroke-width="${l.steps ? 0.6 : 1.2}" stroke-opacity="0.7" stroke-linecap="round" stroke-linejoin="round"${l.steps ? ' stroke-dasharray="0.6 0.6"' : ""}/>`)
  for (const d of doors) {
    const [x, y] = px(d)
    out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="0.3" fill="#22c55e"/>`)
  }
  out.push(...labels)
  out.push(`<text x="${f1(W - 1)}" y="${f1(H - 1)}" font-size="1.4" fill="#64748b" text-anchor="end">© OpenStreetMap contributors</text>`)
  out.push("</svg>")
  return out.join("\n")
}
