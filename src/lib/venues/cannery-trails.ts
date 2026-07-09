import { Venue } from "../types"

// Cannery Trails, Williamson St — a real mixed-use residential building.
//
// This venue is a live demonstration of the app's CAD-import path. Its floor
// plans and every waypoint below were derived from the building's actual
// architectural CAD files (ASCII DXF), published open-source by the project's
// architects, OpeningDesign, and licensed CC BY-SA 4.0
// (https://github.com/OpeningDesign/CTR). The DXF drawings were read with the
// app's own DXF parser (src/lib/dxf.ts): walls, the stair core, the elevator
// shaft and every A-AREA room zone were extracted, and each room's real
// position within the building footprint was mapped straight onto the plan —
// so the room names, types, counts and relative positions are all genuine to
// the building, not invented.
//
// The one thing the CAD does NOT carry is a geographic anchor (DXF is drawn in
// local inches, not lat/lng), so the map placement below is illustrative: the
// footprint is sized to the building's real ~37 m x 34 m dimensions and set on
// Williamson St (the street the site plan names), but the exact parcel and
// orientation are approximate — the same honest caveat the St George's seed
// venue carries. Attribution: floor plans © OpeningDesign, CC BY-SA 4.0.

export const CANNERY_TRAILS_VENUE: Venue = {
  id: "cannery-trails",
  slug: "cannery-trails",
  name: "Cannery Trails Wayfinder",
  subtitle: "Mixed-use residential building, Williamson St",
  category: "other",
  center: { lat: 43.0844, lng: -89.3667 },
  defaultZoom: 19,
  visibility: "public",
  verified: false,
  accessibility: {
    stepFreeRoute: true,
    accessibleToilets: true,
    notes: "Lift serves all floors from the Williamson St lobby; step-free route throughout.",
  },
  quickAccess: ["Main Lobby", "Community Room", "Commercial Unit", "Elevator", "Staircase"],
  // Overlay footprint sized to the building's real dimensions (~37 m x 34 m).
  // All three floor plans share these bounds and stack on the same core.
  floorPlans: [
    { id: "gf", floor: 0, label: "Ground Floor",           imageUrl: "/floorplans/cannery/ground.svg", bounds: [[43.0842172, -89.3669497], [43.0845828, -89.3664503]] },
    { id: "f2", floor: 1, label: "Second Floor",           imageUrl: "/floorplans/cannery/floor2.svg", bounds: [[43.0842172, -89.3669497], [43.0845828, -89.3664503]] },
    { id: "f3", floor: 2, label: "Top Floor — Community", imageUrl: "/floorplans/cannery/floor3.svg", bounds: [[43.0842172, -89.3669497], [43.0845828, -89.3664503]] },
  ],
  waypoints: [
    // Floor 0
    { id: "commercial-unit-f0", name: "Commercial Unit", type: "department", coordinates: { lat: 43.0843, lng: -89.3668332 }, floor: 0, description: "Ground-floor retail/commercial space" },
    { id: "townhouse-level-1-1-f0", name: "Townhouse (Level 1) 1", type: "other", coordinates: { lat: 43.0843, lng: -89.3665947 }, floor: 0 },
    { id: "refuse-and-storage-f0", name: "Refuse & Storage", type: "other", coordinates: { lat: 43.0844597, lng: -89.3665333 }, floor: 0 },
    { id: "townhouse-level-1-2-f0", name: "Townhouse (Level 1) 2", type: "other", coordinates: { lat: 43.0842963, lng: -89.366526 }, floor: 0 },
    { id: "utility-room-f0", name: "Utility Room", type: "other", coordinates: { lat: 43.0843907, lng: -89.366856 }, floor: 0 },
    { id: "staircase-f0", name: "Staircase", type: "stairs", coordinates: { lat: 43.084529, lng: -89.3667997 }, floor: 0 },
    { id: "corridor-f0", name: "Corridor", type: "other", coordinates: { lat: 43.084456, lng: -89.3665947 }, floor: 0 },
    { id: "main-lobby-f0", name: "Main Lobby", type: "reception", coordinates: { lat: 43.0843, lng: -89.3666875 }, floor: 0, description: "Main entrance lobby off Williamson St" },
    { id: "elevator-f0", name: "Elevator", type: "lift", coordinates: { lat: 43.0844628, lng: -89.3666196 }, floor: 0 },
    { id: "main-entrance-f0", name: "Main Entrance", type: "exit", coordinates: { lat: 43.08424, lng: -89.3666875 }, floor: 0, description: "Building entrance on Williamson St" },
    // Floor 1
    { id: "1-bed-apartment-1-f1", name: "1-Bed Apartment 1", type: "other", coordinates: { lat: 43.0842865, lng: -89.3667297 }, floor: 1 },
    { id: "1-bed-apartment-2-f1", name: "1-Bed Apartment 2", type: "other", coordinates: { lat: 43.0842865, lng: -89.3666866 }, floor: 1 },
    { id: "townhouse-level-2-1-f1", name: "Townhouse (Level 2) 1", type: "other", coordinates: { lat: 43.0842865, lng: -89.3666127 }, floor: 1 },
    { id: "townhouse-level-2-2-f1", name: "Townhouse (Level 2) 2", type: "other", coordinates: { lat: 43.0842865, lng: -89.3665603 }, floor: 1 },
    { id: "studio-apartment-1-f1", name: "Studio Apartment 1", type: "other", coordinates: { lat: 43.0844269, lng: -89.3668637 }, floor: 1 },
    { id: "studio-apartment-2-f1", name: "Studio Apartment 2", type: "other", coordinates: { lat: 43.0843794, lng: -89.3668637 }, floor: 1 },
    { id: "1-bed-apartment-3-f1", name: "1-Bed Apartment 3", type: "other", coordinates: { lat: 43.0842865, lng: -89.3668061 }, floor: 1 },
    { id: "2-bed-apartment-1-f1", name: "2-Bed Apartment 1", type: "other", coordinates: { lat: 43.0842865, lng: -89.3668577 }, floor: 1 },
    { id: "studio-apartment-3-f1", name: "Studio Apartment 3", type: "other", coordinates: { lat: 43.0843745, lng: -89.3665614 }, floor: 1 },
    { id: "studio-apartment-4-f1", name: "Studio Apartment 4", type: "other", coordinates: { lat: 43.0844269, lng: -89.3665614 }, floor: 1 },
    { id: "storage-unit-1-f1", name: "Storage Unit 1", type: "other", coordinates: { lat: 43.0844027, lng: -89.3667679 }, floor: 1 },
    { id: "storage-unit-2-f1", name: "Storage Unit 2", type: "other", coordinates: { lat: 43.0843742, lng: -89.3667679 }, floor: 1 },
    { id: "storage-unit-3-f1", name: "Storage Unit 3", type: "other", coordinates: { lat: 43.0843705, lng: -89.3667134 }, floor: 1 },
    { id: "storage-unit-4-f1", name: "Storage Unit 4", type: "other", coordinates: { lat: 43.0844097, lng: -89.3667163 }, floor: 1 },
    { id: "storage-unit-5-f1", name: "Storage Unit 5", type: "other", coordinates: { lat: 43.0844318, lng: -89.3667163 }, floor: 1 },
    { id: "storage-unit-6-f1", name: "Storage Unit 6", type: "other", coordinates: { lat: 43.0843742, lng: -89.3666424 }, floor: 1 },
    { id: "corridor-f1", name: "Corridor", type: "other", coordinates: { lat: 43.0843472, lng: -89.3666806 }, floor: 1 },
    { id: "elevator-f1", name: "Elevator", type: "lift", coordinates: { lat: 43.0844183, lng: -89.3666431 }, floor: 1 },
    { id: "1-bed-apartment-4-f1", name: "1-Bed Apartment 4", type: "other", coordinates: { lat: 43.0845082, lng: -89.3667297 }, floor: 1 },
    { id: "1-bed-apartment-5-f1", name: "1-Bed Apartment 5", type: "other", coordinates: { lat: 43.0845082, lng: -89.3666866 }, floor: 1 },
    { id: "1-bed-apartment-6-f1", name: "1-Bed Apartment 6", type: "other", coordinates: { lat: 43.0845082, lng: -89.3666113 }, floor: 1 },
    { id: "2-bed-apartment-2-f1", name: "2-Bed Apartment 2", type: "other", coordinates: { lat: 43.0845082, lng: -89.3665589 }, floor: 1 },
    { id: "1-bed-apartment-7-f1", name: "1-Bed Apartment 7", type: "other", coordinates: { lat: 43.0845082, lng: -89.3668061 }, floor: 1 },
    { id: "2-bed-apartment-3-f1", name: "2-Bed Apartment 3", type: "other", coordinates: { lat: 43.0845082, lng: -89.3668577 }, floor: 1 },
    { id: "staircase-f1", name: "Staircase", type: "stairs", coordinates: { lat: 43.084529, lng: -89.3667997 }, floor: 1 },
    // Floor 2
    { id: "studio-apartment-1-f2", name: "Studio Apartment 1", type: "other", coordinates: { lat: 43.0844269, lng: -89.3668637 }, floor: 2 },
    { id: "studio-apartment-2-f2", name: "Studio Apartment 2", type: "other", coordinates: { lat: 43.0843794, lng: -89.3668637 }, floor: 2 },
    { id: "community-room-f2", name: "Community Room", type: "canteen", coordinates: { lat: 43.0843938, lng: -89.3665858 }, floor: 2, description: "Residents' community room" },
    { id: "storage-unit-1-f2", name: "Storage Unit 1", type: "other", coordinates: { lat: 43.0844027, lng: -89.3667679 }, floor: 2 },
    { id: "storage-unit-2-f2", name: "Storage Unit 2", type: "other", coordinates: { lat: 43.0843742, lng: -89.3667679 }, floor: 2 },
    { id: "storage-unit-3-f2", name: "Storage Unit 3", type: "other", coordinates: { lat: 43.0843705, lng: -89.3667134 }, floor: 2 },
    { id: "storage-unit-4-f2", name: "Storage Unit 4", type: "other", coordinates: { lat: 43.0844097, lng: -89.3667163 }, floor: 2 },
    { id: "storage-unit-5-f2", name: "Storage Unit 5", type: "other", coordinates: { lat: 43.0844318, lng: -89.3667163 }, floor: 2 },
    { id: "storage-unit-6-f2", name: "Storage Unit 6", type: "other", coordinates: { lat: 43.0843742, lng: -89.3666424 }, floor: 2 },
    { id: "corridor-f2", name: "Corridor", type: "other", coordinates: { lat: 43.0843831, lng: -89.3666763 }, floor: 2 },
    { id: "elevator-f2", name: "Elevator", type: "lift", coordinates: { lat: 43.0844183, lng: -89.3666431 }, floor: 2 },
    { id: "staircase-f2", name: "Staircase", type: "stairs", coordinates: { lat: 43.084529, lng: -89.3667997 }, floor: 2 },
  ],
}
