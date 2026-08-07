// Write the barrel that registers auto-generated sheet venues with the app.
//
// src/lib/venues/index.ts hand-imports each venue module. That is fine for the
// venues someone built deliberately, and unworkable for a batch that grows every
// time the crawl finds more maps — so auto-drafted sheets are collected into one
// generated module that index.ts imports once.
//
// Only sheets carrying an `auto` block are included. The ten hand-built sheets
// are already imported by name in index.ts, and listing them here as well would
// put every one of them into SEED_VENUES twice.
//
// Run: node scripts/nhs/generate-registry.mjs
import { existsSync, writeFileSync } from "fs"
import { dataPath, repoPath, readJson, log } from "./lib/paths.mjs"

const STAGE = "generate-registry"
const OUT = repoPath("src", "lib", "venues", "generated-sheets.ts")

// Must match how build-venues.mjs names its export.
const exportName = (slug) => `${slug.toUpperCase().replace(/-/g, "_")}_VENUE`

const sheetsDoc = readJson(dataPath("mapped-sites.json"))
if (!sheetsDoc) {
  console.error(`[${STAGE}] missing data/mapped-sites.json`)
  process.exit(1)
}

const auto = sheetsDoc.sheets
  .filter((s) => s.auto)
  // A drafted sheet only becomes a venue once build-venues.mjs has actually
  // written its module; importing one that isn't there breaks the whole app
  // build, so skip quietly and let the next run pick it up.
  .filter((s) => {
    const exists = existsSync(repoPath("src", "lib", "venues", `${s.slug}.ts`))
    if (!exists) log(STAGE, `  skipping ${s.slug} — no venue module yet (run build-venues.mjs)`)
    return exists
  })
  .sort((a, b) => a.slug.localeCompare(b.slug))

const lines = []
lines.push("// GENERATED FILE — do not edit by hand.")
lines.push("//")
lines.push("// Written by scripts/nhs/generate-registry.mjs. Collects the venues built")
lines.push("// automatically from NHS trust site-map PDFs discovered by the ingestion")
lines.push("// pipeline, so src/lib/venues/index.ts doesn't need an import line per")
lines.push("// hospital as the batch grows.")
lines.push("//")
lines.push("// Placement for these is derived, not hand-tuned: the centre comes from the NHS")
lines.push("// ODS register and the scale from the site's OpenStreetMap footprint. They are")
lines.push("// left unverified until someone checks the sheet against the map.")
lines.push("//")
lines.push("// Source maps remain the copyright of the publishing trust; each sheet's origin")
lines.push("// URL is recorded in data/plan-sources.json.")
lines.push("")

if (!auto.length) {
  lines.push('import { Venue } from "../types"')
  lines.push("")
  lines.push("// No auto-generated sheet venues yet — the discovery pipeline hasn't run,")
  lines.push("// or nothing it found passed the quality gate in scripts/nhs/draft-sheets.mjs.")
  lines.push("export const GENERATED_SHEET_VENUES: Venue[] = []")
  lines.push("")
} else {
  lines.push('import { Venue } from "../types"')
  for (const sheet of auto) lines.push(`import { ${exportName(sheet.slug)} } from "./${sheet.slug}"`)
  lines.push("")
  lines.push(`// ${auto.length} venue(s) built from published trust site maps.`)
  lines.push("export const GENERATED_SHEET_VENUES: Venue[] = [")
  for (const sheet of auto) lines.push(`  ${exportName(sheet.slug)},`)
  lines.push("]")
  lines.push("")
}

writeFileSync(OUT, lines.join("\n"))
log(STAGE, `wrote ${auto.length} generated sheet venue(s) to src/lib/venues/generated-sheets.ts`)
