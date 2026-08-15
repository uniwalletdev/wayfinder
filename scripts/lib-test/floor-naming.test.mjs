// Checks that a venue's own storey numbering still tells you which floor is the
// ground floor (src/lib/waypoint-meta.ts, floorLabel / floorGroundHint).
//
// The generic scheme names floor 0 "Ground Floor", so it says so in the name. A
// venue scheme replaces that with its own number and used to drop the word
// entirely — at GOSH every label read "Level 1".."Level 10" and none of them
// admitted that Level 2 is the one you walk in on, at the Main Entrance and at
// the ambulance entrance alike. "Go to Level 6" then gives a family no way to
// know whether that is six floors up or four.
//
// Run: node scripts/lib-test/floor-naming.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { floorLabel, floorShortLabel, floorGroundHint } = await import(fileURLToPath(new URL("waypoint-meta.ts", SRC)))
const { GOSH_VENUE } = await import(fileURLToPath(new URL("venues/gosh.ts", SRC)))

const { group, check, report } = await import("../nhs/test/harness.mjs")

group("a venue with no scheme of its own")
{
  check("floor 0 is the Ground Floor", floorLabel(0) === "Ground Floor")
  check("floor 3 is Floor 3", floorLabel(3) === "Floor 3")
  check("floor -1 is Basement 1", floorLabel(-1) === "Basement 1")
  check("and there is no ground hint to add", floorGroundHint(0) === null)
}

group("GOSH, which numbers its own storeys")
{
  const n = GOSH_VENUE.floorNaming
  check("the venue still declares Level 2 as its ground floor", n?.groundLevel === 2)
  check("internal floor 0 displays as Level 2", floorLabel(0, n).startsWith("Level 2"))
  check("and says that Level 2 is the ground floor", floorLabel(0, n) === "Level 2 (ground floor)")
  check("the floors above are not labelled ground", floorLabel(4, n) === "Level 6")
  check("nor the floor below", floorLabel(-1, n) === "Level 1")
  check("a hint exists for the ground floor", floorGroundHint(0, n) === "Level 2 — the ground floor")
  check("and for no other floor", floorGroundHint(4, n) === null && floorGroundHint(-1, n) === null)
}

group("the rail's short labels stay short")
{
  const n = GOSH_VENUE.floorNaming
  // The pills are 38px. Whatever the full label gains, these must not grow.
  check("ground is still L2", floorShortLabel(0, n) === "L2")
  check("the top of the Nurses Home is still L10", floorShortLabel(8, n) === "L10")
  check("every GOSH pill is 3 characters or fewer",
    GOSH_VENUE.floorPlans.every((fp) => floorShortLabel(fp.floor, n).length <= 3))
}

group("the entrances a walker actually arrives at")
{
  // The user-visible claim: you come in off the street onto Level 2. If either
  // of these ever moves floor, the label above is telling people the wrong thing.
  const at = (id) => GOSH_VENUE.waypoints.find((w) => w.id === id)
  const main = at("main-entrance"), amb = at("ambulances-only")
  check("the Main Entrance exists", Boolean(main))
  check("the ambulance entrance exists", Boolean(amb))
  check("the Main Entrance is on the ground floor", main.floor === 0)
  check("so is the ambulance entrance", amb.floor === 0)
  check("which both display as Level 2", floorLabel(main.floor, GOSH_VENUE.floorNaming) === "Level 2 (ground floor)")
}

report()
