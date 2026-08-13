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
const NORTH_LABEL = /^(n|north)$/i

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

  const streets = []
  const north = []
  const scaleBars = []
  for (const item of doc.items) {
    if (NORTH_LABEL.test(item.text)) {
      north.push(item)
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
    scaleBars,
  }
}
