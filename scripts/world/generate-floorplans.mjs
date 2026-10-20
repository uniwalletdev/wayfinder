// Rasterise each world sheet's PDF page to SVG. World equivalent of
// scripts/maps/generate-all.mjs — same renderer (pdf2svg.mjs), same output
// convention (public/floorplans/<slug>/<image>.svg), just reading
// data/world/mapped-sites.json instead of data/mapped-sites.json. Slugs are
// globally unique (country-suffixed by draft-sheets.mjs), so writing into the
// same public/floorplans/ tree as NHS's sheets is safe.
//
// Run: node scripts/world/generate-floorplans.mjs [previewDir]
import { pdfPageToSvg } from "../maps/pdf2svg.mjs"
import sharp from "sharp"
import { writeFileSync, mkdirSync } from "fs"
import { readSheets, WORLD_CONFIG } from "../maps/sheets.mjs"

const MAPS = readSheets(WORLD_CONFIG).flatMap((s) => s.floors.map((f) => [f.file, f.page, s.slug, f.image]))

const thumbOut = process.argv[2]
if (thumbOut) mkdirSync(thumbOut, { recursive: true })
for (const [file, page, slug, image] of MAPS) {
  const { svg, width, height } = await pdfPageToSvg(file, page)
  mkdirSync(`public/floorplans/${slug}`, { recursive: true })
  writeFileSync(`public/floorplans/${slug}/${image}.svg`, svg)
  if (thumbOut && image === "sitemap") await sharp(Buffer.from(svg)).resize({ width: 900 }).png().toFile(`${thumbOut}/${slug}.png`)
  else if (thumbOut) await sharp(Buffer.from(svg)).resize({ width: 900 }).png().toFile(`${thumbOut}/${slug}-${image}.png`)
  console.log(`${slug}/${image}: ${Math.round(width)}x${Math.round(height)}  ${(svg.length / 1024).toFixed(0)}KB`)
}
