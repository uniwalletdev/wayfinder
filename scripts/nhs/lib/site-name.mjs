// Which words in a hospital's name actually identify it.
//
// Matching a sheet to an ODS record compares bags of words, and almost every
// word in an NHS site name is shared with every other NHS site name. "Dewsbury
// & District Hospital-Combined Elective Surgical Hub" and "Pinderfields
// Hospital" have "hospital" in common and nothing else — but "any shared word"
// was enough to accept the match, so a map of Pinderfields shipped under the
// Dewsbury name, at Dewsbury's coordinates, ten miles from the building it
// draws.
//
// What separates those two names is "dewsbury" and "pinderfields": the place.
// Everything else is the vocabulary of the health service.

// Words that appear in so many NHS site names that sharing one proves nothing.
// Deliberately generous — a name reduced to nothing by this list falls back to
// its full token set rather than matching everything (see identifyingTokens).
const GENERIC = new Set([
  "nhs", "trust", "foundation", "hospital", "hospitals", "infirmary", "clinic",
  "clinics", "centre", "center", "health", "healthcare", "care", "medical",
  "university", "teaching", "general", "district", "community", "regional",
  "county", "royal", "national", "site", "campus", "unit", "units", "ward",
  "wards", "service", "services", "department", "departments", "elective",
  "surgical", "surgery", "hub", "combined", "diagnostic", "treatment",
  "outpatient", "outpatients", "acute", "virtual", "and", "the", "of", "at",
  "for", "&",
])

function words(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

// The tokens that name the *place*. Falls back to every token when a name is
// made entirely of generic words ("Community Diagnostic Centre"), because a
// name that identifies nothing must not become a filter that accepts anything.
export function identifyingTokens(name) {
  const all = words(name)
  const distinctive = all.filter((w) => !GENERIC.has(w) && w.length > 2)
  return new Set(distinctive.length ? distinctive : all)
}

// Specialty qualifiers ODS attaches to a site record, which the sheet's own
// title never carries: "Immunology - Derriford Hospital", "Uh North Tees
// Dermatology", "The Maidstone Hospital - General Surgery". Reported rather
// than stripped automatically — a genuinely specialist hospital (an eye
// hospital, an orthopaedic centre) reads the same way, and losing its specialty
// would be the same class of error in the other direction.
const SPECIALTY = /\b(immunology|dermatology|anaesthetics|haematology|virology|microbiology|cardiology|neurology|oncology|radiology|pathology|urology|rheumatology|endocrinology|gastroenterology|sexual health|pain)\b/i

export function looksSpecialtyQualified(name) {
  const s = String(name ?? "")
  // A leading or trailing qualifier around a site name, or an "Elective
  // Surgical Hub"-style suffix bolted onto one.
  // The qualifier sits at one end of the record name, wrapped around the site:
  // "Immunology - Derriford Hospital", "Uh North Tees Dermatology". A specialty
  // word in the middle of a name is usually part of the place's real title.
  const atAnEnd = new RegExp(`(^\\s*${SPECIALTY.source}\\b)|(\\b${SPECIALTY.source}\\s*\\)?\\s*$)`, "i").test(s)
  return (
    (SPECIALTY.test(s) && (atAnEnd || /\b(hospital|infirmary|centre|center)\b/i.test(s))) ||
    /\s[-–]\s(general surgery|general|anaesthetics)\b/i.test(s) ||
    /\belective surgical hub\b/i.test(s)
  )
}
