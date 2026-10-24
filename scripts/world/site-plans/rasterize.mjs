// Rasterise each drafted sheet's PDF page to SVG. Adapted from backup/
// legacy-world-pipeline's scripts/world/generate-floorplans.mjs — same
// renderer (pdf2svg.mjs), same per-slug output convention. Reads
// data/world/mapped-sites.json directly rather than through
// scripts/maps/sheets.mjs's readSheets(), which is hardcoded to the NHS
// config path (data/mapped-sites.json) and shared with the live NHS
// pipeline — not something to repoint for this. normaliseFloors() is a pure
// function and safe to reuse as-is.
//
// Run: node scripts/world/site-plans/rasterize.mjs
import { pdfPageToSvg } from "../../maps/pdf2svg.mjs"
import { normaliseFloors } from "../../maps/sheets.mjs"
import { writeFileSync, mkdirSync } from "fs"
import { dataPath, readJson, log } from "../../nhs/lib/paths.mjs"

const STAGE = "site-plans-rasterize"
const sheetsDoc = readJson(dataPath("world", "mapped-sites.json"), { sheets: [] })
const MAPS = sheetsDoc.sheets.flatMap((s) => normaliseFloors(s).map((f) => [f.file, f.page, s.slug, f.image]))

for (const [file, page, slug, image] of MAPS) {
  const { svg, width, height } = await pdfPageToSvg(file, page)
  mkdirSync(`public/floorplans/${slug}`, { recursive: true })
  writeFileSync(`public/floorplans/${slug}/${image}.svg`, svg)
  log(STAGE, `${slug}/${image}: ${Math.round(width)}x${Math.round(height)} ${(svg.length / 1024).toFixed(0)}KB`)
}
log(STAGE, `done — ${MAPS.length} plan(s) rasterised`)
