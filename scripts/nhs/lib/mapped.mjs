// Which hospitals already ship as fully-mapped venues.
//
// The directory of located-only NHS pins must not duplicate a site that already
// has a real interior venue — two pins for Great Ormond Street, one of which
// can't be navigated, is worse than one.
//
// Until now that exclusion lived as PROSE in the header comment of
// nhs-hospitals-data.ts ("GOSH, St George's and Addenbrooke's are omitted
// here…"), which a human had to read and hand-apply. That does not survive going
// from 721 rows to the full national estate. This reads the venue modules
// themselves, so adding a mapped venue automatically removes its directory pin
// and nobody has to remember to edit a comment.
import { readdirSync, readFileSync } from "fs"
import { repoPath } from "./paths.mjs"

const VENUE_DIR = repoPath("src", "lib", "venues")

// Not venue modules: the registry, the directory data this pipeline writes, and
// the generated barrel that re-exports auto-built sheet venues (the venues
// themselves are separate modules in this directory and are scanned normally).
const NOT_A_VENUE = new Set([
  "index.ts",
  "nhs-hospitals.ts",
  "nhs-hospitals-data.ts",
  "generated-sheets.ts",
])

// Venue modules are either hand-written or generated, but all of them declare
// the same three fields in the same shape near the top of the object literal.
const SLUG_RE = /^\s*slug:\s*"([^"]+)"/m
const NAME_RE = /^\s*name:\s*"((?:[^"\\]|\\.)*)"/m
const CENTER_RE = /^\s*center:\s*\{\s*lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)\s*\}/m

export function readMappedVenues() {
  const files = readdirSync(VENUE_DIR).filter((f) => f.endsWith(".ts") && !NOT_A_VENUE.has(f))
  const venues = []
  for (const file of files) {
    const src = readFileSync(repoPath("src", "lib", "venues", file), "utf8")
    const slug = SLUG_RE.exec(src)?.[1]
    const name = NAME_RE.exec(src)?.[1]
    const center = CENTER_RE.exec(src)
    if (!slug || !center) {
      throw new Error(
        `src/lib/venues/${file} doesn't expose a slug and center in the expected shape. ` +
          `If the venue format changed, update the patterns in scripts/nhs/lib/mapped.mjs — ` +
          `silently skipping it would put a duplicate pin on the map.`
      )
    }
    venues.push({
      file,
      slug,
      name: name?.replace(/\\"/g, '"') ?? slug,
      lat: Number(center[1]),
      lng: Number(center[2]),
    })
  }
  if (!venues.length) throw new Error(`no venue modules found in ${VENUE_DIR}`)
  return venues
}
