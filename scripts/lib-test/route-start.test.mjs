// Checks where a route starts when the walker has not said (src/lib/
// route-start.ts): their live position when there is one, else the venue's
// main entrance, else the centre of the site — each labelled as what it is —
// and that "main entrance" is never the ambulance door.
//
// Run: node scripts/lib-test/route-start.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { mainEntrance, resolveRouteStart, formatMinutes, startIsReal, UNKNOWN } = await import(fileURLToPath(new URL("route-start.ts", SRC)))
const { GOSH_VENUE } = await import(fileURLToPath(new URL("venues/gosh.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

const wp = (id, name, type, floor = 0, lat = 51.5, lng = -0.12) => ({ id, name, type, floor, coordinates: { lat, lng } })
const venue = { venueCenter: { lat: 51.5231, lng: -0.1203 }, venueName: "Test Hospital", openingFloor: 0, currentFloor: 0 }

group("mainEntrance")
{
  const gosh = mainEntrance(GOSH_VENUE.waypoints, 0)
  check("GOSH's main entrance is the Main Entrance", gosh?.name === "Main Entrance", gosh?.name)
  check("not the ambulance door when a public one exists", mainEntrance([wp("a", "Ambulance Entrance", "exit"), wp("b", "Side Entrance", "exit")])?.id === "b")
  check("the ambulance door when it is the only one", mainEntrance([wp("a", "Ambulance Entrance", "exit")])?.id === "a")
  check("'main' anywhere in the name wins", mainEntrance([wp("a", "East Entrance", "exit"), wp("b", "Entrance (main)", "exit")])?.id === "b")
  check("the opening floor breaks a tie", mainEntrance([wp("a", "Entrance", "exit", 1), wp("b", "Entrance", "exit", 0)], 0)?.id === "b")
  check("list order breaks the last tie", mainEntrance([wp("a", "North Entrance", "exit"), wp("b", "South Entrance", "exit")])?.id === "a")
  check("no entrances gives null", mainEntrance([wp("r", "Reception", "reception")]) === null)
  check("OpenStreetMap's 'Main entrance' spelling counts", mainEntrance([wp("a", "Entrance", "exit"), wp("b", "Main entrance", "exit")])?.id === "b")
}

group("resolveRouteStart")
{
  const door = wp("door", "Main Entrance", "exit", 0, 51.5231, -0.1206)
  const ward = wp("ward", "Kangaroo Ward", "ward", 2)
  const waypoints = [ward, door, wp("amb", "Ambulance Entrance", "exit")]
  const here = { lat: 51.52, lng: -0.11 }

  const chosen = resolveRouteStart({ origin: ward, position: here, location: "active", waypoints, ...venue })
  check("a chosen place wins over everything", chosen.kind === "chosen" && chosen.waypoint === ward && chosen.floor === 2 && chosen.label === "Kangaroo Ward")

  const live = resolveRouteStart({ origin: null, position: here, location: "active", waypoints, ...venue, currentFloor: 1 })
  check("a live position is 'Your location' on the current floor", live.kind === "live" && live.coordinates === here && live.floor === 1 && live.label === "Your location" && !live.note)

  const off = resolveRouteStart({ origin: null, position: null, location: "denied", waypoints, ...venue })
  check("location off starts at the main entrance", off.kind === "entrance" && off.waypoint === door && off.coordinates === door.coordinates && off.floor === 0)
  check("and says so", off.label === "Main Entrance" && off.note === "location is off")

  const waiting = resolveRouteStart({ origin: null, position: null, location: "requesting", waypoints, ...venue })
  check("no fix yet says it is still looking", waiting.kind === "entrance" && waiting.note === "finding your location")

  const centre = resolveRouteStart({ origin: null, position: null, location: "denied", waypoints: [ward], ...venue })
  check("no entrance falls back to the centre of the site, named", centre.kind === "centre" && centre.coordinates === venue.venueCenter && centre.waypoint === null && centre.label === "Centre of Test Hospital" && centre.note === "location is off")
  check("the centre stand-in keeps the current floor", resolveRouteStart({ origin: null, position: null, location: "denied", waypoints: [], ...venue, currentFloor: 3 }).floor === 3)
}

group("formatMinutes")
{
  check("a measured route is plain", formatMinutes({ estimatedMinutes: 3, approximate: false }) === "3 min")
  check("a route with an unmapped stretch is marked", formatMinutes({ estimatedMinutes: 1, approximate: true }) === "~1 min")
  check("absent flag reads as measured", formatMinutes({ estimatedMinutes: 2 }) === "2 min")
  check("a route of no length has no time, not a made-up minute", formatMinutes({ estimatedMinutes: 1, totalDistance: 0 }) === UNKNOWN && UNKNOWN === "—")
  check("a route with length keeps its time", formatMinutes({ estimatedMinutes: 4, totalDistance: 310 }) === "4 min")
  check("an hour or more reads in hours", formatMinutes({ estimatedMinutes: 135 }) === "2 h 15 min" && formatMinutes({ estimatedMinutes: 120 }) === "2 h" && formatMinutes({ estimatedMinutes: 59 }) === "59 min")
  check("a long guess is still marked", formatMinutes({ estimatedMinutes: 5003, approximate: true, totalDistance: 400200 }) === "~83 h 23 min")
}

group("startIsReal (journeys out of the building)")
{
  check("a picked place is a real start", startIsReal({ kind: "chosen" }, 0))
  check("a live fix is a real start", startIsReal({ kind: "live" }, 8))
  check("the demo position on site is not", !startIsReal({ kind: "live" }, 0))
  check("the entrance standing in for an unknown position is not", !startIsReal({ kind: "entrance" }, 5))
  check("the centre of the site is not", !startIsReal({ kind: "centre" }, 5))
}

report()
