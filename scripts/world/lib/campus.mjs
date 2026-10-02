// OpenStreetMap hospital grounds → a Findway site-map venue.
//
// Few hospitals have their insides mapped (scripts/world/lib/indoor.mjs), but
// most large ones have their grounds mapped: named buildings and pavilions,
// entrances, car parks, the pharmacy and the café, the paths between them.
// That is the same map the NHS trusts' site maps give, and it answers the
// questions people arrive with — which building, which door, where to park —
// so a hospital without indoor mapping gets a site-map venue instead: one
// "floor" drawn as SVG, a waypoint per building, entrance and facility, and
// the footpaths as corridors for routing.
//
// Data © OpenStreetMap contributors, ODbL 1.0.
import { polygonsOf, lineOf, centroidOf, bboxOf, OSM_ATTRIBUTION, esc, f1, pathOf, fitLabel } from "./indoor.mjs"
import { simplify } from "../../maps/lib/skeleton.mjs"

const M_PER_LAT = 111320
const mPerLng = (lat) => M_PER_LAT * Math.cos((lat * Math.PI) / 180)
const r6 = (n) => Number(n.toFixed(6))
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "place"

// A site map is worth shipping when it names enough of the grounds to be
// useful: two named buildings and a couple of entrances, or one building and
// a handful of facilities. Score = 2 per named building + 1 per entrance or
// facility.
export const MIN_SCORE = 6

const PATHS = new Set(["footway", "path", "pedestrian", "steps", "corridor", "cycleway", "living_street"])
const FACILITIES = new Set(["parking", "parking_entrance", "pharmacy", "cafe", "restaurant", "fast_food", "toilets", "reception_desk", "bicycle_parking", "shelter", "atm", "bank", "place_of_worship", "drinking_water", "bus_station", "taxi", "charging_station"])

const isSite = (t) => t.amenity === "hospital" || t.healthcare === "hospital"
const titleCase = (s) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase())

// What a building or facility is, in the app's vocabulary.
export function placeType(tags, name = "") {
  const t = tags
  if (t.entrance || t.emergency === "emergency_ward_entrance") return "exit"
  if (t.amenity === "pharmacy" || t.healthcare === "pharmacy" || t.shop === "chemist" || /\bpharmac/i.test(name)) return "pharmacy"
  if (["cafe", "restaurant", "fast_food", "food_court"].includes(t.amenity) || /\b(caf[eé]|restaurant|dining|cafeteria|bistro)\b/i.test(name)) return "canteen"
  if (t.amenity === "toilets") return "toilet"
  if (t.amenity === "reception_desk" || /\b(reception|information|welcome) (desk|cent(er|re))\b/i.test(name)) return "reception"
  if (t.amenity === "parking" || t.building === "parking" || t.amenity === "parking_entrance" || /\b(parking|car ?park|garage|park(ing)? (deck|structure|ramp))\b/i.test(name)) return "other"
  if (t.aeroway === "helipad" || t.highway === "bus_stop" || t.amenity === "place_of_worship" || t.building === "chapel" || /\b(chapel|helipad|heliport|bus stop)\b/i.test(name)) return "other"
  if (t.building || t["building:part"] || t.healthcare || t.amenity === "clinic" || t.amenity === "doctors") return "department"
  return "other"
}

export function placeName(tags, type) {
  const t = tags
  const given = (t["name:en"] && !t.name ? t["name:en"] : t.name)?.trim()
  if (given) return given
  if (type === "exit") {
    if (t.entrance === "main") return "Main entrance"
    if (t.entrance === "emergency" || t.emergency === "emergency_ward_entrance") return "Emergency entrance"
    if (t.entrance === "service" || t.entrance === "staff") return null
    return "Entrance"
  }
  if (t.amenity === "parking" || t.building === "parking") return t.parking === "multi-storey" || t.parking === "underground" ? `Parking garage${t.ref ? ` ${t.ref}` : ""}` : `Parking${t.ref ? ` ${t.ref}` : ""}`
  if (t.amenity === "parking_entrance") return "Parking entrance"
  if (t.amenity === "bicycle_parking") return "Bicycle parking"
  if (t.aeroway === "helipad") return "Helipad"
  if (t.highway === "bus_stop") return "Bus stop"
  if (t.amenity === "toilets") return "Toilets"
  if (t.amenity === "pharmacy" || t.healthcare === "pharmacy") return "Pharmacy"
  if (t.amenity) return titleCase(t.amenity.replace(/_/g, " "))
  if (t.healthcare && t.healthcare !== "yes") return titleCase(t.healthcare.replace(/_/g, " "))
  return null
}

const inBounds = (b) => (p) => p.lat >= b.s && p.lat <= b.n && p.lon >= b.w && p.lon <= b.e

// raw: { hospital: { id, name, city, lat, lng, bbox? }, elements }
// Returns { venue, plan, stats } or { reason }.
export function buildCampusVenue(raw, { id, country, generatedAt }) {
  const h = raw.hospital
  const els = raw.elements ?? []
  const hospitalName = (h.name ?? "").trim().toLowerCase()

  const buildings = [] // { polys, tags, name|null, type, nodes }
  const sites = []
  const entrances = [] // { el, tags }
  const facilities = [] // { tags, point, polys|null }
  const paths = []
  const outlineNodes = new Map() // node id → building name
  for (const el of els) {
    const t = el.tags ?? {}
    const polys = polygonsOf(el)
    const line = lineOf(el)
    if (isSite(t) && polys) {
      sites.push({ polys, tags: t })
      if (!t.building) continue
    }
    if ((t.building || t["building:part"]) && polys) {
      const type = placeType(t, t.name ?? "")
      let name = placeName(t, type)
      // The hospital's own name on its main building says nothing a visitor
      // does not know; a differently named building is a landmark.
      if (name && name.trim().toLowerCase() === hospitalName) name = null
      buildings.push({ polys, tags: t, name, type, el })
      if (el.type === "way" && name) for (const n of el.nodes ?? []) outlineNodes.set(n, name)
      continue
    }
    if (el.type === "node" && ((t.entrance && t.entrance !== "no") || t.emergency === "emergency_ward_entrance")) {
      entrances.push({ el, tags: t })
      continue
    }
    if (FACILITIES.has(t.amenity) || t.aeroway === "helipad" || t.highway === "bus_stop" || (t.healthcare && !isSite(t) && t.name) || (t.shop && t.name) || t.amenity === "clinic" || t.amenity === "doctors") {
      const point = el.type === "node" ? { lat: el.lat, lon: el.lon } : polys ? centroidOf(polys[0].outer) : el.center ? { lat: el.center.lat, lon: el.center.lon } : null
      if (point) facilities.push({ tags: t, point, polys })
      continue
    }
    if (PATHS.has(t.highway) && line) paths.push({ line, tags: t })
  }

  const namedBuildings = buildings.filter((b) => b.name)
  const score = 2 * new Set(namedBuildings.map((b) => b.name)).size + entrances.filter((e) => e.tags.entrance === "main" || e.tags.entrance === "emergency" || e.tags.emergency || e.tags.name).length + facilities.length
  if (namedBuildings.length === 0) return { reason: "no named buildings" }
  if (score < MIN_SCORE) return { reason: `score ${score}` }

  // Extent: the hospital grounds, padded. Without a site outline, the
  // buildings and facilities set it.
  const pts = []
  for (const s of sites) for (const p of s.polys) pts.push(...p.outer)
  if (!pts.length && h.bbox) pts.push({ lat: h.bbox[0], lon: h.bbox[1] }, { lat: h.bbox[2], lon: h.bbox[3] })
  if (!pts.length) {
    for (const b of buildings) for (const p of b.polys) pts.push(...p.outer)
    for (const f of facilities) pts.push(f.point)
  }
  const inner = bboxOf(pts)
  const midLat = (inner.s + inner.n) / 2
  const kx = mPerLng(midLat)
  const padLat = Math.max((inner.n - inner.s) * 0.05, 10 / M_PER_LAT)
  const padLng = Math.max((inner.e - inner.w) * 0.05, 10 / kx)
  const bounds = { s: inner.s - padLat, n: inner.n + padLat, w: inner.w - padLng, e: inner.e + padLng }
  const W = (bounds.e - bounds.w) * kx
  const H = (bounds.n - bounds.s) * M_PER_LAT
  if (W > 2500 || H > 2500) return { reason: `grounds ${Math.round(W)}×${Math.round(H)} m — too large for one plan` }
  if (W < 25 || H < 25) return { reason: "grounds too small" }
  const px = (p) => [(p.lon - bounds.w) * kx, (bounds.n - p.lat) * M_PER_LAT]
  const toLatLng = ([x, y]) => ({ lat: r6(bounds.n - y / M_PER_LAT), lng: r6(bounds.w + x / kx) })
  const inside = inBounds(bounds)

  // Waypoints.
  const waypoints = []
  const used = new Map()
  const add = (name, type, p, tags = {}) => {
    const near = waypoints.find((w) => w.name === name && Math.hypot((w.coordinates.lat - p.lat) * M_PER_LAT, (w.coordinates.lng - p.lon) * kx) < 12)
    if (near) return
    const base = slug(name)
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    const w = { id: n ? `${base}-${n + 1}` : base, name, type, coordinates: { lat: r6(p.lat), lng: r6(p.lon) }, floor: 0 }
    const desc = [tags.operator && tags.operator.toLowerCase() !== hospitalName ? tags.operator : null, tags.description, tags["addr:housename"]].filter(Boolean)
    if (desc.length) w.description = desc.join(" · ")
    if (tags.opening_hours) w.hours = tags.opening_hours
    waypoints.push(w)
  }
  for (const b of namedBuildings) if (b.polys[0].outer.some(inside)) add(b.name, b.type, centroidOf(b.polys[0].outer), b.tags)
  let plain = 0
  for (const e of entrances) {
    const p = { lat: e.el.lat, lon: e.el.lon }
    if (!inside(p)) continue
    let name = placeName(e.tags, "exit")
    if (!name) continue
    if (name === "Entrance") {
      const of = outlineNodes.get(e.el.id)
      if (of) name = `${of} entrance`
      // A campus has many doors; without a building to name them after, a
      // dozen anonymous "Entrance" pins is noise rather than help.
      else if (++plain > 8) continue
    }
    add(name, "exit", p, e.tags)
  }
  for (const f of facilities) {
    if (!inside(f.point)) continue
    const type = placeType(f.tags, f.tags.name ?? "")
    const name = placeName(f.tags, type)
    if (name) add(name, type, f.point, f.tags)
  }

  // Footpaths as corridors, trimmed to the grounds and simplified to a metre.
  const trails = []
  let pathM = 0
  for (const p of paths) {
    const pts2 = p.line.filter(inside).map(px)
    if (pts2.length < 2) continue
    const simple = simplify(pts2, 1)
    let len = 0
    for (let i = 0; i + 1 < simple.length; i++) len += Math.hypot(simple[i + 1][0] - simple[i][0], simple[i + 1][1] - simple[i][1])
    if (len < 4) continue
    pathM += len
    trails.push({ id: `path-${trails.length + 1}`, floor: 0, points: simple.map(toLatLng) })
  }

  const plan = renderSite({ W, H, px, sites, buildings, facilities, entrances, paths, hospital: h.name })
  const STAFF = /staff|service|loading|delivery|plant|boiler|generator|maintenance/i
  const pick = (type, re, any = false) => {
    const pool = waypoints.filter((w) => w.type === type && !STAFF.test(w.name))
    return (re && pool.find((w) => re.test(w.name)))?.name ?? (any ? pool[0]?.name : undefined)
  }
  const quick = [
    pick("exit", /^main entrance$|main/i, true),
    waypoints.find((w) => /emergency|urgent|\bER\b|\bA&E\b|accident/i.test(w.name) && !STAFF.test(w.name))?.name,
    pick("reception", /reception|information|welcome/i, true),
    pick("pharmacy", /pharmac/i, true),
    pick("canteen", /caf|restaurant|dining|bistro/i, true),
    pick("other", /parking|garage|car park/i),
  ].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 5)

  const venue = {
    id,
    slug: slug(h.name),
    name: h.name,
    subtitle: [h.city, "Site map from OpenStreetMap"].filter(Boolean).join(" · "),
    category: "hospital",
    center: toLatLng([W / 2, H / 2]),
    defaultZoom: 17,
    floorPlans: [{ id: "site", floor: 0, label: "Site map", imageUrl: `/floorplans/osm/${id}/site.svg`, bounds: [[r6(bounds.s), r6(bounds.w)], [r6(bounds.n), r6(bounds.e)]] }],
    waypoints,
    trails,
    visibility: "public",
    verified: false,
    country,
    ...(quick.length ? { quickAccess: quick } : {}),
    dataSource: OSM_ATTRIBUTION,
    ...(generatedAt ? { updatedAt: generatedAt } : {}),
  }
  const stats = { buildings: buildings.length, named: namedBuildings.length, entrances: entrances.length, facilities: facilities.length, waypoints: waypoints.length, trails: trails.length, pathM: Math.round(pathM), extentM: [Math.round(W), Math.round(H)], score }
  return { venue, plan, stats }
}

function renderSite({ W, H, px, sites, buildings, facilities, entrances, paths, hospital }) {
  const out = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(W)} ${f1(H)}" font-family="Arial, Helvetica, sans-serif">`)
  out.push(`<title>${esc(hospital)} — site map</title>`)
  for (const s of sites) out.push(`<path d="${pathOf(s.polys, px)}" fill="#f8fafc" fill-opacity="0.85" stroke="#64748b" stroke-width="0.6" stroke-dasharray="3 2" fill-rule="evenodd"/>`)
  for (const f of facilities) {
    if (!f.polys) continue
    const parking = f.tags.amenity === "parking" || f.tags.amenity === "bicycle_parking"
    out.push(`<path d="${pathOf(f.polys, px)}" fill="${parking ? "#eef2f7" : "#f1f5f9"}" stroke="#cbd5e1" stroke-width="0.4" fill-rule="evenodd"/>`)
  }
  const labels = []
  for (const b of buildings) {
    const parking = b.tags.building === "parking" || b.tags.amenity === "parking"
    out.push(`<path d="${pathOf(b.polys, px)}" fill="${b.name ? (parking ? "#e2e8f0" : "#dbe4ee") : "#e2e8f0"}" stroke="#94a3b8" stroke-width="0.4" fill-rule="evenodd"/>`)
    if (!b.name) continue
    const bb = bboxOf(b.polys[0].outer)
    const [x0, y0] = px({ lat: bb.n, lon: bb.w })
    const [x1, y1] = px({ lat: bb.s, lon: bb.e })
    const fit = fitLabel(b.name, x1 - x0, y1 - y0, [4, 3.2, 2.6, 2.1, 1.7])
    if (!fit) continue
    const [cx, cy] = px(centroidOf(b.polys[0].outer))
    const lh = fit.fs * 1.15
    const top = cy - ((fit.lines.length - 1) * lh) / 2
    labels.push(`<text x="${f1(cx)}" y="${f1(top)}" font-size="${fit.fs}" fill="#1e293b" text-anchor="middle" dominant-baseline="middle">${fit.lines.map((l, i) => `<tspan x="${f1(cx)}" dy="${i ? f1(lh) : 0}">${esc(l)}</tspan>`).join("")}</text>`)
  }
  for (const p of paths) out.push(`<polyline points="${p.line.map((q) => px(q).map(f1).join(",")).join(" ")}" fill="none" stroke="#cbd5e1" stroke-width="${p.tags.highway === "steps" ? 1 : 1.6}" stroke-linecap="round" stroke-linejoin="round"${p.tags.highway === "steps" ? ' stroke-dasharray="1 1"' : ""}/>`)
  for (const f of facilities) {
    const [x, y] = px(f.point)
    const t = f.tags
    const glyph = t.amenity === "parking" || t.amenity === "parking_entrance" ? "P" : t.amenity === "pharmacy" || t.healthcare === "pharmacy" ? "+" : t.aeroway === "helipad" ? "H" : null
    if (glyph) out.push(`<text x="${f1(x)}" y="${f1(y)}" font-size="3" font-weight="bold" fill="#475569" text-anchor="middle" dominant-baseline="middle">${glyph}</text>`)
    else out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="1" fill="#64748b"/>`)
  }
  for (const e of entrances) {
    const [x, y] = px({ lat: e.el.lat, lon: e.el.lon })
    const main = e.tags.entrance === "main" || e.tags.entrance === "emergency" || e.tags.emergency
    out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${main ? 1.4 : 0.9}" fill="${e.tags.entrance === "emergency" || e.tags.emergency ? "#dc2626" : "#16a34a"}"/>`)
  }
  out.push(...labels)
  out.push(`<text x="${f1(W - 2)}" y="${f1(H - 2)}" font-size="2.2" fill="#64748b" text-anchor="end">© OpenStreetMap contributors</text>`)
  out.push("</svg>")
  return out.join("\n")
}
