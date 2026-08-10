// Checks that a cross-floor route puts the walker back out at the SAME core it
// sent them into (src/lib/routing.ts, buildRoute).
//
// This runs against the real shipped function and the real GOSH venue data,
// because the bug it guards was invisible to any smaller fixture: it needed a
// venue whose lifts are named by BUILDING rather than by floor. GOSH has five
// separate lift cores all named "Lifts — <building>", and the matcher used to
// strip everything after the dash before comparing. All five collapsed to
// "Lifts", so whichever the array happened to list first won — and a walker who
// took the Octav Botnar Wing lift up from Level 2 was told to step out at the
// Nurses Home, 125 m away on the far side of the site, with the drawn route
// jumping straight across the hospital to get there.
//
// Run: node scripts/lib-test/routing.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { buildRoute, distanceMeters } = await import(fileURLToPath(new URL("routing.ts", SRC)))
const { GOSH_VENUE } = await import(fileURLToPath(new URL("venues/gosh.ts", SRC)))

const { group, check, report } = await import("../nhs/test/harness.mjs")

const wps = GOSH_VENUE.waypoints
const byId = (id) => {
  const w = wps.find((x) => x.id === id)
  if (!w) throw new Error(`fixture drifted: no waypoint "${id}" in the GOSH venue`)
  return w
}
// Closest approach of the drawn line to a given place — the honest measure of
// "did the route actually go past here".
const nearestApproach = (route, w) =>
  Math.min(...route.geometry.map((p) => distanceMeters(p, w.coordinates)))

const routeFrom = (start, dest) =>
  buildRoute(start.coordinates, start.floor, dest, wps, "walking", GOSH_VENUE.trails ?? [], "stepfree", GOSH_VENUE.floorNaming)

group("a cross-floor route exits at the core it entered")
{
  // Level 2 (index 0) → Level 5 (index 3), entirely inside the Octav Botnar Wing.
  const lift = byId("octavbotnar-lifts-l2")
  const dest = wps.find((w) => w.floor === 3 && /Octav Botnar/.test(w.description ?? "") && w.type !== "lift" && w.type !== "stairs")
  const route = routeFrom(lift, dest)

  const obwUpstairs = wps.find((w) => w.type === "lift" && w.floor === 3 && w.name === lift.name)
  const nursesUpstairs = wps.find((w) => w.type === "lift" && w.floor === 3 && /Nurses Home/.test(w.name))

  check("the route leaves from the Octav Botnar lift", nearestApproach(route, obwUpstairs) < 2)
  check("and never crosses the site to the Nurses Home", nearestApproach(route, nursesUpstairs) > 50)
  // The two cores are 125 m apart, so a route that swapped them could not come
  // in under this even before walking anywhere.
  check("so the whole journey stays short", route.totalDistance < 125)
}

group("buildings with two cores pick the nearer one")
{
  // Morgan Stanley has a north and a south lift lobby on every level, ~40 m
  // apart. Their names differ, so exact-name matching carries this — but the
  // distance tiebreak has to not undo it.
  const south = byId("morganstanley-south-lift-lobby-l2")
  const dest = wps.find((w) => w.floor === 3 && /Morgan Stanley/.test(w.description ?? "") && w.type !== "lift" && w.type !== "stairs")
  const route = routeFrom(south, dest)

  const southUpstairs = wps.find((w) => w.type === "lift" && w.floor === 3 && w.name === south.name)
  const northUpstairs = wps.find((w) => w.type === "lift" && w.floor === 3 && /North Lift Lobby/.test(w.name))

  check("the south lobby leads back out at the south lobby", nearestApproach(route, southUpstairs) < 2)
  check("the two lobbies really are distinct places", distanceMeters(southUpstairs.coordinates, northUpstairs.coordinates) > 20)
}

group("the '— Floor N' naming convention still matches")
{
  // The convention the old rule was written for, and the reason the dash strip
  // cannot simply be deleted: here the text after the dash is the FLOOR, so the
  // names genuinely differ between storeys and only the base name lines up.
  const here = { id: "l-a-0", name: "Lift A — Floor 0", type: "lift", floor: 0, coordinates: { lat: 51.5, lng: -0.1 } }
  const there = { id: "l-a-1", name: "Lift A — Floor 1", type: "lift", floor: 1, coordinates: { lat: 51.5, lng: -0.1 } }
  // A decoy that would win on distance alone if the name tiers were dropped.
  const decoy = { id: "l-b-1", name: "Lift B — Floor 1", type: "lift", floor: 1, coordinates: { lat: 51.50002, lng: -0.1 } }
  const dest = { id: "d", name: "Clinic", type: "department", floor: 1, coordinates: { lat: 51.5008, lng: -0.1 } }

  const route = buildRoute(here.coordinates, 0, dest, [here, there, decoy, dest], "walking", [], "stepfree")
  check("Lift A upstairs is chosen over a nearer Lift B", nearestApproach(route, there) < 1)
  check("the exit step names the destination", route.steps.some((s) => s.instruction === "Exit and head to Clinic"))
}

report()
