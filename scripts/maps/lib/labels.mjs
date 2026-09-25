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

// Fraction of whitespace tokens that are a single letter — high means the
// label is decorative letter-spaced text (a street/title), not a destination.
// Only letters count: "Wards 3 & 4 — Green zone" is four one-character tokens
// out of seven and a perfectly good label.
export function singleCharRatio(s) {
  const toks = s.split(/\s+/)
  return toks.filter((t) => /^[A-Za-z]$/.test(t)).length / toks.length
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
  /^(ground|first|second|third|lower ground) floor$/i, /^floor \d/i,
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

  // --- Directory-table headings and CAD title blocks --------------------------
  // A single-sheet directory has column headings, and they arrive as text like
  // any other: North Tees shipped "Department / Ward", "Zone" and "Floor" as
  // three places to walk to, and Stratford "1st Floor" and "2nd Floor". A CAD
  // export carries its title block — the revision table, the sheet size, "NTS"
  // (not to scale) and the drawing code — and Wakefield's diagnostic-centre plan
  // shipped every line of it.
  /^(level|floor|zone|area|building|block|dept|departments?|wards?|clinics?|facilities|entrances|services|patient areas|staff areas|other services)$/i,
  /^(department|ward|clinic|dept)s?(\s*\/\s*(department|ward|clinic|dept)s?)+$/i,
  /^\d(st|nd|rd|th) floor:?$/i, /^all ground floor$/i,
  /^(lower ground|ground|first|second|third|fourth|fifth) floor:$/i,
  /^(lower ground|ground|first|second|third|fourth|fifth) floor key:?$/i, /\broundabout\b/i,
  /^level\s*-?\d+$/i,
  /^nts$/i, /^rev(ision)?\b.*\bdescription$/i, /^date\s*\/\s*sig/i, /^a[0-4] plan$/i,
  /^micad\b/i, /^drawing (no|number|title)/i, /^(drawn|checked|approved) by/i, /^sheet \d/i,
  /^[a-z]{1,3}-[a-z]{1,4}-(gf|ff|sf|lg|b\d?|\d{1,2})$/i, // "Wf-Cdc-GF": a drawing code
  /^unit \d+[a-z]?$/i, /^nhs (foundation )?trust$/i, /^the .* teaching$/i,

  // --- Route notes and traffic signs ---------------------------------------
  // Instructions for a driver, not places: "Exit Only", "Closed", "Drop off
  // route to A&E", "Ramp access to all Levels and exit to car park (P2)".
  /^closed$/i, /^(exit|access|deliver(y|ies)) only$/i, /^limited access/i,
  /^no vehicle/i, /^vehicle entry/i, /^(one way|give way|keep (left|right))$/i,
  /^ramp access/i, /^access via/i, /^drop.?off route/i, /^pay here/i,
  /\bfootpath$/i, /\bcorridor\b.*\bcorridor\b/i,

  // --- Off-site orientation -------------------------------------------------
  // The road you came in on, the park and ride, the bus stop by the gate.
  // Derriford shipped "A386 to Tavistock" and Pinderfields "Leeds Via M1" as
  // destinations inside the hospital.
  /\bpark\s*(&|and)\s*ride\b/i, /^[ab]\d{2,4}(\s+(to|towards)\b|$)/i, /\bbus stops?\b/i, /^&\s/,
  /\bvia (the )?[am]\d+\b/i,
]

// Text that is one token over and over is not a name. Ormskirk shipped "8 3 4
// Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh" — a column of "MH"
// (mental health) markers read as one string — and Hartlepool "Ward Ward Ward".
// Either a word repeats three times, or a long label is mostly one- and
// two-letter words. Numbers are exempt: "Wards 5, 6, 7 & 8" is a real label.
export function isRepetitive(s) {
  const toks = s.split(/\s+/)
  const counts = new Map()
  for (const t of toks) {
    const k = t.toLowerCase()
    if (k.length < 2 || !/[a-z]/i.test(k)) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
    if (counts.get(k) >= 3) return true
  }
  const short = toks.filter((t) => t.length <= 2 && /^[a-z]+$/i.test(t)).length
  return toks.length >= 4 && short / toks.length > 0.5
}

// Words the sheet's own font lost letters from. Pinderfields' PDF embeds a font
// whose "g" carries no Unicode mapping, so every g on the sheet vanished:
// "Accident and Emerency Entrance", "Visitors blue bade parkin". Only spellings
// actually seen on a sheet are listed — this is not a spellchecker, and a
// hospital name spelt unusually on purpose must stay as the trust spells it.
const SPELLING = [
  [/\bemerency\b/gi, "Emergency"], [/\bdermatoloy\b/gi, "Dermatology"],
  [/\bbuildin\b/gi, "Building"], [/\bparkin\b/gi, "Parking"], [/\bbade\b/gi, "Badge"],
  [/\bexcercise\b/gi, "Exercise"],
  // Addenbrooke's Level 3 sheet clips "A3 ward" at the page edge.
  [/\bwar$/i, "Ward"],
]
export function fixSpelling(s) {
  let out = s
  for (const [re, word] of SPELLING) {
    out = out.replace(re, (m) =>
      m === m.toLowerCase() ? word.toLowerCase() : m === m.toUpperCase() ? word.toUpperCase() : word
    )
  }
  return out
}

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
  "A&E", "AAU", "ACU", "AEC", "AMU", "CAU", "CCU", "CDC", "CDU", "CRIB", "CT", "DSU", "DVT",
  "DXA", "EAU", "ECG", "ED", "EEG", "ENT", "EPU", "GF", "GP", "GUM", "HASU", "HDU", "HIV",
  "ICU", "ITU", "IT", "KFC", "LG", "MAU", "MIU", "MRI", "NHS", "NICU", "OPD", "PALS",
  "PET", "PGME", "PICU", "PPCI", "RVS", "SAU", "SCBU", "SDEC", "SEAU", "SGUL", "TIA",
  "TSSU", "TV", "UK", "US", "UTC", "WC", "WRVS", "X-RAY", "XR",
])
// Brands and units the sheet writes in a casing of their own.
const SPELT = { whsmith: "WHSmith" }
// Two-letter acronyms that are safe to restore. "It", "Us", "Ed" and "On" are
// words far more often than they are acronyms, so only these are touched.
const TWO_LETTER = new Set(["CT", "GP", "WC", "XR"])

// Acronyms an earlier title-casing pass lowercased before they were in the
// list: "Acute Cardiology Unit (Acu)", "Kfc", "Dxa". A capitalised word whose
// upper-case form is a known acronym goes back to capitals; everything else is
// left as the trust wrote it.
export function fixAcronyms(s) {
  // An earlier title-casing pass wrote "a&E" for A&E wherever it was not the
  // first word ("Emergency a&E Entrance").
  s = s.replace(/\ba&e\b/gi, "A&E")
  return s.replace(/\b[A-Z][a-z]+\b/g, (w) => {
    const u = w.toUpperCase()
    if (u.length >= 3 && KEEP_UPPER.has(u)) return u
    if (TWO_LETTER.has(u)) return u
    return SPELT[w.toLowerCase()] ?? w
  })
}
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
          // Only a whole small word is lowercased: the "A" of "A&E" is not "a".
          if (wordIndex > 0 && i === 0 && KEEP_LOWER.has(lower) && part === w) return lower
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
const ORDINAL = ["ground", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"]
const STOREY_CODES = { gf: "ground", lg: "lower ground", lgf: "lower ground", ff: "first" }
const STOREY_PATTERNS = [
  /\s*[([]\s*((?:lower\s+)?[a-z]+)\s+floor\s*[)\]]\s*/i,   // "Allebone (Second Floor)"
  /^\s*((?:lower\s+)?[a-z]+)\s+floor\s*[:\-–—]\s*/i,       // "FIRST FLOOR: Coronary Care"
  /\s*[-–—,]\s*((?:lower\s+)?[a-z]+)\s+floor\s*$/i,        // "Coronary Care — First Floor"
  /^\s*(\d)(?:st|nd|rd|th)\s+fl(?:oor|\.)\s*:?\s*/i,        // "2nd Fl. Pharmacy & Pathology"
  /^\s*((?:lower\s+)?[a-z]+)\s+floor\s+(?=\S)/i,          // "Ground Floor Theatres"
  /\s+((?:lower\s+)?[a-z]+)\s+floor\s*$/i,                 // "Bone Infection Unit First Floor"
  /^\s*(gf|lg|lgf|ff)\b[\s:.-]*(?=\S)/i,                    // "GF A&E"
  /\s*[-–—,]?\s*\(?\s*(\d)(?:st|nd|rd|th)\s+floor\s*\)?\s*$/i, // "Clinic 4 (1st Floor)"
]
// Numbered levels: "Emergency Department Entrance (Level 2)", "Main Outpatients
// Level 6". A level number is not a floor index — Derriford's Level 6 is its
// main entrance and Lincoln's Level 2 its ground — so these carry the label and
// no index; the venue's floorNaming is what relates one to the other.
const LEVEL_PATTERNS = [
  /\s*\(\s*level\s*(-?\d+)\s*\)\s*/i,
  /\s+[-–—]?\s*level\s*(-?\d+)\s*$/i,
  /^\s*level\s*(-?\d+)\s*[:\-–—]?\s+/i,   // "Level 3 Reception"
]
// "Stairs to First Floor" names where the stairs go, not where they are;
// taking the storey off would leave "Stairs to".
const DANGLING = /\b(to|from|via|for|and|or|of|the|on|in|at|by|with|&)$/i

export function splitStorey(s) {
  for (const re of STOREY_PATTERNS) {
    const m = s.match(re)
    if (!m) continue
    const code = m[1].toLowerCase().replace(/\s+/g, " ")
    const word = /^\d$/.test(code) ? ORDINAL[Number(code)] : (STOREY_CODES[code] ?? code)
    if (!word || !(word in STOREY_WORDS)) continue
    const name = s.replace(re, " ").replace(/\s+/g, " ").trim()
    // Never leave the label empty — "(Ground Floor)" alone is furniture, and the
    // NOISE list already drops it.
    if (name.length < 3 || DANGLING.test(name)) return { name: s, floor: null, storeyLabel: null }
    const pretty = word.charAt(0).toUpperCase() + word.slice(1)
    return { name, floor: STOREY_WORDS[word], storeyLabel: `${pretty} Floor` }
  }
  for (const re of LEVEL_PATTERNS) {
    const m = s.match(re)
    if (!m) continue
    const name = s.replace(re, " ").replace(/\s+/g, " ").trim()
    if (name.length < 3 || DANGLING.test(name)) return { name: s, floor: null, storeyLabel: null }
    return { name, floor: null, storeyLabel: `Level ${m[1]}` }
  }
  return { name: s, floor: null, storeyLabel: null }
}

// Neighbouring ward captions read as one label: St George's shipped "Cavell
// Ward Gunning Ward Keate Ward Major Trauma Ward" and Lister "Ward 6b Renal
// Ward 7a Vascular Ward 7b". Split when every piece is short enough to be one
// ward's name. "Gray Ward Vascular Laboratory Vernon Ward" is left alone: "Vascular
// Laboratory Vernon" is two places, and nothing here can tell where one ends.
// Returns the pieces, or null when the label is one place.
export function splitWards(name) {
  // "Ward 6b Renal Ward 7a Vascular Ward 7b": the code leads, the specialty follows.
  const coded = [...name.matchAll(/\bWard\s+\d+[a-z]?\b/gi)]
  if (coded.length >= 2 && coded[0].index === 0) {
    const parts = []
    for (let i = 0; i < coded.length; i++) {
      const end = i + 1 < coded.length ? coded[i + 1].index : name.length
      const piece = name.slice(coded[i].index, end).trim()
      const rest = piece.replace(/^Ward\s+\d+[a-z]?\b/i, "").trim()
      if (rest && rest.split(/\s+/).length > 2) return null
      parts.push(piece)
    }
    return parts
  }
  // "Cavell Ward Gunning Ward Keate Ward Major Trauma Ward": the name leads.
  const named = name.split(/\bWard\b/)
  if (named.length < 2) return null
  const tail = named.pop().trim()
  const parts = []
  for (const piece of named) {
    const words = piece.trim().split(/\s+/).filter(Boolean)
    if (words.length < 1 || words.length > 2) return null
    parts.push(`${words.join(" ")} Ward`)
  }
  // A tail is a place of its own only when it reads as one: "Hyper Acute
  // Stroke Unit", not "3 and 4" (a ward range) or "/ IVF" (the same ward).
  if (tail) {
    if (/^[^A-Za-z0-9]/.test(tail)) return null
    const words = tail.split(/\s+/).filter((w) => /[a-z]/i.test(w))
    if (words.length < 2 || words.length > 4) return null
    if (!/\b(unit|clinic|centre|center|department|suite|ward|reception|theatres?|lounge|area|rooms?|office|services?|desk|entrance|imaging|x-ray|laboratory|pharmacy|caf[eé]|restaurant|toilets?)\b/i.test(tail)) return null
    parts.push(tail)
  }
  return parts.length >= 2 ? parts : null
}

export function wtype(name) {
  const n = name.toLowerCase()
  if (/\b(a&e|emergency dep|urgent (care|treatment)|utc)\b/.test(n)) return "department"
  if (/entrance|drop.?off|main door|^exit\b|(?<!car park )\bexit$|main gate|^gate\b(?!\s*house)/.test(n)) return "exit"
  if (/pharmac/.test(n)) return "pharmacy"
  // A shop is where a visitor buys water and a paper; it has no type of its own,
  // and "canteen" is the one people look under.
  if (/restaurant|caf[eé]|dining|canteen|tea (bar|room)|coffee|costa|starbucks|greggs|wh ?smith|m&s|\bshop\b|kiosk|league of friends|\bw?rvs\b/.test(n)) return "canteen"
  if (/reception|info(rmation)? (desk|point)|^information$|^enquiries|help desk|front desk|welcome desk|main entrance/.test(n)) return "reception"
  if (/toilet|\bwcs?\b|baby chang|changing places|washroom/.test(n)) return "toilet"
  if (/\bwards?\b/.test(n) && !/day unit|research/.test(n)) return "ward"
  if (/\blifts?\b/.test(n)) return "lift"
  // Stairs before the generic sweep. Every "STAIRWELL" on the estate was typed
  // "other", which meant routing with preference "fastest" could never consider
  // stairs even where the sheet had drawn twelve of them — the lifts beside them
  // were typed correctly, so the omission was invisible.
  if (/\bstair(s|well|way|case)?\b|escalator/.test(n)) return "stairs"
  if (/car park|parking/.test(n)) return "other"
  if (/clinic|imaging|x-ray|radiolog|theatre|outpatient|department|centre|center|unit|suite|medicine|radiotherapy|phlebotomy|patholog|therap|laborator|oncolog|maternit|neonat|surger|ophthal|audiolog|endoscopy|dialysis|renal|cardio|physio|building|wing|house|block|ward|lounge|hospital/.test(n)) return "department"
  return "other"
}

// The whole cleanup, in the order the rules have to run: normalise the text,
// reject what isn't a destination, then tidy what's left. Returns null for a
// label that should not become a waypoint.
// A label that is nothing but a bracket — "(PALS)", "(Adult)", "(via YELLOW
// ROUTE)" — is the tail of a neighbouring caption that the extractor read on its
// own. An acronym is worth keeping as a destination in its own right (PALS is
// what people ask for at the desk), and so is a bracket that names a place
// ("(Maternity Triage)"); a stray word is not. Returns the text to keep, or
// null.
const isAcronym = (t) => KEEP_UPPER.has(t.toUpperCase()) || (t.length <= 4 && t === t.toUpperCase() && /[A-Z]/.test(t))
// How a bracketed continuation of the previous label begins.
const CONTINUATION = /^(new|old|main|via|including|incl|level|adult|right|left|from|to|and|or|see|formerly|non)\b/i
function unwrap(s) {
  const m = s.match(/^\(\s*(.+?)\s*\)$/)
  if (!m) return s
  const inner = m[1]
  const toks = inner.split(/[\s,/&]+|\band\b/).filter(Boolean)
  if (toks.length && toks.every(isAcronym)) {
    return toks.length === 1 && !KEEP_UPPER.has(toks[0].toUpperCase()) ? null : inner
  }
  if (!CONTINUATION.test(inner) && wtype(inner) !== "other") return inner
  return null
}

export function cleanLabel(raw) {
  const s0 = despace(String(raw).replace(CTRL, ""))
    .replace(/^[\s\-/·|]+|[\s\-/·|£$€*]+$/g, "")
    .replace(/^stop [a-z]{1,2}\s+(?=[A-Z])/i, "") // "Stop N Main entrance": the bus stop's letter
    .trim()
  if (s0.length < 3 || s0.length > 58) return null
  if (/^[a-z]/.test(s0)) return null // broken fragment (real labels start upper/number)
  if ((s0.match(/\(/g)?.length || 0) !== (s0.match(/\)/g)?.length || 0)) return null // truncated
  const s = unwrap(s0)
  if (!s) return null
  // "9 (1st floor) 10 (2nd floor ) 11 (3rd floor )": a row of the directory
  // table with nothing left once the storeys are set aside.
  if (!/[a-z]/i.test(s.replace(/\([^)]*\)/g, ""))) return null
  if (isFurniture(s)) return null
  if (STREET.test(s) || STREET_GLUED.test(s)) return null
  if (NOISE.some((re) => re.test(s))) return null
  // "Wards / on", "Lifts to": the first half of a caption whose second half
  // went to another label.
  if (DANGLING.test(s)) return null
  if (singleCharRatio(s) > 0.4) return null
  if (isUndecodable(s)) return null
  if (isRepetitive(s)) return null

  const { name, floor, storeyLabel } = splitStorey(s)
  const text = fixSpelling(fixAcronyms(titleCaseLabel(name)))
  if (text.length < 3 || NOISE.some((re) => re.test(text))) return null
  return { text, type: wtype(text), floorFromLabel: floor, storeyLabel }
}
