// Which hospitals already ship as fully-mapped venues.
//
// The directory of located-only NHS pins must not duplicate a site that already
// has a real interior venue — two pins for Great Ormond Street, one of which
// can't be navigated, is worse than one.
//
// Until now that exclusion lived as PROSE in the header comment of
// nhs-hospitals-data.ts ("GOSH, St George's and Addenbrooke's are omitted
// here…"), which a human had to read and hand-apply. That does not survive going
// from 721 rows to the full national estate. This reads the venue modules
// themselves, so adding a mapped venue automatically removes its directory pin
// and nobody has to remember to edit a comment.
import { readdirSync, readFileSync } from "fs"
import { repoPath, dataPath, readJson } from "./paths.mjs"
import { nameTokens, DOCUMENT_STOPWORDS } from "./match.mjs"

const VENUE_DIR = repoPath("src", "lib", "venues")

// Not venue modules: the registry, the directory data this pipeline writes, and
// the generated barrel that re-exports auto-built sheet venues (the venues
// themselves are separate modules in this directory and are scanned normally).
const NOT_A_VENUE = new Set([
  "index.ts",
  "nhs-hospitals.ts",
  "nhs-hospitals-data.ts",
  "generated-sheets.ts",
])

// Venue modules are either hand-written or generated, but all of them declare
// the same three fields in the same shape near the top of the object literal.
const SLUG_RE = /^\s*slug:\s*"([^"]+)"/m
const NAME_RE = /^\s*name:\s*"((?:[^"\\]|\\.)*)"/m
const CENTER_RE = /^\s*center:\s*\{\s*lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)\s*\}/m

export function readMappedVenues() {
  const files = readdirSync(VENUE_DIR).filter((f) => f.endsWith(".ts") && !NOT_A_VENUE.has(f))
  const venues = []
  for (const file of files) {
    const src = readFileSync(repoPath("src", "lib", "venues", file), "utf8")
    const slug = SLUG_RE.exec(src)?.[1]
    const name = NAME_RE.exec(src)?.[1]
    const center = CENTER_RE.exec(src)
    if (!slug || !center) {
      throw new Error(
        `src/lib/venues/${file} doesn't expose a slug and center in the expected shape. ` +
          `If the venue format changed, update the patterns in scripts/nhs/lib/mapped.mjs — ` +
          `silently skipping it would put a duplicate pin on the map.`
      )
    }
    venues.push({
      file,
      slug,
      name: name?.replace(/\\"/g, '"') ?? slug,
      lat: Number(center[1]),
      lng: Number(center[2]),
    })
  }
  if (!venues.length) throw new Error(`no venue modules found in ${VENUE_DIR}`)
  return venues
}

// Every name a shipping venue answers to: the name in its module, plus whatever
// data/venue-aliases.json records. Aliases exist because a venue called "GOSH
// Wayfinder" shares no words with "Great Ormond Street Hospital For Children",
// and a campus venue stands for several hospitals at once.
//
// An alias is either a bare string, or {name, trustCode} when the name alone is
// not enough. "Queen Mary's Hospital" is St George's in Roehampton and Oxleas'
// in Sidcup — one is mapped and one is not, and no amount of name matching
// separates them. Scoping the alias to the trust that owns the mapped one does.
export function mappedVenueNames(venues = readMappedVenues()) {
  const aliases = readJson(dataPath("venue-aliases.json"), { aliases: {} }).aliases ?? {}
  return venues.map((venue) => ({
    ...venue,
    names: [venue.name, ...(aliases[venue.slug] ?? [])].map((alias) =>
      typeof alias === "string" ? { name: alias } : alias
    ),
  }))
}

// Is this document a map of a hospital that already ships as a full venue?
//
// The crawl finds maps for hospitals that were mapped by hand long before it
// ran — Wythenshawe publishes a 3D version of the sheet already built, and
// Birmingham Women's publishes its own alongside the Clinical Genetics one. Left
// alone, approve-plans would take those too and the app would carry two venues
// for one hospital: two pins, two sets of waypoints, and no way for a visitor to
// tell which is the real one. Worse than either alone.
//
// The test is containment of the VENUE's name, not similarity between the two.
// Every distinctive word of the venue has to appear in the document, so
// "Wythenshawe Hospital" matches "wythenshawe-hospital-sitemap-3D.pdf" while
// "North Manchester General Hospital" does not match "north-devon-2d-map.pdf" —
// sharing one word out of two is how a Hull map gets refused for looking like a
// Manchester one. Similarity scored the other way round (shared / smaller set)
// made every short venue name match promiscuously: it refused North Devon,
// Chelsea and Westminster, Hull Royal Infirmary and Rotherham, none of which are
// mapped.
//
// Where a venue's own name is more specific than the document's — "Basildon &
// Thurrock University Hospital" against "basildon-hospital-map" — the alias list
// is the place to record the shorter form, rather than loosening the rule for
// everything.
export function mappedVenueFor(text, venues = mappedVenueNames(), trustCode = null) {
  const documentTokens = nameTokens(text, DOCUMENT_STOPWORDS)
  if (!documentTokens.size) return null
  for (const venue of venues) {
    for (const alias of venue.names) {
      // A trust-scoped alias speaks only for that trust's documents. Applying it
      // to another trust's is how a hospital that merely shares a name with a
      // mapped one gets refused.
      if (alias.trustCode && alias.trustCode !== trustCode) continue
      const venueTokens = nameTokens(alias.name, DOCUMENT_STOPWORDS)
      // A name that reduces to nothing distinctive ("The Hospital") would
      // otherwise be contained in every document and refuse the lot.
      if (!venueTokens.size) continue
      // One word is only enough when the alias also says which trust. "The Royal
      // London Hospital" reduces to "london", which is in the name of a great
      // many hospitals — unscoped, it refused Evelina London's map. Two-word
      // names ("Mile End", "King George") carry their own specificity; one-word
      // ones have to borrow it from the trust.
      if (venueTokens.size < 2 && !alias.trustCode) continue
      let contained = true
      for (const token of venueTokens) {
        if (!documentTokens.has(token)) { contained = false; break }
      }
      if (contained) return { slug: venue.slug, matchedName: alias.name }
    }
  }
  return null
}
