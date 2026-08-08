// Stage 5 — write src/lib/venues/nhs-hospitals-data.ts from the canonical data.
//
// This is the file the app actually imports. Everything upstream exists so that
// this one is reproducible: given the same ODS extract and geocode cache, this
// stage is deterministic, and its diff is the reviewable record of what changed
// in the national hospital directory this month.
//
// Sites already covered by a fully-mapped venue are skipped — that decision was
// made in build-sites.mjs and is recorded in data/mapped-coverage.json, so this
// stage just honours the flag rather than re-deriving it.
//
// Run: node scripts/nhs/generate-venues.mjs
import { dataPath, repoPath, readJson, log } from "./lib/paths.mjs"
import { looksLikeHospital } from "./lib/ods.mjs"
import { writeFileSync } from "fs"

const STAGE = "generate-venues"
const OUT = repoPath("src", "lib", "venues", "nhs-hospitals-data.ts")

const data = readJson(dataPath("nhs-sites.json"))
if (!data) {
  console.error(`[${STAGE}] missing data/nhs-sites.json — run: node scripts/nhs/build-sites.mjs`)
  process.exit(1)
}

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')

// Hospitals only, for the same reason fetch-osm searches around hospitals only:
// the ODS trust-site register is every location a trust operates, and nationally
// that is ~38,000 clinics, health centres, dental surgeries and community units.
//
// This file is imported by the app and every row becomes a Venue object at
// module load, so shipping all of them would mean a ~2.7MB source file, 38,000
// map pins and a startup cost to match — for a hospital wayfinder whose previous
// directory was 721 hospitals. Filtering to hospitals still roughly quintuples
// the old coverage.
//
// nhs-sites.json keeps the complete register; this is only what the app ships.
const hospitals = data.sites.filter((s) => looksLikeHospital(s.name))
const notHospitals = data.sites.length - hospitals.length
const included = hospitals.filter((s) => !s.mappedVenueSlug)
const excluded = hospitals.length - included.length

// ODS code order is stable across runs but meaningless to a reader; name order
// makes the committed file browsable and keeps diffs local to the sites that
// actually changed.
included.sort((a, b) => a.name.localeCompare(b.name, "en"))

const lines = []
lines.push("// GENERATED FILE — do not edit by hand.")
lines.push("//")
lines.push("// Written by scripts/nhs/generate-venues.mjs from data/nhs-sites.json, which is")
lines.push("// built from the NHS Organisation Data Service bulk extracts (ets.zip, the")
lines.push("// register of NHS trust SITES) geocoded via postcodes.io. To refresh it, run the")
lines.push("// pipeline — `npm run nhs:refresh` locally, or the nhs-data workflow in CI, which")
lines.push("// opens a PR with the updated data.")
lines.push("//")
lines.push("// HOSPITALS only. The ODS trust-site register is every location a trust operates")
lines.push("// — nationally ~38,000 clinics, health centres, dental surgeries and community")
lines.push("// units — and shipping all of them would be megabytes of pins this app has no")
lines.push("// use for. data/nhs-sites.json keeps the full register.")
lines.push("//")
lines.push("// These are LOCATION pins only: a real map position, no interior floor plan or")
lines.push("// waypoints. Selecting one drops you on the hospital so its inside can then be")
lines.push("// surveyed in-app. Sites that already ship as fully-mapped venues are excluded")
lines.push("// automatically (see data/mapped-coverage.json) — that used to be a hand-kept")
lines.push("// list in this comment, and is now derived from the venue modules themselves.")
lines.push("//")
lines.push("// Contains public sector information licensed under the Open Government Licence v3.0.")
lines.push(`// Source data generated ${data.generatedAt}.`)
lines.push("")
lines.push("export type NhsHospitalSite = [")
lines.push("  name: string,")
lines.push("  lat: number,")
lines.push("  lng: number,")
lines.push("  odsCode: string,")
lines.push("  postcode: string,")
lines.push("]")
lines.push("")
lines.push(`// ${included.length} hospitals (${excluded} omitted as already fully mapped,`)
lines.push(`// ${notHospitals} non-hospital trust sites omitted — clinics, health centres, community units).`)
lines.push("export const NHS_HOSPITAL_SITES: NhsHospitalSite[] = [")
for (const s of included) {
  lines.push(`  ["${esc(s.name)}", ${s.lat}, ${s.lng}, "${esc(s.odsCode)}", "${esc(s.postcode)}"],`)
}
lines.push("]")
lines.push("")
lines.push("// When the source data was generated, surfaced in the UI so a stale directory is")
lines.push("// visible rather than silently trusted.")
lines.push(`export const NHS_DATA_GENERATED_AT = "${esc(data.generatedAt)}"`)
lines.push("")

writeFileSync(OUT, lines.join("\n"))
log(STAGE, `wrote ${included.length} hospitals to src/lib/venues/nhs-hospitals-data.ts (${excluded} excluded as fully mapped, ${notHospitals} non-hospital trust sites not shipped)`)
