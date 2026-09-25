#!/usr/bin/env node
// Write the identity corrections in data/venue-identity.json into the committed
// venue modules and data/mapped-sites.json.
//
// The generated venue modules say "edit build-venues.mjs, not this", and a
// corrected sheet would normally be rebuilt from its PDF. The PDFs are not in
// the repo (`/map/` is gitignored), so the same corrections the build applies
// through scripts/maps/sheets.mjs are applied here directly to the committed
// output. The two must agree: rebuilding after this must be a no-op on names,
// positions and storeys.
//
// What it does, per corrected venue:
//   - renames it (name, subtitle, header comment, notes, quickAccess)
//   - moves it: every coordinate in the module — waypoints, corridor points,
//     plan bounds, centre — is translated from the drafted centre to the
//     corrected one and, where the drafted scale came from the wrong
//     hospital's footprint, scaled about it. The drawing keeps its shape.
//   - re-storeys a single-sheet venue that is one level of a building, and
//     renames its floor-plan image to match
//   - records the same name, subtitle, centre, scale and notes in
//     data/mapped-sites.json, so the file reads true on its own
//   - a hand-built venue (an entry naming its `module`) has no sheet: it is
//     renamed, re-addressed, re-noted or moved in its module only, and never
//     rescaled — there is no drafted span to scale against
//
// Idempotent: a venue already at its corrected identity is left untouched.
//
// Run: node scripts/maps/apply-identity.mjs [--dry-run]

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { readIdentity } from "./sheets.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const VENUE_DIR = join(ROOT, "src", "lib", "venues")
const SITES = join(ROOT, "data", "mapped-sites.json")
const DRY = process.argv.includes("--dry-run")
const M = 111320 // metres per degree of latitude

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
const unesc = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\")
const r6 = (n) => Number(n.toFixed(6))
const NAME = /^  name: "((?:[^"\\]|\\.)*)",$/m
const SUBTITLE = /^  subtitle: "((?:[^"\\]|\\.)*)",$/m
const CENTER = /^  center: \{ lat: (-?[\d.]+), lng: (-?[\d.]+) \},$/m
const NOTES = /(  accessibility: \{[^\n]*notes: ")((?:[^"\\]|\\.)*)(" \},)$/m
const QUICK = /^  quickAccess: \[[^\]]*\],$/m
const FLOOR_NAMING = /^  floorNaming: \{[^\n]*\},\n/m
const PLAN = /^(    \{ id: ")([^"]+)(", floor: )(-?\d+)(, label: ")((?:[^"\\]|\\.)*)(", imageUrl: "\/floorplans\/[^/"]+\/)([^"]+)(\.svg", bounds: .*)$/m

// Translate (and scale) one point from the drafted frame to the corrected one.
function mover(from, to, scale) {
  const cosFrom = Math.cos((from[0] * Math.PI) / 180)
  const cosTo = Math.cos((to[0] * Math.PI) / 180)
  return (lat, lng) => {
    const north = (lat - from[0]) * M * scale
    const east = (lng - from[1]) * M * cosFrom * scale
    return [r6(to[0] + north / M), r6(to[1] + east / (M * cosTo))]
  }
}

const sitesDoc = JSON.parse(readFileSync(SITES, "utf8"))
const identity = readIdentity()
const report = []

for (const [slug, fix] of Object.entries(identity)) {
  const handBuilt = fix.module !== undefined
  const path = join(VENUE_DIR, `${handBuilt ? fix.module : slug}.ts`)
  // A hand-built venue's sheet entry is a stand-in with no span, so a move
  // is a translation and the mapped-sites record is left alone.
  const sheet = handBuilt ? { center: null, spanM: null } : sitesDoc.sheets.find((s) => s.slug === slug)
  if (!sheet) throw new Error(`${slug}: not in data/mapped-sites.json`)
  if (!existsSync(path)) throw new Error(`${slug}: no venue module at ${path}`)
  let src = readFileSync(path, "utf8")
  if (handBuilt && !new RegExp(`^  slug: "${slug}",$`, "m").test(src)) throw new Error(`${slug}: module ${fix.module}.ts does not carry that slug`)
  const changes = []

  const oldName = unesc(NAME.exec(src)?.[1] ?? "")
  const centerMatch = CENTER.exec(src)
  if (!oldName || !centerMatch) throw new Error(`${slug}: module does not expose name and center in the expected shape`)
  const oldCenter = [Number(centerMatch[1]), Number(centerMatch[2])]

  // --- Position and scale ---------------------------------------------------
  // The module's centre is the drafted one unless the sheet was placed from
  // control points, in which case the drawing is already where a person put
  // it and a translation would move it off.
  if (fix.center || fix.spanM) {
    const gcps = sheet.gcps ?? sheet.floors?.some((f) => f.gcps)
    if (gcps) throw new Error(`${slug}: placed from control points; correct those in mapped-sites.json instead`)
    const to = fix.center ?? oldCenter
    const scale = fix.spanM && !handBuilt ? fix.spanM / sheet.spanM : 1
    const moved = Math.abs(to[0] - oldCenter[0]) > 1e-7 || Math.abs(to[1] - oldCenter[1]) > 1e-7 || Math.abs(scale - 1) > 1e-9
    if (moved) {
      const move = mover(oldCenter, to, scale)
      let points = 0
      src = src.replace(/lat: (-?[\d.]+), lng: (-?[\d.]+)/g, (_, lat, lng) => {
        points++
        const [a, b] = move(Number(lat), Number(lng))
        return `lat: ${a}, lng: ${b}`
      })
      src = src.replace(/bounds: \[\[(-?[\d.]+), (-?[\d.]+)\], \[(-?[\d.]+), (-?[\d.]+)\]\]/g, (_, s, w, n, e) => {
        const [S, W] = move(Number(s), Number(w))
        const [N, E] = move(Number(n), Number(e))
        return `bounds: [[${S}, ${W}], [${N}, ${E}]]`
      })
      const km = Math.hypot((to[0] - oldCenter[0]) * M, (to[1] - oldCenter[1]) * M * Math.cos((to[0] * Math.PI) / 180)) / 1000
      changes.push(`moved ${km.toFixed(1)} km${scale !== 1 ? `, scaled ×${scale.toFixed(2)}` : ""} (${points} points)`)
      sheet.center = to
      if (fix.spanM) sheet.spanM = fix.spanM
    }
  }

  // --- Name, trust, notes, shortcuts ---------------------------------------
  if (fix.name && fix.name !== oldName) {
    src = src.replace(NAME, `  name: "${esc(fix.name)}",`)
    src = src.replace(`// ${oldName} —`, () => `// ${fix.name} —`)
    changes.push(`renamed "${oldName}" -> "${fix.name}"`)
    sheet.name = fix.name
  }
  if (fix.subtitle && unesc(SUBTITLE.exec(src)?.[1] ?? "") !== fix.subtitle) {
    src = src.replace(SUBTITLE, `  subtitle: "${esc(fix.subtitle)}",`)
    changes.push(`subtitle -> "${fix.subtitle}"`)
    sheet.subtitle = fix.subtitle
  }
  if (fix.notes && unesc(NOTES.exec(src)?.[2] ?? "") !== fix.notes) {
    if (!NOTES.test(src)) throw new Error(`${slug}: no accessibility notes line to replace`)
    src = src.replace(NOTES, (_, head, __, tail) => `${head}${esc(fix.notes)}${tail}`)
    changes.push("notes rewritten")
    sheet.notes = fix.notes
  }
  if (fix.quick) {
    const line = `  quickAccess: [${fix.quick.map((q) => `"${esc(q)}"`).join(", ")}],`
    if (QUICK.exec(src)?.[0] !== line) {
      src = src.replace(QUICK, line)
      changes.push(`quickAccess -> [${fix.quick.join(", ")}]`)
    }
    sheet.quick = fix.quick
  }
  if (fix.floorNaming) {
    const line = `  floorNaming: { word: "${esc(fix.floorNaming.word)}", groundLevel: ${fix.floorNaming.groundLevel} },\n`
    if (FLOOR_NAMING.exec(src)?.[0] !== line) {
      src = FLOOR_NAMING.test(src)
        ? src.replace(FLOOR_NAMING, line)
        : src.replace(/^(  accessibility: \{[^\n]*\n)/m, `$1${line}`)
      changes.push(`floorNaming -> ${fix.floorNaming.word} from ${fix.floorNaming.groundLevel}`)
    }
    sheet.floorNaming = fix.floorNaming
  }

  // --- Storey ----------------------------------------------------------------
  if (fix.floor) {
    const plan = PLAN.exec(src)
    if (!plan) throw new Error(`${slug}: no floor plan line to re-storey`)
    const [, , planId, , planFloor, , , , image] = plan
    if (planId !== fix.floor.id || Number(planFloor) !== fix.floor.floor || image !== fix.floor.id) {
      if ((src.match(/^    \{ id: "[^"]+", floor: -?\d+, label: /gm) ?? []).length !== 1) {
        throw new Error(`${slug}: a floor correction applies to a single-sheet venue only`)
      }
      src = src.replace(PLAN, (_, a, __, b, ___, c, ____, d, _____, tail) =>
        `${a}${fix.floor.id}${b}${fix.floor.floor}${c}${esc(fix.floor.label)}${d}${fix.floor.id}${tail}`)
      // Every waypoint and corridor on the sheet sits on its one storey.
      src = src.replace(new RegExp(`floor: ${planFloor}(?=[,\\s}])`, "g"), `floor: ${fix.floor.floor}`)
      const dir = join(ROOT, "public", "floorplans", slug)
      const from = join(dir, `${image}.svg`)
      const to = join(dir, `${fix.floor.id}.svg`)
      if (existsSync(from) && !existsSync(to)) {
        if (!DRY) renameSync(from, to)
        changes.push(`floor plan ${image}.svg -> ${fix.floor.id}.svg`)
      }
      changes.push(`storey ${planFloor} -> ${fix.floor.floor} "${fix.floor.label}"`)
    }
    const base = sheet.floors?.[0] ?? { file: sheet.file, page: sheet.page }
    sheet.floors = [{ id: fix.floor.id, floor: fix.floor.floor, label: fix.floor.label, file: base.file, page: base.page }]
  }

  if (!changes.length) continue
  report.push(`${slug}:\n  ${changes.join("\n  ")}`)
  if (!DRY) writeFileSync(path, src)
}

const sheetChanges = report.some((r) => !identity[r.split(":")[0]]?.module)
if (!DRY && sheetChanges) writeFileSync(SITES, JSON.stringify(sitesDoc, null, 2) + "\n")
console.log(report.length ? report.join("\n") : "nothing to change")
console.log(`${DRY ? "[dry run] " : ""}${report.length} venue(s) corrected`)
