// The sheet-derived venue build config, read from data/mapped-sites.json.
//
// generate-all.mjs (which rasterises each trust sheet) and build-venues.mjs
// (which places waypoints on it) both need the same list of sheets. They used to
// each carry their own hardcoded copy, which meant adding a hospital in one and
// forgetting the other produced a venue with no image, or an image with no
// venue — silently, at build time. One file now, read by both.
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const CONFIG = join(REPO_ROOT, "data", "mapped-sites.json")

const REQUIRED = ["slug", "id", "name", "subtitle", "file", "page", "center", "spanM", "plan", "quick", "notes"]

// A sheet may carry several floors of one building. Southampton publishes the
// Princess Anne as nine separate PDFs, one per level; Lincoln, Southend,
// Macclesfield and Sheffield Children's do the same. Left as one venue each,
// they become nine pins on one address instead of one building you can move
// through — which is the whole point of holding floor plans.
//
// Both consumers see ONE shape: every sheet comes back with a `floors` array,
// synthesised from file/page/plan when the sheet doesn't declare one. Making the
// single-floor case the special one inside each script is how generate-all and
// build-venues drifted apart before.
const FLOOR_REQUIRED = ["id", "floor", "label", "file", "page"]

export function normaliseFloors(sheet) {
  if (sheet.floors === undefined) {
    return [{
      id: "f0",
      floor: 0,
      label: "Ground Floor",
      file: sheet.file,
      page: sheet.page,
      plan: sheet.plan,
      // Existing venues already point at sitemap.svg, and public/floorplans is
      // full of them. Renaming would be a silent 404 per venue.
      image: "sitemap",
    }]
  }
  if (!Array.isArray(sheet.floors) || !sheet.floors.length) {
    throw new Error(`data/mapped-sites.json: sheet "${sheet.slug}" has an empty floors array`)
  }
  const seenId = new Set()
  const seenFloor = new Set()
  return sheet.floors.map((floor) => {
    const missing = FLOOR_REQUIRED.filter((k) => floor[k] === undefined || floor[k] === null)
    if (missing.length) {
      throw new Error(`data/mapped-sites.json: sheet "${sheet.slug}" floor "${floor.id ?? "?"}" is missing ${missing.join(", ")}`)
    }
    if (!Number.isFinite(floor.floor)) {
      throw new Error(`data/mapped-sites.json: sheet "${sheet.slug}" floor "${floor.id}" has a non-numeric floor`)
    }
    // Two floors sharing an id would overwrite each other's SVG; two sharing a
    // storey number would stack their waypoints on one level. Both produce a
    // venue that looks built and navigates wrongly.
    if (seenId.has(floor.id)) throw new Error(`data/mapped-sites.json: sheet "${sheet.slug}" repeats floor id "${floor.id}"`)
    if (seenFloor.has(floor.floor)) throw new Error(`data/mapped-sites.json: sheet "${sheet.slug}" repeats storey ${floor.floor}`)
    seenId.add(floor.id)
    seenFloor.add(floor.floor)
    return { ...floor, plan: floor.plan ?? sheet.plan, image: floor.id }
  })
}

export function readSheets() {
  let doc
  try {
    doc = JSON.parse(readFileSync(CONFIG, "utf8"))
  } catch (err) {
    throw new Error(`cannot read data/mapped-sites.json: ${err.message}`)
  }
  const sheets = doc?.sheets
  if (!Array.isArray(sheets) || !sheets.length) {
    throw new Error("data/mapped-sites.json has no `sheets` array")
  }
  // Validate up front rather than letting a missing field turn into NaN
  // coordinates halfway through a generated venue module.
  for (const sheet of sheets) {
    const missing = REQUIRED.filter((k) => sheet[k] === undefined || sheet[k] === null)
    if (missing.length) {
      throw new Error(`data/mapped-sites.json: sheet "${sheet.slug ?? "?"}" is missing ${missing.join(", ")}`)
    }
    if (!Array.isArray(sheet.center) || sheet.center.length !== 2 || !sheet.center.every(Number.isFinite)) {
      throw new Error(`data/mapped-sites.json: sheet "${sheet.slug}" has an invalid center`)
    }
    if (!Array.isArray(sheet.plan) || sheet.plan.length !== 4 || !sheet.plan.every(Number.isFinite)) {
      throw new Error(`data/mapped-sites.json: sheet "${sheet.slug}" has an invalid plan crop`)
    }
  }
  return sheets.map((sheet) => ({ ...sheet, floors: normaliseFloors(sheet) }))
}

export { REPO_ROOT }
