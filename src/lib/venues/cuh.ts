import { Venue } from "../types"

// Cambridge University Hospitals — Addenbrooke's Hospital on the Cambridge
// Biomedical Campus, Hills Road, Cambridge CB2 0QQ (Cambridge University
// Hospitals NHS Foundation Trust).
//
// Like GOSH and St George's, this ships as a navigable seed venue: schematic
// floor plans plus waypoints positioned to match them, so the floor selector,
// plan overlay, search and routing all work out of the box. The interior
// layout is a schematic placeholder and is meant to be replaced with a real
// in-app survey — the department names follow Addenbrooke's own conventions
// (letter-plus-level ward names like C3 and D5, the Level 2 concourse), but
// their exact positions are illustrative.
//
// Addenbrooke's signs its storeys as "Level 1" upward, so the venue uses
// floorNaming with groundLevel 1: internal floor 0 displays as Level 1 (the
// Emergency Department level) and the main entrance concourse sits on Level 2.

export const CUH_VENUE: Venue = {
  id: "cuh",
  slug: "cuh",
  name: "Addenbrooke's Wayfinder",
  subtitle: "Cambridge University Hospitals, Cambridge",
  category: "hospital",
  // The NHS directory's pin for Addenbrooke's — centre of the main hospital
  // block, north of the Rosie and the outlying campus buildings.
  center: { lat: 52.175133, lng: 0.140753 },
  defaultZoom: 18,
  visibility: "public",
  verified: true,
  accessibility: {
    stepFreeRoute: true,
    accessibleToilets: true,
    notes: "Large single-site campus. Lifts serve all mapped levels; step-free routes from the main concourse and Blue Badge parking at the front car parks.",
  },
  floorNaming: { word: "Level", groundLevel: 1 },
  quickAccess: ["Main Entrance", "Emergency Department (A&E)", "Outpatients Clinics", "Pharmacy", "Food Court", "Radiology & Imaging"],
  // Overlay footprint of the main hospital block (~200 m × 205 m), centred on
  // the directory pin and kept inside the Biomedical Campus boundary.
  floorPlans: [
    { id: "l1", floor: 0, label: "Level 1",                 imageUrl: "/floorplans/cuh-level1.svg", bounds: [[52.1742, 0.1392], [52.1760, 0.1422]] },
    { id: "l2", floor: 1, label: "Level 2 (main entrance)", imageUrl: "/floorplans/cuh-level2.svg", bounds: [[52.1742, 0.1392], [52.1760, 0.1422]] },
    { id: "l3", floor: 2, label: "Level 3",                 imageUrl: "/floorplans/cuh-level3.svg", bounds: [[52.1742, 0.1392], [52.1760, 0.1422]] },
    { id: "l4", floor: 3, label: "Level 4",                 imageUrl: "/floorplans/cuh-level4.svg", bounds: [[52.1742, 0.1392], [52.1760, 0.1422]] },
    { id: "l5", floor: 4, label: "Level 5",                 imageUrl: "/floorplans/cuh-level5.svg", bounds: [[52.1742, 0.1392], [52.1760, 0.1422]] },
  ],
  waypoints: [
    // Level 1 (internal floor 0) — Emergency Department level. Coordinates are
    // SVG room centres mapped to the floor plan bounds.
    { id: "ed",            name: "Emergency Department (A&E)",     type: "exit",       coordinates: { lat: 52.1755239, lng: 0.1396144 }, floor: 0, description: "Emergency Department — Majors & Resus" },
    { id: "stairs-1-l1",   name: "Staircase 1",                    type: "stairs",     coordinates: { lat: 52.1755239, lng: 0.140295 },  floor: 0 },
    { id: "eau",           name: "Emergency Assessment Unit (EAU)", type: "department", coordinates: { lat: 52.1755239, lng: 0.1411631 }, floor: 0, description: "Same-day emergency assessment" },
    { id: "lift-b-l1",     name: "Lift B",                         type: "lift",       coordinates: { lat: 52.1755239, lng: 0.1418063 }, floor: 0 },
    { id: "lift-a-l1",     name: "Lift A",                         type: "lift",       coordinates: { lat: 52.1749374, lng: 0.1407375 }, floor: 0 },
    { id: "ed-xray",       name: "Emergency X-Ray",                type: "department", coordinates: { lat: 52.1746616, lng: 0.1396144 }, floor: 0, description: "Emergency imaging" },
    { id: "toilet-l1",     name: "Toilets — Level 1",              type: "toilet",     coordinates: { lat: 52.1746616, lng: 0.140295 },  floor: 0 },
    { id: "ed-reception",  name: "ED Reception",                   type: "reception",  coordinates: { lat: 52.1746616, lng: 0.1411631 }, floor: 0, description: "Emergency Department check-in" },
    { id: "ed-entrance",   name: "ED Walk-in Entrance",            type: "exit",       coordinates: { lat: 52.1746616, lng: 0.1418063 }, floor: 0, description: "Emergency Department walk-in entrance" },

    // Level 2 (internal floor 1) — main entrance concourse
    {
      id: "outpatients", name: "Outpatients Clinics", type: "department",
      coordinates: { lat: 52.1755239, lng: 0.1396144 }, floor: 1,
      description: "Outpatient clinics, Level 2",
      hours: "Open now · Closes 17:00",
      arrivalNotes: "Check in at the touchscreen kiosk outside your clinic, then take a seat in the waiting area — you'll be called by first name.",
      typicalWait: "10–20 min after check-in",
    },
    { id: "stairs-1-l2",   name: "Staircase 1 — Level 2",          type: "stairs",     coordinates: { lat: 52.1755239, lng: 0.140295 },  floor: 1 },
    { id: "pharmacy",      name: "Pharmacy",                       type: "pharmacy",   coordinates: { lat: 52.1755239, lng: 0.1411631 }, floor: 1, description: "Outpatient pharmacy, main concourse" },
    { id: "lift-b-l2",     name: "Lift B — Level 2",               type: "lift",       coordinates: { lat: 52.1755239, lng: 0.1418063 }, floor: 1 },
    { id: "lift-a-l2",     name: "Lift A — Level 2",               type: "lift",       coordinates: { lat: 52.1749374, lng: 0.1407375 }, floor: 1 },
    { id: "food-court",    name: "Food Court",                     type: "canteen",    coordinates: { lat: 52.1746616, lng: 0.1396144 }, floor: 1, description: "Concourse restaurants and café" },
    { id: "toilet-l2",     name: "Toilets — Level 2",              type: "toilet",     coordinates: { lat: 52.1746616, lng: 0.140295 },  floor: 1 },
    { id: "reception",     name: "Main Reception",                 type: "reception",  coordinates: { lat: 52.1746616, lng: 0.1411631 }, floor: 1, description: "Main concourse information desk" },
    { id: "main-entrance", name: "Main Entrance",                  type: "reception",  coordinates: { lat: 52.1746616, lng: 0.1418063 }, floor: 1, description: "Addenbrooke's main entrance and concourse, off Hills Road" },

    // Level 3 (internal floor 2) — inpatient wards and imaging
    { id: "ward-c3",       name: "Ward C3",                        type: "ward",       coordinates: { lat: 52.1755239, lng: 0.1399556 }, floor: 2, description: "Medical ward" },
    { id: "ward-d3",       name: "Ward D3",                        type: "ward",       coordinates: { lat: 52.1755239, lng: 0.1414819 }, floor: 2, description: "Surgical ward" },
    { id: "stairs-1-l3",   name: "Staircase 1 — Level 3",          type: "stairs",     coordinates: { lat: 52.1755239, lng: 0.140295 },  floor: 2 },
    { id: "lift-a-l3",     name: "Lift A — Level 3",               type: "lift",       coordinates: { lat: 52.1749374, lng: 0.1407375 }, floor: 2 },
    {
      id: "radiology", name: "Radiology & Imaging", type: "department",
      coordinates: { lat: 52.1746616, lng: 0.1399556 }, floor: 2,
      description: "X-Ray, CT and MRI",
      hours: "Open now · Closes 18:00",
      arrivalNotes: "Report to the imaging reception desk with your referral letter. Please arrive 15 minutes early for changing, if needed.",
      typicalWait: "15–25 min after check-in",
    },
    { id: "toilet-l3",     name: "Toilets — Level 3",              type: "toilet",     coordinates: { lat: 52.1746616, lng: 0.1414819 }, floor: 2 },

    // Level 4 (internal floor 3) — theatres and critical care
    { id: "theatres",      name: "Operating Theatres",             type: "department", coordinates: { lat: 52.1755239, lng: 0.1399556 }, floor: 3, description: "Main theatres suite" },
    { id: "icu",           name: "Intensive Care Unit",            type: "ward",       coordinates: { lat: 52.1755239, lng: 0.1414819 }, floor: 3, description: "Critical care (ICU)" },
    { id: "stairs-1-l4",   name: "Staircase 1 — Level 4",          type: "stairs",     coordinates: { lat: 52.1755239, lng: 0.140295 },  floor: 3 },
    { id: "lift-a-l4",     name: "Lift A — Level 4",               type: "lift",       coordinates: { lat: 52.1749374, lng: 0.1407375 }, floor: 3 },
    { id: "ward-c4",       name: "Ward C4",                        type: "ward",       coordinates: { lat: 52.1746616, lng: 0.1399556 }, floor: 3, description: "Surgical ward" },
    { id: "toilet-l4",     name: "Toilets — Level 4",              type: "toilet",     coordinates: { lat: 52.1746616, lng: 0.1414819 }, floor: 3 },

    // Level 5 (internal floor 4) — inpatient wards and rehabilitation
    { id: "ward-c5",       name: "Ward C5",                        type: "ward",       coordinates: { lat: 52.1755239, lng: 0.1399556 }, floor: 4, description: "Medical ward" },
    { id: "ward-d5",       name: "Ward D5",                        type: "ward",       coordinates: { lat: 52.1755239, lng: 0.1414819 }, floor: 4, description: "Surgical ward" },
    { id: "stairs-1-l5",   name: "Staircase 1 — Level 5",          type: "stairs",     coordinates: { lat: 52.1755239, lng: 0.140295 },  floor: 4 },
    { id: "lift-a-l5",     name: "Lift A — Level 5",               type: "lift",       coordinates: { lat: 52.1749374, lng: 0.1407375 }, floor: 4 },
    { id: "physio",        name: "Physiotherapy & Rehabilitation", type: "department", coordinates: { lat: 52.1746616, lng: 0.1399556 }, floor: 4, description: "Therapy and rehabilitation unit" },
    { id: "toilet-l5",     name: "Toilets — Level 5",              type: "toilet",     coordinates: { lat: 52.1746616, lng: 0.1414819 }, floor: 4 },
  ],
}
