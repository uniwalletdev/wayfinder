// Which building you are in, and which floors it has (src/lib/buildings.ts).
//
// The floor rail used to offer every storey on the site. At GOSH that is ten
// levels, while the Sight and Sound Centre has three: standing in it, seven of
// the ten buttons were floors you could not walk to without changing building.
//
// Run: node scripts/lib-test/buildings.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { buildingOf, venueBuildings, buildingAt, floorsInScope } = await import(fileURLToPath(new URL("buildings.ts", SRC)))
const { GOSH_VENUE } = await import(fileURLToPath(new URL("venues/gosh.ts", SRC)))
const { CUH_VENUE } = await import(fileURLToPath(new URL("venues/cuh.ts", SRC)))

const { group, check, report } = await import("../nhs/test/harness.mjs")

const wp = (over) => ({ id: "x", name: "X", type: "other", coordinates: { lat: 51.5, lng: -0.12 }, floor: 0, ...over })

group("reading the building off a waypoint")
{
  check("from the description", buildingOf(wp({ description: "Nurses Home, Level 4" })) === "Nurses Home")
  check("a place inside a building names the building", buildingOf(wp({ description: "Same Day Admissions Unit - Variety Club Building, Level 2" })) === "Variety Club Building")
  check("an explicit field wins", buildingOf(wp({ building: "Weston House", description: "Nurses Home, Level 4" })) === "Weston House")
  check("a description with no storey is not a building", buildingOf(wp({ description: "Open 9-5, closed weekends" })) === null)
  check("nor is no description", buildingOf(wp({})) === null)
}

group("GOSH's buildings")
{
  const buildings = venueBuildings(GOSH_VENUE.waypoints)
  const by = new Map(buildings.map((b) => [b.name, b]))
  check("several buildings are found", buildings.length >= 8)
  check("the Nurses Home spans all ten levels", by.get("Nurses Home")?.floors.length === 10)
  check("the Sight and Sound Centre has three", by.get("Sight and Sound Centre")?.floors.length === 3)
  check("a one-off label does not become a building", !by.has("St Christopher's Chapel"))
  check("largest first", buildings[0].floors.length >= buildings[buildings.length - 1].floors.length)
}

group("a site with no building data")
{
  check("offers no buildings", venueBuildings(CUH_VENUE.waypoints).length === 0)
  check("so nobody is placed in one", buildingAt(CUH_VENUE.center, 0, CUH_VENUE.waypoints, []) === null)
}

group("which building you are standing in")
{
  const buildings = venueBuildings(GOSH_VENUE.waypoints)
  const sns = GOSH_VENUE.waypoints.find((w) => buildingOf(w) === "Sight and Sound Centre")
  check("next to a Sight and Sound waypoint, you are in it", buildingAt(sns.coordinates, sns.floor, GOSH_VENUE.waypoints, buildings) === "Sight and Sound Centre")
  const far = { lat: sns.coordinates.lat + 0.01, lng: sns.coordinates.lng }
  check("a kilometre away, you are in no building", buildingAt(far, sns.floor, GOSH_VENUE.waypoints, buildings) === null)
  check("with no position, no guess", buildingAt(null, 0, GOSH_VENUE.waypoints, buildings) === null)
}

group("the floors the rail offers")
{
  const all = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8]
  const small = { name: "Sight and Sound Centre", floors: [-1, 0, 1] }
  check("the whole site offers every floor", floorsInScope(all, null, []).length === 10)
  check("a building offers its own floors", floorsInScope(all, small, []).join() === "-1,0,1")
  check("the floor on screen is never dropped", floorsInScope(all, small, [5]).includes(5))
  check("nor is the destination's", floorsInScope(all, small, [null, 7]).includes(7))
  check("a building floor the venue has no plan for is not invented", floorsInScope([0, 1], { name: "B", floors: [0, 1, 9] }, []).join() === "0,1")
}

report()
