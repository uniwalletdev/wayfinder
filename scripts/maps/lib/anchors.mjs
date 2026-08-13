// Reading a sheet for the things that say where it is.
//
// A trust's site map is not a bare drawing. It prints the names of the streets
// around the site, it usually prints a north arrow, and it sometimes prints a
// scale bar. Every one of those is a statement about the real world, made by the
// people who own the building, sitting in the file already — and the pipeline
// throws all three away, then guesses the same facts badly: a 450 m default
// width, no angle at all, and an anchor taken from a postal address.
//
// A named street is the most valuable of the three, because it is a
// correspondence waiting to happen. "GUILFORD STREET" printed at (0.31, 0.08) on
// the page is one half of a control point; the other half is where Guilford
// Street runs on the map, which OpenStreetMap knows and so does anyone with a
// phone. Two streets that cross give a junction, which is a point rather than a
// line — and two points solve the whole placement.
//
// Nothing here contacts the network or decides a placement. It reads what the
// sheet claims and hands it over, which is the half that can be done offline and
// checked.

// Suffixes that make an English street name, plus the handful of hospital-estate
// ones ("Perimeter Road", "West Drive"). Ordered longest-first so "Park Road"
// does not match on "Park".
const STREET_SUFFIX =
  /\b(road|street|lane|avenue|drive|way|close|crescent|terrace|gardens|grove|place|hill|parade|walk|row|square|rise|approach|mews)\b/i

// Text that mentions a street but is an instruction, not a label. "To Headley
// Way" is a direction arrow at the edge of the sheet, and its position on the
// page says nothing about where Headley Way is.
const NOT_A_STREET_LABEL =
  /^(to|towards|for|see|use|follow|via|from|exit|entrance|turn|head|continue|take)\b|\b(entrance|closed|no entry|drop.?off|car park|ward|building|centre|clinic|department|superstore|is often|please|access)\b/i

// "Way" is the trap: it ends real street names (Headley Way) and it ends most
// of a hospital sheet's prose ("this way", "Two way section", "Finding your way
// around"). These are the phrasings that are never a street.
const WAY_PROSE = /\b(this|that|two|one|your|our|the|either|both|no|give)\s+way\b|\bway\s+(in|out|around|to)\b/i

// A lone compass letter, or the word spelled out. Sheets draw the arrow as
// geometry and the letter as text, so the letter is what is readable here — its
// position gives the arrow's, and that is enough to tell a plan turned 20° from
// one turned 110°, which edge orientation alone cannot.
//
// A bare "N" is not proof of a compass, though. Royal Berkshire prints fifteen
// of them, all at body-text size, in four neat columns — a directory table with
// an "N" column, not fifteen compass roses. QEHB prints nine the same way. What
// separates the real ones is size: a compass rose is drawn to be seen from
// across a corridor, so its letter runs well above the sheet's ordinary text,
// while a table's runs exactly at it.
const NORTH_LABEL = /^(n|north)$/i
// What actually separates them is alignment, not size. Royal Berkshire's fifteen
// sit at four x positions — tidy columns, because they are a table. QEHB's nine
// do the same. A compass rose is a one-off: nothing else on the sheet lines up
// with it. Size alone was tried first and is not enough, because a sheet drawn
// with large labels has a large median and its genuine rose fails the ratio.
const ALIGNED_TOLERANCE = 0.004 // of the page, either axis
const ALIGNED_GROUP = 3 // this many in a line is furniture
// A sheet has one compass, or two on a double drawing.
const MAX_COMPASSES = 2

// The number on a scale bar: "20 m", "100m", "50 metres". Bare numbers are
// excluded — a sheet is full of them.
const SCALE_LABEL = /^(\d{1,4})\s*(m|metres|meters|metre|meter)$/i

// Text drawn on an SVG produced by pdf2svg: position, size, and the string.
export function readTextItems(svg) {
  const vb = svg.match(/viewBox=['"]0 0 ([\d.]+) ([\d.]+)['"]/)
  if (!vb) return null
  const W = Number(vb[1]), H = Number(vb[2])
  const items = []
  for (const m of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const attrs = m[1]
    const text = m[2].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
    if (!text) continue
    // Both quote styles: pdf2svg writes double, the hand-built venues single.
    // Matching only double quotes silently skipped every GOSH level — the one
    // set of plans most worth reading.
    const num = (k) => {
      const r = attrs.match(new RegExp(`${k}=["']([-\\d.]+)["']`))
      return r ? Number(r[1]) : null
    }
    const x = num("x"), y = num("y")
    if (x === null || y === null) continue
    items.push({ text, x, y, size: num("font-size") ?? 0, nx: x / W, ny: y / H })
  }
  return { W, H, items }
}

// Tidy a street label into something a gazetteer would recognise: strip the
// trailing road classification a sheet adds ("Bristol Road A38"), bracketed
// asides, and the ALL-CAPS the sheets print.
export function normaliseStreetName(text) {
  let s = text.replace(/\([^)]*\)/g, " ").replace(/\bA\d{2,4}\b|\bB\d{3,4}\b/g, " ")
  s = s.replace(/\s+/g, " ").trim()
  if (!s) return null
  if (s === s.toUpperCase()) {
    s = s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
  }
  return s
}

// Everything on a sheet that claims something about the world.
//
// `streets` are candidate control points: each needs a real coordinate for the
// place it names before it can be used, which is the step this cannot do
// offline. `north` and `scaleBar` are read as-is.
export function readAnchors(svg) {
  const doc = readTextItems(svg)
  if (!doc) return null

  // The size ordinary text is set at, used to tell a compass rose from a letter
  // in a table.
  const sizes = doc.items.map((i) => i.size).filter((n) => n > 0).sort((a, b) => a - b)
  const medianSize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0

  const streets = []
  const northCandidates = []
  const scaleBars = []
  for (const item of doc.items) {
    if (NORTH_LABEL.test(item.text)) {
      northCandidates.push(item)
      continue
    }
    const scale = item.text.match(SCALE_LABEL)
    if (scale) {
      scaleBars.push({ ...item, metres: Number(scale[1]) })
      continue
    }
    if (!STREET_SUFFIX.test(item.text) || NOT_A_STREET_LABEL.test(item.text)) continue
    if (WAY_PROSE.test(item.text)) continue
    const name = normaliseStreetName(item.text)
    if (!name) continue
    // Judge the name itself, not the address tail a few sheets print
    // ("London Road, Reading RG1 5AN") — that tail is more useful than a bare
    // name, not less, so it is kept but not counted against the length rule.
    const head = name.split(",")[0].trim()
    const words = head.split(/\s+/)
    // A bare "Road" or "Close" names nothing.
    if (words.length < 2) continue
    // Longer than this is prose from a travel-directions panel that happens to
    // contain "road", not a label on the drawing.
    if (words.length > 4) continue
    // And the suffix has to END the name rather than merely appear in it.
    if (!STREET_SUFFIX.test(words[words.length - 1])) continue
    streets.push({ ...item, name })
  }

  // Drop any letter that lines up with two or more others — a column or a row of
  // them is a table. What survives is ranked by size, because where a sheet does
  // carry both a rose and a stray letter, the rose is the one drawn to be seen.
  const aligned = (item, axis) =>
    northCandidates.filter((o) => Math.abs(o[axis] - item[axis]) <= ALIGNED_TOLERANCE).length >= ALIGNED_GROUP
  const rejected = northCandidates.filter((n) => aligned(n, "nx") || aligned(n, "ny"))
  const biggestRejected = Math.max(0, ...rejected.map((n) => n.size))
  const north = northCandidates
    .filter((n) => !rejected.includes(n))
    // A sheet that used "N" as a table entry several times over was using it as
    // a table entry, and the one or two that happened not to line up are the
    // same thing. Only a letter drawn larger than every rejected one stands out
    // enough to be a rose — which is how Northampton keeps its 47pt compass out
    // of a table of 11pt Ns, and how Royal Berkshire keeps none of fifteen.
    .filter((n) => rejected.length < ALIGNED_GROUP || n.size > biggestRejected)
    .sort((a, b) => b.size - a.size || a.ny - b.ny)
    .slice(0, MAX_COMPASSES)

  // One street named twice at two ends of the same road is two anchors for one
  // line, which is worth keeping — a line's direction constrains the angle even
  // when neither point is a junction.
  const byName = new Map()
  for (const s of streets) {
    const list = byName.get(s.name)
    if (list) list.push(s)
    else byName.set(s.name, [s])
  }

  return {
    page: { W: doc.W, H: doc.H },
    texts: doc.items.length,
    streets,
    streetNames: [...byName.keys()].sort(),
    repeated: [...byName.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ name: k, times: v.length })),
    north,
    // Kept so a reviewer can see what was rejected rather than wonder.
    northRejected: northCandidates.length - north.length,
    scaleBars,
  }
}
