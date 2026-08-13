#!/usr/bin/env node
// Mapping-quality audit for every seed venue.
//
// The pipeline can turn a trust's published site-map PDF into a venue without a
// human ever looking at the result, so "we shipped a venue" says nothing about
// whether the venue is *navigable*. This script grades what actually got built,
// against the things the navigation code needs in order to work:
//
//   - routing.ts follows `trails` (corridor centre-lines). With none, every
//     indoor leg falls back to a straight hop flagged `approximate`, and the UI
//     tells the walker to follow local signs instead of drawing a path.
//   - cross-floor routing needs a lift/stairs waypoint on *each* floor it links.
//   - SearchModal matches `quickAccess` names against waypoint names exactly,
//     so a near-miss silently renders no shortcut chips.
//   - a waypoint outside its floor plan's bounds draws off the edge of the plan.
//
// Run: node scripts/maps/audit-venues.mjs [--json] [--full] [--venue <slug>]
//
// Exit code is always 0: this reports, it does not gate. Wire it into CI as a
// report step, or add thresholds once the backlog it surfaces is worked down.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadVenues } from "./lib/venue-source.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const VENUE_DIR = join(ROOT, "src", "lib", "venues")
const PUBLIC_DIR = join(ROOT, "public")

// --- Geometry --------------------------------------------------------------

const M_PER_LAT = 111320

function distanceMeters(a, b) {
  const mPerLng = M_PER_LAT * Math.cos((a.lat * Math.PI) / 180)
  const dx = (a.lng - b.lng) * mPerLng
  const dy = (a.lat - b.lat) * M_PER_LAT
  return Math.hypot(dx, dy)
}

function boundsContain(bounds, c) {
  const [[s, w], [n, e]] = bounds
  return c.lat >= Math.min(s, n) && c.lat <= Math.max(s, n) && c.lng >= Math.min(w, e) && c.lng <= Math.max(w, e)
}

function boundsSpanMeters(bounds) {
  const [[s, w], [n, e]] = bounds
  return {
    height: Math.abs(n - s) * M_PER_LAT,
    width: Math.abs(e - w) * M_PER_LAT * Math.cos(((s + n) / 2 * Math.PI) / 180),
  }
}

// --- Name-quality heuristics ----------------------------------------------
// These catch the signature of text scraped off a drawing rather than authored:
// two or three separate destinations welded into one label because their words
// sat near each other on the sheet, a storey named in the text while the
// waypoint sits on floor 0, and apostrophes lost in extraction.

// A floor named inside a label is only a finding when the waypoint isn't on
// that floor — "Level 3 Reception" on floor 3 is a perfectly good name.
const FLOOR_IN_NAME =
  /\b(ground|first|second|third|fourth|fifth|lower|upper)\s+floor\b|\b(level|floor)\s*[-–]?\s*(\d|[a-z]\b)|\b\d(st|nd|rd|th)\s+floor\b|\bgf\b|\bLL\b/i

// Words that each name a destination in their own right. Several in one label
// means the extractor merged neighbouring captions.
const DESTINATION_WORDS =
  /\b(ward|clinic|department|dept|unit|centre|center|theatre|theatres|reception|entrance|toilets?|wc|cafe|cafeteria|canteen|restaurant|pharmacy|x-ray|xray|radiology|outpatients?|a&e|lift|lifts|stairs|stairwell|car\s?park|chapel|shop|atm)\b/gi

// Names that are navigation furniture from the sheet's legend or key, not
// places inside the hospital.
const NOT_A_PLACE =
  /^(key|legend|north|scale|site\s?map|welcome|welcome to|map|notes?|index|contents|disclaimer|copyright|©.*|page \d+|for more information.*|www\..*|https?:.*|tel[:.].*|\d{4,}|[^a-z0-9]*)$/i

// Off-site context the sheet includes for orientation — real places, but not
// destinations inside this venue.
const OFF_SITE = /\b(station|bus stop|tube|underground|railway|train|park & ride|park and ride|main road|roundabout|a\d{2,}|b\d{3,})\b/i

function countDestinationWords(name) {
  const hits = name.match(DESTINATION_WORDS)
  if (!hits) return 0
  return new Set(hits.map((h) => h.toLowerCase().replace(/\s+/g, ""))).size
}

function nameFindings(w, venue) {
  const out = []
  const name = w.name.trim()

  if (!name) out.push("empty name")
  if (NOT_A_PLACE.test(name)) out.push(`sheet furniture, not a destination: "${name}"`)
  if (OFF_SITE.test(name)) out.push(`off-site landmark listed as a venue destination: "${name}"`)

  // Two or more distinct destination words, and long enough that it isn't a
  // legitimate compound like "Outpatients Reception".
  if (countDestinationWords(name) >= 3) out.push(`several destinations merged into one label: "${name}"`)

  const floorMatch = name.match(FLOOR_IN_NAME)
  if (floorMatch) {
    const digit = name.match(/\b(?:level|floor)\s*[-–]?\s*(\d)|\b(\d)(?:st|nd|rd|th)\s+floor\b/i)
    const named = digit ? Number(digit[1] ?? digit[2]) : null
    const groundLevel = venue.floorNaming?.groundLevel ?? 0
    const asIndex = named === null ? null : named - groundLevel
    if (asIndex === null || asIndex !== w.floor) {
      out.push(`storey named in the label but the waypoint sits on floor ${w.floor}: "${name}"`)
    }
  }

  if (/\b[a-z]\s+s\b/i.test(name) && !/\b(a|i)\s+s\b/i.test(name)) out.push(`apostrophe lost in extraction: "${name}"`)
  if (name.length > 4 && name === name.toUpperCase() && /[A-Z]{4}/.test(name)) out.push(`shouting label kept verbatim from the sheet: "${name}"`)
  if (name.split(/\s+/).length > 8) out.push(`caption, not a name (${name.split(/\s+/).length} words): "${name}"`)

  return out
}

// --- The audit -------------------------------------------------------------

function auditVenue(venue) {
  const wps = venue.waypoints ?? []
  const plans = venue.floorPlans ?? []
  const trails = venue.trails ?? []
  const findings = []
  const add = (severity, code, detail) => findings.push({ severity, code, detail })

  const planFloors = new Set(plans.map((p) => p.floor))
  const wpFloors = new Set(wps.map((w) => w.floor))
  const allFloors = new Set([...planFloors, ...wpFloors])

  // 1. Corridor network — the single biggest determinant of whether a route is
  //    a drawn path or a straight line with a "follow the signs" caveat.
  const trailPoints = trails.reduce((n, t) => n + (t.points?.length ?? 0), 0)
  const trailFloors = new Set(trails.map((t) => t.floor))
  if (trails.length === 0) {
    add("critical", "no-corridors", "no trails: every indoor leg routes as a straight line flagged approximate")
  } else {
    for (const f of wpFloors) {
      if (!trailFloors.has(f)) add("major", "floor-without-corridors", `floor ${f} has waypoints but no corridor network`)
    }
  }

  // 2. Vertical circulation. Cross-floor routing picks a lift on the departure
  //    floor, then looks for its counterpart on the arrival floor.
  const byFloor = new Map()
  for (const w of wps) {
    if (!byFloor.has(w.floor)) byFloor.set(w.floor, [])
    byFloor.get(w.floor).push(w)
  }
  const verticalFloors = new Set(wps.filter((w) => w.type === "lift" || w.type === "stairs").map((w) => w.floor))
  if (allFloors.size > 1) {
    const missing = [...wpFloors].filter((f) => !verticalFloors.has(f)).sort((a, b) => a - b)
    if (missing.length > 0) {
      add(
        "critical",
        "no-vertical-circulation",
        `multi-floor venue with no lift or stairs on floor${missing.length > 1 ? "s" : ""} ${missing.join(", ")} — cross-floor routing cannot connect ${missing.length === wpFloors.size ? "any" : "those"} floor${missing.length > 1 ? "s" : ""}`
      )
    }
    const liftFloors = new Set(wps.filter((w) => w.type === "lift").map((w) => w.floor))
    for (const f of wpFloors) {
      if (!liftFloors.has(f) && verticalFloors.has(f)) {
        add("major", "stairs-only-floor", `floor ${f} has stairs but no lift — step-free routing cannot leave it`)
      }
    }
  }

  // 3. Interior vs campus. A single floor 0 with every waypoint typed as a
  //    building is a site map, not an interior — nothing to navigate indoors.
  const isSingleFloor = allFloors.size <= 1
  if (isSingleFloor && wps.length > 0) {
    add("major", "campus-only", "one floor only: this is a site map with pins on buildings, with no interior to navigate")
  }

  // 4. Type quality. Everything landing in "other"/"department" means the
  //    extractor never worked out what these places are.
  const types = {}
  for (const w of wps) types[w.type] = (types[w.type] ?? 0) + 1
  const generic = (types.other ?? 0) + (types.department ?? 0)
  if (wps.length >= 5 && generic / wps.length > 0.75) {
    add("major", "untyped", `${Math.round((generic / wps.length) * 100)}% of waypoints are "other"/"department" — icons, filters and type-aware search all degrade`)
  }
  for (const kind of ["toilet", "reception", "exit"]) {
    if (wps.length >= 8 && !types[kind]) {
      add("minor", `no-${kind}`, `nothing typed "${kind}" — the amenity people look for most is unfindable`)
    }
  }

  // 5. quickAccess chips resolve by exact name match (SearchModal.tsx:88,
  //    WayfinderApp.tsx:758). A near-miss renders nothing at all.
  const names = new Set(wps.map((w) => w.name))
  for (const q of venue.quickAccess ?? []) {
    if (!names.has(q)) {
      const near = wps
        .map((w) => ({ n: w.name, s: similarity(q, w.name) }))
        .sort((a, b) => b.s - a.s)[0]
      add(
        "major",
        "dead-quick-access",
        `quickAccess "${q}" matches no waypoint — the chip never renders${near && near.s > 0.4 ? ` (closest: "${near.n}")` : ""}`
      )
    }
  }

  // 6. Waypoints outside the plan they are drawn on.
  for (const [floor, list] of byFloor) {
    const plan = plans.find((p) => p.floor === floor)
    if (!plan) {
      if (plans.length > 0) add("major", "floor-without-plan", `floor ${floor} has ${list.length} waypoints but no floor plan`)
      continue
    }
    const outside = list.filter((w) => !boundsContain(plan.bounds, w.coordinates))
    if (outside.length > 0) {
      add("major", "outside-bounds", `${outside.length}/${list.length} waypoints on floor ${floor} fall outside the plan's bounds (e.g. "${outside[0].name}")`)
    }
  }

  // 7. Assets referenced but absent, and what kind of image they are.
  let rasterPlans = 0
  let tracedPlans = 0
  for (const p of plans) {
    const path = join(PUBLIC_DIR, p.imageUrl.replace(/^\//, ""))
    if (!existsSync(path)) {
      add("critical", "missing-asset", `floor plan image ${p.imageUrl} does not exist — the floor renders blank`)
      continue
    }
    if (/\.(png|jpe?g|webp)$/i.test(p.imageUrl)) {
      rasterPlans++
      continue
    }
    const svg = readFileSync(path, "utf8")
    if (/<image[\s>]/.test(svg)) rasterPlans++
    // A trace of a published PDF is a wall of <path> with no structural
    // rectangles; a reconstruction draws rooms and corridors as shapes.
    else if ((svg.match(/<path/g) ?? []).length > 200 && (svg.match(/<rect/g) ?? []).length < 5) tracedPlans++
  }
  if (rasterPlans > 0) add("major", "raster-plan", `${rasterPlans} floor plan(s) are pictures — no structure to route on, no legible text at zoom`)
  if (tracedPlans > 0 && trails.length === 0) {
    add("major", "traced-sheet", `${tracedPlans} floor plan(s) are vector traces of the trust's published sheet — the drawing was converted, the building was not modelled`)
  }

  // 8. Duplicates and stacked pins.
  const seenName = new Map()
  for (const w of wps) {
    const key = `${w.name}|${w.floor}`
    seenName.set(key, (seenName.get(key) ?? 0) + 1)
  }
  const dupes = [...seenName.entries()].filter(([, n]) => n > 1)
  if (dupes.length > 0) add("minor", "duplicate-waypoints", `${dupes.length} name(s) appear more than once on the same floor (e.g. "${dupes[0][0].split("|")[0]}")`)

  let stacked = 0
  for (let i = 0; i < wps.length; i++) {
    for (let j = i + 1; j < wps.length; j++) {
      if (wps[i].floor === wps[j].floor && distanceMeters(wps[i].coordinates, wps[j].coordinates) < 1.5) stacked++
    }
  }
  if (stacked > 0) add("minor", "stacked-waypoints", `${stacked} waypoint pair(s) sit within 1.5 m of each other — pins overlap and are untappable`)

  // 9. Name quality across the venue.
  const nameIssues = []
  for (const w of wps) for (const f of nameFindings(w, venue)) nameIssues.push(f)
  if (nameIssues.length > 0) {
    const share = Math.round((nameIssues.length / Math.max(wps.length, 1)) * 100)
    add(
      nameIssues.length > wps.length * 0.25 ? "major" : "minor",
      "name-quality",
      `${nameIssues.length} label problem(s) across ${wps.length} waypoints (${share}%)`
    )
  }

  // 10. Density. A hospital reduced to a dozen pins isn't mapped, it's indexed.
  const span = plans[0] ? boundsSpanMeters(plans[0].bounds) : null
  const area = span ? (span.width * span.height) / 10000 : null // hectares
  if (wps.length === 0) add("critical", "no-waypoints", "no waypoints: nothing to search for and nowhere to route to")
  else if (wps.length < 10) add("major", "thin-coverage", `only ${wps.length} waypoints for the whole site`)

  // 11. Metadata people rely on.
  if (!venue.verified) add("minor", "unverified", "not verified: placement and content have not been checked against the real site")
  if (!venue.accessibility) add("minor", "no-accessibility", "no accessibility information")

  const score = gradeOf(findings, { wps, trails, allFloors })

  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    grade: score.grade,
    points: score.points,
    stats: {
      waypoints: wps.length,
      floors: allFloors.size,
      floorPlans: plans.length,
      trails: trails.length,
      trailPoints,
      lifts: wps.filter((w) => w.type === "lift").length,
      stairs: wps.filter((w) => w.type === "stairs").length,
      types,
      nameIssues: nameIssues.length,
      areaHectares: area ? Number(area.toFixed(1)) : null,
      verified: !!venue.verified,
    },
    nameIssueDetail: nameIssues,
    findings,
  }
}

// Dice similarity over character bigrams — same measure search.ts uses for
// "did you mean", so a near-miss quickAccess entry is judged the way the app
// would judge it.
function similarity(a, b) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")
  const x = norm(a)
  const y = norm(b)
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0
  const counts = new Map()
  for (let i = 0; i < y.length - 1; i++) {
    const g = y.slice(i, i + 2)
    counts.set(g, (counts.get(g) ?? 0) + 1)
  }
  let common = 0
  for (let i = 0; i < x.length - 1; i++) {
    const g = x.slice(i, i + 2)
    const c = counts.get(g) ?? 0
    if (c > 0) {
      common++
      counts.set(g, c - 1)
    }
  }
  return (2 * common) / (x.length - 1 + (y.length - 1))
}

// A grade for "can a stranger actually be navigated through this building",
// not for "did the pipeline produce a file". The weights say what the app
// needs: a corridor network and vertical circulation are what turn pins into
// navigation, so their absence dominates.
function gradeOf(findings, { wps, trails, allFloors }) {
  let points = 100
  for (const f of findings) {
    points -= f.severity === "critical" ? 25 : f.severity === "major" ? 10 : 3
  }
  if (trails.length > 0) points += 10
  if (allFloors.size > 2) points += 10
  if (wps.length >= 40) points += 5
  points = Math.max(0, Math.min(100, points))
  const grade = points >= 85 ? "A" : points >= 70 ? "B" : points >= 55 ? "C" : points >= 40 ? "D" : points >= 20 ? "E" : "F"
  return { grade, points }
}

// --- Reporting -------------------------------------------------------------

function main() {
  const args = process.argv.slice(2)
  const asJson = args.includes("--json")
  const full = args.includes("--full")
  const only = args.includes("--venue") ? args[args.indexOf("--venue") + 1] : null

  // Audit what actually ships, not what sits on disk. build-venues.mjs writes a
  // module per sheet and never removes one, so regrouping a hospital's separate
  // level sheets into a single multi-floor venue leaves the old per-level
  // modules behind. They are unreferenced and harmless, but auditing them would
  // report duplicate venues the app never shows.
  const registry = readFileSync(join(VENUE_DIR, "index.ts"), "utf8") + readFileSync(join(VENUE_DIR, "generated-sheets.ts"), "utf8")
  const shipped = new Set([...registry.matchAll(/from "\.\/([a-z0-9-]+)"/g)].map((m) => m[1]))

  const onDisk = readdirSync(VENUE_DIR)
    .filter((f) => f.endsWith(".ts") && !["index.ts", "generated-sheets.ts", "nhs-hospitals.ts", "nhs-hospitals-data.ts"].includes(f))
    .map((f) => f.replace(/\.ts$/, ""))
  const files = onDisk.filter((s) => shipped.has(s)).map((s) => `${s}.ts`)
  const dead = onDisk.filter((s) => !shipped.has(s))

  const results = []
  const unreadable = []
  for (const file of files) {
    const src = readFileSync(join(VENUE_DIR, file), "utf8")
    let venues
    try {
      venues = loadVenues(src)
    } catch (err) {
      unreadable.push(`${file}: ${err.message}`)
      continue
    }
    for (const v of venues) {
      if (!v || !v.id) continue
      if (only && v.slug !== only && v.id !== only) continue
      results.push(auditVenue(v))
    }
  }

  results.sort((a, b) => a.points - b.points || a.name.localeCompare(b.name))

  if (asJson) {
    process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), dead, unreadable, results }, null, 2) + "\n")
    return
  }

  const gradeCount = {}
  for (const r of results) gradeCount[r.grade] = (gradeCount[r.grade] ?? 0) + 1

  console.log(`\nMapping quality audit — ${results.length} venues\n`)
  console.log(`Grades: ${["A", "B", "C", "D", "E", "F"].map((g) => `${g}:${gradeCount[g] ?? 0}`).join("  ")}`)
  const withTrails = results.filter((r) => r.stats.trails > 0).length
  const multiFloor = results.filter((r) => r.stats.floors > 1).length
  console.log(`With a corridor network: ${withTrails}/${results.length}   Multi-floor: ${multiFloor}/${results.length}\n`)

  const pad = (s, n) => String(s).padEnd(n)
  console.log(pad("GRADE", 6) + pad("VENUE", 44) + pad("WPS", 5) + pad("FLRS", 5) + pad("TRAILS", 7) + pad("LIFT", 5) + "TOP FINDING")
  console.log("-".repeat(130))
  for (const r of results) {
    const top = r.findings.find((f) => f.severity === "critical") ?? r.findings[0]
    console.log(
      pad(r.grade + " " + r.points, 6) +
        pad(r.name.slice(0, 42), 44) +
        pad(r.stats.waypoints, 5) +
        pad(r.stats.floors, 5) +
        pad(r.stats.trails, 7) +
        pad(r.stats.lifts, 5) +
        (top ? top.detail.slice(0, 60) : "—")
    )
  }

  if (full) {
    for (const r of results) {
      console.log(`\n\n### ${r.name} (${r.slug}) — ${r.grade} ${r.points}/100`)
      console.log(`    ${r.stats.waypoints} waypoints · ${r.stats.floors} floor(s) · ${r.stats.trails} trails · ${r.stats.lifts} lifts · ${r.stats.stairs} stairs`)
      for (const f of r.findings) console.log(`    [${f.severity}] ${f.code}: ${f.detail}`)
      for (const n of r.nameIssueDetail.slice(0, 12)) console.log(`      · ${n}`)
      if (r.nameIssueDetail.length > 12) console.log(`      · …and ${r.nameIssueDetail.length - 12} more`)
    }
  }

  if (dead.length > 0) {
    console.log(`\n${dead.length} venue module(s) on disk that nothing imports — left behind when their sheets were regrouped:`)
    for (const d of dead) console.log(`  src/lib/venues/${d}.ts`)
  }

  if (unreadable.length > 0) {
    console.log(`\nCould not read ${unreadable.length} module(s):`)
    for (const u of unreadable) console.log(`  ${u}`)
  }
  console.log()
}

main()
