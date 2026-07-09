import { Venue } from "../types"

// St George's Hospital, Tooting — one of the largest NHS hospitals in the UK
// (St George's University Hospitals NHS Foundation Trust), on Blackshaw Road,
// London SW17 0QT.
//
// Like GOSH, this ships as a navigable seed venue: schematic floor plans plus
// waypoints positioned to match them, so the floor selector, plan overlay,
// search and routing all work out of the box. The interior layout is a
// schematic placeholder (the site has many more wings and floors than four) and
// is meant to be replaced with a real in-app survey — the department and ward
// names are genuine to St George's, but their exact positions are illustrative.
//
// Placement was originally a naive box around Google's "St George's Hospital"
// pin, which sits at the eastern edge of the site — so the overlay spilled
// across Tooting Grove onto the houses beyond it. The bounds below were
// re-georeferenced against Google Maps imagery of the site so the plan now
// covers the main hospital complex (Hunter/Jenner wings, the MTC helipad and
// the Emergency Department) and stays inside the campus: south of Cranmer
// Terrace, west of Tooting Grove, north of Blackshaw Road.

export const ST_GEORGES_VENUE: Venue = {
  id: "st-georges",
  slug: "st-georges",
  name: "St George's Wayfinder",
  subtitle: "St George's Hospital, Tooting",
  category: "hospital",
  // Centre of the main hospital complex (not Google's pin, which sits at the
  // eastern edge of the campus next to Tooting Grove).
  center: { lat: 51.4265487, lng: -0.1747804 },
  defaultZoom: 18,
  visibility: "public",
  verified: true,
  accessibility: {
    stepFreeRoute: true,
    accessibleToilets: true,
    notes: "Large multi-building site. Lifts serve all mapped floors; step-free routes and Blue Badge parking available.",
  },
  quickAccess: ["Grosvenor Wing Main Entrance", "Emergency Department (A&E)", "Major Trauma Centre", "Radiology & Imaging", "Ingredients Restaurant"],
  // Overlay footprint of the main building complex (~195 m × 208 m). Corners
  // chosen so no edge crosses a public road: the NE corner stops short of
  // Tooting Grove, which runs diagonally along the east side of the site.
  floorPlans: [
    { id: "gf", floor: 0, label: "Ground Floor",  imageUrl: "/floorplans/stgeorges/ground.svg", bounds: [[51.4256122, -0.1761831], [51.4274851, -0.1733777]] },
    { id: "f1", floor: 1, label: "First Floor",   imageUrl: "/floorplans/stgeorges/floor1.svg", bounds: [[51.4256122, -0.1761831], [51.4274851, -0.1733777]] },
    { id: "f2", floor: 2, label: "Second Floor",  imageUrl: "/floorplans/stgeorges/floor2.svg", bounds: [[51.4256122, -0.1761831], [51.4274851, -0.1733777]] },
    { id: "f3", floor: 3, label: "Third Floor",   imageUrl: "/floorplans/stgeorges/floor3.svg", bounds: [[51.4256122, -0.1761831], [51.4274851, -0.1733777]] },
  ],
  waypoints: [
    // Ground Floor — coordinates mapped to the schematic floor plan bounds
    { id: "ae-entrance",   name: "Emergency Department (A&E)", type: "exit",      coordinates: { lat: 51.4269888, lng: -0.175795 }, floor: 0, description: "Accident & Emergency entrance, Grosvenor Wing" },
    { id: "stairs-1-gf",   name: "Staircase 1",               type: "stairs",    coordinates: { lat: 51.4269888, lng: -0.1751591 }, floor: 0 },
    { id: "pharmacy-gf",   name: "Pharmacy",                  type: "pharmacy",  coordinates: { lat: 51.4269888, lng: -0.1743471 }, floor: 0, description: "Outpatient pharmacy" },
    { id: "lift-b-gf",     name: "Lift B",                    type: "lift",      coordinates: { lat: 51.4269888, lng: -0.1737455 }, floor: 0 },
    { id: "lift-a-gf",     name: "Lift A",                    type: "lift",      coordinates: { lat: 51.4263801, lng: -0.1747461 }, floor: 0 },
    { id: "canteen-gf",    name: "Ingredients Restaurant",    type: "canteen",   coordinates: { lat: 51.4260925, lng: -0.175795 }, floor: 0, description: "Patient and visitor restaurant & café" },
    { id: "toilet-gf",     name: "Toilets",                   type: "toilet",    coordinates: { lat: 51.4260925, lng: -0.1751591 }, floor: 0 },
    { id: "reception",     name: "Main Reception",            type: "reception", coordinates: { lat: 51.4260925, lng: -0.1743471 }, floor: 0, description: "Main reception desk" },
    { id: "main-entrance", name: "Grosvenor Wing Main Entrance", type: "reception", coordinates: { lat: 51.4260925, lng: -0.1737455 }, floor: 0, description: "St George's Hospital main entrance, off Blackshaw Road (Grosvenor Wing)" },
    { id: "mtc",           name: "Major Trauma Centre",       type: "department",coordinates: { lat: 51.4263801, lng: -0.175795 }, floor: 0, description: "St George's is a designated Major Trauma Centre" },

    // First Floor
    { id: "cardiology-opd", name: "Cardiology Outpatients",   type: "department", coordinates: { lat: 51.4269888, lng: -0.1754755 }, floor: 1, description: "Cardiology outpatient clinics" },
    { id: "fracture-clinic", name: "Fracture Clinic",         type: "department", coordinates: { lat: 51.4269888, lng: -0.1740494 }, floor: 1, description: "Trauma & orthopaedic outpatients" },
    { id: "stairs-1-f1",    name: "Staircase 1 — First Floor", type: "stairs",    coordinates: { lat: 51.4269888, lng: -0.1751591 }, floor: 1 },
    { id: "lift-a-f1",      name: "Lift A — First Floor",     type: "lift",       coordinates: { lat: 51.4263801, lng: -0.1747461 }, floor: 1 },
    {
      id: "outpatients-1", name: "Outpatients", type: "department",
      coordinates: { lat: 51.4260925, lng: -0.1754755 }, floor: 1,
      description: "Outpatients, Lanesborough Wing",
      hours: "Open now · Closes 17:00",
      arrivalNotes: "Check in at the touchscreen kiosk in the Lanesborough Wing atrium, then take a seat — you'll be called by first name.",
      typicalWait: "10–20 min after check-in",
    },
    { id: "toilet-f1",      name: "Toilets — First Floor",    type: "toilet",     coordinates: { lat: 51.4260925, lng: -0.1740494 }, floor: 1 },

    // Second Floor
    { id: "ward-neuro",     name: "Gordon Smith Ward",        type: "ward",       coordinates: { lat: 51.4269888, lng: -0.1754755 }, floor: 2, description: "Neurosciences ward" },
    { id: "ward-ortho",     name: "Trauma & Orthopaedics Ward", type: "ward",     coordinates: { lat: 51.4269888, lng: -0.1740494 }, floor: 2, description: "Trauma and orthopaedics" },
    { id: "stairs-1-f2",    name: "Staircase 1 — Second Floor", type: "stairs",   coordinates: { lat: 51.4269888, lng: -0.1751591 }, floor: 2 },
    { id: "lift-a-f2",      name: "Lift A — Second Floor",    type: "lift",       coordinates: { lat: 51.4263801, lng: -0.1747461 }, floor: 2 },
    {
      id: "radiology", name: "Radiology & Imaging", type: "department",
      coordinates: { lat: 51.4260925, lng: -0.1754755 }, floor: 2,
      description: "X-Ray, CT and MRI",
      hours: "Open now · Closes 18:00",
      arrivalNotes: "Report to the imaging reception desk with your referral letter. Please arrive 15 minutes early for changing, if needed.",
      typicalWait: "15–25 min after check-in",
    },
    { id: "toilet-f2",      name: "Toilets — Second Floor",   type: "toilet",     coordinates: { lat: 51.4260925, lng: -0.1740494 }, floor: 2 },

    // Third Floor
    { id: "ward-surgical",  name: "Surgical Ward",            type: "ward",       coordinates: { lat: 51.4269888, lng: -0.175795 }, floor: 3, description: "General surgery ward" },
    { id: "ward-icu",       name: "Intensive Care Unit",      type: "ward",       coordinates: { lat: 51.4269888, lng: -0.1751591 }, floor: 3, description: "Critical care (ICU)" },
    { id: "ward-childrens", name: "Children's Ward",          type: "ward",       coordinates: { lat: 51.4269888, lng: -0.1740494 }, floor: 3, description: "Paediatrics, St James' Wing" },
    { id: "stairs-1-f3",    name: "Staircase 1 — Third Floor", type: "stairs",    coordinates: { lat: 51.4269888, lng: -0.1751591 }, floor: 3 },
    { id: "lift-a-f3",      name: "Lift A — Third Floor",     type: "lift",       coordinates: { lat: 51.4263801, lng: -0.1747461 }, floor: 3 },
    { id: "theatre",        name: "Operating Theatres",       type: "department", coordinates: { lat: 51.4260925, lng: -0.1754755 }, floor: 3, description: "Surgical theatres" },
    { id: "toilet-f3",      name: "Toilets — Third Floor",    type: "toilet",     coordinates: { lat: 51.4260925, lng: -0.1740494 }, floor: 3 },
  ],
}
