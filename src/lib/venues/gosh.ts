import { Venue } from "../types"

// Great Ormond Street Hospital — the first venue the app shipped with. It is
// now just one *seed* venue rather than the hard-coded universe: its center,
// floor plans and waypoints are data on this object, not constants sprinkled
// across the codebase.
//
// The storey range and footprint come from the building's own fire zone layout
// plan (Variety Club Building, drawing FF-FZ-NHS-GOS-VCB): Levels 1–7 plus a
// plant-only roof (not mapped). The block is modelled as it appears on that
// plan — wings around a central garden courtyard — with a ring corridor, two
// lift banks and two staircases that sit at the same spot on every storey.
// Room-by-room detail is an illustrative, GOSH-flavoured programme (the fire
// plan doesn't name rooms), meant to be refined by a real in-app survey.
//
// IMPORTANT: the floor-plan SVGs, these waypoints and the corridor trails all
// share one coordinate system (SVG px 800x1000 ↔ the venue bounds below). They
// are generated together — see the drawing conventions in the SVGs — so a room
// on the image, its search pin, and the corridor a route follows line up
// exactly. Edit them together, not piecemeal.

const B: [[number, number], [number, number]] = [[51.5218, -0.1208], [51.5232, -0.119]]

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
    notes: "Lifts A and B serve all mapped floors; step-free routes available throughout.",
  },
  // GOSH's Great Ormond Street main entrance and Main Reception are at Level 2 —
  // the street/ground level (the site slopes, so there are levels below it). So
  // the entrance floor (internal index 0) displays as "Level 2", matching the
  // hospital's own signage; Level 1 below it is internal floor -1, and the
  // floors above read Level 3 up to Level 7.
  floorNaming: { word: "Level", groundLevel: 2 },
  quickAccess: ["Main Entrance", "A&E Entrance", "Restaurant & Café", "Pharmacy", "Ward 5B", "X-Ray & Imaging"],
  floorPlans: [
    { id: "l1", floor: -1, label: "Level 1", imageUrl: "/floorplans/gosh/level1.svg", bounds: B },
    { id: "gf", floor: 0, label: "Level 2 (entrance)", imageUrl: "/floorplans/gosh/level2.svg", bounds: B },
    { id: "f1", floor: 1, label: "Level 3", imageUrl: "/floorplans/gosh/level3.svg", bounds: B },
    { id: "f2", floor: 2, label: "Level 4", imageUrl: "/floorplans/gosh/level4.svg", bounds: B },
    { id: "f3", floor: 3, label: "Level 5", imageUrl: "/floorplans/gosh/level5.svg", bounds: B },
    { id: "f4", floor: 4, label: "Level 6", imageUrl: "/floorplans/gosh/level6.svg", bounds: B },
    { id: "f5", floor: 5, label: "Level 7", imageUrl: "/floorplans/gosh/level7.svg", bounds: B },
  ],
  waypoints: [
    // Level 1 (internal floor -1) — below the street-level entrance: therapy, records and support services
    { id: "physio-l1", name: "Physiotherapy & Occupational Therapy", type: "department", coordinates: { lat: 51.522759, lng: -0.120530 }, floor: -1, description: "Therapy gyms and treatment rooms — west wing, Level 1" },
    { id: "hydro-l1", name: "Hydrotherapy Pool", type: "department", coordinates: { lat: 51.522283, lng: -0.120530 }, floor: -1, description: "Warm-water therapy pool — west wing, Level 1" },
    { id: "stairs-1-l1", name: "Staircase 1 — Level 1", type: "stairs", coordinates: { lat: 51.522990, lng: -0.119900 }, floor: -1 },
    { id: "records-l1", name: "Medical Records", type: "department", coordinates: { lat: 51.522990, lng: -0.119686 }, floor: -1, description: "Health records office — north corridor, Level 1" },
    { id: "lift-a-l1", name: "Lift A — Level 1", type: "lift", coordinates: { lat: 51.522542, lng: -0.120530 }, floor: -1 },
    { id: "lift-b-l1", name: "Lift B — Level 1", type: "lift", coordinates: { lat: 51.522542, lng: -0.119270 }, floor: -1 },
    { id: "toilet-l1", name: "Toilets — Level 1", type: "toilet", coordinates: { lat: 51.522836, lng: -0.119270 }, floor: -1 },
    { id: "estates-l1", name: "Estates & Facilities", type: "other", coordinates: { lat: 51.522675, lng: -0.119270 }, floor: -1, description: "Estates workshop and stores — east wing, Level 1" },
    { id: "stairs-2-l1", name: "Staircase 2 — Level 1", type: "stairs", coordinates: { lat: 51.522010, lng: -0.120283 }, floor: -1 },

    // Level 2 (internal floor 0) — the street-level entrance floor: main entrance, reception, A&E, pharmacy, café
    { id: "ae-entrance", name: "A&E Entrance", type: "exit", coordinates: { lat: 51.522290, lng: -0.120564 }, floor: 0, description: "Emergency department entrance — west side, Level 2" },
    { id: "bloods-gf", name: "Blood Tests (Phlebotomy)", type: "department", coordinates: { lat: 51.522759, lng: -0.120530 }, floor: 0, description: "Walk-in blood tests — west wing, Level 2" },
    { id: "stairs-1-gf", name: "Staircase 1", type: "stairs", coordinates: { lat: 51.522990, lng: -0.119900 }, floor: 0 },
    { id: "pharmacy-gf", name: "Pharmacy", type: "pharmacy", coordinates: { lat: 51.522990, lng: -0.119686 }, floor: 0, description: "Main pharmacy — north corridor, Level 2" },
    { id: "outpatients-reception-gf", name: "Outpatients Reception", type: "reception", coordinates: { lat: 51.522990, lng: -0.120496 }, floor: 0, description: "Check in for outpatient appointments — Level 2" },
    { id: "lift-a-gf", name: "Lift A", type: "lift", coordinates: { lat: 51.522542, lng: -0.120530 }, floor: 0 },
    { id: "lift-b-gf", name: "Lift B", type: "lift", coordinates: { lat: 51.522542, lng: -0.119270 }, floor: 0 },
    { id: "toilet-gf", name: "Toilets", type: "toilet", coordinates: { lat: 51.522836, lng: -0.119270 }, floor: 0 },
    { id: "canteen-gf", name: "Restaurant & Café", type: "canteen", coordinates: { lat: 51.522010, lng: -0.120012 }, floor: 0, description: "The Lagoon — patient and visitor restaurant, Level 2" },
    { id: "main-entrance", name: "Main Entrance", type: "reception", coordinates: { lat: 51.521989, lng: -0.119675 }, floor: 0, description: "Great Ormond Street main entrance and lobby" },
    { id: "reception", name: "Main Reception", type: "reception", coordinates: { lat: 51.522010, lng: -0.119405 }, floor: 0, description: "Main reception desk — right of the entrance lobby" },
    { id: "stairs-2-gf", name: "Staircase 2", type: "stairs", coordinates: { lat: 51.522010, lng: -0.120283 }, floor: 0 },
    { id: "family-room-gf", name: "Family Room", type: "other", coordinates: { lat: 51.522192, lng: -0.119270 }, floor: 0, description: "Quiet space for families — east wing, Level 2" },

    // Level 3 (internal floor 1) — wards 1A/1B, outpatients and children's spaces
    { id: "ward-1a", name: "Ward 1A", type: "ward", coordinates: { lat: 51.522759, lng: -0.120530 }, floor: 1, description: "Haematology ward — west wing, Level 3" },
    { id: "ward-1b", name: "Ward 1B", type: "ward", coordinates: { lat: 51.522283, lng: -0.119270 }, floor: 1, description: "Oncology ward — east wing, Level 3" },
    {
      id: "outpatients-1", name: "Outpatients Clinic 1", type: "department",
      coordinates: { lat: 51.522990, lng: -0.120159 }, floor: 1,
      description: "General outpatients — north wing, Level 3",
      hours: "Open now · Closes 17:00",
      arrivalNotes: "Check in at the touchscreen kiosk by the entrance, then take a seat in the waiting area — you'll be called by first name.",
      typicalWait: "10–20 min after check-in",
    },
    { id: "daycare-f1", name: "Day Care Unit", type: "department", coordinates: { lat: 51.522283, lng: -0.120530 }, floor: 1, description: "Day admissions — west wing, Level 3" },
    { id: "stairs-1-f1", name: "Staircase 1 — Level 3", type: "stairs", coordinates: { lat: 51.522990, lng: -0.119900 }, floor: 1 },
    { id: "lift-a-f1", name: "Lift A — Level 3", type: "lift", coordinates: { lat: 51.522542, lng: -0.120530 }, floor: 1 },
    { id: "lift-b-f1", name: "Lift B — Level 3", type: "lift", coordinates: { lat: 51.522542, lng: -0.119270 }, floor: 1 },
    { id: "toilet-f1", name: "Toilets — Level 3", type: "toilet", coordinates: { lat: 51.522836, lng: -0.119270 }, floor: 1 },
    { id: "playroom-f1", name: "Playroom — Level 3", type: "other", coordinates: { lat: 51.522010, lng: -0.119675 }, floor: 1, description: "Play area for inpatients and siblings" },
    { id: "school-f1", name: "Hospital School", type: "other", coordinates: { lat: 51.522010, lng: -0.120012 }, floor: 1, description: "The hospital school — south wing, Level 3" },
    { id: "stairs-2-f1", name: "Staircase 2 — Level 3", type: "stairs", coordinates: { lat: 51.522010, lng: -0.120283 }, floor: 1 },

    // Level 4 (internal floor 2) — imaging (X-Ray, MRI, CT, ultrasound) and wards 2A/2B
    { id: "ward-2a", name: "Ward 2A", type: "ward", coordinates: { lat: 51.522283, lng: -0.119270 }, floor: 2, description: "Cardiology ward — east wing, Level 4" },
    { id: "ward-2b", name: "Ward 2B", type: "ward", coordinates: { lat: 51.522010, lng: -0.119945 }, floor: 2, description: "Neurology ward — south wing, Level 4" },
    {
      id: "xray", name: "X-Ray & Imaging", type: "department",
      coordinates: { lat: 51.522759, lng: -0.120530 }, floor: 2,
      description: "Radiology department — west wing, Level 4",
      hours: "Open now · Closes 18:00",
      arrivalNotes: "Report to the imaging reception desk with your referral letter. Please arrive 15 minutes early for changing, if needed.",
      typicalWait: "15–25 min after check-in",
    },
    { id: "mri-f2", name: "MRI Suite", type: "department", coordinates: { lat: 51.522283, lng: -0.120530 }, floor: 2, description: "MRI scanning — west wing, Level 4" },
    { id: "ultrasound-f2", name: "Ultrasound", type: "department", coordinates: { lat: 51.522990, lng: -0.120159 }, floor: 2, description: "Ultrasound scanning — north wing, Level 4" },
    { id: "stairs-1-f2", name: "Staircase 1 — Level 4", type: "stairs", coordinates: { lat: 51.522990, lng: -0.119900 }, floor: 2 },
    { id: "lift-a-f2", name: "Lift A — Level 4", type: "lift", coordinates: { lat: 51.522542, lng: -0.120530 }, floor: 2 },
    { id: "lift-b-f2", name: "Lift B — Level 4", type: "lift", coordinates: { lat: 51.522542, lng: -0.119270 }, floor: 2 },
    { id: "toilet-f2", name: "Toilets — Level 4", type: "toilet", coordinates: { lat: 51.522836, lng: -0.119270 }, floor: 2 },
    { id: "stairs-2-f2", name: "Staircase 2 — Level 4", type: "stairs", coordinates: { lat: 51.522010, lng: -0.120283 }, floor: 2 },

    // Level 5 (internal floor 3) — operating theatres, recovery and surgical wards
    { id: "ward-3a", name: "Ward 3A", type: "ward", coordinates: { lat: 51.522010, lng: -0.119945 }, floor: 3, description: "Surgical ward — south wing, Level 5" },
    { id: "ward-3b", name: "Ward 3B", type: "ward", coordinates: { lat: 51.522010, lng: -0.119540 }, floor: 3, description: "Critical care — south wing, Level 5" },
    { id: "ward-5b", name: "Ward 5B", type: "ward", coordinates: { lat: 51.522283, lng: -0.119270 }, floor: 3, description: "General paediatrics — east wing, Level 5" },
    { id: "theatre", name: "Operating Theatres", type: "department", coordinates: { lat: 51.522759, lng: -0.120530 }, floor: 3, description: "Surgical theatres 1–4 — west wing, Level 5" },
    { id: "recovery-f3", name: "Theatre Recovery", type: "department", coordinates: { lat: 51.522283, lng: -0.120530 }, floor: 3, description: "Post-anaesthetic recovery — west wing, Level 5" },
    { id: "stairs-1-f3", name: "Staircase 1 — Level 5", type: "stairs", coordinates: { lat: 51.522990, lng: -0.119900 }, floor: 3 },
    { id: "lift-a-f3", name: "Lift A — Level 5", type: "lift", coordinates: { lat: 51.522542, lng: -0.120530 }, floor: 3 },
    { id: "lift-b-f3", name: "Lift B — Level 5", type: "lift", coordinates: { lat: 51.522542, lng: -0.119270 }, floor: 3 },
    { id: "toilet-f3", name: "Toilets — Level 5", type: "toilet", coordinates: { lat: 51.522836, lng: -0.119270 }, floor: 3 },
    { id: "stairs-2-f3", name: "Staircase 2 — Level 5", type: "stairs", coordinates: { lat: 51.522010, lng: -0.120283 }, floor: 3 },

    // Level 6 (internal floor 4) — respiratory/renal wards and the parents' floor
    { id: "ward-6a", name: "Ward 6A", type: "ward", coordinates: { lat: 51.522759, lng: -0.120530 }, floor: 4, description: "Respiratory ward — west wing, Level 6" },
    { id: "ward-6b", name: "Ward 6B", type: "ward", coordinates: { lat: 51.522283, lng: -0.120530 }, floor: 4, description: "Renal ward — west wing, Level 6" },
    { id: "parents-f4", name: "Parents' Accommodation", type: "department", coordinates: { lat: 51.522990, lng: -0.119686 }, floor: 4, description: "Overnight rooms for parents and carers — Level 6" },
    { id: "dialysis-f4", name: "Dialysis Unit", type: "department", coordinates: { lat: 51.522990, lng: -0.120496 }, floor: 4, description: "Renal dialysis — north wing, Level 6" },
    { id: "playroom-f4", name: "Playroom — Level 6", type: "other", coordinates: { lat: 51.522675, lng: -0.119270 }, floor: 4, description: "Play area — east wing, Level 6" },
    { id: "stairs-1-f4", name: "Staircase 1 — Level 6", type: "stairs", coordinates: { lat: 51.522990, lng: -0.119900 }, floor: 4 },
    { id: "lift-a-f4", name: "Lift A — Level 6", type: "lift", coordinates: { lat: 51.522542, lng: -0.120530 }, floor: 4 },
    { id: "lift-b-f4", name: "Lift B — Level 6", type: "lift", coordinates: { lat: 51.522542, lng: -0.119270 }, floor: 4 },
    { id: "toilet-f4", name: "Toilets — Level 6", type: "toilet", coordinates: { lat: 51.522836, lng: -0.119270 }, floor: 4 },
    { id: "stairs-2-f4", name: "Staircase 2 — Level 6", type: "stairs", coordinates: { lat: 51.522010, lng: -0.120283 }, floor: 4 },

    // Level 7 (internal floor 5) — smaller set-back storey: seminar rooms, staff areas and plant
    { id: "seminar-f5", name: "Seminar & Training Rooms", type: "department", coordinates: { lat: 51.522990, lng: -0.120159 }, floor: 5, description: "Staff education and training — north wing, Level 7" },
    { id: "training-f5", name: "Staff Training", type: "department", coordinates: { lat: 51.522759, lng: -0.120530 }, floor: 5, description: "Training suite — west wing, Level 7" },
    { id: "plant-f5", name: "Plant Room", type: "other", coordinates: { lat: 51.522283, lng: -0.119270 }, floor: 5, description: "Building plant — restricted access" },
    { id: "stairs-1-f5", name: "Staircase 1 — Level 7", type: "stairs", coordinates: { lat: 51.522990, lng: -0.119900 }, floor: 5 },
    { id: "lift-a-f5", name: "Lift A — Level 7", type: "lift", coordinates: { lat: 51.522542, lng: -0.120530 }, floor: 5 },
    { id: "lift-b-f5", name: "Lift B — Level 7", type: "lift", coordinates: { lat: 51.522542, lng: -0.119270 }, floor: 5 },
    { id: "toilet-f5", name: "Toilets — Level 7", type: "toilet", coordinates: { lat: 51.522836, lng: -0.119270 }, floor: 5 },
    { id: "stairs-2-f5", name: "Staircase 2 — Level 7", type: "stairs", coordinates: { lat: 51.522010, lng: -0.120283 }, floor: 5 },
  ],
  // The walkable corridor network, one ring per storey (plus the Level 2
  // entrance spurs and garden path), expressed as survey trails so buildRoute
  // follows the drawn corridors instead of cutting through rooms. Node
  // coordinates sit on the corridor centrelines of the floor-plan SVGs, and
  // every lift/stair door is a node, so cross-floor routes stay on the network.
  trails: [
    { id: "gosh-corridor-ring--1", floor: -1, points: [{ lat: 51.522892, lng: -0.120373 }, { lat: 51.522892, lng: -0.120215 }, { lat: 51.522892, lng: -0.120057 }, { lat: 51.522892, lng: -0.119900 }, { lat: 51.522892, lng: -0.119743 }, { lat: 51.522892, lng: -0.119585 }, { lat: 51.522892, lng: -0.119427 }, { lat: 51.522808, lng: -0.119427 }, { lat: 51.522710, lng: -0.119427 }, { lat: 51.522626, lng: -0.119427 }, { lat: 51.522542, lng: -0.119427 }, { lat: 51.522444, lng: -0.119427 }, { lat: 51.522346, lng: -0.119427 }, { lat: 51.522248, lng: -0.119427 }, { lat: 51.522164, lng: -0.119427 }, { lat: 51.522108, lng: -0.119427 }, { lat: 51.522108, lng: -0.119585 }, { lat: 51.522108, lng: -0.119675 }, { lat: 51.522108, lng: -0.119832 }, { lat: 51.522108, lng: -0.119900 }, { lat: 51.522108, lng: -0.120057 }, { lat: 51.522108, lng: -0.120215 }, { lat: 51.522108, lng: -0.120283 }, { lat: 51.522108, lng: -0.120373 }, { lat: 51.522164, lng: -0.120373 }, { lat: 51.522248, lng: -0.120373 }, { lat: 51.522290, lng: -0.120373 }, { lat: 51.522388, lng: -0.120373 }, { lat: 51.522486, lng: -0.120373 }, { lat: 51.522542, lng: -0.120373 }, { lat: 51.522640, lng: -0.120373 }, { lat: 51.522738, lng: -0.120373 }, { lat: 51.522836, lng: -0.120373 }, { lat: 51.522892, lng: -0.120373 }] },
    { id: "gosh-corridor-ring-0", floor: 0, points: [{ lat: 51.522892, lng: -0.120373 }, { lat: 51.522892, lng: -0.120215 }, { lat: 51.522892, lng: -0.120057 }, { lat: 51.522892, lng: -0.119900 }, { lat: 51.522892, lng: -0.119743 }, { lat: 51.522892, lng: -0.119585 }, { lat: 51.522892, lng: -0.119427 }, { lat: 51.522808, lng: -0.119427 }, { lat: 51.522710, lng: -0.119427 }, { lat: 51.522626, lng: -0.119427 }, { lat: 51.522542, lng: -0.119427 }, { lat: 51.522444, lng: -0.119427 }, { lat: 51.522346, lng: -0.119427 }, { lat: 51.522248, lng: -0.119427 }, { lat: 51.522164, lng: -0.119427 }, { lat: 51.522108, lng: -0.119427 }, { lat: 51.522108, lng: -0.119585 }, { lat: 51.522108, lng: -0.119675 }, { lat: 51.522108, lng: -0.119832 }, { lat: 51.522108, lng: -0.119900 }, { lat: 51.522108, lng: -0.120057 }, { lat: 51.522108, lng: -0.120215 }, { lat: 51.522108, lng: -0.120283 }, { lat: 51.522108, lng: -0.120373 }, { lat: 51.522164, lng: -0.120373 }, { lat: 51.522248, lng: -0.120373 }, { lat: 51.522290, lng: -0.120373 }, { lat: 51.522388, lng: -0.120373 }, { lat: 51.522486, lng: -0.120373 }, { lat: 51.522542, lng: -0.120373 }, { lat: 51.522640, lng: -0.120373 }, { lat: 51.522738, lng: -0.120373 }, { lat: 51.522836, lng: -0.120373 }, { lat: 51.522892, lng: -0.120373 }] },
    { id: "gosh-entrance-spur-0", floor: 0, points: [{ lat: 51.522108, lng: -0.119675 }, { lat: 51.522038, lng: -0.119675 }, { lat: 51.521968, lng: -0.119675 }] },
    { id: "gosh-ae-spur-0", floor: 0, points: [{ lat: 51.522290, lng: -0.120373 }, { lat: 51.522290, lng: -0.120508 }, { lat: 51.522290, lng: -0.120598 }] },
    { id: "gosh-courtyard-path-0", floor: 0, points: [{ lat: 51.522892, lng: -0.119900 }, { lat: 51.522794, lng: -0.119900 }, { lat: 51.522696, lng: -0.119900 }, { lat: 51.522598, lng: -0.119900 }, { lat: 51.522500, lng: -0.119900 }, { lat: 51.522402, lng: -0.119900 }, { lat: 51.522304, lng: -0.119900 }, { lat: 51.522206, lng: -0.119900 }, { lat: 51.522108, lng: -0.119900 }] },
    { id: "gosh-corridor-ring-1", floor: 1, points: [{ lat: 51.522892, lng: -0.120373 }, { lat: 51.522892, lng: -0.120215 }, { lat: 51.522892, lng: -0.120057 }, { lat: 51.522892, lng: -0.119900 }, { lat: 51.522892, lng: -0.119743 }, { lat: 51.522892, lng: -0.119585 }, { lat: 51.522892, lng: -0.119427 }, { lat: 51.522808, lng: -0.119427 }, { lat: 51.522710, lng: -0.119427 }, { lat: 51.522626, lng: -0.119427 }, { lat: 51.522542, lng: -0.119427 }, { lat: 51.522444, lng: -0.119427 }, { lat: 51.522346, lng: -0.119427 }, { lat: 51.522248, lng: -0.119427 }, { lat: 51.522164, lng: -0.119427 }, { lat: 51.522108, lng: -0.119427 }, { lat: 51.522108, lng: -0.119585 }, { lat: 51.522108, lng: -0.119675 }, { lat: 51.522108, lng: -0.119832 }, { lat: 51.522108, lng: -0.119900 }, { lat: 51.522108, lng: -0.120057 }, { lat: 51.522108, lng: -0.120215 }, { lat: 51.522108, lng: -0.120283 }, { lat: 51.522108, lng: -0.120373 }, { lat: 51.522164, lng: -0.120373 }, { lat: 51.522248, lng: -0.120373 }, { lat: 51.522290, lng: -0.120373 }, { lat: 51.522388, lng: -0.120373 }, { lat: 51.522486, lng: -0.120373 }, { lat: 51.522542, lng: -0.120373 }, { lat: 51.522640, lng: -0.120373 }, { lat: 51.522738, lng: -0.120373 }, { lat: 51.522836, lng: -0.120373 }, { lat: 51.522892, lng: -0.120373 }] },
    { id: "gosh-corridor-ring-2", floor: 2, points: [{ lat: 51.522892, lng: -0.120373 }, { lat: 51.522892, lng: -0.120215 }, { lat: 51.522892, lng: -0.120057 }, { lat: 51.522892, lng: -0.119900 }, { lat: 51.522892, lng: -0.119743 }, { lat: 51.522892, lng: -0.119585 }, { lat: 51.522892, lng: -0.119427 }, { lat: 51.522808, lng: -0.119427 }, { lat: 51.522710, lng: -0.119427 }, { lat: 51.522626, lng: -0.119427 }, { lat: 51.522542, lng: -0.119427 }, { lat: 51.522444, lng: -0.119427 }, { lat: 51.522346, lng: -0.119427 }, { lat: 51.522248, lng: -0.119427 }, { lat: 51.522164, lng: -0.119427 }, { lat: 51.522108, lng: -0.119427 }, { lat: 51.522108, lng: -0.119585 }, { lat: 51.522108, lng: -0.119675 }, { lat: 51.522108, lng: -0.119832 }, { lat: 51.522108, lng: -0.119900 }, { lat: 51.522108, lng: -0.120057 }, { lat: 51.522108, lng: -0.120215 }, { lat: 51.522108, lng: -0.120283 }, { lat: 51.522108, lng: -0.120373 }, { lat: 51.522164, lng: -0.120373 }, { lat: 51.522248, lng: -0.120373 }, { lat: 51.522290, lng: -0.120373 }, { lat: 51.522388, lng: -0.120373 }, { lat: 51.522486, lng: -0.120373 }, { lat: 51.522542, lng: -0.120373 }, { lat: 51.522640, lng: -0.120373 }, { lat: 51.522738, lng: -0.120373 }, { lat: 51.522836, lng: -0.120373 }, { lat: 51.522892, lng: -0.120373 }] },
    { id: "gosh-corridor-ring-3", floor: 3, points: [{ lat: 51.522892, lng: -0.120373 }, { lat: 51.522892, lng: -0.120215 }, { lat: 51.522892, lng: -0.120057 }, { lat: 51.522892, lng: -0.119900 }, { lat: 51.522892, lng: -0.119743 }, { lat: 51.522892, lng: -0.119585 }, { lat: 51.522892, lng: -0.119427 }, { lat: 51.522808, lng: -0.119427 }, { lat: 51.522710, lng: -0.119427 }, { lat: 51.522626, lng: -0.119427 }, { lat: 51.522542, lng: -0.119427 }, { lat: 51.522444, lng: -0.119427 }, { lat: 51.522346, lng: -0.119427 }, { lat: 51.522248, lng: -0.119427 }, { lat: 51.522164, lng: -0.119427 }, { lat: 51.522108, lng: -0.119427 }, { lat: 51.522108, lng: -0.119585 }, { lat: 51.522108, lng: -0.119675 }, { lat: 51.522108, lng: -0.119832 }, { lat: 51.522108, lng: -0.119900 }, { lat: 51.522108, lng: -0.120057 }, { lat: 51.522108, lng: -0.120215 }, { lat: 51.522108, lng: -0.120283 }, { lat: 51.522108, lng: -0.120373 }, { lat: 51.522164, lng: -0.120373 }, { lat: 51.522248, lng: -0.120373 }, { lat: 51.522290, lng: -0.120373 }, { lat: 51.522388, lng: -0.120373 }, { lat: 51.522486, lng: -0.120373 }, { lat: 51.522542, lng: -0.120373 }, { lat: 51.522640, lng: -0.120373 }, { lat: 51.522738, lng: -0.120373 }, { lat: 51.522836, lng: -0.120373 }, { lat: 51.522892, lng: -0.120373 }] },
    { id: "gosh-corridor-ring-4", floor: 4, points: [{ lat: 51.522892, lng: -0.120373 }, { lat: 51.522892, lng: -0.120215 }, { lat: 51.522892, lng: -0.120057 }, { lat: 51.522892, lng: -0.119900 }, { lat: 51.522892, lng: -0.119743 }, { lat: 51.522892, lng: -0.119585 }, { lat: 51.522892, lng: -0.119427 }, { lat: 51.522808, lng: -0.119427 }, { lat: 51.522710, lng: -0.119427 }, { lat: 51.522626, lng: -0.119427 }, { lat: 51.522542, lng: -0.119427 }, { lat: 51.522444, lng: -0.119427 }, { lat: 51.522346, lng: -0.119427 }, { lat: 51.522248, lng: -0.119427 }, { lat: 51.522164, lng: -0.119427 }, { lat: 51.522108, lng: -0.119427 }, { lat: 51.522108, lng: -0.119585 }, { lat: 51.522108, lng: -0.119675 }, { lat: 51.522108, lng: -0.119832 }, { lat: 51.522108, lng: -0.119900 }, { lat: 51.522108, lng: -0.120057 }, { lat: 51.522108, lng: -0.120215 }, { lat: 51.522108, lng: -0.120283 }, { lat: 51.522108, lng: -0.120373 }, { lat: 51.522164, lng: -0.120373 }, { lat: 51.522248, lng: -0.120373 }, { lat: 51.522290, lng: -0.120373 }, { lat: 51.522388, lng: -0.120373 }, { lat: 51.522486, lng: -0.120373 }, { lat: 51.522542, lng: -0.120373 }, { lat: 51.522640, lng: -0.120373 }, { lat: 51.522738, lng: -0.120373 }, { lat: 51.522836, lng: -0.120373 }, { lat: 51.522892, lng: -0.120373 }] },
    { id: "gosh-corridor-ring-5", floor: 5, points: [{ lat: 51.522892, lng: -0.120373 }, { lat: 51.522892, lng: -0.120215 }, { lat: 51.522892, lng: -0.120057 }, { lat: 51.522892, lng: -0.119900 }, { lat: 51.522892, lng: -0.119743 }, { lat: 51.522892, lng: -0.119585 }, { lat: 51.522892, lng: -0.119427 }, { lat: 51.522808, lng: -0.119427 }, { lat: 51.522710, lng: -0.119427 }, { lat: 51.522626, lng: -0.119427 }, { lat: 51.522542, lng: -0.119427 }, { lat: 51.522444, lng: -0.119427 }, { lat: 51.522346, lng: -0.119427 }, { lat: 51.522248, lng: -0.119427 }, { lat: 51.522164, lng: -0.119427 }, { lat: 51.522108, lng: -0.119427 }, { lat: 51.522108, lng: -0.119585 }, { lat: 51.522108, lng: -0.119675 }, { lat: 51.522108, lng: -0.119832 }, { lat: 51.522108, lng: -0.119900 }, { lat: 51.522108, lng: -0.120057 }, { lat: 51.522108, lng: -0.120215 }, { lat: 51.522108, lng: -0.120283 }, { lat: 51.522108, lng: -0.120373 }, { lat: 51.522164, lng: -0.120373 }, { lat: 51.522248, lng: -0.120373 }, { lat: 51.522290, lng: -0.120373 }, { lat: 51.522388, lng: -0.120373 }, { lat: 51.522486, lng: -0.120373 }, { lat: 51.522542, lng: -0.120373 }, { lat: 51.522640, lng: -0.120373 }, { lat: 51.522738, lng: -0.120373 }, { lat: 51.522836, lng: -0.120373 }, { lat: 51.522892, lng: -0.120373 }] },
  ],
}
