// Checks the on-venue search ranking (src/lib/search.ts) against what a
// visitor typing at a hospital kiosk expects to come first.
//
// Run: node scripts/lib-test/search.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { rankWaypoints, rankNearMisses, scoreWaypoint } = await import(fileURLToPath(new URL("search.ts", SRC)))
const { WAYPOINT_TYPE_LABELS } = await import(fileURLToPath(new URL("waypoint-meta.ts", SRC)))
const { GOSH_VENUE } = await import(fileURLToPath(new URL("venues/gosh.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

const label = (w) => WAYPOINT_TYPE_LABELS[w.type]
const wps = GOSH_VENUE.waypoints
const rank = (q) => rankWaypoints(q, wps, label).map((w) => w.name)

group("the closest name comes first")
{
  check("an exact name wins outright", rank("Pharmacy")[0] === "Pharmacy")
  check("a prefix of the name beats a word inside another name", rank("Pharm")[0] === "Pharmacy")
  check("case and accents do not matter", rank("pHaRmAcY")[0] === "Pharmacy")
  const kang = rank("kangaroo")
  check("a ward is found by its animal", kang[0] === "Kangaroo Ward")
}

group("fuzzy matching helps with names, not descriptions")
{
  const hits = rank("pharm")
  check("Pharmacy is the top hit", hits[0] === "Pharmacy")
  check("a place whose DESCRIPTION merely contains the letters in order is not a hit", !hits.includes("Ramp to Southwood"))
  check("nor is one whose description spells it across several words", !hits.includes("Lullaby Factory Cycle Parking"))
  check("an abbreviation still finds the ward by its name", scoreWaypoint("paeds", "Paediatric Intensive Care", undefined, "Ward") > 0)
  check("but not through a type label", scoreWaypoint("dpt", "Somewhere", undefined, "Department") === 0)
}

group("multi-word queries")
{
  check("'main entrance' finds the Main Entrance", rank("main entrance")[0] === "Main Entrance")
  check("word order inside the name is respected as a prefix match", rank("entrance main").length > 0)
}

group("did you mean")
{
  const near = rankNearMisses("farmacy", wps).map((w) => w.name)
  check("a phonetic misspelling suggests the pharmacy", near.includes("Pharmacy"))
  check("nonsense suggests nothing", rankNearMisses("zzqxv", wps).length === 0)
  check("at most three suggestions", rankNearMisses("ward", wps).length <= 3)
}

report()
