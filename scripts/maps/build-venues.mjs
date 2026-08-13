// Build src/lib/venues/<slug>.ts for each reconstructed hospital sheet.
//
// For every sheet we: reconstruct the vector floor plan (scripts/maps/pdf2svg),
// pull grouped destination labels (scripts/maps/extract), and place each label
// as a waypoint at its position on the sheet. Geography is approximate by design
// — like the other sheet-derived venues, pin placement within the site is
// illustrative — but self-consistent: pins land on their labels because both
// come from the same coordinate extraction.
//
// `plan` crops waypoint extraction to the actual site-plan area so labels from a
// sheet's directory table / key / title band don't become stray waypoints; the
// floor-plan IMAGE is always the whole sheet. Bounds are anchored so the plan
// centre lands on the hospital's real coordinates.
//
// Run: node scripts/maps/build-venues.mjs
import { extractLabels } from "./extract.mjs"
import { readSheets } from "./sheets.mjs"
import { writeFileSync } from "fs"
// The app's own placement solver, imported directly rather than reimplemented:
// the pins the pipeline writes and the picture the renderer turns have to come
// out of one transform. Node strips the types (22.18+).
import { solvePlanPlacement, placedPlanPoint, placementBounds } from "../../src/lib/plan-georeference.ts"

const R = 111320 // metres per degree latitude

// The sheets to build, and how each one is anchored to the real world, now live
// in data/mapped-sites.json — see scripts/maps/sheets.mjs for the field notes.
// generate-all.mjs reads the same file, so a sheet can't be rasterised without a
// venue or vice versa.
const VENUES = readSheets()

function slugify(s) {
  return s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "wp"
}
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
const r6 = (n) => Number(n.toFixed(6))

// Place one floor: its bounds, and its labels as waypoints on that storey.
//
// Every floor of a building is anchored on the same centre, but each gets its
// own bounds from its OWN page dimensions. Sharing one aspect ratio across
// floors would stretch any sheet drawn at a different size — and trusts publish
// levels of one hospital at whatever size each drawing happened to be.
async function placeFloor(v, floor, usedIds) {
  const { labels, W, H } = await extractLabels(floor.file, floor.page)
  const [px0, py0, px1, py1] = floor.plan
  const inPlan = labels.filter((l) => l.nx >= px0 && l.nx <= px1 && l.ny >= py0 && l.ny <= py1)

  // A georeferenced sheet is placed by its control points; everything else falls
  // back to the centre-and-width anchoring below. The two are not variations on
  // one method: control points solve an angle as well as a position and a size,
  // and the angle is the difference between a plan that sits on its hospital and
  // one that lies across the road at 20° to it.
  const placement = solveFloorPlacement(v, floor, W / H)
  if (placement) {
    const toLatLng = (nx, ny) => {
      const c = placedPlanPoint(placement, W / H, nx, ny)
      return [r6(c.lat), r6(c.lng)]
    }
    const [[bS, bW], [bN, bE]] = placementBounds(placement, W / H)
    return {
      wps: waypointsFrom(inPlan, floor, usedIds, toLatLng),
      bounds: [r6(bS), r6(bW), r6(bN), r6(bE)],
      placement,
    }
  }

  // Bounds: full sheet spans dLng × dLat, anchored so the plan centre == center.
  const [lat0, lng0] = v.center
  const dLng = v.spanM / (R * Math.cos((lat0 * Math.PI) / 180))
  const dLat = (v.spanM * (H / W)) / R
  const pcx = (px0 + px1) / 2, pcy = (py0 + py1) / 2
  // Only the north-west corner is used — toLatLng walks south and east from it.
  // The other two edges were computed and never read.
  const lngW = lng0 - pcx * dLng
  const latN = lat0 + pcy * dLat

  const toLatLng = (nx, ny) => [r6(latN - ny * dLat), r6(lngW + nx * dLng)]

  const [bS, bW] = toLatLng(0, 1) // sheet bottom-left  -> [latS, lngW]
  const [bN, bE] = toLatLng(1, 0) // sheet top-right    -> [latN, lngE]
  return { wps: waypointsFrom(inPlan, floor, usedIds, toLatLng), bounds: [bS, bW, bN, bE], placement: null }
}

// Control points for one floor, if it has any. A sheet's own `gcps` apply to a
// single-floor venue; a multi-floor venue needs them per floor, because each
// level is a different drawing on a differently sized page.
//
// Each is [x, y] normalised on the sheet against [lat, lng] in the world — a
// mapper saying "this corner of the drawing is that corner of the building".
// Two are enough to fix the angle, the scale and the position together.
export function solveFloorPlacement(v, floor, aspectRatio) {
  const gcps = floor.gcps ?? v.gcps
  if (!Array.isArray(gcps) || gcps.length < 2) return null
  const placement = solvePlanPlacement(
    gcps.map((g) => ({
      plan: { x: g.sheet[0], y: g.sheet[1] },
      world: { lat: g.world[0], lng: g.world[1] },
      note: g.note,
    })),
    aspectRatio
  )
  if (!placement) {
    throw new Error(
      `data/mapped-sites.json: sheet "${v.slug}" floor "${floor.id}" has control points that cannot be solved ` +
        `— two points at the same spot on the drawing fix no scale or angle`
    )
  }
  return placement
}

// Waypoint ids are de-duplicated across the WHOLE venue, not per floor: a
// hospital has a "Reception" on several levels, and two waypoints sharing an
// id would collide in routing.
export function waypointsFrom(inPlan, floor, usedIds, toLatLng) {
  return inPlan.map((l) => {
    const base = `${slugify(l.text)}-f${floor.floor}`
    const n = usedIds[base] || 0
    usedIds[base] = n + 1
    const id = n === 0 ? base : `${base}-${n + 1}`
    const [lat, lng] = toLatLng(l.nx, l.ny)
    // A storey read out of the label goes in the description, not the floor.
    // The pin has to stay on the sheet it was extracted from: a hospital that
    // publishes one site map listing "Allebone (Second Floor)" has no floor-2
    // plan to draw, so moving the waypoint there would hide it behind a floor
    // selector with nothing under it. In the description it still reaches the
    // destination card and search, and it is the record a later per-floor
    // ingest needs. Waypoints whose floor comes from the FILENAME are a
    // different case and are placed on their real storey, above.
    return {
      id, name: l.text, type: l.type, lat, lng, floor: floor.floor,
      description: l.storeyLabel ?? undefined,
    }
  })
}

async function build(v) {
  const usedIds = {}
  const placed = []
  for (const floor of v.floors) placed.push({ floor, ...(await placeFloor(v, floor, usedIds)) })
  const wps = placed.flatMap((p) => p.wps)

  // A solved placement supersedes the sheet's declared centre — that centre is
  // an ODS registry address, which is a postal point and not a promise about
  // where the middle of the estate is. Control points put the drawing on the
  // buildings, so its centre is measured rather than assumed.
  const solved = placed.find((p) => p.placement)?.placement
  const [lat0, lng0] = solved ? [solved.center.lat, solved.center.lng] : v.center

  const L = []
  L.push('import { Venue } from "../types"')
  L.push("")
  L.push(`// ${v.name} — reconstructed from the trust's own map sheet${v.floors.length > 1 ? "s" : ""}`)
  L.push(`// (${v.floors.map((f) => f.file).join(", ")}).`)
  L.push("// Generated by scripts/maps/build-venues.mjs — edit that, not this.")
  L.push("")
  L.push(`export const ${v.slug.toUpperCase().replace(/-/g, "_")}_VENUE: Venue = {`)
  L.push(`  id: "${v.id}",`)
  L.push(`  slug: "${v.slug}",`)
  L.push(`  name: "${esc(v.name)}",`)
  L.push(`  subtitle: "${esc(v.subtitle)}",`)
  L.push('  category: "hospital",')
  L.push(`  center: { lat: ${r6(lat0)}, lng: ${r6(lng0)} },`)
  L.push("  defaultZoom: 17,")
  L.push('  visibility: "public",')
  L.push("  verified: false,")
  L.push(`  accessibility: { stepFreeRoute: true, accessibleToilets: true, notes: "${esc(v.notes)}" },`)
  L.push(`  quickAccess: [${v.quick.map((q) => `"${esc(q)}"`).join(", ")}],`)
  L.push("  floorPlans: [")
  for (const { floor, bounds: [bS, bW, bN, bE], placement } of placed) {
    // Only the image turns; the waypoints above are already in world
    // coordinates, placed through the same solution. A rotation written here
    // without those coordinates having gone through it would slide every pin
    // off the drawing.
    const turn = placement && Math.abs(placement.rotation) > 0.05
      ? `, rotation: ${Number(placement.rotation.toFixed(2))}`
      : ""
    L.push(
      `    { id: "${floor.id}", floor: ${floor.floor}, label: "${esc(floor.label)}", ` +
        `imageUrl: "/floorplans/${v.slug}/${floor.image}.svg", bounds: [[${r6(bS)}, ${r6(bW)}], [${r6(bN)}, ${r6(bE)}]]${turn} },`
    )
  }
  L.push("  ],")
  L.push("  waypoints: [")
  for (const w of wps) {
    const desc = w.description ? `, description: "${esc(w.description)}"` : ""
    L.push(`    { id: "${w.id}", name: "${esc(w.name)}", type: "${w.type}", coordinates: { lat: ${w.lat}, lng: ${w.lng} }, floor: ${w.floor}${desc} },`)
  }
  L.push("  ],")
  L.push("}")
  L.push("")
  writeFileSync(`src/lib/venues/${v.slug}.ts`, L.join("\n"))
  return { slug: v.slug, count: wps.length, placement: solved ?? null }
}

// Only when run as a script. The placement helpers above are pure and are
// checked by scripts/maps/test/georeference.test.mjs, which cannot import them
// if importing this file rebuilds all 55 venues — and cannot exercise them
// through build() either, since that needs the trusts' PDFs and map/ is
// gitignored.
if (process.argv[1]?.endsWith("build-venues.mjs")) {
  for (const v of VENUES) {
    const r = await build(v)
    // The residual is the whole point of reporting anything here: it is how far
    // the fit misses the mapper's own control points, and the only number that
    // says whether a plan is placed or merely put somewhere.
    const placement = r.placement
      ? ` — placed from ${r.placement.points} control points, ` +
        `${r.placement.rotation.toFixed(1)}° turn, ±${r.placement.residualM.toFixed(1)} m`
      : ""
    console.log(`${r.slug}: ${r.count} waypoints${placement}`)
  }
}
