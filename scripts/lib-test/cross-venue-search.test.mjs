// Checks the across-every-hospital search (src/lib/cross-venue-search.ts) that
// /api/search serves when the open venue has no match.
//
// Run: node scripts/lib-test/cross-venue-search.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { buildCrossVenueIndex, searchAcrossVenues } = await import(fileURLToPath(new URL("cross-venue-search.ts", SRC)))
const { SEED_VENUES } = await import(fileURLToPath(new URL("venues/index.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

const index = buildCrossVenueIndex(SEED_VENUES)

group("the index")
{
  check("covers thousands of places", index.entries.length > 3000, String(index.entries.length))
  check("holds nothing from a directory pin", index.entries.every((e) => !e.venueId.startsWith("nhs-")))
}

group("finding a ward at another hospital")
{
  const hits = searchAcrossVenues(index, "kangaroo")
  check("Kangaroo Ward at GOSH is the top hit", hits[0]?.waypoint.name === "Kangaroo Ward" && hits[0]?.venueId === "gosh")
  check("the hit names its hospital and floor", hits[0]?.venueName === "Great Ormond Street Hospital" && hits[0]?.floorLabel.startsWith("Level 2"))
  const excluded = searchAcrossVenues(index, "kangaroo", { exclude: "gosh" })
  check("the open venue is excluded (it has its own search)", excluded.every((h) => h.venueId !== "gosh"))
}

group("breadth and limits")
{
  const pharm = searchAcrossVenues(index, "pharmacy", { limit: 8 })
  check("a common name comes from several hospitals", new Set(pharm.map((h) => h.venueId)).size >= 3)
  const counts = {}
  for (const h of pharm) counts[h.venueId] = (counts[h.venueId] ?? 0) + 1
  check("no hospital takes more than three of the slots", Object.values(counts).every((n) => n <= 3))
  check("the limit holds", pharm.length <= 8)
  check("a one-letter query returns nothing", searchAcrossVenues(index, "k").length === 0)
  check("nonsense returns nothing", searchAcrossVenues(index, "zzqxv").length === 0)
}

report()
