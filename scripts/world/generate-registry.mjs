// Write the barrel that registers auto-generated WORLD sheet venues with the
// app. World equivalent of scripts/nhs/generate-registry.mjs — same reasoning
// (one import in index.ts instead of one per hospital as the batch grows),
// reading data/world/mapped-sites.json and writing a separate barrel so NHS's
// own generated-sheets.ts is untouched.
//
// Run: node scripts/world/generate-registry.mjs
import { existsSync, writeFileSync } from "fs"
import { dataPath, repoPath, readJson, log } from "../nhs/lib/paths.mjs"

const STAGE = "world-generate-registry"
const OUT = repoPath("src", "lib", "venues", "world-generated-sheets.ts")

const exportName = (slug) => `${slug.toUpperCase().replace(/-/g, "_")}_VENUE`

const sheetsDoc = readJson(dataPath("world", "mapped-sites.json"))
if (!sheetsDoc) {
  console.error(`[${STAGE}] missing data/world/mapped-sites.json — run: node scripts/world/draft-sheets.mjs`)
  process.exit(1)
}

const auto = sheetsDoc.sheets
  .filter((s) => s.auto)
  .filter((s) => {
    const exists = existsSync(repoPath("src", "lib", "venues", `${s.slug}.ts`))
    if (!exists) log(STAGE, `  skipping ${s.slug} — no venue module yet (run build-venues.mjs)`)
    return exists
  })
  .sort((a, b) => a.slug.localeCompare(b.slug))

const lines = []
lines.push("// GENERATED FILE — do not edit by hand.")
lines.push("//")
lines.push("// Written by scripts/world/generate-registry.mjs. Collects the venues built")
lines.push("// automatically from hospital site-map PDFs discovered by scripts/world/, so")
lines.push("// src/lib/venues/index.ts doesn't need an import line per hospital.")
lines.push("//")
lines.push("// Placement for these is derived, not hand-tuned: the centre comes from")
lines.push("// OpenStreetMap and the scale is a default estimate (no building-footprint")
lines.push("// fetch for world hospitals yet, unlike the NHS pipeline's). Unverified until")
lines.push("// someone checks the sheet against the map.")
lines.push("//")
lines.push("// Source maps remain the copyright of the publishing hospital; each sheet's")
lines.push("// origin URL is recorded in data/world/plan-sources-<cc>.json.")
lines.push("")

if (!auto.length) {
  lines.push('import { Venue } from "../types"')
  lines.push("")
  lines.push("// No auto-generated world sheet venues yet.")
  lines.push("export const WORLD_GENERATED_SHEET_VENUES: Venue[] = []")
  lines.push("")
} else {
  lines.push('import { Venue } from "../types"')
  for (const sheet of auto) lines.push(`import { ${exportName(sheet.slug)} } from "./${sheet.slug}"`)
  lines.push("")
  lines.push(`// ${auto.length} venue(s) built from published hospital site maps.`)
  lines.push("export const WORLD_GENERATED_SHEET_VENUES: Venue[] = [")
  for (const sheet of auto) lines.push(`  ${exportName(sheet.slug)},`)
  lines.push("]")
  lines.push("")
}

writeFileSync(OUT, lines.join("\n"))
log(STAGE, `wrote ${auto.length} generated sheet venue(s) to src/lib/venues/world-generated-sheets.ts`)
