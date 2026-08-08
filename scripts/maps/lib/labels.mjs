// Turning a sheet's raw text into a waypoint name and type.
//
// Split out of extract.mjs so it can be tested: extract.mjs imports pdfjs at
// module load, which needs node_modules and a real PDF, while everything here is
// string-in/string-out. The rules encode what a hospital site map actually
// contains — destinations, but also a title block, a key, a directory table,
// street names and car-park codes, all of which arrive as text of the same kind.

const CTRL = /[\u0000-\u001F\u007F]/g

// Some sheets set wide letter-spacing on street/title labels, so each glyph
// arrives as its own token ("M i n d e l soh n C r e s c e n t"). Collapse runs
// of single characters back into words so the street filter can see them.
export function despace(s) {
  return s.replace(/\b([A-Za-z])(?: ([A-Za-z]))+\b/g, (m) => m.replace(/ /g, "")).replace(/\s+/g, " ").trim()
}

// Fraction of whitespace tokens that are a single character — high means the
// label is decorative letter-spaced text (a street/title), not a destination.
export function singleCharRatio(s) {
  const toks = s.split(/\s+/)
  return toks.filter((t) => t.length === 1).length / toks.length
}

// Words that mark a label as NOT a destination. The second form (no word
// boundary before the suffix) catches letter-spaced streets that despace glued
// together, e.g. "HintleshamAvenue", "nCrescent", "hnWay".
const STREET = /\b(road|street|lane|way|avenue|drive|close|crescent|place|gardens|walk|grove|terrace|boulevard|mews|court only|park rd)\b/i
const STREET_GLUED = /(?:avenue|crescent|street|boulevard|drive)$/i

const NOISE = [
  /^please remember/i, /^site map$/i, /^key$/i, /copyright/i, /accessable/i,
  /nhs foundation trust/i, /university hospitals/i, /college healthcare/i, /^www\./i, /@/,
  /\b0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/, /^update/i, /^correct at/i, /^tel[: ]/i,
  /^part of/i, /^for more/i, /vaccination/i, /what3words/i, /google maps/i,
  /^car park code/i, /^blue badge/i, /^zones? [a-z] to/i, /drop off points/i,
  /shopping centre$/i, /metro station/i, /^stop [a-z]{1,2}$/i, /please make sure/i,
  /magistrates court/i, /primary school/i, /^national rail/i, /^access (to|for)/i,
  /free shuttle/i, /running from/i, /when visiting/i, /post ?code/i, /sat nav/i,
  /^(ground|first|second|third|lower ground) floor$/i, /^floor \d/i, /^level \d/i,
  /^visitors? car park$/i, /^staff car park$/i, /^public car park$/i,
  // Map-key items, transport and directional notes that aren't destinations.
  /^shuttle$/i, /^taxi$/i, /^trust$/i, /^bus (route|stop)/i, /^no access/i,
  /^vehicle (access|entrance|exit)/i, /^construction zone$/i, /^practice$/i,
  /^(unit|patient|entrance|centre|hospital|building)$/i, /^ev charging/i,
  /^(accessible|visitor|disabled) parking$/i, /^pedestrian (crossing|tunnel)$/i,
  // Street abbreviations ("Enford St.", "Seymour Pl.").
  /\b(st|rd|ave|pl|ln|dr|cres|sq|gdns)\.$/i,

  // --- The sheet's own furniture -----------------------------------------
  // Every sheet is drafted with a full-page crop (plan: [0,0,1,1]), so the
  // title block, the key and the alphabetical directory table are scraped
  // alongside the map itself. James Cook shipped "(IN ALPHABETICAL ORDER)",
  // "ICONS KEY:" and "FLOOR & ROUTE" as places you could ask to be taken to.
  /^icons?\s*key/i, /^legend$/i, /^index$/i, /^contents$/i, /^disclaimer/i,
  /^\(?in alphabetical order\)?$/i, /^location$/i, /^floor\s*&\s*route$/i,
  /^site map\b/i, /^welcome to\b/i, /^how to (find|get)/i, /^this map/i,
  /^published/i, /^produced by/i, /^reviewed/i, /^version \d/i, /^\d{4} edition/i,

  // Staff-only parking is not a visitor destination. Named visitor car parks
  // ("Car Park 3") still come through — where to park is one of the things
  // people most need from a site map, and only the bare generic forms are
  // dropped by the rules above.
  /staff only/i, /^non[- ]trust/i, /^permit holders/i,

  // A storey on its own, however the sheet bracketed it. The plain form was
  // already dropped; "(Ground Floor)" was not, and survived splitStorey too
  // because removing the storey would have left an empty name.
  /^[([]?\s*((?:lower\s+)?(?:ground|first|second|third|fourth|fifth|basement))\s+floor\s*[)\]]?$/i,

  // Transport interchanges the sheet names for orientation. Marylebone Station
  // shipped as a destination inside Western Eye Hospital, 150 m up the road.
  /\b(rail|railway|train|tube|underground|bus|coach|metro|park and ride|park & ride)\s+station\b/i,
  // A bare "<Name> Station" is an interchange, except for the stations that
  // genuinely stand on a hospital site — a ward's nurses' station above all,
  // and the ambulance station, which is a building people are sent to.
  /^(?!.*\b(nurses?|ambulance|fire|police|charging|work|dressing|sub|weather|blood|hand|sluice|docking)\b)[A-Z][A-Za-z'’ ]{2,} Station$/i,
]

// Map furniture: zone letters, compass points, entrance numbers, floor codes.
export const isFurniture = (s) =>
  /^[a-z]$/i.test(s) || /^[nsew]{1,3}$/i.test(s) || /^\d{1,3}[a-z]?$/i.test(s) ||
  /^gf$|^lg$|^[bg]\d?$/i.test(s) || /^(north|south|east|west)$/i.test(s) ||
  /^zones? [a-z]/i.test(s) || /^block [a-z]$/i.test(s) ||
  /^(cp|cv|tcp|mscp|mp)\s?\d+[a-z]?$/i.test(s) // car-park zone codes (CP2, TCP01…)

// A PDF that embeds a subsetted font without a ToUnicode map decodes to letters
// that are not the letters on the page. Northampton shipped a waypoint named
// "KDXCLKHHCRERLKLKUMJKKJDBKYBDSGACQBQJNALMFRJKHKJEQ" — 49 characters, one
// token, 10% vowels. No English place name looks like that, and the existing
// 58-character ceiling let it through.
export function isUndecodable(s) {
  const t = s.replace(/[^A-Za-z]/g, "")
  if (t.length < 12 || /\s/.test(s.trim())) return false
  const vowels = (t.match(/[aeiouy]/gi) ?? []).length
  return vowels / t.length < 0.2
}

// Acronyms and codes that must survive title-casing as they are. A hospital
// sheet is dense with them, and "A&e Reception" or "Male Wc" reads as a bug to
// anyone standing in the building.
const KEEP_UPPER = new Set([
  "A&E", "AAU", "AMU", "CCU", "CDU", "CT", "DVT", "EAU", "ECG", "ED", "EEG", "ENT",
  "EPU", "GF", "GP", "GUM", "HDU", "HIV", "ICU", "ITU", "IT", "LG", "MAU", "MIU",
  "MRI", "NHS", "NICU", "OPD", "PALS", "PICU", "SAU", "SCBU", "SDEC", "TIA", "TV",
  "UK", "US", "UTC", "WC", "X-RAY", "XR",
])
const KEEP_LOWER = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to"])

// Title-case a label the sheet set in capitals. 255 waypoints across the estate
// shout at the reader because the drawing did; the drawing had a typographic
// reason, a destination card does not. Mixed-case labels are left untouched —
// the trust chose that casing.
export function titleCaseLabel(s) {
  if (/[a-z]/.test(s)) return s
  const words = s.split(/(\s+)/)
  let wordIndex = -1
  return words
    .map((w) => {
      if (/^\s+$/.test(w)) return w
      wordIndex++
      // Split on internal punctuation so "REHABILITATION/PHYSIO" and
      // "MAXILLO-FACIAL" cap each part.
      return w
        .split(/([/\-–—&()])/)
        .map((part, i) => {
          if (!/[A-Za-z]/.test(part)) return part
          if (KEEP_UPPER.has(part.toUpperCase())) return part.toUpperCase()
          const lower = part.toLowerCase()
          if (wordIndex > 0 && i === 0 && KEEP_LOWER.has(lower)) return lower
          return lower.charAt(0).toUpperCase() + lower.slice(1)
        })
        .join("")
    })
    .join("")
}

// Wards and clinics on a single-sheet directory carry their storey in the label
// — "Allebone (Second Floor)", "FIRST FLOOR: Coronary Care Unit". The name is
// what someone reads on a destination card, so the storey comes out of it; it is
// returned separately rather than dropped, because it is the only record of
// which floor the place is actually on.
const STOREY_WORDS = {
  basement: -1, "lower ground": -1, ground: 0, first: 1, second: 2, third: 3,
  fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
}
const STOREY_PATTERNS = [
  /\s*[([]\s*((?:lower\s+)?[a-z]+)\s+floor\s*[)\]]\s*/i,   // "Allebone (Second Floor)"
  /^\s*((?:lower\s+)?[a-z]+)\s+floor\s*[:\-–]\s*/i,        // "FIRST FLOOR: Coronary Care"
  /\s*[-–,]\s*((?:lower\s+)?[a-z]+)\s+floor\s*$/i,         // "Coronary Care - First Floor"
]

export function splitStorey(s) {
  for (const re of STOREY_PATTERNS) {
    const m = s.match(re)
    if (!m) continue
    const word = m[1].toLowerCase().replace(/\s+/g, " ")
    if (!(word in STOREY_WORDS)) continue
    const name = s.replace(re, " ").replace(/\s+/g, " ").trim()
    // Never leave the label empty — "(Ground Floor)" alone is furniture, and the
    // NOISE list already drops it.
    if (name.length < 3) return { name: s, floor: null, storeyLabel: null }
    const pretty = word.charAt(0).toUpperCase() + word.slice(1)
    return { name, floor: STOREY_WORDS[word], storeyLabel: `${pretty} Floor` }
  }
  return { name: s, floor: null, storeyLabel: null }
}

export function wtype(name) {
  const n = name.toLowerCase()
  if (/\b(a&e|emergency dep|urgent (care|treatment)|utc)\b/.test(n)) return "department"
  if (/entrance|drop.?off|main door/.test(n)) return "exit"
  if (/pharmac/.test(n)) return "pharmacy"
  if (/restaurant|caf[eé]|dining|canteen|tea (bar|room)|coffee/.test(n)) return "canteen"
  if (/reception|info(rmation)? desk|main entrance/.test(n)) return "reception"
  if (/toilet|\bwc\b/.test(n)) return "toilet"
  if (/\bwards?\b/.test(n) && !/day unit|research/.test(n)) return "ward"
  if (/\blifts?\b/.test(n)) return "lift"
  // Stairs before the generic sweep. Every "STAIRWELL" on the estate was typed
  // "other", which meant routing with preference "fastest" could never consider
  // stairs even where the sheet had drawn twelve of them — the lifts beside them
  // were typed correctly, so the omission was invisible.
  if (/\bstair(s|well|way|case)?\b/.test(n)) return "stairs"
  if (/car park|parking/.test(n)) return "other"
  if (/clinic|imaging|x-ray|radiolog|theatre|outpatient|department|centre|center|unit|suite|medicine|radiotherapy|phlebotomy|patholog|therap|laborator|oncolog|maternit|neonat|surger|ophthal|audiolog|endoscopy|dialysis|renal|cardio|physio|building|wing|house|block|ward|lounge|hospital/.test(n)) return "department"
  return "other"
}

// The whole cleanup, in the order the rules have to run: normalise the text,
// reject what isn't a destination, then tidy what's left. Returns null for a
// label that should not become a waypoint.
export function cleanLabel(raw) {
  const s = despace(String(raw).replace(CTRL, "")).replace(/^[\s\-/·|]+|[\s\-/·|]+$/g, "").trim()
  if (s.length < 3 || s.length > 58) return null
  if (/^[a-z]/.test(s)) return null // broken fragment (real labels start upper/number)
  if ((s.match(/\(/g)?.length || 0) !== (s.match(/\)/g)?.length || 0)) return null // truncated
  if (isFurniture(s)) return null
  if (STREET.test(s) || STREET_GLUED.test(s)) return null
  if (NOISE.some((re) => re.test(s))) return null
  if (!/[a-z]/i.test(s)) return null
  if (singleCharRatio(s) > 0.4) return null
  if (isUndecodable(s)) return null

  const { name, floor, storeyLabel } = splitStorey(s)
  const text = titleCaseLabel(name)
  if (text.length < 3 || NOISE.some((re) => re.test(text))) return null
  return { text, type: wtype(text), floorFromLabel: floor, storeyLabel }
}
