// Checks the OpenStreetMap indoor → venue build (scripts/world/lib/indoor.mjs)
// on a small made-up hospital: two levels, a corridor polygon on one and a
// drawn corridor way on the other, named and anonymous rooms, a lift serving
// both levels, stairs, a main entrance.
//
// Run: node scripts/world/test/indoor.test.mjs
import { buildIndoorVenue, parseLevels, classify, nameOf, polygonsOf, centroidOf } from "../lib/indoor.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

// A metre grid at Luxembourg's latitude, origin at the building's SW corner.
const LAT0 = 49.6
const LON0 = 6.13
const dLat = 1 / 111320
const dLon = 1 / (111320 * Math.cos((LAT0 * Math.PI) / 180))
const at = (x, y) => ({ lat: LAT0 + y * dLat, lon: LON0 + x * dLon })
const rect = (x, y, w, h) => [at(x, y), at(x + w, y), at(x + w, y + h), at(x, y + h), at(x, y)]
let nextId = 1
const way = (geometry, tags) => ({ type: "way", id: nextId++, geometry, tags })
const node = (x, y, tags) => ({ type: "node", id: nextId++, ...at(x, y), tags })

const elements = [
  way(rect(0, 0, 60, 30), { building: "hospital", name: "Clinique Test" }),
  // Level 0: a corridor across the middle, rooms either side.
  way(rect(0, 13, 60, 4), { indoor: "corridor", level: "0" }),
  way(rect(0, 0, 12, 13), { indoor: "room", level: "0", name: "Reception", room: "reception" }),
  way(rect(12, 0, 12, 13), { indoor: "room", level: "0", name: "Radiologie" }),
  way(rect(24, 0, 12, 13), { indoor: "room", level: "0", amenity: "pharmacy" }),
  way(rect(36, 0, 12, 13), { indoor: "room", level: "0", amenity: "toilets", wheelchair: "yes" }),
  way(rect(48, 0, 12, 13), { indoor: "room", level: "0", "healthcare:speciality": "cardiology" }),
  way(rect(0, 17, 15, 13), { indoor: "room", level: "0", amenity: "cafe", name: "Café Soleil" }),
  way(rect(15, 17, 15, 13), { indoor: "room", level: "0" }),
  way(rect(30, 17, 15, 13), { indoor: "room", level: "0", ref: "0.12" }),
  way(rect(45, 17, 15, 13), { indoor: "room", level: "0", room: "storage" }),
  node(30, 15, { highway: "elevator", level: "0;1", ref: "A" }),
  node(55, 15, { stairs: "yes", level: "0;1" }),
  node(0, 15, { entrance: "main", door: "yes" }),
  node(12, 13, { door: "yes", level: "0" }),
  // Level 1: a drawn corridor way, wards, a mezzanine room the app cannot show.
  way([at(2, 15), at(58, 15)], { highway: "corridor", level: "1" }),
  way(rect(0, 0, 20, 13), { indoor: "room", level: "1", name: "Station 1" }),
  way(rect(20, 0, 20, 13), { indoor: "room", level: "1", name: "Station 2" }),
  way(rect(40, 0, 20, 13), { indoor: "room", level: "1", name: "Intensive care unit" }),
  way(rect(0, 17, 60, 13), { indoor: "room", level: "1", name: "Operating theatres" }),
  way(rect(0, 17, 10, 5), { indoor: "room", level: "1.5", name: "Mezzanine" }),
]
const raw = { hospital: { id: "osm-w1", country: "LU", name: "Clinique Test", city: "Luxembourg", lat: LAT0, lng: LON0 }, elements }

group("tag parsing")
{
  check("levels: single, list, range", JSON.stringify([parseLevels("0"), parseLevels("0;1"), parseLevels("-1-1")]) === "[[0],[0,1],[-1,0,1]]")
  check("a mezzanine is left out", parseLevels("0.5").length === 0 && parseLevels("0;0.5;1").join() === "0,1")
  check("a lift is a lift however tagged", classify({ highway: "elevator" }) === "lift" && classify({ room: "elevator" }) === "lift")
  check("stairs, toilets, pharmacy, reception", classify({ stairs: "yes" }) === "stairs" && classify({ amenity: "toilets" }) === "toilet" && classify({ amenity: "pharmacy" }) === "pharmacy" && classify({ room: "reception" }) === "reception")
  check("a ward by name", classify({ indoor: "room" }, "Station 3") === "ward")
  check("a department by speciality", classify({ "healthcare:speciality": "cardiology" }) === "department")
  check("names fall back to the tags", nameOf({ "healthcare:speciality": "cardiology" }, "department") === "Cardiology" && nameOf({ amenity: "toilets", wheelchair: "yes" }, "toilet") === "Accessible toilet")
  check("a bare room with a ref is Room <ref>", nameOf({ indoor: "room", ref: "0.12" }, "other") === "Room 0.12")
  check("an anonymous room has no name", nameOf({ indoor: "room" }, "other") === null)
}

group("geometry")
{
  const polys = polygonsOf(way(rect(0, 0, 10, 10), {}))
  check("a closed way is one polygon", polys?.length === 1 && polys[0].outer.length === 5)
  const c = centroidOf(rect(0, 0, 10, 10))
  check("centroid of a square is its middle", Math.abs(c.lat - at(5, 5).lat) < 1e-9 && Math.abs(c.lon - at(5, 5).lon) < 1e-9)
  check("an open way is not a polygon", polygonsOf(way([at(0, 0), at(1, 1)], {})) === null)
}

group("the built venue")
{
  const built = buildIndoorVenue(raw, { id: "osm-lu-w1", country: "LU", generatedAt: "2026-10-02T00:00:00Z" })
  check("builds", !!built.venue, built.reason)
  const v = built.venue
  check("two floors, level 0 and 1 as internal floors 0 and 1", v.floorPlans.map((p) => p.floor).join() === "0,1" && v.floorPlans[0].label === "Ground Floor" && v.floorPlans[1].label === "Floor 1")
  check("the mezzanine made no floor", !v.floorPlans.some((p) => p.floor === 1.5) && !v.waypoints.some((w) => w.name === "Mezzanine"))
  check("plans are the venue's SVGs", v.floorPlans[0].imageUrl === "/floorplans/osm/osm-lu-w1/l0.svg" && built.plans.get(0).startsWith("<svg"))
  check("bounds enclose the building with padding", v.floorPlans[0].bounds[0][0] < LAT0 && v.floorPlans[0].bounds[1][1] > at(60, 30).lon)
  const names = v.waypoints.map((w) => `${w.name}@${w.floor}`)
  check("named rooms became waypoints", ["Reception@0", "Radiologie@0", "Pharmacy@0", "Accessible toilet@0", "Cardiology@0", "Café Soleil@0", "Room 0.12@0", "Storage@0"].every((n) => names.includes(n)), names.join(", "))
  check("the anonymous room did not", v.waypoints.filter((w) => w.floor === 0 && w.type === "other").length === 2)
  check("the lift serves both floors under one name", v.waypoints.filter((w) => w.type === "lift").map((w) => `${w.name}@${w.floor}`).sort().join() === "Lift A@0,Lift A@1")
  check("so do the stairs", v.waypoints.filter((w) => w.type === "stairs").length === 2)
  check("the main entrance is an exit on the ground floor", v.waypoints.some((w) => w.type === "exit" && w.name === "Main entrance" && w.floor === 0))
  check("wards are wards", v.waypoints.filter((w) => w.type === "ward").map((w) => w.name).sort().join() === "Intensive care unit,Station 1,Station 2")
  check("types are the app's", v.waypoints.every((w) => ["ward", "department", "lift", "stairs", "toilet", "exit", "reception", "canteen", "pharmacy", "other"].includes(w.type)))
  check("ids are unique", new Set(v.waypoints.map((w) => w.id)).size === v.waypoints.length)
  const t0 = v.trails.filter((t) => t.floor === 0)
  const t1 = v.trails.filter((t) => t.floor === 1)
  check("the corridor polygon gave a centre-line on the ground floor", t0.length >= 1 && built.stats.corridorM > 60, JSON.stringify(built.stats))
  const mid = t0.flatMap((t) => t.points)
  check("that runs down the middle of the corridor", mid.every((p) => Math.abs((p.lat - at(0, 15).lat) / dLat) < 1.2), String(mid.map((p) => ((p.lat - at(0, 15).lat) / dLat).toFixed(2)).slice(0, 5)))
  check("the drawn corridor way is the first-floor trail", t1.length === 1 && t1[0].points.length === 2)
  check("quick access leads with the entrance and reception", v.quickAccess[0] === "Main entrance" && v.quickAccess.includes("Reception") && v.quickAccess.includes("Pharmacy"))
  check("the venue is public, unverified, in Luxembourg, credited to OSM", v.visibility === "public" && v.verified === false && v.country === "LU" && /OpenStreetMap/.test(v.dataSource))
  check("the subtitle names the city and the source", v.subtitle === "Luxembourg · Indoor map from OpenStreetMap")
  const svg = built.plans.get(0)
  check("the plan labels the rooms", svg.includes(">Reception<") && svg.includes("Radiologie") && svg.includes("Café Soleil"))
  check("the plan credits OpenStreetMap", svg.includes("© OpenStreetMap contributors"))
  check("the plan has no raw XML in names", !svg.includes("<Café"))
  check("the first floor plan draws the corridor way", built.plans.get(1).includes("<polyline"))
}

group("too thin to ship")
{
  const few = buildIndoorVenue({ hospital: raw.hospital, elements: elements.slice(0, 6) }, { id: "x", country: "LU" })
  check("a handful of rooms is refused with a reason", !few.venue && /rooms/.test(few.reason))
  const anon = buildIndoorVenue({ hospital: raw.hospital, elements: elements.map((e) => (e.tags.indoor === "room" ? { ...e, tags: { indoor: "room", level: e.tags.level } } : e)) }, { id: "x", country: "LU" })
  check("rooms without names are refused too", !anon.venue && /named/.test(anon.reason))
}

report()
