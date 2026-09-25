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
const IDENTITY = join(REPO_ROOT, "data", "venue-identity.json")

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
    // `gcps` falls back to the sheet's the same way `plan` does — a single-floor
    // venue declares its control points once, at the top. A multi-floor venue
    // must give them per floor: each level is a separate drawing on a page of
    // its own size, so one set of sheet coordinates cannot describe them all.
    return { ...floor, plan: floor.plan ?? sheet.plan, gcps: floor.gcps ?? sheet.gcps, image: floor.id }
  })
}

// A person's correction to a drafted sheet's identity, laid over the entry.
// The drafter names a sheet after the ODS record it matched, and ODS files
// departments, closed sites and legacy trusts as sites: the John Radcliffe
// arrived under the Nuffield Orthopaedic Centre trust and St George's on
// Woking. data/venue-identity.json holds what a person has checked; applying it
// here, every time the sheets are read, is what makes a --force re-draft unable
// to put the wrong name back.
const IDENTITY_FIELDS = ["name", "subtitle", "center", "spanM", "notes", "quick", "floorNaming"]
export function applyIdentity(sheet, fix) {
  if (!fix) return sheet
  const out = { ...sheet }
  for (const k of IDENTITY_FIELDS) if (fix[k] !== undefined) out[k] = fix[k]
  // Re-storeying a single-sheet venue: the sheet becomes that one floor, drawn
  // from the same file, under an image named for the floor.
  if (fix.floor) {
    const base = sheet.floors?.[0] ?? { file: sheet.file, page: sheet.page, plan: sheet.plan, gcps: sheet.gcps }
    out.floors = [{ ...base, id: fix.floor.id, floor: fix.floor.floor, label: fix.floor.label }]
  }
  return out
}

export function readIdentity() {
  let doc
  try {
    doc = JSON.parse(readFileSync(IDENTITY, "utf8"))
  } catch (err) {
    throw new Error(`cannot read data/venue-identity.json: ${err.message}`)
  }
  const venues = doc?.venues ?? {}
  for (const [slug, fix] of Object.entries(venues)) {
    if (fix.center && (!Array.isArray(fix.center) || fix.center.length !== 2 || !fix.center.every(Number.isFinite))) {
      throw new Error(`data/venue-identity.json: "${slug}" has an invalid center`)
    }
    if (fix.floor && (typeof fix.floor.id !== "string" || !Number.isFinite(fix.floor.floor) || typeof fix.floor.label !== "string")) {
      throw new Error(`data/venue-identity.json: "${slug}" has an invalid floor (needs id, floor, label)`)
    }
  }
  return venues
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
  const identity = readIdentity()
  // A correction for a sheet that no longer exists is a mistake worth hearing
  // about, not a silent leftover.
  const slugs = new Set(sheets.map((s) => s.slug))
  for (const slug of Object.keys(identity)) {
    if (!slugs.has(slug)) throw new Error(`data/venue-identity.json corrects "${slug}", which is not in data/mapped-sites.json`)
  }
  return sheets.map((sheet) => {
    const fixed = applyIdentity(sheet, identity[sheet.slug])
    return { ...fixed, floors: normaliseFloors(fixed) }
  })
}

export { REPO_ROOT }
