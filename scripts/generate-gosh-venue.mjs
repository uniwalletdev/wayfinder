#!/usr/bin/env node
// Generates the GOSH venue data (src/lib/venues/gosh.ts) and the ten floor-plan
// SVGs (public/floorplans/gosh/level1..10.svg) from ONE description of the site,
// so that every drawn room, its search pin and the corridor a route follows all
// share a single coordinate system and cannot drift apart.
//
// Run with: node scripts/generate-gosh-venue.mjs
//
// ── WHERE THIS DATA COMES FROM ───────────────────────────────────────────────
// Everything below is transcribed from GOSH's own on-site signage, photographed
// in July 2026 (the `map- GOSH` folder). Two classes of source, with a strict
// rule about which wins:
//
//   * LIFT DIRECTORIES are authoritative for WHAT is on a level. Three boards:
//     the Mittal Children's Medical Centre board (Morgan Stanley + Premier Inn,
//     Levels 1-7), the Octav Botnar Wing board (Levels 0-7) and the Nurses Home
//     board (Levels 1-10).
//
//   * FIRE / ZONE DRAWINGS are authoritative for GEOMETRY only - footprints,
//     cores, corridors. Their room labels are NOT reliable: the Nurses Home
//     E-series sheets are dated 2013-2016 and their room uses have since
//     changed (Level 6 is drawn as research offices but is signed today as
//     Physiotherapy & Occupational Therapy). Never import a 2013 room use as a
//     waypoint name.
//
// Drawings used for geometry: N1(X)F00 (Morgan Stanley Level 1, the only scaled
// sheet at 1:200), FF-FZ-NHS-GOSH-MOR-02 (Morgan Stanley zones), K2/K5/K6/K7-FIR
// and FF-FZ-NHS-GOSH-PICB-02 (Premier Inn), FF-FZ-NHS-GOS-VCB (Variety Club),
// FF-FZ-NHS-GOSH-NRSH plus E1..E10-Fir (Nurses Home), FF-FZ-NHS-GOSH-WSL (West
// Link), FF-FZ-NHS-GOSH-WEHO (Weston House).
//
// ── ORIENTATION ─────────────────────────────────────────────────────────────
// NORTH IS UP in these plans. That comes from the true-north arrows on the dry
// riser plans (Octav Botnar Wing (L) and Southwood Building (C) sheets):
// Guilford Street runs along the NORTH of the site, Great Ormond Street the
// SOUTH, Lamb's Conduit Street EAST, Powis Place / Queen Square WEST.
//
// CAUTION: the hospital's own "This is Level 1 / Level 2" acrylic boards are
// oriented to suit wherever the reader is standing - sheet 4 and sheet 1 are
// north-up, sheet 8 is SOUTH-up, and the older pre-construction board is rotated
// 90 degrees. Do not "correct" this file to match any single board.
//
// ── LEVEL NUMBERING ─────────────────────────────────────────────────────────
// GOSH numbers its storeys Level 1-10 and the site slopes, so the street-level
// ground floor carrying the Main Entrance is LEVEL 2. That is modelled as
// floorNaming { word: "Level", groundLevel: 2 }: internal floor index 0 displays
// as "Level 2", so displayed level = index + 2 and index = level - 2.
//
// There is NO offset to apply. The Morgan Stanley zone sheets run Level -1 to 8,
// but that is not a different origin: its "LEVEL 2" sheet contains the Morgan
// Stanley Garden, which the site boards place at Level 2. Its Levels -1/0 are
// basements and Level 8 is plant - storeys with no public destination, which is
// why the lift directory never mentions them.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const SVG_DIR = path.join(REPO, "public", "floorplans", "gosh")

// ── Coordinate system ────────────────────────────────────────────────────────
// SVG space 1000 x 706 (x east, y south). Two ways to place it on the globe:
//
//   * DEFAULT (GCPS empty): the original north-up box below — four hand-estimated
//     corners, no rotation. Quick to set up, but the real GOSH site is tilted a
//     few degrees off north, so this drifts against GPS, worst at the corners.
//   * FITTED (>= 2 ground-control points in GCPS): a 2-D similarity transform —
//     position + one uniform scale + one rotation — least-squares-fitted to real
//     landmark coordinates. Waypoints, trails, the floor-plan bounds AND the plan
//     artwork are all re-projected through it, so nothing drifts apart.
//
// Fill in GCPS to switch from DEFAULT to FITTED; empty it again to fall back. The
// DEFAULT path is byte-for-byte the historical output, so committing this engine
// changes nothing on the map until real coordinates are supplied.
const W = 1000, H = 706
const LAT_N = 51.52325, LAT_S = 51.5221, LNG_W = -0.1212, LNG_E = -0.1186
const M_PER_PX = 0.18
const M_PER_DEG_LAT = 111320

// ── Ground-control points ─────────────────────────────────────────────────────
// `x,y` are the pixel positions (already fixed in this schematic) of features you
// can also pinpoint on a real map. Fill `lat,lng` from Google Maps or
// OpenStreetMap: right-click the exact spot → the coordinates appear → copy them.
//
// The five below are the road-CENTRE junctions that box in the site plus the Main
// Entrance: they are unambiguous on satellite imagery and span the whole canvas,
// which is exactly what makes the rotation + scale fit stable. Two points are the
// minimum (4 degrees of freedom); four or five let the fit report and drive down
// its own error. Spread and sharpness matter far more than count.
const GCPS = [
  { name: "Guilford St × Powis Pl (NW)",           x: 114, y: 82,  lat: null, lng: null },
  { name: "Guilford St × Lamb's Conduit St (NE)",  x: 866, y: 82,  lat: null, lng: null },
  { name: "Great Ormond St × Lamb's Conduit (SE)", x: 866, y: 614, lat: null, lng: null },
  { name: "Great Ormond St × Powis Pl (SW)",       x: 114, y: 614, lat: null, lng: null },
  { name: "Main Entrance (Guilford St doors)",     x: 524, y: 84,  lat: null, lng: null },
].filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lng))

// Complex-number least squares for the similarity w = a·z + b (a = scale·e^{iθ}),
// no external dependencies. Fits pixel space to a local East/North metre plane
// about the GCP centroid, then converts back to lat/lng. Returns null with < 2
// points so the caller falls back to the DEFAULT box.
const cAdd = (p, q) => ({ re: p.re + q.re, im: p.im + q.im })
const cSub = (p, q) => ({ re: p.re - q.re, im: p.im - q.im })
const cMul = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re })
const cConj = (p) => ({ re: p.re, im: -p.im })

function fitTransform() {
  if (GCPS.length < 2) return null
  const O = {
    lat: GCPS.reduce((s, g) => s + g.lat, 0) / GCPS.length,
    lng: GCPS.reduce((s, g) => s + g.lng, 0) / GCPS.length,
  }
  const kLng = M_PER_DEG_LAT * Math.cos((O.lat * Math.PI) / 180)
  // z: pixel with y flipped so +im points north; w: metres east/north of O.
  const zs = GCPS.map((g) => ({ re: g.x, im: H - g.y }))
  const ws = GCPS.map((g) => ({ re: (g.lng - O.lng) * kLng, im: (g.lat - O.lat) * M_PER_DEG_LAT }))
  const mean = (arr) => ({
    re: arr.reduce((s, p) => s + p.re, 0) / arr.length,
    im: arr.reduce((s, p) => s + p.im, 0) / arr.length,
  })
  const zbar = mean(zs), wbar = mean(ws)
  let num = { re: 0, im: 0 }, den = 0
  for (let i = 0; i < zs.length; i++) {
    const zc = cSub(zs[i], zbar), wc = cSub(ws[i], wbar)
    num = cAdd(num, cMul(wc, cConj(zc)))
    den += zc.re * zc.re + zc.im * zc.im
  }
  const a = { re: num.re / den, im: num.im / den }
  const b = cSub(wbar, cMul(a, zbar))
  const toLL = (x, y) => {
    const w = cAdd(cMul(a, { re: x, im: H - y }), b)
    return { lat: O.lat + w.im / M_PER_DEG_LAT, lng: O.lng + w.re / kLng }
  }
  return { toLL, kLng, scale: Math.hypot(a.re, a.im), theta: Math.atan2(a.im, a.re) }
}
const TF = fitTransform()

const round6 = (n) => +n.toFixed(6)
const px2lat = (y) => round6(LAT_N - (y / H) * (LAT_N - LAT_S))
const px2lng = (x) => round6(LNG_W + (x / W) * (LNG_E - LNG_W))
const ll = TF
  ? (x, y) => { const g = TF.toLL(x, y); return { lat: round6(g.lat), lng: round6(g.lng) } }
  : (x, y) => ({ lat: px2lat(y), lng: px2lng(x) })

// Floor-plan overlay bounds: the axis-aligned lat/lng box the plan image is
// stretched onto (Leaflet's imageOverlay cannot rotate). DEFAULT keeps the hand
// box; FITTED uses the geographic bounding box of the re-projected canvas, with
// the artwork pre-rotated inside it (see frameSvg) so the north-up overlay still
// lands every feature at its true bearing.
const BB = TF
  ? (() => {
      const c = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => TF.toLL(x, y))
      return {
        S: Math.min(...c.map((p) => p.lat)), N: Math.max(...c.map((p) => p.lat)),
        W: Math.min(...c.map((p) => p.lng)), E: Math.max(...c.map((p) => p.lng)),
      }
    })()
  : { S: LAT_S, N: LAT_N, W: LNG_W, E: LNG_E }

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const idxOf = (level) => level - 2

// ── Palette ──────────────────────────────────────────────────────────────────
const CAT = {
  ward:     { fill: "#DBEAFE", stroke: "#93C5FD" },
  clinical: { fill: "#D1FAE5", stroke: "#6EE7B7" },
  public:   { fill: "#FEF3C7", stroke: "#FCD34D" },
  office:   { fill: "#EDE9FE", stroke: "#C4B5FD" },
  support:  { fill: "#E2E8F0", stroke: "#CBD5E1" },
  wc:       { fill: "#CFFAFE", stroke: "#67E8F9" },
  circ:     { fill: "#F1F5F9", stroke: "#CBD5E1" },
}
const PAGE = "#F8FAFC"
const CORRIDOR = "#F1F5F9"
const WALL = "#1E293B"
const CONTEXT = { fill: "#F1F5F9", stroke: "#CBD5E1" }
const STREET = "#E2E8F0"

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;")
const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// ── The site ─────────────────────────────────────────────────────────────────
// Footprints are read off the north-up dry riser site plans and the north-up
// "This is Level 2" boards. `axis` drives the room-layout engine: "ew" means the
// building runs east-west with a corridor spine along its length, "ns" likewise
// north-south.
//
// `levels` is the inclusive public level range each building serves.

const BUILDINGS = {
  nursesHome: {
    name: "Nurses Home", code: "E", axis: "ew", levels: [1, 10],
    rect: { x0: 150, y0: 88, x1: 430, y1: 172 },
    // Stair A west, Stair B east - the "A-B stairwell, Level 2 to 10" named on
    // the Southwood dry riser plan. Two lifts beside stair A.
    cores: [
      { kind: "stairs", name: "Stair A", at: 0.06 },
      { kind: "lift", name: "Lifts", at: 0.16 },
      { kind: "stairs", name: "Stair B", at: 0.95 },
    ],
  },
  southwood: {
    name: "Southwood Building", code: "C", axis: "ew", levels: [1, 7],
    rect: { x0: 150, y0: 196, x1: 410, y1: 330 },
    cores: [
      { kind: "stairs", name: "Stairs", at: 0.08 },
      { kind: "lift", name: "Lifts", at: 0.5 },
    ],
  },
  westLink: {
    name: "West Link", code: "D", axis: "ns", levels: [1, 4],
    rect: { x0: 150, y0: 176, x1: 208, y1: 196 },
    cores: [{ kind: "stairs", name: "Stairs", at: 0.5 }],
  },
  eastLink: {
    name: "East Link", code: "F", axis: "ns", levels: [1, 4],
    rect: { x0: 396, y0: 176, x1: 434, y1: 200 },
    cores: [],
  },
  morganStanley: {
    name: "Morgan Stanley Clinical Building", code: "N", axis: "ns", levels: [1, 7],
    rect: { x0: 452, y0: 88, x1: 596, y1: 392 },
    // Six lifts and two staircases in TWO cores at opposite ends of a long
    // floor - straight off the 1:200 Level 1 sheet (N1(X)F00). West core:
    // N1L-01..04 around lift lobby N1002, plus stair N1ST-01. East core:
    // N1L-05/06 around lobby N1020, plus stair N1ST-02.
    cores: [
      { kind: "lift", name: "North Lift Lobby", at: 0.13, note: "4 lifts" },
      { kind: "stairs", name: "North Stairs", at: 0.23 },
      { kind: "lift", name: "South Lift Lobby", at: 0.82, note: "2 lifts" },
      { kind: "stairs", name: "South Stairs", at: 0.92 },
    ],
  },
  premierInn: {
    name: "Premier Inn Clinical Building", code: "K", axis: "ew", levels: [1, 7],
    // The footprint CHANGES with height: a wide irregular podium at Levels 1-2,
    // narrowing to the long east-west bedroom bar at Levels 3-7.
    rect: { x0: 566, y0: 330, x1: 828, y1: 404 },
    rectByLevel: {
      1: { x0: 528, y0: 300, x1: 840, y1: 430 },
      2: { x0: 528, y0: 300, x1: 840, y1: 430 },
    },
    cores: [
      { kind: "stairs", name: "West Stairs", at: 0.04 },
      { kind: "lift", name: "Lift Lobby", at: 0.62, note: "4 lifts" },
      { kind: "stairs", name: "East Stairs", at: 0.96 },
    ],
  },
  varietyClub: {
    name: "Variety Club Building", code: "B", axis: "ew", levels: [1, 7],
    rect: { x0: 372, y0: 424, x1: 664, y1: 580 },
    cores: [
      { kind: "stairs", name: "Stairs", at: 0.1 },
      { kind: "lift", name: "Lifts", at: 0.5 },
    ],
  },
  octavBotnar: {
    name: "Octav Botnar Wing", code: "L", axis: "ns", levels: [1, 7],
    rect: { x0: 742, y0: 440, x1: 852, y1: 596 },
    cores: [
      { kind: "lift", name: "Lifts", at: 0.2 },
      { kind: "stairs", name: "Stairs", at: 0.82 },
    ],
  },
  cameliaBotnar: {
    name: "Camelia Botnar Labs", code: "P", axis: "ns", levels: [1, 4],
    rect: { x0: 758, y0: 248, x1: 852, y1: 330 },
    cores: [{ kind: "lift", name: "Lifts", at: 0.5 }],
  },
  westonHouse: {
    name: "Weston House", axis: "ns", levels: [1, 8],
    rect: { x0: 300, y0: 628, x1: 388, y1: 700 },
    cores: [{ kind: "stairs", name: "Stairs", at: 0.8 }],
  },
}

// Buildings drawn as context only - no internal mapping, one waypoint each on
// Level 2. Several sit across a public street from the main site.
const CONTEXT_BUILDINGS = [
  { id: "school", name: "School", rect: { x0: 56, y0: 214, x1: 144, y1: 300 } },
  { id: "boiler-house", name: "Boiler House", rect: { x0: 246, y0: 176, x1: 300, y1: 196 } },
  { id: "zayed-centre", name: "The Zayed Centre for Research", rect: { x0: 884, y0: 96, x1: 988, y1: 184 } },
  { id: "rlhim", name: "Royal London Hospital for Integrated Medicine", rect: { x0: 186, y0: 548, x1: 288, y1: 616 } },
  { id: "barclay-house", name: "Barclay House", rect: { x0: 398, y0: 628, x1: 470, y1: 700 } },
  { id: "sight-and-sound", name: "Sight and Sound Centre", rect: { x0: 60, y0: 632, x1: 162, y1: 700 } },
]

// The Children's Cancer Centre construction site along the Great Ormond Street
// frontage. It stands where the Frontage Building, Paul O'Gorman Building and
// Cardiac Wing used to be - those still appear on the older dry riser base plans
// (codes M, A, K) because those boards predate the demolition, so they are
// deliberately NOT modelled as buildings.
const CONSTRUCTION = { x0: 300, y0: 590, x1: 736, y1: 620 }

const STREETS = [
  { name: "GUILFORD STREET", x0: 120, y0: 56, x1: 1000, y1: 78, label: "h" },
  { name: "GREAT ORMOND STREET", x0: 60, y0: 604, x1: 900, y1: 624, label: "h" },
  { name: "LAMB'S CONDUIT ST", x0: 856, y0: 78, x1: 878, y1: 624, label: "v" },
  { name: "POWIS PLACE", x0: 104, y0: 176, x1: 124, y1: 616, label: "v" },
  { name: "BOSWELL ST", x0: 168, y0: 624, x1: 186, y1: 706, label: "v" },
]

// ── Per-level programme ──────────────────────────────────────────────────────
// Straight off the three lift directories. Each entry is [displayName, category,
// optional description]. Order matters: rooms are laid out along the building's
// long axis in this order.

const PROGRAMME = {
  morganStanley: {
    1: [
      ["Walrus Clinical Investigations Centre", "clinical", "Morgan Stanley Clinical Building, Level 1"],
      ["Echo / ECG", "clinical", "Within the Walrus Clinical Investigations Centre"],
      ["Lung Function", "clinical", "Exercise testing - within the Walrus CIC"],
      ["Walrus Day Care", "clinical", "Day-care beds within the Walrus CIC"],
    ],
    2: [
      ["Main Reception", "public", "Morgan Stanley Clinical Building, Level 2"],
      ["The Disney Reef", "public", "Play and entertainment space"],
      ["GOSH Charity Hub", "public", "Morgan Stanley Clinical Building, Level 2"],
      ["The Lagoon", "public", "Restaurant - hot food, grab & go, coffee bar and shop"],
      ["WCs and Baby Change", "wc", "Includes accessible WCs"],
    ],
    3: [["Theatres 7-10", "clinical", "Morgan Stanley Clinical Building, Level 3"]],
    4: [["Flamingo Ward", "ward", "Morgan Stanley Clinical Building, Level 4"]],
    5: [["Koala Ward", "ward", "Morgan Stanley Clinical Building, Level 5"]],
    6: [["Bear Ward", "ward", "Morgan Stanley Clinical Building, Level 6"]],
    7: [["Eagle Ward", "ward", "Morgan Stanley Clinical Building, Level 7"]],
  },
  premierInn: {
    1: [
      ["Bod Pod", "clinical", "Premier Inn Clinical Building, Level 1"],
      ["Nuclear Medicine", "clinical", "Premier Inn Clinical Building, Level 1"],
    ],
    2: [
      ["Kangaroo Ward", "ward", "Premier Inn Clinical Building, Level 2"],
      ["Leopard Ward", "ward", "Premier Inn Clinical Building, Level 2"],
    ],
    3: [
      ["Nightingale Day Unit / Recovery", "clinical", "Premier Inn Clinical Building, Level 3"],
      ["Theatres 11 & 12", "clinical", "Premier Inn Clinical Building, Level 3"],
    ],
    4: [["Alligator Ward", "ward", "Premier Inn Clinical Building, Level 4"]],
    5: [
      ["Chameleon Ward", "ward", "Premier Inn Clinical Building, Level 5 - cardiorespiratory / telemetry"],
      ["Possum Ward", "ward", "Premier Inn Clinical Building, Level 5"],
    ],
    6: [["Panther Ward", "ward", "Premier Inn Clinical Building, Level 6 - orthopaedics"]],
    7: [["Pelican Ward", "ward", "Premier Inn Clinical Building, Level 7 - isolation / SIR ward"]],
  },
  octavBotnar: {
    1: [
      ["Ocean Department", "clinical", "Octav Botnar Wing, Level 1"],
      ["Theatres 14 & 15", "clinical", "Octav Botnar Wing, Level 1"],
      ["BME Department", "support", "Octav Botnar Wing, Levels 0-1"],
    ],
    2: [
      ["Private Patients Reception", "public", "Octav Botnar Wing, Level 2"],
      ["Caterpillar Outpatients", "clinical", "Octav Botnar Wing, Level 2"],
    ],
    3: [
      ["Kingfisher Ward", "ward", "Octav Botnar Wing, Level 3"],
      ["Gastroenterology Investigation Suite", "clinical", "Octav Botnar Wing, Level 3"],
    ],
    4: [["Butterfly Ward", "ward", "Octav Botnar Wing, Level 4"]],
    5: [["Bumblebee Ward", "ward", "Octav Botnar Wing, Level 5"]],
    6: [["Sky Ward", "ward", "Octav Botnar Wing, Level 6"]],
    7: [["The Hive", "ward", "Octav Botnar Wing, Level 7"]],
  },
  nursesHome: {
    1: [
      ["Post Room", "support", "Nurses Home, Level 1"],
      ["Portering, Receipts & Distribution", "support", "Nurses Home, Level 1"],
      ["Works / Plant", "support", "Workshops and heating plant - Nurses Home, Level 1"],
    ],
    2: [
      ["Dietetics", "clinical", "Nurses Home, Level 2"],
      ["Speech & Language Therapy", "clinical", "Nurses Home, Level 2"],
      ["Radiology & Urology Offices", "office", "Nurses Home, Level 2"],
      ["Doctor's Mess", "office", "Nurses Home, Level 2"],
      ["Patient Laundry", "support", "Nurses Home, Level 2"],
    ],
    3: [
      ["Mezzanine Unit", "office", "Nurses Home, Level 3"],
      ["Nursing Workforce Team", "office", "Nurses Home, Level 3"],
      ["Archivist", "office", "Nurses Home, Level 3"],
      ["Accommodation Team", "office", "Nurses Home, Level 3"],
    ],
    4: [
      ["Clinical Simulation Centre", "clinical", "Nurses Home, Level 4"],
      ["Moving and Handling Training Rooms", "office", "Nurses Home, Level 4"],
      ["Nursing & Education", "office", "Nurses Home, Level 4"],
      ["Nursing & HCA Bank", "office", "Nurses Home, Level 4"],
      ["Paediatric & Neonatal Intensive Care Offices", "office", "Nurses Home, Level 4"],
      ["Resuscitation Services", "office", "Nurses Home, Level 4"],
    ],
    5: [
      ["ENT", "clinical", "Nurses Home, Level 5"],
      ["Gastroenterology", "clinical", "Nurses Home, Level 5"],
      ["Neuroscience Offices", "office", "Nurses Home, Level 5"],
    ],
    6: [
      ["Physiotherapy Offices", "office", "Nurses Home, Level 6"],
      ["Occupational Therapy Offices", "office", "Nurses Home, Level 6"],
    ],
    7: [["Clinical Operations Offices", "office", "Nurses Home, Level 7"]],
    8: [
      ["Rheumatology, Dermatology & Oncology Offices", "office", "Nurses Home, Level 8"],
      ["BCC Matrons", "office", "Nurses Home, Level 8"],
    ],
    9: [["On Call Accommodation", "office", "Nurses Home, Level 9"]],
    10: [["Neurosciences Offices", "office", "Nurses Home, Level 10"]],
  },
  varietyClub: {
    2: [
      ["Pharmacy", "public", "Variety Club Building, Level 2"],
      ["X-Ray", "clinical", "Variety Club Building, Level 2"],
      ["PALS", "public", "Patient Advice & Liaison Service"],
      ["Chapel", "public", "Variety Club Building, Level 2"],
      ["Multifaith Room", "public", "Variety Club Building, Level 2"],
    ],
  },
  southwood: {
    2: [["Southwood Outpatients & Therapies", "clinical", "Southwood Building, Level 2"]],
    5: [
      ["Speech & Language Therapy Offices", "office", "Southwood Building, Level 5"],
      ["PAMHS Meeting Room", "office", "Southwood Building, Level 5"],
    ],
  },
  westLink: {
    1: [["Scan Room", "clinical", "West Link, Level 1"]],
    2: [
      ["Cashiers", "public", "West Link, Level 2"],
      ["Treatment Room", "clinical", "West Link, Level 2"],
    ],
  },
  cameliaBotnar: {
    2: [["Camelia Botnar Labs", "clinical", "Laboratories"]],
  },
  westonHouse: {
    2: [["Weston House", "office", "Offices - south of Great Ormond Street"]],
  },
}

// Standalone site features, all at street level (Level 2).
const SITE_FEATURES = [
  { id: "main-entrance", name: "Main Entrance", type: "exit", x: 524, y: 84,
    desc: "Guilford Street - step-free, into the north end of the Morgan Stanley Clinical Building" },
  { id: "lullaby-factory", name: "Lullaby Factory", type: "other", x: 440, y: 250,
    desc: "GOSH's sculptural art installation, in the light well between the Southwood Building and Morgan Stanley" },
  { id: "morgan-stanley-garden", name: "Morgan Stanley Garden", type: "other", x: 620, y: 250,
    desc: "Courtyard garden" },
  { id: "loading-bay", name: "Loading Bay", type: "other", x: 604, y: 100,
    desc: "Morgan Stanley loading bay - access from the pedestrian gate on Guilford Street" },
  { id: "vcb-car-park", name: "VCB Car Park", type: "other", x: 340, y: 566,
    desc: "Variety Club Building car park and main undercover cycle park" },
  { id: "cycle-parking-lullaby", name: "Lullaby Factory Cycle Parking", type: "other", x: 424, y: 300,
    desc: "88 spaces - access at the bottom of the stairwell, from Guilford Street via the loading dock" },
  { id: "ambulances-only", name: "Ambulance Entrance", type: "exit", x: 316, y: 470,
    desc: "Ambulances only - west side of the site" },
  { id: "southwood-ramp", name: "Ramp to Southwood", type: "other", x: 420, y: 340,
    desc: "Step-free ramp between the Mittal Children's Medical Centre and the Southwood Building" },
]

// ── Room layout engine ───────────────────────────────────────────────────────
// Splits a building footprint into a corridor spine plus two rows/columns of
// rooms, so that pins, drawn rooms and the routing network are generated from
// the same numbers.

const COR = 26 // corridor width in px (~4.7 m)

function footprint(key, level) {
  const b = BUILDINGS[key]
  return (b.rectByLevel && b.rectByLevel[level]) || b.rect
}

function layout(key, level) {
  const b = BUILDINGS[key]
  const r = footprint(key, level)
  const rooms = []
  const items = []

  // Cores first - they occupy fixed positions along the spine on every level so
  // that a lift on Level 3 is directly above the same lift on Level 2.
  for (const c of b.cores) items.push({ core: c, at: c.at })

  const prog = (PROGRAMME[key] && PROGRAMME[key][level]) || []
  const n = prog.length
  // Spread programme rooms across the length, skipping the very ends.
  prog.forEach((p, i) => {
    const at = n === 1 ? 0.5 : 0.12 + (0.76 * i) / (n - 1)
    items.push({ room: p, at })
  })

  items.sort((a, z) => a.at - z.at)

  const ew = b.axis === "ew"
  const L0 = ew ? r.x0 : r.y0
  const L1 = ew ? r.x1 : r.y1
  const Cmid = ew ? (r.y0 + r.y1) / 2 : (r.x0 + r.x1) / 2
  const span = L1 - L0

  // Alternate sides so rooms sit either side of the corridor.
  let side = 0
  for (const it of items) {
    const centre = L0 + it.at * span
    const half = Math.max(30, Math.min(64, span / Math.max(4, items.length) / 1.6))
    const a = Math.max(L0 + 2, centre - half)
    const z = Math.min(L1 - 2, centre + half)
    const isCore = !!it.core
    // Cores straddle the corridor; programme rooms alternate north/south.
    const s = isCore ? 2 : side++ % 2
    let rect
    if (ew) {
      const y0 = s === 0 ? r.y0 + 2 : s === 1 ? Cmid + COR / 2 : Cmid - COR / 2 - 14
      const y1 = s === 0 ? Cmid - COR / 2 : s === 1 ? r.y1 - 2 : Cmid + COR / 2 + 14
      rect = { x0: a, y0, x1: z, y1 }
    } else {
      const x0 = s === 0 ? r.x0 + 2 : s === 1 ? Cmid + COR / 2 : Cmid - COR / 2 - 14
      const x1 = s === 0 ? Cmid - COR / 2 : s === 1 ? r.x1 - 2 : Cmid + COR / 2 + 14
      rect = { x0, y0: a, x1, y1: z }
    }
    if (isCore) {
      rooms.push({ ...rect, kind: it.core.kind, name: it.core.name, note: it.core.note, cat: "circ", building: key })
    } else {
      rooms.push({ ...rect, name: it.room[0], cat: it.room[1], desc: it.room[2], building: key })
    }
  }

  // Corridor spine: the centreline plus a node opposite every room, which
  // guarantees each waypoint sits within a few metres of the routing network.
  //
  // The link-corridor attachment points MUST be nodes here too. buildTrailGraph
  // stitches trails together by node proximity (TRAIL_STITCH_M, 6 m) - it does
  // not split a segment at a point lying part-way along it. A link that meets
  // this spine between two sparse nodes would leave the building an island.
  const nodes = []
  const attach = attachmentsFor(level)[key] || []
  const ends = [L0 + 10, ...items.map((it) => L0 + it.at * span), L1 - 10, ...attach]
  for (const t of ends.sort((a, z) => a - z)) nodes.push(ew ? [t, Cmid] : [Cmid, t])

  return { rect: r, rooms, spine: nodes, axis: b.axis, mid: Cmid }
}

// Which buildings exist on a given level.
function buildingsOn(level) {
  return Object.keys(BUILDINGS).filter((k) => {
    const [a, z] = BUILDINGS[k].levels
    return level >= a && level <= z
  })
}

// ── Link corridors ───────────────────────────────────────────────────────────
// The site boards mark "Link Corridors" between blocks. These must join the per
// building corridor SPINES - not their outer walls - or each building ends up an
// island and cross-building routing silently falls back to straight lines.
// So the pairs are declared here and the geometry is derived from the spines.
const LINK_PAIRS = [
  ["nursesHome", "southwood"],
  ["southwood", "westLink"],
  ["southwood", "eastLink"],
  ["eastLink", "morganStanley"],
  // The Mittal Children's Medical Centre is one complex: Morgan Stanley and
  // Premier Inn interconnect on every level.
  ["morganStanley", "premierInn"],
  // The signed step-free ramp between the Mittal and the Southwood. This is the
  // only Southwood <-> Mittal link above Level 4, where the East Link stops.
  ["southwood", "morganStanley"],
  ["morganStanley", "varietyClub"],
  ["varietyClub", "premierInn"],
  ["premierInn", "cameliaBotnar"],
  ["premierInn", "octavBotnar"],
]

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// The corridor spine of a building at a level, as a segment in one axis.
function spineSeg(key, level) {
  const b = BUILDINGS[key]
  const r = footprint(key, level)
  return b.axis === "ew"
    ? { axis: "ew", at: (r.y0 + r.y1) / 2, lo: r.x0, hi: r.x1 }
    : { axis: "ns", at: (r.x0 + r.x1) / 2, lo: r.y0, hi: r.y1 }
}

// An L-shaped corridor joining two spines, with both endpoints landing exactly
// ON the spines so the trail graph merges them into one connected network.
function linkPath(aKey, bKey, level) {
  const A = spineSeg(aKey, level), Bs = spineSeg(bKey, level)
  if (A.axis === "ew" && Bs.axis === "ew") {
    const x = clamp((Math.max(A.lo, Bs.lo) + Math.min(A.hi, Bs.hi)) / 2, Math.max(A.lo, Bs.lo), Math.min(A.hi, Bs.hi))
    const xa = clamp(x, A.lo, A.hi), xb = clamp(x, Bs.lo, Bs.hi)
    return [[xa, A.at], [xa, (A.at + Bs.at) / 2], [xb, Bs.at]]
  }
  if (A.axis === "ns" && Bs.axis === "ns") {
    const y = clamp((Math.max(A.lo, Bs.lo) + Math.min(A.hi, Bs.hi)) / 2, Math.max(A.lo, Bs.lo), Math.min(A.hi, Bs.hi))
    const ya = clamp(y, A.lo, A.hi), yb = clamp(y, Bs.lo, Bs.hi)
    return [[A.at, ya], [(A.at + Bs.at) / 2, ya], [Bs.at, yb]]
  }
  // One horizontal, one vertical: meet at the crossing of the two centrelines.
  const ew = A.axis === "ew" ? A : Bs
  const ns = A.axis === "ew" ? Bs : A
  const cx = clamp(ns.at, ew.lo, ew.hi)
  const cy = clamp(ew.at, ns.lo, ns.hi)
  const path = [[cx, ew.at], [ns.at, ew.at], [ns.at, cy]]
  return A.axis === "ew" ? path : path.slice().reverse()
}

// ── Outdoor footpaths (Level 2 only) ─────────────────────────────────────────
// Several destinations are detached from the main site and are reached along the
// public pavement, not an internal corridor: the Zayed Centre on Guilford
// Street, the Sight and Sound Centre on Boswell Street, RLHIM / Weston House /
// Barclay House across Great Ormond Street, and the School off Powis Place.
// Without these, routing to them has nothing to follow.
const OUTDOOR_PATHS = [
  // ONE closed pavement ring around the site. It has to be a single connected
  // loop - four separate street segments leave the corners unjoined, and then a
  // route from inside the hospital to, say, the VCB car park has no way round.
  { id: "pavement-ring", pts: [
    [114, 82], [300, 82], [452, 82], [524, 82], [596, 82], [760, 82], [866, 82],
    [866, 248], [866, 400], [866, 500], [866, 614],
    [736, 614], [560, 614], [434, 614], [344, 614], [237, 614], [177, 614], [114, 614],
    // Nodes on the west side line up with the spurs that leave it, so those
    // spurs stitch onto the ring rather than dangling 8 m short of it.
    [114, 566], [114, 520], [114, 470], [114, 400], [114, 257], [114, 180], [114, 82],
  ] },
  // Guilford Street continues east past Lamb's Conduit to the Zayed Centre.
  { id: "guilford-east", pts: [[866, 82], [936, 82]] },
  { id: "boswell-pavement", pts: [[177, 614], [177, 660], [177, 666]] },
  // Spurs from the pavement to each detached entrance
  { id: "spur-zayed", pts: [[936, 82], [936, 140]] },
  { id: "spur-sight-and-sound", pts: [[177, 666], [111, 666]] },
  { id: "spur-weston-house", pts: [[344, 614], [344, 664]] },
  { id: "spur-barclay-house", pts: [[434, 614], [434, 664]] },
  { id: "spur-rlhim", pts: [[237, 614], [237, 582]] },
  { id: "spur-school", pts: [[114, 257], [100, 257]] },
  { id: "spur-ambulances", pts: [[114, 470], [316, 470]] },
  { id: "spur-vcb-car-park", pts: [[114, 566], [340, 566]] },
  { id: "spur-main-entrance", pts: [[524, 82], [524, 84]] },
]

// Where each link corridor meets each building's spine, as a position along that
// spine's axis. linkPath always returns [pointOnA, ..., pointOnB], so the first
// and last points are the two attachment points.
const _attachCache = new Map()
function attachmentsFor(level) {
  if (_attachCache.has(level)) return _attachCache.get(level)
  const m = {}
  for (const [a, b, pts] of linksOn(level)) {
    const A = spineSeg(a, level), Bs = spineSeg(b, level)
    const first = pts[0], last = pts[pts.length - 1]
    ;(m[a] ||= []).push(A.axis === "ew" ? first[0] : first[1])
    ;(m[b] ||= []).push(Bs.axis === "ew" ? last[0] : last[1])
  }
  _attachCache.set(level, m)
  return m
}

function linksOn(level) {
  return LINK_PAIRS
    .filter(([a, b]) => {
      const ba = BUILDINGS[a].levels, bb = BUILDINGS[b].levels
      return level >= ba[0] && level <= ba[1] && level >= bb[0] && level <= bb[1]
    })
    .map(([a, b]) => [a, b, linkPath(a, b, level)])
}

// ── SVG ──────────────────────────────────────────────────────────────────────
function wrap(name, maxChars) {
  const words = String(name).split(" ")
  const lines = []
  let cur = ""
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w } else cur = cur ? cur + " " + w : w
  }
  if (cur) lines.push(cur)
  return lines
}

function roomSvg(r) {
  const c = CAT[r.cat] || CAT.support
  const w = r.x1 - r.x0, h = r.y1 - r.y0
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2
  let s = `  <rect x='${r.x0.toFixed(1)}' y='${r.y0.toFixed(1)}' width='${w.toFixed(1)}' height='${h.toFixed(1)}' rx='2' fill='${c.fill}' stroke='${c.stroke}' stroke-width='1.2'/>\n`
  const icon = r.kind === "lift" ? "\u{1F6D7}" : r.kind === "stairs" ? "\u{1FA9C}" : null
  const maxChars = Math.max(8, Math.floor(w / 6.2))
  const lines = wrap(r.name, maxChars)
  const size = h < 30 || w < 60 ? 8 : 9.5
  const lh = size + 2
  let ty = cy - ((icon ? 12 : 0) + lines.length * lh) / 2 + size
  if (icon) {
    s += `  <text x='${cx.toFixed(1)}' y='${(ty + 2).toFixed(1)}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='12'>${icon}</text>\n`
    ty += 14
  }
  for (const line of lines) {
    s += `  <text x='${cx.toFixed(1)}' y='${ty.toFixed(1)}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='${size}' font-weight='bold' fill='#0F172A'>${esc(line)}</text>\n`
    ty += lh
  }
  return s
}

// Wrap a level's drawing body in the outer <svg>. DEFAULT reproduces the
// historical markup exactly. FITTED emits onto a canvas whose viewBox is the
// axis-aligned geographic bounding box (BB), with the whole body pushed through a
// single affine <g transform> that maps the original upright pixel space onto
// that canvas — so stretching the north-up image onto BB reproduces the site's
// true rotation, without touching any of the drawing code below.
function frameSvg(body) {
  if (!TF) return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}'>\n${body}</svg>\n`
  const widthM = (BB.E - BB.W) * TF.kLng
  const heightM = (BB.N - BB.S) * M_PER_DEG_LAT
  const WS = W, HS = Math.max(1, Math.round((WS * heightM) / widthM))
  // original pixel (x,y) → emitted-canvas pixel, via true lat/lng then the
  // axis-aligned BB→canvas scaling. Affine, so three basis points define it.
  const f = (x, y) => {
    const g = TF.toLL(x, y)
    return { X: ((g.lng - BB.W) / (BB.E - BB.W)) * WS, Y: ((BB.N - g.lat) / (BB.N - BB.S)) * HS }
  }
  const o = f(0, 0), ux = f(1, 0), uy = f(0, 1)
  const m = [ux.X - o.X, ux.Y - o.Y, uy.X - o.X, uy.Y - o.Y, o.X, o.Y].map((v) => +v.toFixed(5))
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${WS} ${HS}'>\n  <g transform='matrix(${m.join(" ")})'>\n${body}  </g>\n</svg>\n`
}

function buildSvg(level) {
  const keys = buildingsOn(level)
  const lays = Object.fromEntries(keys.map((k) => [k, layout(k, level)]))

  let s = `  <rect width='${W}' height='${H}' fill='${PAGE}'/>\n`

  // Streets
  for (const st of STREETS) {
    s += `  <rect x='${st.x0}' y='${st.y0}' width='${st.x1 - st.x0}' height='${st.y1 - st.y0}' fill='${STREET}'/>\n`
    const cx = (st.x0 + st.x1) / 2, cy = (st.y0 + st.y1) / 2
    if (st.label === "h") {
      s += `  <text x='${cx}' y='${cy + 4}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='10' font-style='italic' fill='#94A3B8' letter-spacing='2'>${esc(st.name)}</text>\n`
    } else {
      s += `  <text x='${cx}' y='${cy}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='10' font-style='italic' fill='#94A3B8' letter-spacing='2' transform='rotate(-90 ${cx} ${cy})'>${esc(st.name)}</text>\n`
    }
  }

  // Outdoor footpaths (Level 2), drawn under the buildings
  if (level === 2) {
    for (const p of OUTDOOR_PATHS) {
      const d = p.pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")
      s += `  <path d='${d}' fill='none' stroke='#E7E5E4' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/>\n`
    }
  }

  // Context buildings + construction hoarding (Level 2 shows labels)
  for (const cb of CONTEXT_BUILDINGS) {
    const r = cb.rect
    s += `  <rect x='${r.x0}' y='${r.y0}' width='${r.x1 - r.x0}' height='${r.y1 - r.y0}' rx='3' fill='${CONTEXT.fill}' stroke='${CONTEXT.stroke}' stroke-width='1.5' stroke-dasharray='5,4'/>\n`
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2
    const lines = wrap(cb.name, Math.max(9, Math.floor((r.x1 - r.x0) / 6)))
    let ty = cy - (lines.length * 11) / 2 + 9
    for (const line of lines) {
      s += `  <text x='${cx}' y='${ty}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='9' fill='#94A3B8'>${esc(line)}</text>\n`
      ty += 11
    }
  }
  s += `  <rect x='${CONSTRUCTION.x0}' y='${CONSTRUCTION.y0}' width='${CONSTRUCTION.x1 - CONSTRUCTION.x0}' height='${CONSTRUCTION.y1 - CONSTRUCTION.y0}' rx='3' fill='#FEE2E2' stroke='#FCA5A5' stroke-width='1.5'/>\n`
  s += `  <text x='${(CONSTRUCTION.x0 + CONSTRUCTION.x1) / 2}' y='${(CONSTRUCTION.y0 + CONSTRUCTION.y1) / 2 + 4}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='10' font-weight='bold' fill='#B91C1C' letter-spacing='1'>CHILDREN'S CANCER CENTRE - UNDER CONSTRUCTION</text>\n`

  // Building slabs and corridors
  for (const k of keys) {
    const L = lays[k]
    const r = L.rect
    s += `  <rect x='${r.x0}' y='${r.y0}' width='${r.x1 - r.x0}' height='${r.y1 - r.y0}' fill='white'/>\n`
    if (L.axis === "ew") {
      s += `  <rect x='${r.x0}' y='${L.mid - COR / 2}' width='${r.x1 - r.x0}' height='${COR}' fill='${CORRIDOR}'/>\n`
    } else {
      s += `  <rect x='${L.mid - COR / 2}' y='${r.y0}' width='${COR}' height='${r.y1 - r.y0}' fill='${CORRIDOR}'/>\n`
    }
  }

  // Link corridors
  for (const [, , pts] of linksOn(level)) {
    const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")
    s += `  <path d='${d}' fill='none' stroke='${CORRIDOR}' stroke-width='14' stroke-linecap='round' stroke-linejoin='round'/>\n`
    s += `  <path d='${d}' fill='none' stroke='#CBD5E1' stroke-width='1' stroke-dasharray='4,3'/>\n`
  }

  // Rooms
  for (const k of keys) for (const r of lays[k].rooms) s += roomSvg(r)

  // Building outlines + name tags
  for (const k of keys) {
    const b = BUILDINGS[k], r = lays[k].rect
    s += `  <rect x='${r.x0}' y='${r.y0}' width='${r.x1 - r.x0}' height='${r.y1 - r.y0}' fill='none' stroke='${WALL}' stroke-width='2'/>\n`
    const tag = b.code ? `${b.name} (${b.code})` : b.name
    s += `  <text x='${r.x0 + 4}' y='${r.y0 - 4}' font-family='Arial,Helvetica,sans-serif' font-size='9.5' font-weight='bold' fill='#475569'>${esc(tag)}</text>\n`
  }

  // Level 2 only: main entrance marker
  if (level === 2) {
    s += `  <rect x='452' y='72' width='150' height='18' rx='9' fill='#16A34A'/>\n`
    s += `  <text x='527' y='85' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='10' font-weight='bold' fill='white'>▲ MAIN ENTRANCE</text>\n`
  }

  // Level chip
  const sub = LEVEL_SUB[level] || "Great Ormond Street Hospital for Children"
  s += `  <g>\n    <rect x='20' y='16' width='268' height='44' rx='10' fill='#005EB8'/>\n`
  s += `    <text x='34' y='36' font-family='Arial,Helvetica,sans-serif' font-size='15' font-weight='bold' fill='white'>Level ${level}${level === 2 ? " · Ground Floor" : ""}</text>\n`
  s += `    <text x='34' y='51' font-family='Arial,Helvetica,sans-serif' font-size='8.5' fill='#BFDBFE'>${esc(sub)}</text>\n  </g>\n`

  // North arrow
  s += `  <g>\n    <circle cx='956' cy='660' r='17' fill='white' stroke='#CBD5E1' stroke-width='1.5'/>\n`
  s += `    <polygon points='956,647 951,663 956,659 961,663' fill='#DC2626'/>\n`
  s += `    <text x='956' y='673' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='9' font-weight='bold' fill='#334155'>N</text>\n  </g>\n`

  // Scale bar: 111 px ~ 20 m at 0.18 m/px
  s += `  <g>\n    <line x1='700' y1='676' x2='811' y2='676' stroke='#475569' stroke-width='2'/>\n`
  s += `    <line x1='700' y1='670' x2='700' y2='682' stroke='#475569' stroke-width='2'/>\n`
  s += `    <line x1='811' y1='670' x2='811' y2='682' stroke='#475569' stroke-width='2'/>\n`
  s += `    <text x='755' y='668' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='9' fill='#475569'>20 m</text>\n  </g>\n`

  return frameSvg(s)
}

const LEVEL_SUB = {
  1: "Below street level · Walrus CIC, Bod Pod, Nuclear Medicine",
  2: "Street level · Main Entrance on Guilford Street",
  3: "Theatres, Nightingale Day Unit, Kingfisher Ward",
  4: "Flamingo, Alligator and Butterfly Wards",
  5: "Koala, Chameleon, Possum and Bumblebee Wards",
  6: "Bear, Panther and Sky Wards",
  7: "Eagle, Pelican Wards and The Hive",
  8: "Nurses Home · Rheumatology, Dermatology & Oncology Offices",
  9: "Nurses Home · On Call Accommodation",
  10: "Nurses Home · Neurosciences Offices",
}

// ── Waypoints and trails ─────────────────────────────────────────────────────
function waypointsFor(level) {
  const out = []
  const idx = idxOf(level)
  for (const k of buildingsOn(level)) {
    const L = layout(k, level)
    for (const r of L.rooms) {
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2
      if (r.kind) {
        const b = BUILDINGS[k]
        out.push({
          id: `${slug(k)}-${slug(r.name)}-l${level}`,
          name: `${r.name} — ${b.name}`,
          type: r.kind === "lift" ? "lift" : "stairs",
          x: cx, y: cy, floor: idx,
          desc: r.note ? `${b.name}, Level ${level} (${r.note})` : `${b.name}, Level ${level}`,
        })
      } else {
        out.push({
          id: slug(r.name) + (COMMON_NAMES.has(r.name) ? `-l${level}` : ""),
          name: r.name,
          type: typeFor(r),
          x: cx, y: cy, floor: idx,
          desc: r.desc,
        })
      }
    }
  }
  if (level === 2) {
    for (const f of SITE_FEATURES) out.push({ id: f.id, name: f.name, type: f.type, x: f.x, y: f.y, floor: idx, desc: f.desc })
    for (const cb of CONTEXT_BUILDINGS) {
      const r = cb.rect
      out.push({
        id: cb.id, name: cb.name, type: "other",
        x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, floor: idx,
        desc: CONTEXT_DESC[cb.id],
      })
    }
  }
  return out
}

// Names that legitimately recur on more than one level and so need a suffix.
const COMMON_NAMES = new Set(["Speech & Language Therapy"])

const CONTEXT_DESC = {
  "school": "The hospital school - west of the Southwood Building",
  "boiler-house": "GOSH Estates boiler house",
  "zayed-centre": "Zayed Centre for Research into Rare Disease in Children - entrance on Guilford Street",
  "rlhim": "Hippo, Rabbit & Zebra Outpatients - entrance on Great Ormond Street",
  "barclay-house": "Offices - south of Great Ormond Street",
  "sight-and-sound": "GOSH Sight and Sound Centre - entrance on Boswell Street",
}

function typeFor(r) {
  if (r.cat === "ward") return "ward"
  if (r.cat === "wc") return "toilet"
  if (/pharmacy/i.test(r.name)) return "pharmacy"
  if (/reception|cashiers/i.test(r.name)) return "reception"
  if (/lagoon|restaurant|caf/i.test(r.name)) return "canteen"
  if (r.cat === "clinical") return "department"
  if (r.cat === "office") return "department"
  return "other"
}

function trailsFor(level) {
  const t = []
  for (const k of buildingsOn(level)) {
    const L = layout(k, level)
    if (L.spine.length >= 2) t.push({ id: `gosh-${slug(k)}-spine-l${level}`, pts: L.spine })
  }
  for (const [a, b, pts] of linksOn(level)) {
    t.push({ id: `gosh-link-${slug(a)}-${slug(b)}-l${level}`, pts })
  }
  if (level === 2) {
    t.push({ id: "gosh-entrance-spur-l2", pts: [[524, 84], [524, 100], [524, 128]] })
    for (const p of OUTDOOR_PATHS) t.push({ id: `gosh-outdoor-${p.id}`, pts: p.pts })
  }
  return t
}

// ── Emit ─────────────────────────────────────────────────────────────────────
fs.mkdirSync(SVG_DIR, { recursive: true })
for (const level of LEVELS) {
  fs.writeFileSync(path.join(SVG_DIR, `level${level}.svg`), buildSvg(level))
  console.log("wrote", path.join("public/floorplans/gosh", `level${level}.svg`))
}

const num = (n) => n.toFixed(6)

function wpLine(w) {
  const c = ll(w.x, w.y)
  let line = `    { id: ${JSON.stringify(w.id)}, name: ${JSON.stringify(w.name)}, type: ${JSON.stringify(w.type)}, coordinates: { lat: ${num(c.lat)}, lng: ${num(c.lng)} }, floor: ${w.floor}`
  if (w.desc) line += `, description: ${JSON.stringify(w.desc)}`
  if (w.arrivalNotes) line += `, arrivalNotes: ${JSON.stringify(w.arrivalNotes)}`
  line += " },"
  return line
}

const ARRIVAL = {
  "the-lagoon": "Entrance at the south-west corner; the tills (Pay Here) are by the hot-food counter, with the Shop and Coffee Bar just inside and the Disney Playground and The Lullaby quiet room alongside.",
  "main-entrance": "The Main Entrance is on Guilford Street, at the north end of the Morgan Stanley Clinical Building. The historic Great Ormond Street entrance is closed behind the Children's Cancer Centre hoarding.",
}

let ts = `import { Venue } from "../types"

// Great Ormond Street Hospital for Children.
//
// GENERATED FILE - do not edit by hand. Run \`node scripts/generate-gosh-venue.mjs\`
// to regenerate this file together with public/floorplans/gosh/level1..10.svg.
// The generator carries the full provenance for every value below.
//
// Rebuilt from the hospital's own on-site signage photographed in July 2026 (the
// \`map- GOSH\` folder). Ward-per-level comes from three lift directories - the
// Mittal Children's Medical Centre board (Morgan Stanley + Premier Inn), the
// Octav Botnar Wing board and the Nurses Home board. Building footprints, cores
// and corridors come from the GOSH Estates / Fisk fire and dry-riser drawings.
// Where the two disagree the directories win: the fire drawings are dated
// 2013-2016 and several of their room uses are now stale.
//
// Orientation is taken from the true-north arrows on the dry-riser plans:
// Guilford Street NORTH, Great Ormond Street SOUTH, Lamb's Conduit Street EAST,
// Powis Place / Queen Square WEST. The hospital's own acrylic boards are
// oriented to suit the reader's position - some are north-up, one is south-up -
// so they must not be used to "correct" this.
//
// GOSH numbers its storeys Level 1-10 and the site slopes, so the street-level
// ground floor with the Main Entrance is Level 2. floorNaming below makes
// internal floor index 0 display as "Level 2"; displayed level = index + 2.
// Levels 8-10 are the upper Nurses Home only.

const B: [[number, number], [number, number]] = [[${round6(BB.S)}, ${round6(BB.W)}], [${round6(BB.N)}, ${round6(BB.E)}]]

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
  floorNaming: { word: "Level", groundLevel: 2 },
  quickAccess: ["Main Entrance", "Main Reception", "The Lagoon", "Pharmacy", "X-Ray", "PALS", "Kangaroo Ward"],
  floorPlans: [
`
for (const level of LEVELS) {
  const label = level === 2 ? "Level 2 (entrance)" : `Level ${level}`
  ts += `    { id: "l${level}", floor: ${idxOf(level)}, label: "${label}", imageUrl: "/floorplans/gosh/level${level}.svg", bounds: B },\n`
}
ts += `  ],
  waypoints: [
`
let total = 0
for (const level of LEVELS) {
  const wps = waypointsFor(level)
  ts += `    // ── Level ${level} (internal floor ${idxOf(level)}) ──\n`
  for (const w of wps) {
    if (ARRIVAL[w.id]) w.arrivalNotes = ARRIVAL[w.id]
    ts += wpLine(w) + "\n"
    total++
  }
  ts += "\n"
}
ts = ts.replace(/\n\n$/, "\n")
ts += `  ],
  // The walkable corridor network: one spine per building per level, plus the
  // marked link corridors between blocks and the Level 2 entrance spur. Node
  // coordinates sit on the corridor centrelines drawn in the floor-plan SVGs and
  // every lift and stair core is a node, so buildRoute follows real corridors
  // instead of cutting through wards, and cross-floor routes stay on the network.
  trails: [
`
for (const level of LEVELS) {
  for (const t of trailsFor(level)) {
    const pts = t.pts.map(([x, y]) => {
      const c = ll(x, y)
      return `{ lat: ${num(c.lat)}, lng: ${num(c.lng)} }`
    })
    ts += `    { id: ${JSON.stringify(t.id)}, floor: ${idxOf(level)}, points: [${pts.join(", ")}] },\n`
  }
}
ts += `  ],
}
`

fs.writeFileSync(path.join(REPO, "src/lib/venues/gosh.ts"), ts)
console.log(`wrote src/lib/venues/gosh.ts (${total} waypoints across ${LEVELS.length} levels)`)

// ── Sanity checks ────────────────────────────────────────────────────────────
// Every waypoint must sit close to a trail node or buildRoute will refuse to
// follow the corridors and fall back to a straight line through the walls.
let worst = 0, worstId = ""
for (const level of LEVELS) {
  const nodes = trailsFor(level).flatMap((t) => t.pts)
  for (const w of waypointsFor(level)) {
    let best = Infinity
    for (const [x, y] of nodes) best = Math.min(best, Math.hypot(x - w.x, y - w.y))
    const m = best * M_PER_PX
    if (m > worst) { worst = m; worstId = `${w.id} (Level ${level})` }
  }
}
console.log(`max waypoint→corridor distance: ${worst.toFixed(1)} m (${worstId}) — must be < 30`)
if (worst >= 30) { console.error("FAIL: a waypoint is too far from the corridor network"); process.exit(1) }

// Duplicate waypoint ids would silently break search and routing.
const seen = new Map()
for (const level of LEVELS) for (const w of waypointsFor(level)) {
  if (seen.has(w.id)) { console.error(`FAIL: duplicate waypoint id ${w.id} (Levels ${seen.get(w.id)} and ${level})`); process.exit(1) }
  seen.set(w.id, level)
}
console.log(`${seen.size} unique waypoint ids — no collisions`)

// ── Georeferencing report ─────────────────────────────────────────────────────
// How well the fitted transform reproduces each control point, in metres. A large
// residual on one point usually means a mistyped or mis-clicked coordinate.
if (TF) {
  let maxM = 0, sum2 = 0
  console.log(`\ngeoreference: fitted from ${GCPS.length} ground-control point(s)`)
  for (const g of GCPS) {
    const p = TF.toLL(g.x, g.y)
    const dN = (p.lat - g.lat) * M_PER_DEG_LAT
    const dE = (p.lng - g.lng) * TF.kLng
    const m = Math.hypot(dN, dE)
    sum2 += m * m; maxM = Math.max(maxM, m)
    console.log(`  ${g.name}: ${m.toFixed(2)} m off`)
  }
  const bearing = ((90 - (TF.theta * 180) / Math.PI) % 360 + 360) % 360
  console.log(`  scale ${TF.scale.toFixed(3)} m/px · site up-axis bearing ${bearing.toFixed(1)}° from true north`)
  console.log(`  max residual ${maxM.toFixed(2)} m · RMS ${Math.sqrt(sum2 / GCPS.length).toFixed(2)} m (aim < ~5 m)`)
} else {
  console.log("\ngeoreference: no ground-control points — using the original north-up box.")
  console.log("Fill GCPS in this script with real lat/lng to fit position + scale + rotation.")
}
