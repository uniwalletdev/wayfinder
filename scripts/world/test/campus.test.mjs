// Checks the hospital-grounds → site-map build (scripts/world/lib/campus.mjs)
// on a made-up campus: three named buildings and the main block, a main and an
// emergency entrance plus anonymous doors, a car park, a pharmacy, a café, and
// footpaths between them.
//
// Run: node scripts/world/test/campus.test.mjs
import { buildCampusVenue, placeType, placeName } from "../lib/campus.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

const LAT0 = 39.7
const LON0 = -104.99
const dLat = 1 / 111320
const dLon = 1 / (111320 * Math.cos((LAT0 * Math.PI) / 180))
const at = (x, y) => ({ lat: LAT0 + y * dLat, lon: LON0 + x * dLon })
const rect = (x, y, w, h) => [at(x, y), at(x + w, y), at(x + w, y + h), at(x, y + h), at(x, y)]
let nextId = 1
const way = (geometry, tags, nodes) => ({ type: "way", id: nextId++, geometry, tags, nodes })
const node = (x, y, tags) => ({ type: "node", id: nextId++, ...at(x, y), tags })

const doorA = node(60, 50, { entrance: "yes" })
const elements = [
  way(rect(0, 0, 300, 200), { amenity: "hospital", name: "Test Medical Center" }),
  way(rect(20, 20, 100, 60), { building: "hospital", name: "Test Medical Center" }),
  way(rect(140, 20, 80, 60), { building: "yes", name: "Anschutz Pavilion" }),
  way(rect(20, 100, 60, 60), { building: "yes", name: "Children's Hospital" }),
  way(rect(100, 100, 80, 50), { building: "yes", name: "Emergency Department" }),
  way(rect(200, 100, 60, 80), { building: "parking", name: "Parking Garage A", parking: "multi-storey" }),
  way(rect(240, 20, 40, 40), { building: "yes" }),
  way(rect(60, 48, 30, 4), { building: "yes", name: "Walkway" }, [doorA.id]),
  node(70, 20, { entrance: "main", door: "yes" }),
  node(140, 125, { entrance: "emergency" }),
  doorA,
  node(150, 20, { entrance: "yes" }),
  node(160, 20, { entrance: "service" }),
  node(130, 60, { amenity: "pharmacy", name: "Outpatient Pharmacy" }),
  node(135, 70, { amenity: "cafe", name: "Atrium Café" }),
  way(rect(220, 150, 60, 40), { amenity: "parking" }),
  node(290, 190, { highway: "bus_stop", name: "Hospital Loop" }),
  way([at(70, 15), at(70, 0)], { highway: "footway" }),
  way([at(70, 15), at(150, 15), at(230, 15), at(230, 100)], { highway: "footway" }),
  way([at(90, 90), at(140, 90), at(140, 125)], { highway: "path" }),
  way([at(0, 250), at(50, 260)], { highway: "footway" }), // outside the grounds
  way([at(150, 15), at(150, 10)], { highway: "steps" }),
]
const raw = { hospital: { id: "osm-w1", country: "US", name: "Test Medical Center", city: "Denver", lat: LAT0, lng: LON0, bbox: [LAT0, LON0, at(300, 200).lat, at(300, 200).lon] }, elements }

group("place vocabulary")
{
  check("a car park is other, named Parking garage", placeType({ building: "parking", parking: "multi-storey" }) === "other" && placeName({ amenity: "parking", parking: "multi-storey", ref: "B" }, "other") === "Parking garage B")
  check("a named building is a department", placeType({ building: "yes" }, "North Tower") === "department")
  check("a pharmacy by tag or by name", placeType({ amenity: "pharmacy" }) === "pharmacy" && placeType({ building: "yes" }, "Outpatient Pharmacy") === "pharmacy")
  check("entrances: main, emergency, plain, service", placeName({ entrance: "main" }, "exit") === "Main entrance" && placeName({ entrance: "emergency" }, "exit") === "Emergency entrance" && placeName({ entrance: "yes" }, "exit") === "Entrance" && placeName({ entrance: "service" }, "exit") === null)
  check("a café by amenity", placeType({ amenity: "cafe" }) === "canteen")
}

group("the built site map")
{
  const built = buildCampusVenue(raw, { id: "osm-us-w1", country: "US", generatedAt: "2026-10-02T00:00:00Z" })
  check("builds", !!built.venue, built.reason)
  const v = built.venue
  const names = v.waypoints.map((w) => `${w.name}[${w.type}]`)
  check("one floor, the site map", v.floorPlans.length === 1 && v.floorPlans[0].floor === 0 && v.floorPlans[0].imageUrl === "/floorplans/osm/osm-us-w1/site.svg")
  check("named buildings are places; the hospital's own name is not", names.includes("Anschutz Pavilion[department]") && names.includes("Children's Hospital[department]") && names.includes("Emergency Department[department]") && !v.waypoints.some((w) => w.name === "Test Medical Center"))
  check("the parking garage is a place", names.includes("Parking Garage A[other]"))
  check("main and emergency entrances", names.includes("Main entrance[exit]") && names.includes("Emergency entrance[exit]"))
  check("a plain door on a named building is named after it", names.includes("Walkway entrance[exit]"))
  check("a service door is not a place", !v.waypoints.some((w) => /service/i.test(w.name)))
  check("facilities: pharmacy, café, car park, bus stop", names.includes("Outpatient Pharmacy[pharmacy]") && names.includes("Atrium Café[canteen]") && names.includes("Parking[other]") && names.includes("Hospital Loop[other]"))
  check("footpaths inside the grounds became trails; the one outside did not", v.trails.length === 4 && v.trails.every((t) => t.points.every((p) => p.lat <= v.floorPlans[0].bounds[1][0])), String(v.trails.length))
  check("quick access leads with the entrance and emergency", v.quickAccess[0] === "Main entrance" && v.quickAccess.includes("Emergency Department") && v.quickAccess.includes("Outpatient Pharmacy"))
  check("bounds enclose the grounds with padding", v.floorPlans[0].bounds[0][0] < LAT0 && v.floorPlans[0].bounds[1][1] > at(300, 200).lon)
  check("subtitle and source", v.subtitle === "Denver · Site map from OpenStreetMap" && /OpenStreetMap/.test(v.dataSource) && v.country === "US")
  check("ids unique, all on floor 0", new Set(v.waypoints.map((w) => w.id)).size === v.waypoints.length && v.waypoints.every((w) => w.floor === 0))
  const svg = built.plan
  check("the plan labels the buildings and credits OSM", svg.includes("Anschutz Pavilion") && svg.includes("Children") && svg.includes("© OpenStreetMap contributors"))
  check("the plan marks the car park and entrances", svg.includes(">P<") && svg.includes("#dc2626") && svg.includes("#16a34a"))
}

group("too thin to ship")
{
  const few = buildCampusVenue({ hospital: raw.hospital, elements: elements.filter((e) => !(e.tags.building && e.tags.name && e.tags.name !== "Test Medical Center")) }, { id: "x", country: "US" })
  check("no named buildings → refused", !few.venue && /named/.test(few.reason))
  const low = buildCampusVenue({ hospital: raw.hospital, elements: elements.slice(0, 3) }, { id: "x", country: "US" })
  check("one building and nothing else → refused by score", !low.venue && /score/.test(low.reason), low.reason)
}

report()
