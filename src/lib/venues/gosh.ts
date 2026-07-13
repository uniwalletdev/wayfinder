import { Venue } from "../types"

// Great Ormond Street Hospital — the first venue the app shipped with. It is now
// just one *seed* venue rather than the hard-coded universe: its center, floor
// plans and waypoints are data on this object, not constants sprinkled across
// the codebase. New public/private venues are layered alongside it at runtime.
//
// The storey range comes from the building's own fire zone layout plan (Variety
// Club Building, drawing FF-FZ-NHS-GOS-VCB): Levels 1–7 plus a plant roof. All
// seven levels are mapped below — Level 7 is a smaller, set-back storey on the
// plan, and the roof is plant only, so it isn't mapped. The interior layout is
// still a schematic placeholder meant to be replaced with a real in-app survey:
// room positions are illustrative, but the levels themselves are real.

export const GOSH_VENUE: Venue = {
  id: "gosh",
  slug: "gosh",
  name: "GOSH Wayfinder",
  subtitle: "Great Ormond Street Hospital",
  category: "hospital",
  center: { lat: 51.5225, lng: -0.1199 },
  defaultZoom: 18,
  visibility: "public",
  verified: true,
  accessibility: {
    stepFreeRoute: true,
    accessibleToilets: true,
    notes: "Lifts serve all mapped floors; step-free routes available throughout.",
  },
  // GOSH's Great Ormond Street main entrance and Main Reception are at Level 2 —
  // the street/ground level (the site slopes, so there are levels below it). So
  // the entrance floor (internal index 0) displays as "Level 2", matching the
  // hospital's own signage; Level 1 below it is internal floor -1, and the
  // floors above read Level 3 up to Level 7.
  floorNaming: { word: "Level", groundLevel: 2 },
  quickAccess: ["Main Entrance", "A&E Entrance", "Restaurant & Café", "Pharmacy", "Ward 5B", "X-Ray & Imaging"],
  floorPlans: [
    { id: "l1", floor: -1, label: "Level 1", imageUrl: "/floorplans/gosh-level1.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
    { id: "gf", floor: 0, label: "Level 2 (entrance)", imageUrl: "/floorplans/ground.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
    { id: "f1", floor: 1, label: "Level 3", imageUrl: "/floorplans/floor1.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
    { id: "f2", floor: 2, label: "Level 4", imageUrl: "/floorplans/floor2.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
    { id: "f3", floor: 3, label: "Level 5", imageUrl: "/floorplans/floor3.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
    { id: "f4", floor: 4, label: "Level 6", imageUrl: "/floorplans/gosh-level6.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
    { id: "f5", floor: 5, label: "Level 7", imageUrl: "/floorplans/gosh-level7.svg", bounds: [[51.5218, -0.1208], [51.5232, -0.1190]] },
  ],
  waypoints: [
    // Level 1 (internal floor -1) — below the street-level entrance; therapy and
    // support services
    { id: "physio-l1",   name: "Physiotherapy & Occupational Therapy", type: "department", coordinates: { lat: 51.522829, lng: -0.120346 }, floor: -1, description: "Therapy gyms and treatment rooms" },
    { id: "stairs-1-l1", name: "Staircase 1 — Level 1",  type: "stairs",     coordinates: { lat: 51.522829, lng: -0.120143 }, floor: -1 },
    { id: "records-l1",  name: "Medical Records",        type: "department", coordinates: { lat: 51.522829, lng: -0.119431 }, floor: -1, description: "Health records office" },
    { id: "lift-a-l1",   name: "Lift A — Level 1",       type: "lift",       coordinates: { lat: 51.522374, lng: -0.119878 }, floor: -1 },
    { id: "estates-l1",  name: "Estates & Facilities",   type: "other",      coordinates: { lat: 51.522159, lng: -0.120346 }, floor: -1, description: "Estates workshop and stores" },
    { id: "toilet-l1",   name: "Toilets — Level 1",      type: "toilet",     coordinates: { lat: 51.522159, lng: -0.119431 }, floor: -1 },

    // Level 2 (internal floor 0) — street-level entrance floor; coordinates
    // derived from SVG room centres mapped to floor plan bounds
    { id: "ae-entrance",  name: "A&E Entrance",      type: "exit",      coordinates: { lat: 51.522829, lng: -0.120551 }, floor: 0, description: "Emergency department entrance" },
    { id: "stairs-1-gf", name: "Staircase 1",        type: "stairs",    coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 0 },
    { id: "pharmacy-gf", name: "Pharmacy",           type: "pharmacy",  coordinates: { lat: 51.522829, lng: -0.119622 }, floor: 0, description: "Main pharmacy" },
    { id: "lift-b-gf",   name: "Lift B",             type: "lift",      coordinates: { lat: 51.522829, lng: -0.119236 }, floor: 0 },
    { id: "lift-a-gf",   name: "Lift A",             type: "lift",      coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 0 },
    { id: "canteen-gf",  name: "Restaurant & Café",  type: "canteen",   coordinates: { lat: 51.522159, lng: -0.120551 }, floor: 0, description: "Patient and visitor restaurant" },
    { id: "toilet-gf",   name: "Toilets",            type: "toilet",    coordinates: { lat: 51.522159, lng: -0.120143 }, floor: 0 },
    { id: "reception",   name: "Main Reception",     type: "reception", coordinates: { lat: 51.522159, lng: -0.119622 }, floor: 0, description: "Main reception desk" },
    { id: "main-entrance", name: "Main Entrance",    type: "reception", coordinates: { lat: 51.522159, lng: -0.119236 }, floor: 0, description: "Great Ormond Street main entrance" },

    // Level 3 (internal floor 1)
    { id: "ward-1a",       name: "Ward 1A",             type: "ward",       coordinates: { lat: 51.522829, lng: -0.120346 }, floor: 1, description: "Haematology ward" },
    { id: "ward-1b",       name: "Ward 1B",             type: "ward",       coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 1, description: "Oncology ward" },
    { id: "stairs-1-f1",   name: "Staircase 1 — Level 3", type: "stairs",   coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 1 },
    { id: "lift-a-f1",     name: "Lift A — Level 3",    type: "lift",       coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 1 },
    {
      id: "outpatients-1", name: "Outpatients Clinic 1", type: "department",
      coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 1,
      description: "General outpatients",
      hours: "Open now · Closes 17:00",
      arrivalNotes: "Check in at the touchscreen kiosk by the entrance, then take a seat in the waiting area — you'll be called by first name.",
      typicalWait: "10–20 min after check-in",
    },
    { id: "toilet-f1",     name: "Toilets — Level 3",   type: "toilet",     coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 1 },

    // Level 4 (internal floor 2)
    { id: "ward-2a",   name: "Ward 2A",          type: "ward",       coordinates: { lat: 51.522829, lng: -0.120346 }, floor: 2, description: "Cardiology ward" },
    { id: "ward-2b",   name: "Ward 2B",          type: "ward",       coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 2, description: "Neurology ward" },
    { id: "stairs-1-f2", name: "Staircase 1 — Level 4", type: "stairs",   coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 2 },
    { id: "lift-a-f2", name: "Lift A — Level 4", type: "lift",       coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 2 },
    {
      id: "xray", name: "X-Ray & Imaging", type: "department",
      coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 2,
      description: "Radiology department",
      hours: "Open now · Closes 18:00",
      arrivalNotes: "Report to the imaging reception desk with your referral letter. Please arrive 15 minutes early for changing, if needed.",
      typicalWait: "15–25 min after check-in",
    },
    { id: "toilet-f2", name: "Toilets — Level 4",type: "toilet",     coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 2 },

    // Level 5 (internal floor 3)
    { id: "ward-3a",   name: "Ward 3A",           type: "ward",       coordinates: { lat: 51.522829, lng: -0.120551 }, floor: 3, description: "Surgical ward" },
    { id: "ward-3b",   name: "Ward 3B",           type: "ward",       coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 3, description: "Critical care" },
    { id: "ward-5b",   name: "Ward 5B",           type: "ward",       coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 3, description: "General paediatrics" },
    { id: "stairs-1-f3", name: "Staircase 1 — Level 5", type: "stairs", coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 3 },
    { id: "lift-a-f3", name: "Lift A — Level 5",  type: "lift",       coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 3 },
    { id: "theatre",   name: "Operating Theatres",type: "department", coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 3, description: "Surgical theatres" },
    { id: "toilet-f3", name: "Toilets — Level 5", type: "toilet",     coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 3 },

    // Level 6 (internal floor 4)
    { id: "ward-6a",     name: "Ward 6A",              type: "ward",       coordinates: { lat: 51.522829, lng: -0.120346 }, floor: 4, description: "Respiratory ward" },
    { id: "ward-6b",     name: "Ward 6B",              type: "ward",       coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 4, description: "Renal ward" },
    { id: "stairs-1-f4", name: "Staircase 1 — Level 6", type: "stairs",    coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 4 },
    { id: "lift-a-f4",   name: "Lift A — Level 6",     type: "lift",       coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 4 },
    { id: "parents-f4",  name: "Parents' Accommodation", type: "department", coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 4, description: "Overnight rooms for parents and carers" },
    { id: "toilet-f4",   name: "Toilets — Level 6",    type: "toilet",     coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 4 },

    // Level 7 (internal floor 5) — smaller set-back storey on the fire plan;
    // mostly plant, with a few staff-facing rooms
    { id: "seminar-f5",  name: "Seminar & Training Rooms", type: "department", coordinates: { lat: 51.522829, lng: -0.120346 }, floor: 5, description: "Staff education and training" },
    { id: "stairs-1-f5", name: "Staircase 1 — Level 7", type: "stairs",    coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 5 },
    { id: "plant-f5",    name: "Plant Room",           type: "other",      coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 5, description: "Building plant — restricted access" },
    { id: "lift-a-f5",   name: "Lift A — Level 7",     type: "lift",       coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 5 },
  ],
}
