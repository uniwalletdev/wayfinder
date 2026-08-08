// Read a storey out of a map sheet's filename.
//
// Trusts publish a hospital's levels as separate PDFs and say which is which
// only in the filename. Four conventions cover everything the crawl has found:
//
//   pah-c-level-floor-plan.pdf                 a lettered level  (Southampton)
//   lincoln-hospital-map-level-1.pdf           a numbered level  (Lincoln)
//   southend-hospital-ground-floor-map.pdf     a named storey    (Southend)
//   site-2025-05-05-mdgh-first-floor.pdf       a named storey    (Macclesfield)
//
// Returns { floor, label } or null. `floor` is the storey number the venue
// routes on; `label` is what a person reading a lift panel would see, which is
// not always the same thing — Southampton's levels are lettered A upward, so
// Level C is storey 2 and calling it "Floor 2" to a visitor would be wrong.

// Named storeys. Basement is negative so a lift panel's order and the storey
// numbers agree.
const NAMED = new Map([
  ["basement", { floor: -1, label: "Basement" }],
  ["lower ground", { floor: -1, label: "Lower Ground Floor" }],
  ["ground", { floor: 0, label: "Ground Floor" }],
  ["first", { floor: 1, label: "First Floor" }],
  ["second", { floor: 2, label: "Second Floor" }],
  ["third", { floor: 3, label: "Third Floor" }],
  ["fourth", { floor: 4, label: "Fourth Floor" }],
  ["fifth", { floor: 5, label: "Fifth Floor" }],
])

// Lettered levels, A upward. There is no I — Southampton skips it, as lifts
// generally do, because I and 1 are hard to tell apart on a button.
const LETTERS = "abcdefghjklmnop"

export function floorFromSlug(slug) {
  const text = String(slug ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  if (!text) return null

  // "lower ground" before "ground", or the longer name never matches.
  for (const [word, floor] of NAMED) {
    if (new RegExp(`\\b${word}\\b(?=[a-z0-9 ]*\\bfloor\\b)|\\bfloor\\b[a-z0-9 ]*\\b${word}\\b`).test(text)) return { ...floor }
  }

  // "level 1", "level-3", "floor 2".
  const numbered = text.match(/\b(?:level|floor)\s+(\d{1,2})\b/) ?? text.match(/\b(\d{1,2})\s+(?:level|floor)\b/)
  if (numbered) {
    const n = Number(numbered[1])
    // A four-digit year already failed the \d{1,2} guard; this catches a stray
    // "level 30" in a document number rather than a real storey.
    if (n <= 20) return { floor: n, label: `Level ${n}` }
  }

  // "c level", "level c", "a floor" — a single letter next to "level" or
  // "floor". Sheffield Children's writes hospital-map-a-floor where Southampton
  // writes pah-c-level. The named storeys are matched above, so "ground floor"
  // can never reach this and be read as the letter G.
  const lettered =
    text.match(/\b([a-z])\s+(?:level|floor)\b/) ?? text.match(/\b(?:level|floor)\s+([a-z])\b/)
  if (lettered) {
    const index = LETTERS.indexOf(lettered[1])
    if (index >= 0) return { floor: index, label: `Level ${lettered[1].toUpperCase()}` }
  }

  return null
}

// Do these sheets differ ONLY by their storey?
//
// Two sheets of one hospital are floors of one building rather than two separate
// maps when what is left of each filename, after the storey words come out, is
// the same. "internal-site-map-north-tees" and "external-site-map-north-tees"
// are NOT floors of each other — they are two views of the same site — and this
// is what tells them apart.
export function stemWithoutFloor(slug) {
  return String(slug ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:lower ground|basement|ground|first|second|third|fourth|fifth)\b/g, " ")
    .replace(/\b(?:level|floor)s?\b/g, " ")
    .replace(/\b[a-z]\b/g, " ")
    .replace(/\b\d{1,2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
