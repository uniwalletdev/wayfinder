#!/usr/bin/env node
// What each sheet already tells you about where it is.
//
// audit-placement.mjs measures how wrong a placement is. This lists the evidence
// for making it right, and all of it is evidence the trust printed on its own
// map and the pipeline discards: the streets around the site, the north arrow,
// the scale bar.
//
// A named street is half a control point. "GUILFORD STREET" at (0.31, 0.08) on
// the page needs only the coordinate of Guilford Street to become a
// correspondence, and two correspondences solve a sheet's angle, scale and
// position together (solvePlanPlacement in src/lib/plan-georeference.ts). Two
// named streets that cross give a junction, which is better still: a point
// rather than a line.
//
// Getting the coordinates is the half this cannot do — it needs OpenStreetMap or
// a gazetteer, and neither is reachable from a sandbox with a locked-down egress
// policy. So the output is a worklist: which sheets can be georeferenced from
// what they say, and which have nothing to say and need a human eye or a survey.
//
// Run: node scripts/maps/anchors.mjs [--json] [--venue <slug>] [--full]

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, dirname, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { readAnchors } from "./lib/anchors.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const PLAN_DIR = join(ROOT, "public", "floorplans")

const argv = process.argv.slice(2)
const AS_JSON = argv.includes("--json")
const FULL = argv.includes("--full")
const ONLY = argv.includes("--venue") ? argv[argv.indexOf("--venue") + 1] : null

function planFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...planFiles(path))
    else if (entry.endsWith(".svg")) out.push(path)
  }
  return out
}

// How much a sheet's own printing is worth as a georeference.
//
// Two distinct streets is the threshold, because that is what the solver needs:
// two correspondences fix rotation, scale and position exactly. One street
// constrains but does not solve. A north label on its own settles the angle to
// within the drawing's accuracy and leaves scale and position open.
function gradeOf(a) {
  if (a.streetNames.length >= 3) return { grade: "strong", why: `${a.streetNames.length} named streets` }
  if (a.streetNames.length === 2) return { grade: "solvable", why: "two named streets" }
  if (a.streetNames.length === 1 && a.north.length) return { grade: "partial", why: "one street and a north arrow" }
  if (a.streetNames.length === 1) return { grade: "partial", why: "one named street" }
  if (a.north.length) return { grade: "angle-only", why: "a north arrow, nothing to anchor to" }
  return { grade: "none", why: "nothing printed that names a place" }
}

const ORDER = ["strong", "solvable", "partial", "angle-only", "none"]

function main() {
  const rows = []
  for (const file of planFiles(PLAN_DIR)) {
    const slug = relative(PLAN_DIR, file).replace(/\.svg$/, "")
    if (ONLY && !slug.startsWith(ONLY)) continue
    const anchors = readAnchors(readFileSync(file, "utf8"))
    if (!anchors) continue
    rows.push({ slug, ...anchors, ...gradeOf(anchors) })
  }
  rows.sort((a, b) => ORDER.indexOf(a.grade) - ORDER.indexOf(b.grade) || b.streetNames.length - a.streetNames.length)

  if (AS_JSON) {
    console.log(JSON.stringify({ plans: rows }, null, 2))
    return
  }

  const pad = (s, n) => String(s).padEnd(n).slice(0, n)
  console.log(pad("plan", 46) + pad("grade", 11) + "  streets  N  scale   named")
  for (const r of rows) {
    if (!FULL && r.grade === "none") continue
    console.log(
      pad(r.slug, 46) + pad(r.grade, 11) +
      String(r.streetNames.length).padStart(7) +
      String(r.north.length ? "y" : "-").padStart(3) +
      String(r.scaleBars.length ? `${r.scaleBars[0].metres}m` : "-").padStart(7) +
      "   " + r.streetNames.slice(0, 3).join(" · ").slice(0, 58)
    )
  }

  const count = (g) => rows.filter((r) => r.grade === g).length
  console.log(`\n${rows.length} plans read\n`)
  for (const g of ORDER) console.log(`  ${g.padEnd(12)} ${count(g)}`)
  console.log(`\n  solvable from the sheet alone   ${count("strong") + count("solvable")}`)
  console.log(`  printing a north arrow          ${rows.filter((r) => r.north.length).length}`)
  console.log(`  printing a usable scale bar     ${rows.filter((r) => r.scaleBars.length).length}`)
  const names = new Set(rows.flatMap((r) => r.streetNames))
  console.log(`  distinct street names in total  ${names.size}`)
  if (!FULL && count("none")) console.log(`\n  (${count("none")} plans with nothing printed hidden — pass --full)`)
}

main()
