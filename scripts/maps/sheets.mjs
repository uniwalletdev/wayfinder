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
  return sheets
}

export { REPO_ROOT }
