// Writes src/lib/venues/catalog-data.ts: a summary of every mapped seed venue
// (name, centre, flags — what the picker, search and link resolution need)
// and a lazy loader for each one's module.
//
// Why: index.ts imports every mapped hospital's interior, and the app used to
// import index.ts. Someone opening the map for one ward downloaded 67
// hospitals' floor plans, waypoints and corridors — about 60% of the largest
// client chunk. With this file the client ships the summaries (a few KB) plus
// the default venue, and imports a hospital's module the moment it is opened.
//
// Generated rather than hand-written so the summary can never drift from the
// module it describes; scripts/lib-test/venue-catalog.test.mjs fails CI if it
// has. Run after the registry changes: `npm run nhs:catalog` (nhs:ingest does).
//
// Run: node scripts/nhs/generate-venue-catalog.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { register } from "node:module"
import { fileURLToPath } from "node:url"
import { loadVenues } from "../maps/lib/venue-source.mjs"

register(new URL("../lib-test/ts-hooks.mjs", import.meta.url), import.meta.url)

const VENUE_DIR = new URL("../../src/lib/venues/", import.meta.url)
const OUT = fileURLToPath(new URL("catalog-data.ts", VENUE_DIR))

// Files in the venues folder that are not venue modules.
const NOT_MODULES = new Set(["index.ts", "core.ts", "catalog.ts", "catalog-data.ts", "generated-sheets.ts", "nhs-hospitals.ts", "nhs-hospitals-data.ts"])

// The registry decides which venues ship and in what order; the modules on
// disk say where each one lives. Match the two by id.
const { SEED_VENUES } = await import(fileURLToPath(new URL("index.ts", VENUE_DIR)))
const { NHS_HOSPITAL_VENUES } = await import(fileURLToPath(new URL("nhs-hospitals.ts", VENUE_DIR)))
const directoryIds = new Set(NHS_HOSPITAL_VENUES.map((v) => v.id))

const moduleOf = new Map() // venue id -> { file, exportName }
for (const file of readdirSync(VENUE_DIR).filter((f) => f.endsWith(".ts") && !NOT_MODULES.has(f)).sort()) {
  const source = readFileSync(new URL(file, VENUE_DIR), "utf8")
  const names = [...source.matchAll(/^export const (\w+)\s*:\s*Venue\s*=/gm)].map((m) => m[1])
  const venues = loadVenues(source)
  venues.forEach((v, i) => {
    if (moduleOf.has(v.id)) throw new Error(`venue id "${v.id}" is exported by both ${moduleOf.get(v.id).file} and ${file}`)
    moduleOf.set(v.id, { file: file.replace(/\.ts$/, ""), exportName: names[i] })
  })
}

const mapped = SEED_VENUES.filter((v) => !directoryIds.has(v.id))
const summaries = []
const loaders = []
for (const v of mapped) {
  const mod = moduleOf.get(v.id)
  if (!mod) throw new Error(`no module on disk exports venue "${v.id}" (${v.name})`)
  const summary = {
    id: v.id,
    slug: v.slug,
    name: v.name,
    ...(v.subtitle ? { subtitle: v.subtitle } : {}),
    category: v.category,
    center: v.center,
    defaultZoom: v.defaultZoom,
    visibility: v.visibility,
    verified: v.verified,
    ...(v.illustrative ? { illustrative: true } : {}),
    ...(v.odsCode ? { odsCode: v.odsCode } : {}),
    ...(v.country ? { country: v.country } : {}),
    mapped: v.floorPlans.length > 0 || v.waypoints.length > 0,
  }
  summaries.push(`  ${JSON.stringify(summary)},`)
  loaders.push(`  ${JSON.stringify(v.id)}: () => import("./${mod.file}").then((m) => m.${mod.exportName}),`)
}

const lines = [
  "// GENERATED FILE — do not edit by hand.",
  "//",
  "// Written by scripts/nhs/generate-venue-catalog.mjs from the venue registry",
  "// (index.ts): one summary per mapped seed venue, in registry order, and a",
  "// lazy import of each venue's module. The app lists and searches venues from",
  "// the summaries and loads a venue's interior only when it is opened, so",
  "// opening the map for one ward no longer downloads every hospital.",
  "// scripts/lib-test/venue-catalog.test.mjs checks this file against the modules.",
  "",
  'import type { Venue, VenueSummary } from "../types"',
  "",
  "export const MAPPED_VENUE_SUMMARIES: VenueSummary[] = [",
  ...summaries,
  "]",
  "",
  "export const VENUE_LOADERS: Record<string, () => Promise<Venue>> = {",
  ...loaders,
  "}",
  "",
]
writeFileSync(OUT, lines.join("\n"))
console.log(`wrote ${mapped.length} venue summaries and loaders to src/lib/venues/catalog-data.ts`)
