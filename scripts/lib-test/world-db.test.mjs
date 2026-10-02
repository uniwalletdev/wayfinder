// Checks the input validation /api/world/* relies on (src/lib/world-db.ts):
// country codes, world ids, positions and plan names. The queries themselves
// need the database and are exercised by the workflow's publish step.
//
// Run: node scripts/lib-test/world-db.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { parseCountry, parseWorldId, parseLatLng, parsePlanId, worldAvailable } = await import(fileURLToPath(new URL("world-db.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

group("country codes")
{
  check("upper-cased two letters", parseCountry("lu") === "LU" && parseCountry(" US ") === "US")
  check("anything else is refused", parseCountry("USA") === null && parseCountry("") === null && parseCountry(null) === null && parseCountry("1A") === null)
}

group("world ids")
{
  const p = parseWorldId("osm-us-w375742949")
  check("osm-<cc>-<w|n|r><id> splits into country and row id", p && p.country === "US" && p.rowId === "osm-w375742949" && p.id === "osm-us-w375742949")
  check("case is normalised", parseWorldId("OSM-LU-R123")?.rowId === "osm-r123")
  check("an NHS id, a user venue or junk is refused", parseWorldId("nhs-st-marys") === null && parseWorldId("venue-1-abc") === null && parseWorldId("osm-us-x1") === null && parseWorldId("osm-us-w1; drop table") === null)
}

group("positions and plans")
{
  check("a position parses", JSON.stringify(parseLatLng("39.99", "-83.01")) === JSON.stringify({ lat: 39.99, lng: -83.01 }))
  check("out of range or missing is refused", parseLatLng("91", "0") === null && parseLatLng("1", "181") === null && parseLatLng(null, "1") === null && parseLatLng("abc", "1") === null)
  check("plan ids with or without .svg", parsePlanId("l0.svg") === "l0" && parsePlanId("site") === "site" && parsePlanId("b1") === "b1")
  check("a path or an odd name is refused", parsePlanId("../x") === null && parsePlanId("") === null && parsePlanId("a".repeat(40)) === null)
  check("without DATABASE_URL the world is unavailable", worldAvailable() === false)
}

report()
