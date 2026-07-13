#!/usr/bin/env node
// Generates the GOSH (Variety Club Building) floor-plan SVGs and the matching
// venue data (waypoints + corridor trails) in ONE shared coordinate system, so
// the drawn rooms, the search pins and the routed corridors all line up.
//
// Geometry is modelled on the building's fire zone layout plan (drawing
// FF-FZ-NHS-GOS-VCB): a rectangular block around a central courtyard, Levels
// 1–7, with Level 7 a smaller set-back storey and the roof plant-only.
//
// SVG space: 800 x 1000 (x right, y down), mapped onto the venue bounds
//   [[51.5218, -0.1208], [51.5232, -0.1190]]  (SW, NE)
// so 1px ≈ 0.156 m in both axes (square pixels).

//
// Run with: node scripts/generate-gosh-venue.mjs
// (rewrites public/floorplans/gosh/*.svg and src/lib/venues/gosh.ts)

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const SVG_DIR = path.join(REPO, "public", "floorplans", "gosh")

const W = 800, H = 1000
const LAT_N = 51.5232, LAT_S = 51.5218, LNG_W = -0.1208, LNG_E = -0.119
const px2lat = (y) => +(LAT_N - (y / H) * (LAT_N - LAT_S)).toFixed(6)
const px2lng = (x) => +(LNG_W + (x / W) * (LNG_E - LNG_W)).toFixed(6)
const ll = (x, y) => ({ lat: px2lat(y), lng: px2lng(x) })

// ── Master footprint ─────────────────────────────────────────────────────────
// Outer walls
const BX0 = 70, BX1 = 730, BY0 = 100, BY1 = 900
// Wing depth 100px (~15m); corridor ring band 40px (~6m)
const NW_Y1 = 200, SW_Y0 = 800, WW_X1 = 170, EW_X0 = 630
const COR = 40
// corridor bands (outer edge = room inner face)
const corN = { x0: WW_X1, x1: EW_X0, y0: NW_Y1, y1: NW_Y1 + COR }
const corS = { x0: WW_X1, x1: EW_X0, y0: SW_Y0 - COR, y1: SW_Y0 }
const corW = { x0: WW_X1, x1: WW_X1 + COR, y0: NW_Y1, y1: SW_Y0 }
const corE = { x0: EW_X0 - COR, x1: EW_X0, y0: NW_Y1, y1: SW_Y0 }
// corridor centrelines
const CLN = 220, CLS = 780, CLW = 190, CLE = 610
// courtyard
const CY = { x0: WW_X1 + COR, x1: EW_X0 - COR, y0: NW_Y1 + COR, y1: SW_Y0 - COR }

// ── Palette ──────────────────────────────────────────────────────────────────
const CAT = {
  ward:      { fill: "#DBEAFE", stroke: "#93C5FD" },
  clinical:  { fill: "#D1FAE5", stroke: "#6EE7B7" },
  public:    { fill: "#FEF3C7", stroke: "#FCD34D" },
  emergency: { fill: "#FEE2E2", stroke: "#FCA5A5" },
  family:    { fill: "#FCE7F3", stroke: "#F9A8D4" },
  circ:      { fill: "#EDE9FE", stroke: "#C4B5FD" },
  wc:        { fill: "#CFFAFE", stroke: "#67E8F9" },
  support:   { fill: "#E2E8F0", stroke: "#CBD5E1" },
  plant:     { fill: "#E2E8F0", stroke: "#94A3B8", hatch: true },
  roof:      { fill: "#F1F5F9", stroke: "#CBD5E1", hatch: true, dashed: true },
}
const PAGE = "#F8FAFC"
const CORRIDOR = "#F1F5F9"
const WALL = "#1E293B"
const GARDEN = { fill: "#DCFCE7", stroke: "#86EFAC" }
const PATHC = { fill: "#E7E5E4", stroke: "#D6D3D1" }

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;")

// Greedy word-wrap for room labels.
function wrap(name, maxChars) {
  const words = name.split(" ")
  const lines = []
  let cur = ""
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w } else cur = cur ? cur + " " + w : w
  }
  if (cur) lines.push(cur)
  return lines
}

// One room. door: "N"|"S"|"E"|"W" side facing a corridor (drawn as an opening).
function room(r) {
  const { x0, y0, x1, y1, cat, name, sub, icon } = r
  const c = CAT[cat]
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const w = x1 - x0, h = y1 - y0
  let s = `  <rect x='${x0}' y='${y0}' width='${w}' height='${h}' rx='2' fill='${c.fill}' stroke='${c.stroke}' stroke-width='1.5'${c.dashed ? " stroke-dasharray='5,4'" : ""}/>\n`
  if (c.hatch) s += `  <rect x='${x0}' y='${y0}' width='${w}' height='${h}' rx='2' fill='url(#hatch)'/>\n`
  // Door: a gap in the room's corridor-facing wall.
  if (r.door) {
    const dl = 22
    const at = r.doorAt
    if (r.door === "N") s += doorSeg(at ?? cx, y0, at ?? cx, y0, dl, true)
    if (r.door === "S") s += doorSeg(at ?? cx, y1, at ?? cx, y1, dl, true)
    if (r.door === "W") s += doorSeg(x0, at ?? cy, x0, at ?? cy, dl, false)
    if (r.door === "E") s += doorSeg(x1, at ?? cy, x1, at ?? cy, dl, false)
  }
  if (!name) {
    if (r.watermark) s += `  <text x='${cx}' y='${cy + 4}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='11' fill='#94A3B8'>${esc(r.watermark)}</text>\n`
    return s
  }
  const maxChars = w >= 150 ? 20 : w >= 110 ? 14 : 12
  const lines = wrap(name, maxChars)
  const small = h < 90 || cat === "circ" || cat === "wc"
  const nameSize = small ? 10.5 : 12
  const lh = nameSize + 3
  const blockH = (icon ? 18 : 0) + lines.length * lh + (sub ? 13 : 0)
  let ty = cy - blockH / 2 + (icon ? 6 : nameSize / 2 + 2)
  if (icon) {
    s += `  <text x='${cx}' y='${ty + 5}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='15'>${icon}</text>\n`
    ty += 20
  } else ty += nameSize / 2
  for (const line of lines) {
    s += `  <text x='${cx}' y='${ty}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='${nameSize}' font-weight='bold' fill='#0F172A'>${esc(line)}</text>\n`
    ty += lh
  }
  if (sub) s += `  <text x='${cx}' y='${ty + 1}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='9.5' fill='#64748B'>${esc(sub)}</text>\n`
  return s
}

function doorSeg(x, y, _x, _y, len, horizontal) {
  if (horizontal) return `  <line x1='${x - len / 2}' y1='${y}' x2='${x + len / 2}' y2='${y}' stroke='${CORRIDOR}' stroke-width='4'/>\n`
  return `  <line x1='${x}' y1='${y - len / 2}' x2='${x}' y2='${y + len / 2}' stroke='${CORRIDOR}' stroke-width='4'/>\n`
}

// ── Fixed cores, identical on every storey (vertical circulation) ────────────
const CORE = {
  stairs1: { x0: 370, x1: 430, y0: BY0, y1: NW_Y1, cat: "circ", name: "Staircase 1", icon: "🪜", door: "S" },
  stairs2: { x0: 200, x1: 260, y0: SW_Y0, y1: BY1, cat: "circ", name: "Staircase 2", icon: "🪜", door: "N" },
  liftA:   { x0: BX0, x1: WW_X1, y0: 430, y1: 510, cat: "circ", name: "Lift A", icon: "🛗", door: "E" },
  liftB:   { x0: EW_X0, x1: BX1, y0: 430, y1: 510, cat: "circ", name: "Lift B", icon: "🛗", door: "W" },
  wc:      { x0: EW_X0, x1: BX1, y0: 200, y1: 320, cat: "wc", name: "Toilets", icon: "🚻", door: "W" },
}

// ── Per-floor programmes ─────────────────────────────────────────────────────
// Each entry: rooms (incl. cores), courtyard variant, entrances, plus the
// waypoints (px space) that should exist on that floor.
// Wing helper shorthands
const NR = (x0, x1, spec) => ({ x0, x1, y0: BY0, y1: NW_Y1, door: "S", ...spec })
const SR = (x0, x1, spec) => ({ x0, x1, y0: SW_Y0, y1: BY1, door: "N", ...spec })
const WR = (y0, y1, spec) => ({ x0: BX0, x1: WW_X1, y0, y1, door: "E", ...spec })
const ER = (y0, y1, spec) => ({ x0: EW_X0, x1: BX1, y0, y1, door: "W", ...spec })

const FLOORS = [
  {
    floor: -1, file: "level1.svg", title: "Level 1", chipSub: "Below street level · GOSH Variety Club Building",
    courtyard: "plant",
    rooms: [
      NR(BX0, 200, { cat: "support", name: "Staff Changing" }),
      NR(200, 370, { cat: "clinical", name: "Medical Physics" }),
      CORE.stairs1,
      NR(430, 560, { cat: "support", name: "Medical Records", sub: "Health records office" }),
      NR(560, BX1, { cat: "support", name: "IT & Switchboard" }),
      WR(NW_Y1, 430, { cat: "clinical", name: "Physiotherapy & Occupational Therapy", sub: "Therapy gyms" }),
      CORE.liftA,
      WR(510, SW_Y0, { cat: "clinical", name: "Hydrotherapy Pool" }),
      CORE.wc,
      ER(320, 430, { cat: "support", name: "Estates & Facilities", sub: "Workshop" }),
      CORE.liftB,
      ER(510, 640, { cat: "support", name: "Stores" }),
      ER(640, SW_Y0, { cat: "support", name: "Workshops" }),
      SR(BX0, 200, { cat: "support", name: "Kitchens" }),
      CORE.stairs2,
      SR(260, 440, { cat: "support", name: "Laundry & Linen" }),
      SR(440, 560, { cat: "support", name: "Waste & Recycling" }),
      SR(560, BX1, { cat: "support", name: "Maintenance" }),
    ],
    waypoints: [
      { id: "physio-l1", name: "Physiotherapy & Occupational Therapy", type: "department", x: 120, y: 315, desc: "Therapy gyms and treatment rooms — west wing, Level 1" },
      { id: "hydro-l1", name: "Hydrotherapy Pool", type: "department", x: 120, y: 655, desc: "Warm-water therapy pool — west wing, Level 1" },
      { id: "stairs-1-l1", name: "Staircase 1 — Level 1", type: "stairs", x: 400, y: 150 },
      { id: "records-l1", name: "Medical Records", type: "department", x: 495, y: 150, desc: "Health records office — north corridor, Level 1" },
      { id: "lift-a-l1", name: "Lift A — Level 1", type: "lift", x: 120, y: 470 },
      { id: "lift-b-l1", name: "Lift B — Level 1", type: "lift", x: 680, y: 470 },
      { id: "toilet-l1", name: "Toilets — Level 1", type: "toilet", x: 680, y: 260 },
      { id: "estates-l1", name: "Estates & Facilities", type: "other", x: 680, y: 375, desc: "Estates workshop and stores — east wing, Level 1" },
      { id: "stairs-2-l1", name: "Staircase 2 — Level 1", type: "stairs", x: 230, y: 850 },
    ],
  },
  {
    floor: 0, file: "level2.svg", title: "Level 2 · Entrance", chipSub: "Street level · GOSH Variety Club Building",
    courtyard: "garden", entrances: true,
    rooms: [
      NR(BX0, 200, { cat: "clinical", name: "Outpatients Reception", icon: "💁" }),
      NR(200, 370, { cat: "support", name: "PALS — Patient Advice" }),
      CORE.stairs1,
      NR(430, 560, { cat: "public", name: "Pharmacy", icon: "💊", sub: "Main pharmacy" }),
      NR(560, BX1, { cat: "public", name: "Shop & Newsagent" }),
      WR(NW_Y1, 430, { cat: "clinical", name: "Blood Tests", sub: "Phlebotomy" }),
      CORE.liftA,
      WR(510, 620, { cat: "emergency", name: "A&E Waiting" }),
      WR(680, SW_Y0, { cat: "emergency", name: "Emergency Department", sub: "A&E" }),
      CORE.wc,
      ER(320, 430, { cat: "clinical", name: "Medical Day Unit" }),
      CORE.liftB,
      ER(510, 640, { cat: "clinical", name: "Clinic Rooms 1–6" }),
      ER(640, SW_Y0, { cat: "family", name: "Family Room" }),
      SR(BX0, 200, { cat: "support", name: "Patient Transport" }),
      CORE.stairs2,
      SR(260, 440, { cat: "public", name: "Restaurant & Café", icon: "🍽️", sub: "The Lagoon" }),
      SR(440, 560, { cat: "public", name: "Main Entrance", icon: "🚪", sub: "& Lobby" }),
      SR(560, BX1, { cat: "public", name: "Main Reception", icon: "💁" }),
    ],
    waypoints: [
      { id: "ae-entrance", name: "A&E Entrance", type: "exit", x: 105, y: 650, desc: "Emergency department entrance — west side, Level 2" },
      { id: "bloods-gf", name: "Blood Tests (Phlebotomy)", type: "department", x: 120, y: 315, desc: "Walk-in blood tests — west wing, Level 2" },
      { id: "stairs-1-gf", name: "Staircase 1", type: "stairs", x: 400, y: 150 },
      { id: "pharmacy-gf", name: "Pharmacy", type: "pharmacy", x: 495, y: 150, desc: "Main pharmacy — north corridor, Level 2" },
      { id: "outpatients-reception-gf", name: "Outpatients Reception", type: "reception", x: 135, y: 150, desc: "Check in for outpatient appointments — Level 2" },
      { id: "lift-a-gf", name: "Lift A", type: "lift", x: 120, y: 470 },
      { id: "lift-b-gf", name: "Lift B", type: "lift", x: 680, y: 470 },
      { id: "toilet-gf", name: "Toilets", type: "toilet", x: 680, y: 260 },
      { id: "canteen-gf", name: "Restaurant & Café", type: "canteen", x: 350, y: 850, desc: "The Lagoon — patient and visitor restaurant, Level 2" },
      { id: "main-entrance", name: "Main Entrance", type: "reception", x: 500, y: 865, desc: "Great Ormond Street main entrance and lobby" },
      { id: "reception", name: "Main Reception", type: "reception", x: 620, y: 850, desc: "Main reception desk — right of the entrance lobby" },
      { id: "stairs-2-gf", name: "Staircase 2", type: "stairs", x: 230, y: 850 },
      { id: "family-room-gf", name: "Family Room", type: "other", x: 680, y: 720, desc: "Quiet space for families — east wing, Level 2" },
    ],
  },
  {
    floor: 1, file: "level3.svg", title: "Level 3", chipSub: "GOSH Variety Club Building",
    courtyard: "void",
    rooms: [
      NR(BX0, 200, { cat: "support", name: "Ward Staff Base" }),
      NR(200, 370, { cat: "clinical", name: "Outpatients Clinic 1", sub: "General outpatients" }),
      CORE.stairs1,
      NR(430, 560, { cat: "clinical", name: "Treatment Rooms" }),
      NR(560, BX1, { cat: "family", name: "Parents' Room" }),
      WR(NW_Y1, 430, { cat: "ward", name: "Ward 1A", icon: "🏥", sub: "Haematology" }),
      CORE.liftA,
      WR(510, SW_Y0, { cat: "clinical", name: "Day Care Unit" }),
      CORE.wc,
      ER(320, 430, { cat: "family", name: "Adolescent Room" }),
      CORE.liftB,
      ER(510, SW_Y0, { cat: "ward", name: "Ward 1B", icon: "🏥", sub: "Oncology" }),
      SR(BX0, 200, { cat: "clinical", name: "Phlebotomy" }),
      CORE.stairs2,
      SR(260, 440, { cat: "family", name: "Hospital School" }),
      SR(440, 560, { cat: "family", name: "Playroom" }),
      SR(560, BX1, { cat: "family", name: "Quiet Room" }),
    ],
    waypoints: [
      { id: "ward-1a", name: "Ward 1A", type: "ward", x: 120, y: 315, desc: "Haematology ward — west wing, Level 3" },
      { id: "ward-1b", name: "Ward 1B", type: "ward", x: 680, y: 655, desc: "Oncology ward — east wing, Level 3" },
      { id: "outpatients-1", name: "Outpatients Clinic 1", type: "department", x: 285, y: 150, desc: "General outpatients — north wing, Level 3", extras: true },
      { id: "daycare-f1", name: "Day Care Unit", type: "department", x: 120, y: 655, desc: "Day admissions — west wing, Level 3" },
      { id: "stairs-1-f1", name: "Staircase 1 — Level 3", type: "stairs", x: 400, y: 150 },
      { id: "lift-a-f1", name: "Lift A — Level 3", type: "lift", x: 120, y: 470 },
      { id: "lift-b-f1", name: "Lift B — Level 3", type: "lift", x: 680, y: 470 },
      { id: "toilet-f1", name: "Toilets — Level 3", type: "toilet", x: 680, y: 260 },
      { id: "playroom-f1", name: "Playroom — Level 3", type: "other", x: 500, y: 850, desc: "Play area for inpatients and siblings" },
      { id: "school-f1", name: "Hospital School", type: "other", x: 350, y: 850, desc: "The hospital school — south wing, Level 3" },
      { id: "stairs-2-f1", name: "Staircase 2 — Level 3", type: "stairs", x: 230, y: 850 },
    ],
  },
  {
    floor: 2, file: "level4.svg", title: "Level 4", chipSub: "GOSH Variety Club Building",
    courtyard: "void",
    rooms: [
      NR(BX0, 200, { cat: "clinical", name: "Imaging Reception", icon: "💁" }),
      NR(200, 370, { cat: "clinical", name: "Ultrasound" }),
      CORE.stairs1,
      NR(430, 560, { cat: "clinical", name: "CT Scanner" }),
      NR(560, BX1, { cat: "public", name: "Imaging Waiting Area" }),
      WR(NW_Y1, 430, { cat: "clinical", name: "X-Ray & Imaging", sub: "Radiology" }),
      CORE.liftA,
      WR(510, SW_Y0, { cat: "clinical", name: "MRI Suite" }),
      CORE.wc,
      ER(320, 430, { cat: "clinical", name: "Echo Lab" }),
      CORE.liftB,
      ER(510, SW_Y0, { cat: "ward", name: "Ward 2A", icon: "🏥", sub: "Cardiology" }),
      SR(BX0, 200, { cat: "support", name: "Staff Room" }),
      CORE.stairs2,
      SR(260, 500, { cat: "ward", name: "Ward 2B", icon: "🏥", sub: "Neurology" }),
      SR(500, 620, { cat: "clinical", name: "Neurophysiology" }),
      SR(620, BX1, { cat: "family", name: "Parents' Room" }),
    ],
    waypoints: [
      { id: "ward-2a", name: "Ward 2A", type: "ward", x: 680, y: 655, desc: "Cardiology ward — east wing, Level 4" },
      { id: "ward-2b", name: "Ward 2B", type: "ward", x: 380, y: 850, desc: "Neurology ward — south wing, Level 4" },
      { id: "xray", name: "X-Ray & Imaging", type: "department", x: 120, y: 315, desc: "Radiology department — west wing, Level 4", extras: true },
      { id: "mri-f2", name: "MRI Suite", type: "department", x: 120, y: 655, desc: "MRI scanning — west wing, Level 4" },
      { id: "ultrasound-f2", name: "Ultrasound", type: "department", x: 285, y: 150, desc: "Ultrasound scanning — north wing, Level 4" },
      { id: "stairs-1-f2", name: "Staircase 1 — Level 4", type: "stairs", x: 400, y: 150 },
      { id: "lift-a-f2", name: "Lift A — Level 4", type: "lift", x: 120, y: 470 },
      { id: "lift-b-f2", name: "Lift B — Level 4", type: "lift", x: 680, y: 470 },
      { id: "toilet-f2", name: "Toilets — Level 4", type: "toilet", x: 680, y: 260 },
      { id: "stairs-2-f2", name: "Staircase 2 — Level 4", type: "stairs", x: 230, y: 850 },
    ],
  },
  {
    floor: 3, file: "level5.svg", title: "Level 5", chipSub: "GOSH Variety Club Building",
    courtyard: "void",
    rooms: [
      NR(BX0, 200, { cat: "clinical", name: "Surgical Admissions" }),
      NR(200, 370, { cat: "clinical", name: "Anaesthetics" }),
      CORE.stairs1,
      NR(430, 560, { cat: "public", name: "Theatre Waiting" }),
      NR(560, BX1, { cat: "family", name: "Parents' Room" }),
      WR(NW_Y1, 430, { cat: "clinical", name: "Operating Theatres", sub: "Theatres 1–4" }),
      CORE.liftA,
      WR(510, SW_Y0, { cat: "clinical", name: "Theatre Recovery" }),
      CORE.wc,
      ER(320, 430, { cat: "support", name: "Milk Kitchen" }),
      CORE.liftB,
      ER(510, SW_Y0, { cat: "ward", name: "Ward 5B", icon: "🏥", sub: "General Paediatrics" }),
      SR(BX0, 200, { cat: "support", name: "Staff Base" }),
      CORE.stairs2,
      SR(260, 500, { cat: "ward", name: "Ward 3A", icon: "🏥", sub: "Surgical" }),
      SR(500, 620, { cat: "ward", name: "Ward 3B", sub: "Critical Care" }),
      SR(620, BX1, { cat: "family", name: "Family Waiting" }),
    ],
    waypoints: [
      { id: "ward-3a", name: "Ward 3A", type: "ward", x: 380, y: 850, desc: "Surgical ward — south wing, Level 5" },
      { id: "ward-3b", name: "Ward 3B", type: "ward", x: 560, y: 850, desc: "Critical care — south wing, Level 5" },
      { id: "ward-5b", name: "Ward 5B", type: "ward", x: 680, y: 655, desc: "General paediatrics — east wing, Level 5" },
      { id: "theatre", name: "Operating Theatres", type: "department", x: 120, y: 315, desc: "Surgical theatres 1–4 — west wing, Level 5" },
      { id: "recovery-f3", name: "Theatre Recovery", type: "department", x: 120, y: 655, desc: "Post-anaesthetic recovery — west wing, Level 5" },
      { id: "stairs-1-f3", name: "Staircase 1 — Level 5", type: "stairs", x: 400, y: 150 },
      { id: "lift-a-f3", name: "Lift A — Level 5", type: "lift", x: 120, y: 470 },
      { id: "lift-b-f3", name: "Lift B — Level 5", type: "lift", x: 680, y: 470 },
      { id: "toilet-f3", name: "Toilets — Level 5", type: "toilet", x: 680, y: 260 },
      { id: "stairs-2-f3", name: "Staircase 2 — Level 5", type: "stairs", x: 230, y: 850 },
    ],
  },
  {
    floor: 4, file: "level6.svg", title: "Level 6", chipSub: "GOSH Variety Club Building",
    courtyard: "void",
    rooms: [
      NR(BX0, 200, { cat: "clinical", name: "Dialysis Unit" }),
      NR(200, 370, { cat: "family", name: "Family Kitchen & Dining" }),
      CORE.stairs1,
      NR(430, 560, { cat: "family", name: "Parents' Accommodation", sub: "Overnight rooms" }),
      NR(560, BX1, { cat: "family", name: "Quiet Room" }),
      WR(NW_Y1, 430, { cat: "ward", name: "Ward 6A", icon: "🏥", sub: "Respiratory" }),
      CORE.liftA,
      WR(510, SW_Y0, { cat: "ward", name: "Ward 6B", icon: "🏥", sub: "Renal" }),
      CORE.wc,
      ER(320, 430, { cat: "family", name: "Playroom" }),
      CORE.liftB,
      ER(510, 640, { cat: "family", name: "Hospital School" }),
      ER(640, SW_Y0, { cat: "family", name: "Teenage Lounge" }),
      SR(BX0, 200, { cat: "support", name: "Staff Base" }),
      CORE.stairs2,
      SR(260, 440, { cat: "family", name: "Parents' Bedrooms" }),
      SR(440, 560, { cat: "support", name: "Laundry" }),
      SR(560, BX1, { cat: "family", name: "Parents' Lounge" }),
    ],
    waypoints: [
      { id: "ward-6a", name: "Ward 6A", type: "ward", x: 120, y: 315, desc: "Respiratory ward — west wing, Level 6" },
      { id: "ward-6b", name: "Ward 6B", type: "ward", x: 120, y: 655, desc: "Renal ward — west wing, Level 6" },
      { id: "parents-f4", name: "Parents' Accommodation", type: "department", x: 495, y: 150, desc: "Overnight rooms for parents and carers — Level 6" },
      { id: "dialysis-f4", name: "Dialysis Unit", type: "department", x: 135, y: 150, desc: "Renal dialysis — north wing, Level 6" },
      { id: "playroom-f4", name: "Playroom — Level 6", type: "other", x: 680, y: 375, desc: "Play area — east wing, Level 6" },
      { id: "stairs-1-f4", name: "Staircase 1 — Level 6", type: "stairs", x: 400, y: 150 },
      { id: "lift-a-f4", name: "Lift A — Level 6", type: "lift", x: 120, y: 470 },
      { id: "lift-b-f4", name: "Lift B — Level 6", type: "lift", x: 680, y: 470 },
      { id: "toilet-f4", name: "Toilets — Level 6", type: "toilet", x: 680, y: 260 },
      { id: "stairs-2-f4", name: "Staircase 2 — Level 6", type: "stairs", x: 230, y: 850 },
    ],
  },
  {
    floor: 5, file: "level7.svg", title: "Level 7", chipSub: "Set-back storey · GOSH Variety Club Building",
    courtyard: "open",
    rooms: [
      NR(BX0, 200, { cat: "roof", watermark: "Roof" }),
      NR(200, 370, { cat: "support", name: "Seminar Room 1", sub: "Education & training" }),
      CORE.stairs1,
      NR(430, 560, { cat: "support", name: "Seminar Room 2" }),
      NR(560, BX1, { cat: "roof", watermark: "Roof" }),
      WR(NW_Y1, 430, { cat: "support", name: "Staff Training" }),
      CORE.liftA,
      WR(510, SW_Y0, { cat: "plant", name: "Plant Room West", icon: "🔒", sub: "Restricted access" }),
      CORE.wc,
      ER(320, 430, { cat: "plant", name: "Plant", icon: "🔒" }),
      CORE.liftB,
      ER(510, SW_Y0, { cat: "plant", name: "Ventilation Plant", icon: "🔒", sub: "Restricted access" }),
      SR(BX0, 200, { cat: "roof", watermark: "Roof" }),
      CORE.stairs2,
      SR(260, 440, { cat: "support", name: "Staff Break Room" }),
      SR(440, BX1, { cat: "plant", name: "Plant Room South", icon: "🔒", sub: "Restricted access" }),
    ],
    waypoints: [
      { id: "seminar-f5", name: "Seminar & Training Rooms", type: "department", x: 285, y: 150, desc: "Staff education and training — north wing, Level 7" },
      { id: "training-f5", name: "Staff Training", type: "department", x: 120, y: 315, desc: "Training suite — west wing, Level 7" },
      { id: "plant-f5", name: "Plant Room", type: "other", x: 680, y: 655, desc: "Building plant — restricted access" },
      { id: "stairs-1-f5", name: "Staircase 1 — Level 7", type: "stairs", x: 400, y: 150 },
      { id: "lift-a-f5", name: "Lift A — Level 7", type: "lift", x: 120, y: 470 },
      { id: "lift-b-f5", name: "Lift B — Level 7", type: "lift", x: 680, y: 470 },
      { id: "toilet-f5", name: "Toilets — Level 7", type: "toilet", x: 680, y: 260 },
      { id: "stairs-2-f5", name: "Staircase 2 — Level 7", type: "stairs", x: 230, y: 850 },
    ],
  },
]

// ── SVG assembly ─────────────────────────────────────────────────────────────
function buildSvg(f) {
  let s = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}'>\n`
  s += `  <defs>\n    <pattern id='hatch' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>\n      <line x1='0' y1='0' x2='0' y2='8' stroke='#CBD5E1' stroke-width='1.4'/>\n    </pattern>\n  </defs>\n`
  s += `  <rect width='${W}' height='${H}' fill='${PAGE}'/>\n`

  // Building slab
  s += `  <rect x='${BX0}' y='${BY0}' width='${BX1 - BX0}' height='${BY1 - BY0}' fill='white'/>\n`

  // Corridor ring (+ the Level 2 A&E spur passage through the west wing)
  for (const c of [corN, corS, corW, corE]) {
    s += `  <rect x='${c.x0}' y='${c.y0}' width='${c.x1 - c.x0}' height='${c.y1 - c.y0}' fill='${CORRIDOR}'/>\n`
  }
  if (f.entrances) s += `  <rect x='${BX0}' y='620' width='${WW_X1 + COR - BX0}' height='60' fill='${CORRIDOR}'/>\n`

  // Courtyard / centre block
  if (f.courtyard === "garden" || f.courtyard === "open") {
    const light = f.courtyard === "open"
    s += `  <rect x='${CY.x0}' y='${CY.y0}' width='${CY.x1 - CY.x0}' height='${CY.y1 - CY.y0}' fill='${GARDEN.fill}'${light ? " fill-opacity='0.55'" : ""} stroke='${GARDEN.stroke}' stroke-width='1.5'/>\n`
    if (f.courtyard === "garden") {
      // stone path the floor-0 corridor trail follows
      s += `  <rect x='388' y='${CY.y0}' width='24' height='${CY.y1 - CY.y0}' fill='${PATHC.fill}' stroke='${PATHC.stroke}' stroke-width='1'/>\n`
      for (const [tx, ty] of [[255, 300], [545, 300], [255, 700], [545, 700], [310, 500]]) {
        s += `  <text x='${tx}' y='${ty}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='17'>🌳</text>\n`
      }
      s += `  <text x='485' y='505' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='12' font-weight='bold' fill='#15803D'>Garden Courtyard</text>\n`
    } else {
      s += `  <text x='400' y='505' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='12' fill='#4D7C0F'>Courtyard — open below</text>\n`
    }
  } else if (f.courtyard === "void") {
    s += `  <rect x='${CY.x0}' y='${CY.y0}' width='${CY.x1 - CY.x0}' height='${CY.y1 - CY.y0}' fill='${GARDEN.fill}' fill-opacity='0.5' stroke='${GARDEN.stroke}' stroke-width='1.5' stroke-dasharray='6,4'/>\n`
    s += `  <text x='400' y='505' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='12' fill='#4D7C0F'>Garden Courtyard below</text>\n`
  } else if (f.courtyard === "plant") {
    s += `  <rect x='${CY.x0}' y='${CY.y0}' width='${CY.x1 - CY.x0}' height='${CY.y1 - CY.y0}' fill='${CAT.plant.fill}' stroke='${CAT.plant.stroke}' stroke-width='1.5'/>\n`
    s += `  <rect x='${CY.x0}' y='${CY.y0}' width='${CY.x1 - CY.x0}' height='${CY.y1 - CY.y0}' fill='url(#hatch)'/>\n`
    s += `  <text x='400' y='495' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='15'>🔒</text>\n`
    s += `  <text x='400' y='515' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='12' font-weight='bold' fill='#475569'>Building Plant &amp; Services</text>\n`
    s += `  <text x='400' y='531' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='9.5' fill='#64748B'>Restricted access</text>\n`
  }

  // Corridor labels
  s += `  <text x='400' y='${CLN + 4}' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='9' fill='#94A3B8' letter-spacing='2'>CORRIDOR</text>\n`
  s += `  <text x='${CLW}' y='360' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='9' fill='#94A3B8' letter-spacing='2' transform='rotate(-90 ${CLW} 360)'>CORRIDOR</text>\n`

  // Rooms
  for (const r of f.rooms) s += room(r)

  // Outer wall on top
  s += `  <rect x='${BX0}' y='${BY0}' width='${BX1 - BX0}' height='${BY1 - BY0}' fill='none' stroke='${WALL}' stroke-width='3'/>\n`

  // Entrances (Level 2 only): wall openings + markers
  if (f.entrances) {
    s += `  <line x1='486' y1='${BY1}' x2='514' y2='${BY1}' stroke='${PATHC.fill}' stroke-width='6'/>\n`
    s += `  <line x1='${BX0}' y1='636' x2='${BX0}' y2='664' stroke='${PATHC.fill}' stroke-width='6'/>\n`
    // main entrance pill
    s += `  <rect x='428' y='912' width='144' height='20' rx='10' fill='#16A34A'/>\n`
    s += `  <text x='500' y='926' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='11' font-weight='bold' fill='white'>▲ MAIN ENTRANCE</text>\n`
    // A&E pill (rotated, along the west wall)
    s += `  <g transform='rotate(-90 44 650)'><rect x='-26' y='640' width='140' height='20' rx='10' fill='#DC2626'/><text x='44' y='654' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='11' font-weight='bold' fill='white'>▲ A&amp;E ENTRANCE</text></g>\n`
    // street name
    s += `  <text x='400' y='965' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='12' font-style='italic' fill='#94A3B8' letter-spacing='3'>GREAT ORMOND STREET</text>\n`
  }

  // Level chip
  s += `  <g>\n    <rect x='22' y='18' width='250' height='46' rx='10' fill='#005EB8'/>\n`
  s += `    <text x='36' y='38' font-family='Arial,Helvetica,sans-serif' font-size='15' font-weight='bold' fill='white'>${esc(f.title)}</text>\n`
  s += `    <text x='36' y='54' font-family='Arial,Helvetica,sans-serif' font-size='9' fill='#BFDBFE'>${esc(f.chipSub)}</text>\n  </g>\n`

  // North arrow
  s += `  <g>\n    <circle cx='754' cy='46' r='17' fill='white' stroke='#CBD5E1' stroke-width='1.5'/>\n`
  s += `    <polygon points='754,33 749,49 754,45 759,49' fill='#DC2626'/>\n`
  s += `    <text x='754' y='59' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='9' font-weight='bold' fill='#334155'>N</text>\n  </g>\n`

  // Scale bar (128px ≈ 20 m at 0.156 m/px)
  s += `  <g>\n    <line x1='30' y1='952' x2='158' y2='952' stroke='#475569' stroke-width='2'/>\n`
  s += `    <line x1='30' y1='946' x2='30' y2='958' stroke='#475569' stroke-width='2'/>\n`
  s += `    <line x1='158' y1='946' x2='158' y2='958' stroke='#475569' stroke-width='2'/>\n`
  s += `    <text x='94' y='944' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='10' fill='#475569'>20 m</text>\n  </g>\n`

  s += `</svg>\n`
  return s
}

// ── Corridor trails (routing network) ────────────────────────────────────────
// Ring centreline nodes, clockwise from the NW corner. Door nodes for every
// core are included exactly, so lifts/stairs snap onto the network.
function ringPoints() {
  const pts = []
  for (const x of [190, 260, 330, 400, 470, 540, 610]) pts.push([x, CLN])
  for (const y of [280, 350, 410, 470, 540, 610, 680, 740, CLS]) pts.push([CLE, y])
  for (const x of [540, 500, 430, 400, 330, 260, 230, 190]) pts.push([x, CLS])
  for (const y of [740, 680, 650, 580, 510, 470, 400, 330, 260, CLN]) pts.push([CLW, y])
  return pts
}

function trailsFor(floor) {
  const t = [{ id: `gosh-corridor-ring-${floor}`, floor, pts: ringPoints() }]
  if (floor === 0) {
    t.push({ id: "gosh-entrance-spur-0", floor, pts: [[500, CLS], [500, 830], [500, 880]] })
    t.push({ id: "gosh-ae-spur-0", floor, pts: [[CLW, 650], [130, 650], [90, 650]] })
    t.push({
      id: "gosh-courtyard-path-0", floor,
      pts: [[400, CLN], [400, 290], [400, 360], [400, 430], [400, 500], [400, 570], [400, 640], [400, 710], [400, CLS]],
    })
  }
  return t
}

// ── Emit ─────────────────────────────────────────────────────────────────────
fs.mkdirSync(SVG_DIR, { recursive: true })
for (const f of FLOORS) {
  fs.writeFileSync(path.join(SVG_DIR, f.file), buildSvg(f))
  console.log("wrote", path.join("public/floorplans/gosh", f.file))
}

// gosh.ts
const num = (n) => n.toFixed(6)
function wpLine(w, floor) {
  const c = ll(w.x, w.y)
  let line = `    { id: ${JSON.stringify(w.id)}, name: ${JSON.stringify(w.name)}, type: ${JSON.stringify(w.type)}, coordinates: { lat: ${num(c.lat)}, lng: ${num(c.lng)} }, floor: ${floor}`
  if (w.desc) line += `, description: ${JSON.stringify(w.desc)}`
  line += " },"
  return line
}

const EXTRAS = {
  "outpatients-1": `      hours: "Open now · Closes 17:00",
      arrivalNotes: "Check in at the touchscreen kiosk by the entrance, then take a seat in the waiting area — you'll be called by first name.",
      typicalWait: "10–20 min after check-in",`,
  xray: `      hours: "Open now · Closes 18:00",
      arrivalNotes: "Report to the imaging reception desk with your referral letter. Please arrive 15 minutes early for changing, if needed.",
      typicalWait: "15–25 min after check-in",`,
}

function wpBlock(w, floor) {
  if (!w.extras) return wpLine(w, floor)
  const c = ll(w.x, w.y)
  return `    {
      id: ${JSON.stringify(w.id)}, name: ${JSON.stringify(w.name)}, type: ${JSON.stringify(w.type)},
      coordinates: { lat: ${num(c.lat)}, lng: ${num(c.lng)} }, floor: ${floor},
      description: ${JSON.stringify(w.desc)},
${EXTRAS[w.id]}
    },`
}

function trailLines(floor) {
  return trailsFor(floor)
    .map((t) => {
      const pts = t.pts.map(([x, y]) => {
        const c = ll(x, y)
        return `{ lat: ${num(c.lat)}, lng: ${num(c.lng)} }`
      })
      return `    { id: ${JSON.stringify(t.id)}, floor: ${floor}, points: [${pts.join(", ")}] },`
    })
    .join("\n")
}

const FLOOR_HEADERS = {
  "-1": "Level 1 (internal floor -1) — below the street-level entrance: therapy, records and support services",
  0: "Level 2 (internal floor 0) — the street-level entrance floor: main entrance, reception, A&E, pharmacy, café",
  1: "Level 3 (internal floor 1) — wards 1A/1B, outpatients and children's spaces",
  2: "Level 4 (internal floor 2) — imaging (X-Ray, MRI, CT, ultrasound) and wards 2A/2B",
  3: "Level 5 (internal floor 3) — operating theatres, recovery and surgical wards",
  4: "Level 6 (internal floor 4) — respiratory/renal wards and the parents' floor",
  5: "Level 7 (internal floor 5) — smaller set-back storey: seminar rooms, staff areas and plant",
}

let ts = `import { Venue } from "../types"

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
`
const LABELS = { "-1": "Level 1", 0: "Level 2 (entrance)", 1: "Level 3", 2: "Level 4", 3: "Level 5", 4: "Level 6", 5: "Level 7" }
const IDS = { "-1": "l1", 0: "gf", 1: "f1", 2: "f2", 3: "f3", 4: "f4", 5: "f5" }
for (const f of FLOORS) {
  ts += `    { id: "${IDS[f.floor]}", floor: ${f.floor}, label: "${LABELS[f.floor]}", imageUrl: "/floorplans/gosh/${f.file}", bounds: B },\n`
}
ts += `  ],
  waypoints: [
`
for (const f of FLOORS) {
  ts += `    // ${FLOOR_HEADERS[f.floor]}\n`
  for (const w of f.waypoints) ts += wpBlock(w, f.floor) + "\n"
  ts += "\n"
}
ts = ts.replace(/\n\n$/, "\n")
ts += `  ],
  // The walkable corridor network, one ring per storey (plus the Level 2
  // entrance spurs and garden path), expressed as survey trails so buildRoute
  // follows the drawn corridors instead of cutting through rooms. Node
  // coordinates sit on the corridor centrelines of the floor-plan SVGs, and
  // every lift/stair door is a node, so cross-floor routes stay on the network.
  trails: [
`
for (const f of FLOORS) {
  ts += trailLines(f.floor) + "\n"
}
ts += `  ],
}
`

fs.writeFileSync(path.join(REPO, "src/lib/venues/gosh.ts"), ts)
console.log("wrote src/lib/venues/gosh.ts")

// sanity: waypoint-to-nearest-trail-node distance must be < 30 m for routing
const M_PER_PX = 0.156
let worst = 0, worstId = ""
for (const f of FLOORS) {
  const nodes = trailsFor(f.floor).flatMap((t) => t.pts)
  for (const w of f.waypoints) {
    let best = Infinity
    for (const [x, y] of nodes) best = Math.min(best, Math.hypot(x - w.x, y - w.y))
    const m = best * M_PER_PX
    if (m > worst) { worst = m; worstId = w.id }
  }
}
console.log(`max waypoint→corridor distance: ${worst.toFixed(1)} m (${worstId}) — must be < 30`)
