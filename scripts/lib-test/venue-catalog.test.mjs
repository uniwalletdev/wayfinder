// Checks the generated venue catalog (src/lib/venues/catalog-data.ts) against
// the venue modules it describes.
//
// The app lists, searches and resolves seed venues from the catalog and loads
// a venue's module only when it is opened. A summary that has drifted from its
// module — a renamed hospital, a venue added to the registry but not the
// catalog — would list one thing and open another, or not list a mapped
// hospital at all. Regenerate with `npm run nhs:catalog`.
//
// Run: node scripts/lib-test/venue-catalog.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/venues/", import.meta.url)
const { SEED_VENUES, DEFAULT_VENUE } = await import(fileURLToPath(new URL("index.ts", SRC)))
const { NHS_HOSPITAL_VENUES } = await import(fileURLToPath(new URL("nhs-hospitals.ts", SRC)))
const { MAPPED_VENUE_SUMMARIES, VENUE_LOADERS } = await import(fileURLToPath(new URL("catalog-data.ts", SRC)))
const { summaryOf, loadVenue, loadCatalog, isSeedVenueId } = await import(fileURLToPath(new URL("catalog.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

const directoryIds = new Set(NHS_HOSPITAL_VENUES.map((v) => v.id))
const mapped = SEED_VENUES.filter((v) => !directoryIds.has(v.id))
const json = (o) => JSON.stringify(o)

group("the catalog lists every mapped seed venue, in registry order")
{
  check("same count", MAPPED_VENUE_SUMMARIES.length === mapped.length, `${MAPPED_VENUE_SUMMARIES.length} vs ${mapped.length}`)
  check("same ids in the same order", json(MAPPED_VENUE_SUMMARIES.map((v) => v.id)) === json(mapped.map((v) => v.id)))
  const stale = mapped.filter((v, i) => json(MAPPED_VENUE_SUMMARIES[i]) !== json(summaryOf(v)))
  check("every summary matches its module (run npm run nhs:catalog if not)", stale.length === 0, stale.map((v) => v.id).join(", "))
  check("a summary never carries an interior", MAPPED_VENUE_SUMMARIES.every((v) => !("waypoints" in v) && !("floorPlans" in v)))
  check("the default venue is one of them", MAPPED_VENUE_SUMMARIES.some((v) => v.id === DEFAULT_VENUE.id))
}

group("every loader opens the venue it names")
{
  const ids = Object.keys(VENUE_LOADERS)
  check("one loader per mapped venue", json(ids) === json(mapped.map((v) => v.id)))
  const loaded = await Promise.all(ids.map((id) => VENUE_LOADERS[id]()))
  const wrong = ids.filter((id, i) => loaded[i]?.id !== id)
  check("each resolves to a venue with that id", wrong.length === 0, wrong.join(", "))
  check("and the venue has its interior", loaded.every((v) => v.floorPlans.length > 0 || v.waypoints.length > 0))
}

group("resolving a venue by id")
{
  check("the default venue needs no fetch", (await loadVenue(DEFAULT_VENUE.id)) === DEFAULT_VENUE)
  const other = mapped.find((v) => v.id !== DEFAULT_VENUE.id)
  check("another mapped venue loads", (await loadVenue(other.id))?.id === other.id)
  const pin = NHS_HOSPITAL_VENUES[0]
  check("a directory hospital loads through the directory", (await loadVenue(pin.id))?.id === pin.id)
  check("an unknown id is null, not an error", (await loadVenue("venue-1700000000000-abcde")) === null)
  check("seed ids are recognised without loading", isSeedVenueId(other.id) && isSeedVenueId(pin.id) && !isSeedVenueId("venue-x"))
  const catalog = await loadCatalog()
  check("the full catalog is the mapped venues then the directory", catalog.length === mapped.length + NHS_HOSPITAL_VENUES.length && catalog[0].id === mapped[0].id)
  check("directory entries are marked as not mapped", catalog.slice(mapped.length).every((v) => v.mapped === false))
}

report()
