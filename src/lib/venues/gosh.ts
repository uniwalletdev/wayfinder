import { Venue } from "../types"

// Great Ormond Street Hospital for Children — the first venue the app shipped
// with, now rebuilt entirely from the hospital's own on-site signage
// photographed in July 2026 (see the `map- GOSH` folder): the Mittal Children's
// Medical Centre lift directory (the authoritative ward-per-level list), the
// "This is Level 1 / Level 2 Ground Floor" site maps, The Lagoon plan, the
// Octav Botnar Wing and Nurses Home lift directories, and the Fisk / GOSH
// Estates fire-escape and dry-riser drawings for every building.
//
// Orientation comes from the true-north arrows on the engineering drawings:
// Guilford Street runs along the NORTH of the site, Great Ormond Street along
// the SOUTH, Lamb's Conduit Street to the EAST and Powis Place / Queen Square
// to the WEST. The current Main Entrance is on Guilford Street, into the north
// end of the Morgan Stanley Clinical Building (the historic Great Ormond Street
// entrance now sits behind the Children's Cancer Centre construction hoarding).
//
// GOSH numbers its storeys Level 1–7 and the site slopes, so the street-level
// ground floor with the Main Entrance is Level 2. That is modelled with
// floorNaming { word: "Level", groundLevel: 2 }: internal floor index 0 is the
// entrance and displays as "Level 2", Level 1 sits just below it at index -1,
// and the wards climb to Level 7 at index 5. Indoor coordinates are derived
// from the schematic signage, not a geodetic survey, and every floor-plan SVG
// in public/floorplans/gosh is generated from the same layout so pins land on
// rooms. All floor plans share the bounds B below; the SVGs are landscape
// (viewBox 1000x710) with Guilford Street along the top.

const B: [[number, number], [number, number]] = [[51.5221, -0.1212], [51.52325, -0.1186]]

export const GOSH_VENUE: Venue = {
  id: "gosh",
  slug: "gosh",
  name: "GOSH Wayfinder",
  subtitle: "Great Ormond Street Hospital for Children",
  category: "hospital",
  center: { lat: 51.52267, lng: -0.11990 },
  defaultZoom: 18,
  visibility: "public",
  verified: true,
  accessibility: {
    stepFreeRoute: true,
    accessibleToilets: true,
    hearingLoop: true,
    notes: "Lifts serve every mapped level of the Morgan Stanley and Premier Inn Clinical Buildings, the Octav Botnar Wing and the Nurses Home. The Main Entrance on Guilford Street and the link corridors between buildings are step-free, with accessible WCs and baby-change on Level 2.",
  },
  // GOSH's street-level Main Entrance (Guilford Street) is "Level 2"; the site
  // slopes so Level 1 sits below it. Internal floor 0 therefore displays as
  // "Level 2" and floor -1 as "Level 1" (displayed level = index + 2).
  floorNaming: { word: "Level", groundLevel: 2 },
  quickAccess: ["Main Entrance", "Main Reception", "The Lagoon", "Pharmacy", "X-Ray", "PALS", "Kangaroo Ward"],
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
    // ── Level 1 ──
    { id: "walrus-clinical-investigations-centre", name: "Walrus Clinical Investigations Centre", type: "department", coordinates: { lat: 51.522643, lng: -0.119463 }, floor: -1, description: "Morgan Stanley Clinical Building, Level 1" },
    { id: "echo-ecg", name: "Echo / ECG", type: "department", coordinates: { lat: 51.522704, lng: -0.119541 }, floor: -1, description: "Within Walrus CIC" },
    { id: "lung-function", name: "Lung Function", type: "department", coordinates: { lat: 51.522704, lng: -0.11938 }, floor: -1, description: "Within Walrus CIC" },
    { id: "walrus-day-care", name: "Walrus Day Care", type: "department", coordinates: { lat: 51.522568, lng: -0.119461 }, floor: -1, description: "Within Walrus CIC" },
    { id: "bod-pod", name: "Bod Pod", type: "department", coordinates: { lat: 51.522649, lng: -0.120072 }, floor: -1, description: "Premier Inn Clinical Building, Level 1" },
    { id: "nuclear-medicine", name: "Nuclear Medicine", type: "department", coordinates: { lat: 51.522516, lng: -0.120035 }, floor: -1, description: "Premier Inn Clinical Building, Level 1" },
    { id: "ocean-department", name: "Ocean Department", type: "department", coordinates: { lat: 51.522461, lng: -0.118948 }, floor: -1, description: "Octav Botnar Wing, Level 1" },
    { id: "theatres-14-15", name: "Theatres 14 & 15", type: "department", coordinates: { lat: 51.522387, lng: -0.118948 }, floor: -1, description: "Octav Botnar Wing, Level 1" },
    { id: "bme-department", name: "BME Department", type: "department", coordinates: { lat: 51.522314, lng: -0.118948 }, floor: -1, description: "Octav Botnar Wing, Levels 0–1" },
    { id: "post-room", name: "Post Room", type: "other", coordinates: { lat: 51.523044, lng: -0.120836 }, floor: -1, description: "Nurses Home, Level 1" },
    { id: "portering-receipts-distribution", name: "Portering, Receipts & Distribution", type: "other", coordinates: { lat: 51.522988, lng: -0.120836 }, floor: -1, description: "Nurses Home, Level 1" },
    { id: "mscbLift-l1", name: "Lift Lobby — Morgan Stanley · Level 1", type: "lift", coordinates: { lat: 51.522636, lng: -0.119697 }, floor: -1 },
    { id: "mscbStair-l1", name: "Stairs — Morgan Stanley · Level 1", type: "stairs", coordinates: { lat: 51.522821, lng: -0.1197 }, floor: -1 },
    { id: "picbLift-l1", name: "Lift Lobby — Premier Inn · Level 1", type: "lift", coordinates: { lat: 51.52261, lng: -0.119809 }, floor: -1 },
    { id: "obwLift-l1", name: "Lift — Octav Botnar Wing · Level 1", type: "lift", coordinates: { lat: 51.522301, lng: -0.119047 }, floor: -1 },
    { id: "nhLift-l1", name: "Lift — Nurses Home · Level 1", type: "lift", coordinates: { lat: 51.523044, lng: -0.120625 }, floor: -1 },

    // ── Level 2 (Ground Floor — Main Entrance) ──
    { id: "main-entrance", name: "Main Entrance", type: "exit", coordinates: { lat: 51.522902, lng: -0.119458 }, floor: 0, description: "Guilford Street — step-free" },
    { id: "main-reception", name: "Main Reception", type: "reception", coordinates: { lat: 51.522845, lng: -0.119458 }, floor: 0, description: "Morgan Stanley Clinical Building, Level 2" },
    { id: "the-disney-reef", name: "The Disney Reef", type: "other", coordinates: { lat: 51.522656, lng: -0.119463 }, floor: 0, description: "Play & entertainment space" },
    { id: "gosh-charity-hub", name: "GOSH Charity Hub", type: "other", coordinates: { lat: 51.522597, lng: -0.119463 }, floor: 0, description: "Morgan Stanley Clinical Building, Level 2" },
    { id: "the-lagoon", name: "The Lagoon", type: "canteen", coordinates: { lat: 51.522484, lng: -0.119463 }, floor: 0, description: "Restaurant — hot food, grab & go, coffee bar & shop", arrivalNotes: "Entrance at the south-west corner; the tills (Pay Here) are by the hot-food counter, with the Shop and Coffee Bar just inside and the Disney Playground and The Lullaby quiet room alongside." },
    { id: "wcs-baby-change", name: "WCs & Baby Change", type: "toilet", coordinates: { lat: 51.522372, lng: -0.119463 }, floor: 0, description: "Includes accessible WCs" },
    { id: "kangaroo-ward", name: "Kangaroo Ward", type: "ward", coordinates: { lat: 51.522641, lng: -0.120035 }, floor: 0, description: "Premier Inn Clinical Building, Level 2" },
    { id: "leopard-ward", name: "Leopard Ward", type: "ward", coordinates: { lat: 51.522541, lng: -0.120035 }, floor: 0, description: "Premier Inn Clinical Building, Level 2" },
    { id: "x-ray", name: "X-Ray", type: "department", coordinates: { lat: 51.52262, lng: -0.120397 }, floor: 0, description: "Variety Club Building, Level 2" },
    { id: "pharmacy", name: "Pharmacy", type: "pharmacy", coordinates: { lat: 51.522541, lng: -0.120397 }, floor: 0, description: "Variety Club Building, Level 2" },
    { id: "pals", name: "PALS", type: "other", coordinates: { lat: 51.522469, lng: -0.120451 }, floor: 0, description: "Patient Advice & Liaison Service" },
    { id: "chapel", name: "Chapel", type: "other", coordinates: { lat: 51.522469, lng: -0.120313 }, floor: 0, description: "Variety Club Building, Level 2" },
    { id: "private-patients-reception", name: "Private Patients Reception", type: "reception", coordinates: { lat: 51.522461, lng: -0.118948 }, floor: 0, description: "Octav Botnar Wing, Level 2" },
    { id: "caterpillar-outpatients", name: "Caterpillar Outpatients", type: "department", coordinates: { lat: 51.522385, lng: -0.118948 }, floor: 0, description: "Octav Botnar Wing, Level 2" },
    { id: "zayed-centre-for-research-into-rare-disease-in-children", name: "Zayed Centre for Research into Rare Disease in Children", type: "department", coordinates: { lat: 51.523062, lng: -0.118938 }, floor: 0, description: "Entrance on Guilford Street" },
    { id: "camelia-botnar-labs", name: "Camelia Botnar Labs", type: "department", coordinates: { lat: 51.522667, lng: -0.118938 }, floor: 0, description: "Laboratories" },
    { id: "southwood-building", name: "Southwood Building", type: "other", coordinates: { lat: 51.523062, lng: -0.120191 }, floor: 0, description: "Outpatients, therapies & offices" },
    { id: "morgan-stanley-garden", name: "Morgan Stanley Garden", type: "other", coordinates: { lat: 51.522907, lng: -0.120191 }, floor: 0, description: "Courtyard garden" },
    { id: "nurses-home", name: "Nurses Home", type: "reception", coordinates: { lat: 51.523018, lng: -0.120831 }, floor: 0, description: "Dietetics, Doctor's Mess & Speech & Language Therapy — Way Out on Level 2" },
    { id: "royal-london-hospital-for-integrated-medicine", name: "Royal London Hospital for Integrated Medicine", type: "department", coordinates: { lat: 51.522393, lng: -0.120755 }, floor: 0, description: "Hippo, Rabbit & Zebra Outpatients — entrance on Great Ormond Street" },
    { id: "sight-and-sound-centre", name: "Sight and Sound Centre", type: "department", coordinates: { lat: 51.522218, lng: -0.120823 }, floor: 0, description: "Entrance on Boswell Street" },
    { id: "mscbLift-l2", name: "Lift Lobby — Morgan Stanley · Level 2", type: "lift", coordinates: { lat: 51.522636, lng: -0.119697 }, floor: 0 },
    { id: "mscbStair-l2", name: "Stairs — Morgan Stanley · Level 2", type: "stairs", coordinates: { lat: 51.522821, lng: -0.1197 }, floor: 0 },
    { id: "picbLift-l2", name: "Lift Lobby — Premier Inn · Level 2", type: "lift", coordinates: { lat: 51.52261, lng: -0.119809 }, floor: 0 },
    { id: "picbStair-l2", name: "Stairs — Premier Inn · Level 2", type: "stairs", coordinates: { lat: 51.522416, lng: -0.12016 }, floor: 0 },
    { id: "obwLift-l2", name: "Lift — Octav Botnar Wing · Level 2", type: "lift", coordinates: { lat: 51.522301, lng: -0.119047 }, floor: 0 },
    { id: "obwStair-l2", name: "Stairs — Octav Botnar Wing · Level 2", type: "stairs", coordinates: { lat: 51.522301, lng: -0.118899 }, floor: 0 },
    { id: "nhLift-l2", name: "Lift — Nurses Home · Level 2", type: "lift", coordinates: { lat: 51.523044, lng: -0.120625 }, floor: 0 },

    // ── Level 3 ──
    { id: "theatres-7-10", name: "Theatres 7–10", type: "department", coordinates: { lat: 51.522643, lng: -0.119463 }, floor: 1, description: "Morgan Stanley Clinical Building, Level 3" },
    { id: "nightingale-day-unit-recovery", name: "Nightingale Day Unit / Recovery", type: "department", coordinates: { lat: 51.522639, lng: -0.120035 }, floor: 1, description: "Premier Inn Clinical Building, Level 3" },
    { id: "theatres-11-12", name: "Theatres 11 & 12", type: "department", coordinates: { lat: 51.522542, lng: -0.120035 }, floor: 1, description: "Premier Inn Clinical Building, Level 3" },
    { id: "kingfisher-ward", name: "Kingfisher Ward", type: "ward", coordinates: { lat: 51.522455, lng: -0.118948 }, floor: 1, description: "Octav Botnar Wing, Level 3" },
    { id: "gastroenterology-investigation-suite", name: "Gastroenterology Investigation Suite", type: "department", coordinates: { lat: 51.522369, lng: -0.118948 }, floor: 1, description: "Octav Botnar Wing, Level 3" },
    { id: "nurses-home-nursing-workforce-mezzanine-unit", name: "Nurses Home — Nursing Workforce & Mezzanine Unit", type: "department", coordinates: { lat: 51.523022, lng: -0.120831 }, floor: 1, description: "Nursing Workforce Team, Archivist & Accommodation" },
    { id: "mscbLift-l3", name: "Lift Lobby — Morgan Stanley · Level 3", type: "lift", coordinates: { lat: 51.522636, lng: -0.119697 }, floor: 1 },
    { id: "mscbStair-l3", name: "Stairs — Morgan Stanley · Level 3", type: "stairs", coordinates: { lat: 51.522821, lng: -0.1197 }, floor: 1 },
    { id: "picbLift-l3", name: "Lift Lobby — Premier Inn · Level 3", type: "lift", coordinates: { lat: 51.52261, lng: -0.119809 }, floor: 1 },
    { id: "picbStair-l3", name: "Stairs — Premier Inn · Level 3", type: "stairs", coordinates: { lat: 51.522416, lng: -0.12016 }, floor: 1 },
    { id: "obwLift-l3", name: "Lift — Octav Botnar Wing · Level 3", type: "lift", coordinates: { lat: 51.522301, lng: -0.119047 }, floor: 1 },
    { id: "nhLift-l3", name: "Lift — Nurses Home · Level 3", type: "lift", coordinates: { lat: 51.523044, lng: -0.120625 }, floor: 1 },

    // ── Level 4 ──
    { id: "flamingo-ward", name: "Flamingo Ward", type: "ward", coordinates: { lat: 51.522643, lng: -0.119463 }, floor: 2, description: "Morgan Stanley Clinical Building, Level 4" },
    { id: "alligator-ward", name: "Alligator Ward", type: "ward", coordinates: { lat: 51.522588, lng: -0.120035 }, floor: 2, description: "Premier Inn Clinical Building, Level 4" },
    { id: "butterfly-ward", name: "Butterfly Ward", type: "ward", coordinates: { lat: 51.522447, lng: -0.118948 }, floor: 2, description: "Octav Botnar Wing, Level 4" },
    { id: "clinical-simulation-centre", name: "Clinical Simulation Centre", type: "department", coordinates: { lat: 51.523022, lng: -0.120831 }, floor: 2, description: "Nurses Home, Level 4 — with Moving & Handling training rooms" },
    { id: "mscbLift-l4", name: "Lift Lobby — Morgan Stanley · Level 4", type: "lift", coordinates: { lat: 51.522636, lng: -0.119697 }, floor: 2 },
    { id: "mscbStair-l4", name: "Stairs — Morgan Stanley · Level 4", type: "stairs", coordinates: { lat: 51.522821, lng: -0.1197 }, floor: 2 },
    { id: "picbLift-l4", name: "Lift Lobby — Premier Inn · Level 4", type: "lift", coordinates: { lat: 51.52261, lng: -0.119809 }, floor: 2 },
    { id: "picbStair-l4", name: "Stairs — Premier Inn · Level 4", type: "stairs", coordinates: { lat: 51.522416, lng: -0.12016 }, floor: 2 },
    { id: "obwLift-l4", name: "Lift — Octav Botnar Wing · Level 4", type: "lift", coordinates: { lat: 51.522301, lng: -0.119047 }, floor: 2 },
    { id: "nhLift-l4", name: "Lift — Nurses Home · Level 4", type: "lift", coordinates: { lat: 51.523044, lng: -0.120625 }, floor: 2 },

    // ── Level 5 ──
    { id: "koala-ward", name: "Koala Ward", type: "ward", coordinates: { lat: 51.522643, lng: -0.119463 }, floor: 3, description: "Morgan Stanley Clinical Building, Level 5" },
    { id: "chameleon-ward", name: "Chameleon Ward", type: "ward", coordinates: { lat: 51.522638, lng: -0.120035 }, floor: 3, description: "Premier Inn Clinical Building, Level 5 — cardiorespiratory / telemetry" },
    { id: "possum-ward", name: "Possum Ward", type: "ward", coordinates: { lat: 51.522537, lng: -0.120035 }, floor: 3, description: "Premier Inn Clinical Building, Level 5" },
    { id: "bumblebee-ward", name: "Bumblebee Ward", type: "ward", coordinates: { lat: 51.522447, lng: -0.118948 }, floor: 3, description: "Octav Botnar Wing, Level 5" },
    { id: "nurses-home-ent-gastroenterology-neuroscience-offices", name: "Nurses Home — ENT, Gastroenterology & Neuroscience Offices", type: "department", coordinates: { lat: 51.52302, lng: -0.120831 }, floor: 3, description: "Nurses Home, Level 5" },
    { id: "speech-language-therapy", name: "Speech & Language Therapy", type: "department", coordinates: { lat: 51.523085, lng: -0.120191 }, floor: 3, description: "Southwood Building, Level 5" },
    { id: "mscbLift-l5", name: "Lift Lobby — Morgan Stanley · Level 5", type: "lift", coordinates: { lat: 51.522636, lng: -0.119697 }, floor: 3 },
    { id: "mscbStair-l5", name: "Stairs — Morgan Stanley · Level 5", type: "stairs", coordinates: { lat: 51.522821, lng: -0.1197 }, floor: 3 },
    { id: "picbLift-l5", name: "Lift Lobby — Premier Inn · Level 5", type: "lift", coordinates: { lat: 51.52261, lng: -0.119809 }, floor: 3 },
    { id: "picbStair-l5", name: "Stairs — Premier Inn · Level 5", type: "stairs", coordinates: { lat: 51.522416, lng: -0.12016 }, floor: 3 },
    { id: "obwLift-l5", name: "Lift — Octav Botnar Wing · Level 5", type: "lift", coordinates: { lat: 51.522301, lng: -0.119047 }, floor: 3 },
    { id: "nhLift-l5", name: "Lift — Nurses Home · Level 5", type: "lift", coordinates: { lat: 51.523044, lng: -0.120625 }, floor: 3 },

    // ── Level 6 ──
    { id: "bear-ward", name: "Bear Ward", type: "ward", coordinates: { lat: 51.522643, lng: -0.119463 }, floor: 4, description: "Morgan Stanley Clinical Building, Level 6" },
    { id: "panther-ward", name: "Panther Ward", type: "ward", coordinates: { lat: 51.522588, lng: -0.120035 }, floor: 4, description: "Premier Inn Clinical Building, Level 6" },
    { id: "sky-ward", name: "Sky Ward", type: "ward", coordinates: { lat: 51.522447, lng: -0.118948 }, floor: 4, description: "Octav Botnar Wing, Level 6" },
    { id: "nurses-home-physiotherapy-occupational-therapy", name: "Nurses Home — Physiotherapy & Occupational Therapy", type: "department", coordinates: { lat: 51.52302, lng: -0.120831 }, floor: 4, description: "Nurses Home, Level 6" },
    { id: "mscbLift-l6", name: "Lift Lobby — Morgan Stanley · Level 6", type: "lift", coordinates: { lat: 51.522636, lng: -0.119697 }, floor: 4 },
    { id: "mscbStair-l6", name: "Stairs — Morgan Stanley · Level 6", type: "stairs", coordinates: { lat: 51.522821, lng: -0.1197 }, floor: 4 },
    { id: "picbLift-l6", name: "Lift Lobby — Premier Inn · Level 6", type: "lift", coordinates: { lat: 51.52261, lng: -0.119809 }, floor: 4 },
    { id: "picbStair-l6", name: "Stairs — Premier Inn · Level 6", type: "stairs", coordinates: { lat: 51.522416, lng: -0.12016 }, floor: 4 },
    { id: "obwLift-l6", name: "Lift — Octav Botnar Wing · Level 6", type: "lift", coordinates: { lat: 51.522301, lng: -0.119047 }, floor: 4 },
    { id: "nhLift-l6", name: "Lift — Nurses Home · Level 6", type: "lift", coordinates: { lat: 51.523044, lng: -0.120625 }, floor: 4 },

    // ── Level 7 ──
    { id: "eagle-ward", name: "Eagle Ward", type: "ward", coordinates: { lat: 51.522643, lng: -0.119463 }, floor: 5, description: "Morgan Stanley Clinical Building, Level 7" },
    { id: "pelican-ward", name: "Pelican Ward", type: "ward", coordinates: { lat: 51.522588, lng: -0.120035 }, floor: 5, description: "Premier Inn Clinical Building, Level 7 — isolation / SIR ward" },
    { id: "the-hive", name: "The Hive", type: "ward", coordinates: { lat: 51.522447, lng: -0.118948 }, floor: 5, description: "Octav Botnar Wing, Level 7" },
    { id: "nurses-home-clinical-operations-offices", name: "Nurses Home — Clinical Operations Offices", type: "department", coordinates: { lat: 51.523025, lng: -0.120831 }, floor: 5, description: "Nurses Home, Level 7" },
    { id: "mscbLift-l7", name: "Lift Lobby — Morgan Stanley · Level 7", type: "lift", coordinates: { lat: 51.522636, lng: -0.119697 }, floor: 5 },
    { id: "mscbStair-l7", name: "Stairs — Morgan Stanley · Level 7", type: "stairs", coordinates: { lat: 51.522821, lng: -0.1197 }, floor: 5 },
    { id: "picbLift-l7", name: "Lift Lobby — Premier Inn · Level 7", type: "lift", coordinates: { lat: 51.52261, lng: -0.119809 }, floor: 5 },
    { id: "picbStair-l7", name: "Stairs — Premier Inn · Level 7", type: "stairs", coordinates: { lat: 51.522416, lng: -0.12016 }, floor: 5 },
    { id: "obwLift-l7", name: "Lift — Octav Botnar Wing · Level 7", type: "lift", coordinates: { lat: 51.522301, lng: -0.119047 }, floor: 5 },
    { id: "nhLift-l7", name: "Lift — Nurses Home · Level 7", type: "lift", coordinates: { lat: 51.523044, lng: -0.120625 }, floor: 5 },
  ],
}
