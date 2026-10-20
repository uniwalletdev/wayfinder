// Stage W3 — write src/lib/venues/world-hospitals-data.ts from the canonical
// data. Mirrors scripts/nhs/generate-venues.mjs.
//
// Run: node scripts/world/generate-venues.mjs
import { dataPath, repoPath, readJson, log } from "../nhs/lib/paths.mjs"
import { writeFileSync } from "fs"

const STAGE = "world-generate-venues"
const OUT = repoPath("src", "lib", "venues", "world-hospitals-data.ts")

const data = readJson(dataPath("world", "world-sites.json"))
if (!data) {
  console.error(`[${STAGE}] missing data/world/world-sites.json — run: node scripts/world/build-sites.mjs`)
  process.exit(1)
}

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')

const sites = [...data.sites].sort(
  (a, b) => a.countryCode.localeCompare(b.countryCode) || a.name.localeCompare(b.name, "en")
)

const lines = []
lines.push("// GENERATED FILE — do not edit by hand.")
lines.push("//")
lines.push("// Written by scripts/world/generate-venues.mjs from data/world/world-sites.json,")
lines.push("// which merges scripts/world/discover-plans.mjs's per-country OpenStreetMap")
lines.push("// hospital lists. To refresh it: node scripts/world/build-sites.mjs && node")
lines.push("// scripts/world/generate-venues.mjs.")
lines.push("//")
lines.push("// These are LOCATION pins only, the world equivalent of nhs-hospitals-data.ts:")
lines.push("// a real map position, no interior floor plan or waypoints. Selecting one drops")
lines.push("// you on the hospital so its inside can then be surveyed in-app. Coverage is")
lines.push("// whatever OpenStreetMap volunteers have mapped with a website tag and")
lines.push("// amenity=hospital — a floor, not a census: a real hospital with no OSM entry,")
lines.push("// or one whose contributor didn't add a website, is invisible to this list.")
lines.push("//")
lines.push("// Hospital locations © OpenStreetMap contributors, ODbL 1.0.")
lines.push(`// Source data generated ${data.generatedAt}.`)
lines.push("")
lines.push("export type WorldHospitalSite = [")
lines.push("  name: string,")
lines.push("  lat: number,")
lines.push("  lng: number,")
lines.push("  code: string,")
lines.push("  countryCode: string,")
lines.push("]")
lines.push("")
lines.push(`// ${sites.length} hospitals across ${Object.keys(data.byCountry ?? {}).length} countries.`)
for (const [cc, count] of Object.entries(data.byCountry ?? {})) {
  lines.push(`// ${cc}: ${count}`)
}
lines.push("export const WORLD_HOSPITAL_SITES: WorldHospitalSite[] = [")
for (const s of sites) {
  lines.push(`  ["${esc(s.name)}", ${s.lat}, ${s.lng}, "${esc(s.code)}", "${esc(s.countryCode)}"],`)
}
lines.push("]")
lines.push("")
lines.push(`export const WORLD_DATA_GENERATED_AT = "${esc(data.generatedAt)}"`)
lines.push("")

writeFileSync(OUT, lines.join("\n"))
log(STAGE, `wrote ${sites.length} hospitals to src/lib/venues/world-hospitals-data.ts`)
