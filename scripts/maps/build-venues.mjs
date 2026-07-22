// Build src/lib/venues/<slug>.ts for each reconstructed hospital sheet.
//
// For every sheet we: reconstruct the vector floor plan (scripts/maps/pdf2svg),
// pull grouped destination labels (scripts/maps/extract), and place each label
// as a waypoint at its position on the sheet. Geography is approximate by design
// — like the other sheet-derived venues, pin placement within the site is
// illustrative — but self-consistent: pins land on their labels because both
// come from the same coordinate extraction.
//
// `plan` crops waypoint extraction to the actual site-plan area so labels from a
// sheet's directory table / key / title band don't become stray waypoints; the
// floor-plan IMAGE is always the whole sheet. Bounds are anchored so the plan
// centre lands on the hospital's real coordinates.
//
// Run: node scripts/maps/build-venues.mjs
import { extractLabels } from "./extract.mjs"
import { writeFileSync } from "fs"

const R = 111320 // metres per degree latitude

// slug, name, subtitle, center [lat,lng], spanM (full-sheet width in metres),
// plan crop [x0,y0,x1,y1] (normalised; waypoints only), quickAccess, notes.
const VENUES = [
  {
    slug: "charing-cross", file: "map/Charing Cross.pdf", page: 1,
    id: "charing-cross-hospital", name: "Charing Cross Hospital",
    subtitle: "Imperial College Healthcare NHS Trust · Fulham Palace Road, London W6 8RF",
    center: [51.487045, -0.219921], spanM: 470, plan: [0, 0.16, 1, 0.97],
    quick: ["Main entrance", "A&E", "A&E and Urgent Treatment Centre entrance", "Main outpatients (First floor)", "Tower block"],
    notes: "Site map with building entrances, step-free routes and the nearest Underground stations (Hammersmith, Barons Court, West Kensington).",
  },
  {
    slug: "hammersmith", file: "map/Hammersmith Hospital location map.pdf", page: 1,
    id: "hammersmith-hospital", name: "Hammersmith Hospital",
    subtitle: "Imperial College Healthcare NHS Trust · Du Cane Road, London W12 0HS",
    center: [51.517422, -0.234707], spanM: 430, plan: [0, 0.12, 1, 0.95],
    quick: ["Main entrance", "Urgent Treatment Centre", "A Block", "Heart attack centre", "Outpatients, x-ray and pharmacy"],
    notes: "Site map with lettered building zones, main and Urgent Treatment Centre entrances, and bus stops on Du Cane Road.",
  },
  {
    slug: "qcch", file: "map/Queen Charlottes and Chelsea Hospital location map.pdf", page: 1,
    id: "queen-charlottes-chelsea-hospital", name: "Queen Charlotte's & Chelsea Hospital",
    subtitle: "Imperial College Healthcare NHS Trust · Du Cane Road, London W12 0HS",
    center: [51.51706, -0.235544], spanM: 430, plan: [0, 0.14, 1, 0.95],
    quick: ["Main entrance", "Delivery suite", "Birth centre", "Centre for fetal care", "Neonatal intensive Care - Unit"],
    notes: "Maternity and neonatal hospital sharing the Hammersmith Hospital site; floor legend runs GF (main reception) up to level 4 (neonatal intensive care).",
  },
  {
    slug: "western-eye", file: "map/Western Eye Hospital location map.pdf", page: 1,
    id: "western-eye-hospital", name: "Western Eye Hospital",
    subtitle: "Imperial College Healthcare NHS Trust · 153-173 Marylebone Road, London NW1 5QH",
    center: [51.520702, -0.163316], spanM: 300, plan: [0, 0.14, 1, 0.95],
    quick: ["Main entrance", "Eye A&E department", "Macular clinic", "Day care unit", "Alex Cross ward"],
    notes: "24-hour eye A&E. Nearest stations Marylebone, Baker Street and Edgware Road; floor legend GF–4.",
  },
  {
    slug: "bwh", file: "map/Clinical-Genetics-BWH-site-map.pdf", page: 1,
    id: "birmingham-womens-hospital", name: "Birmingham Women's Hospital",
    subtitle: "Birmingham Women's and Children's NHS FT · Mindelsohn Way, Edgbaston, Birmingham B15 2TG",
    center: [52.45378, -1.94261], spanM: 620, plan: [0, 0.06, 1, 0.84],
    quick: ["Main Entrance (BWH)", "A&E", "Birmingham Women's Hospital", "Lavender House", "Clinical Genetics Clinic"],
    notes: "Site map (from the Clinical Genetics sheet) showing Birmingham Women's Hospital and the adjacent Queen Elizabeth Hospital Birmingham; nearest station University.",
  },
  {
    slug: "qehb", file: "map/map-qehb.pdf", page: 1,
    id: "queen-elizabeth-hospital-birmingham", name: "Queen Elizabeth Hospital Birmingham",
    subtitle: "University Hospitals Birmingham NHS FT · Mindelsohn Way, Birmingham B15 2GW",
    center: [52.45015, -1.941762], spanM: 720, plan: [0, 0.05, 0.71, 0.85],
    quick: ["Main Entrance", "A&E", "Acute Medical Unit (AMU)", "Heritage Building", "Cancer Centre"],
    notes: "Large acute site with numbered entrances 1–6; free shuttle bus between car parks and entrances. Nearest station University.",
  },
  {
    slug: "nmgh", file: "map/NMGHMap_Flat_UpdateDec2023_External-VB-Block-Naviagation-V2_.pdf", page: 1,
    id: "north-manchester-general-hospital", name: "North Manchester General Hospital",
    subtitle: "Manchester University NHS FT · Delaunays Road, Crumpsall, Manchester M8 5RB",
    center: [53.517887, -2.229487], spanM: 620, plan: [0.18, 0.11, 1, 0.97],
    quick: ["Main Entrance", "Emergency Department (A&E)", "North Manchester General Hospital", "MRI Scanner"],
    notes: "Site map with lettered blocks A–J, colour-coded car parks and pedestrian/emergency entrances. Nearest Metrolink at Crumpsall.",
  },
  {
    slug: "oxford-road", file: "map/ORC-map-with-directory-Feb-25.pdf", page: 1,
    id: "mft-oxford-road-campus", name: "Manchester Royal Infirmary — Oxford Road Campus",
    subtitle: "Manchester University NHS FT · Oxford Road, Manchester M13 9WL",
    center: [53.46247, -2.22546], spanM: 720, plan: [0, 0.18, 0.72, 0.85],
    quick: ["Manchester Royal Infirmary", "Manchester Royal Eye Hospital", "Saint Mary's Hospital", "Royal Manchester Children's Hospital", "Adult Emergency Department (A&E)"],
    notes: "Shared campus of Manchester Royal Infirmary, Saint Mary's, the Royal Eye Hospital and Royal Manchester Children's Hospital; zones A–N map to building entrances.",
  },
  {
    slug: "trafford", file: "map/Trafford-General-Hospital-map.pdf", page: 1,
    id: "trafford-general-hospital", name: "Trafford General Hospital",
    subtitle: "Manchester University NHS FT · Moorside Road, Davyhulme, Manchester M41 5SL",
    center: [53.45619, -2.35566], spanM: 300, plan: [0, 0.1, 0.5, 0.92],
    quick: ["Main Entrance", "Blue Zone", "Green Zone", "Red Zone", "Urgent Care Centre"],
    notes: "Colour-zoned map (Blue / Green / Red) with a ground and first-floor plan and a full department directory. AccessAble accessibility guide available.",
  },
  {
    slug: "wythenshawe", file: "map/wythenshawe-hospital-sitemap-updated-logo.pdf", page: 1,
    id: "wythenshawe-hospital", name: "Wythenshawe Hospital",
    subtitle: "Manchester University NHS FT · Southmoor Road, Wythenshawe, Manchester M23 9LT",
    center: [53.38757, -2.29174], spanM: 700, plan: [0, 0.02, 1, 0.72],
    quick: ["Main Entrance", "Acute Block", "North West Heart Centre", "Treatment & Diagnostic Centre", "Education & Research Centre"],
    notes: "Colour-zoned campus (purple, green, blue, yellow, orange) with numbered entrances; specialist heart, lung and cystic-fibrosis centres.",
  },
]

function slugify(s) {
  return s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "wp"
}
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
const r6 = (n) => Number(n.toFixed(6))

async function build(v) {
  const { labels, W, H } = await extractLabels(v.file, v.page)
  const [px0, py0, px1, py1] = v.plan
  const inPlan = labels.filter((l) => l.nx >= px0 && l.nx <= px1 && l.ny >= py0 && l.ny <= py1)

  // Bounds: full sheet spans dLng × dLat, anchored so the plan centre == center.
  const [lat0, lng0] = v.center
  const dLng = v.spanM / (R * Math.cos((lat0 * Math.PI) / 180))
  const dLat = (v.spanM * (H / W)) / R
  const pcx = (px0 + px1) / 2, pcy = (py0 + py1) / 2
  const lngW = lng0 - pcx * dLng, lngE = lngW + dLng
  const latN = lat0 + pcy * dLat, latS = latN - dLat

  const toLatLng = (nx, ny) => [r6(latN - ny * dLat), r6(lngW + nx * dLng)]

  // Waypoints, de-duplicated ids.
  const usedIds = {}
  const wps = inPlan.map((l) => {
    const base = `${slugify(l.text)}-f0`
    const n = usedIds[base] || 0
    usedIds[base] = n + 1
    const id = n === 0 ? base : `${base}-${n + 1}`
    const [lat, lng] = toLatLng(l.nx, l.ny)
    return { id, name: l.text, type: l.type, lat, lng }
  })

  const [bS, bW] = toLatLng(0, 1) // sheet bottom-left  -> [latS, lngW]
  const [bN, bE] = toLatLng(1, 0) // sheet top-right    -> [latN, lngE]

  const L = []
  L.push('import { Venue } from "../types"')
  L.push("")
  L.push(`// ${v.name} — reconstructed from the trust's own site map sheet`)
  L.push("// (${v.file}). Generated by scripts/maps/build-venues.mjs — edit that, not this.".replace("${v.file}", v.file))
  L.push("")
  L.push(`export const ${v.slug.toUpperCase().replace(/-/g, "_")}_VENUE: Venue = {`)
  L.push(`  id: "${v.id}",`)
  L.push(`  slug: "${v.slug}",`)
  L.push(`  name: "${esc(v.name)}",`)
  L.push(`  subtitle: "${esc(v.subtitle)}",`)
  L.push('  category: "hospital",')
  L.push(`  center: { lat: ${r6(lat0)}, lng: ${r6(lng0)} },`)
  L.push("  defaultZoom: 17,")
  L.push('  visibility: "public",')
  L.push("  verified: false,")
  L.push(`  accessibility: { stepFreeRoute: true, accessibleToilets: true, notes: "${esc(v.notes)}" },`)
  L.push(`  quickAccess: [${v.quick.map((q) => `"${esc(q)}"`).join(", ")}],`)
  L.push("  floorPlans: [")
  L.push(`    { id: "f0", floor: 0, label: "Ground Floor", imageUrl: "/floorplans/${v.slug}/sitemap.svg", bounds: [[${r6(bS)}, ${r6(bW)}], [${r6(bN)}, ${r6(bE)}]] },`)
  L.push("  ],")
  L.push("  waypoints: [")
  for (const w of wps) {
    L.push(`    { id: "${w.id}", name: "${esc(w.name)}", type: "${w.type}", coordinates: { lat: ${w.lat}, lng: ${w.lng} }, floor: 0 },`)
  }
  L.push("  ],")
  L.push("}")
  L.push("")
  writeFileSync(`src/lib/venues/${v.slug}.ts`, L.join("\n"))
  return { slug: v.slug, count: wps.length }
}

for (const v of VENUES) {
  const r = await build(v)
  console.log(`${r.slug}: ${r.count} waypoints`)
}
