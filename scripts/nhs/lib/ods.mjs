// NHS Organisation Data Service (ODS) bulk extracts.
//
// ODS publishes the authoritative register of NHS organisations as headerless,
// fixed-position CSVs inside zips, refreshed monthly. Because there is no header
// row there is nothing in the file itself to catch a layout change — if ODS ever
// inserts a column, a positional read keeps "working" and quietly writes address
// lines into the postcode field. So the column map is written down here, and
// every parse asserts the shape before trusting it.
//
// Licence: ODS data is published under the Open Government Licence v3.0.
// Attribution is required when the data is redistributed; see data/README.md.
//
// Column reference (1-based, as the ODS data dictionary numbers them):
//    1 Organisation Code          10 Postcode              15 Parent Organisation Code
//    2 Name                       11 Open Date             16 Join Parent Date
//    3 National Grouping          12 Close Date            17 Left Parent Date
//    4 High Level Health Geog.    13 Status Code           18 Contact Telephone
//    5 Address Line 1             14 Organisation Sub-Type 22 Amended Record Indicator
//  6-9 Address Lines 2-5
export const ODS_COL = {
  code: 0,
  name: 1,
  nationalGrouping: 2,
  healthGeography: 3,
  address1: 4,
  address2: 5,
  address3: 6,
  address4: 7,
  address5: 8,
  postcode: 9,
  openDate: 10,
  closeDate: 11,
  statusCode: 12,
  subType: 13,
  parentCode: 14,
}

// The published layout. Rows are allowed to be shorter (trailing empty fields
// are often omitted) but the modal width is checked against this so a genuine
// layout change fails the run instead of corrupting the output.
export const ODS_EXPECTED_FIELDS = 27

// Highest index we actually read — any row narrower than this can't be trusted.
const MIN_FIELDS = ODS_COL.parentCode + 1

// The bulk files we consume. `ets` is the one that matters most: it is the
// register of individual hospital SITES, which is what a wayfinding app needs —
// `etr` is trust-level (a legal entity, often spread over many sites).
export const ODS_SOURCES = {
  etr: {
    url: "https://files.digital.nhs.uk/assets/ods/current/etr.zip",
    description: "NHS Trusts (England)",
  },
  ets: {
    url: "https://files.digital.nhs.uk/assets/ods/current/ets.zip",
    description: "NHS Trust Sites (England)",
  },
  // Not consumed by the venue build yet, but fetched so the estate beyond
  // hospitals is available without another round-trip to CI.
  epraccur: {
    url: "https://files.digital.nhs.uk/assets/ods/current/epraccur.zip",
    description: "GP Practices (England and Wales)",
    optional: true,
  },
}

// ODS stores names and addresses in upper case. Lower-casing wholesale would
// wreck the acronyms these names are full of (NHS, QEII, A&E), so only words
// that look like ordinary words are recased and known upper-case tokens are
// left alone.
//
// This list is not exhaustive and can't be — the estate contains every clinical
// acronym going (ENT, ITU, HMP…) and there is no rule that separates them from
// ordinary words without also mangling "ST" into "ST" instead of "St". A missed
// acronym costs a slightly odd-looking label, which is the right way for this to
// fail; add to the list as real examples turn up.
const KEEP_UPPER = /^(NHS|UK|GP|HQ|A&E|ENT|ITU|HMP|II|III|IV|VI|VII|IX|XI|[A-Z]&[A-Z]|[A-Z]{1,3}\d+[A-Z]?)$/
const LOWER_WORDS = new Set(["and", "of", "the", "for", "at", "in", "on", "upon", "de", "le"])

// Hyphens, slashes and brackets start a new word; an apostrophe does NOT —
// otherwise ST MARY'S becomes "Mary'S".
const WORD_BREAK = /([-/()])/

function titleCase(s) {
  let isFirst = true
  return s
    .split(/\s+/)
    .map((word) => {
      if (!word) return word
      return word
        .split(WORD_BREAK)
        .map((part) => {
          if (!part) return part
          if (WORD_BREAK.test(part) && part.length === 1) return part
          if (KEEP_UPPER.test(part)) { isFirst = false; return part }
          const lower = part.toLowerCase()
          // "and", "on", "of" stay lower-case mid-name (Stoke-on-Trent, Guy's
          // and St Thomas') but are capitalised if the name opens with them.
          const recased = !isFirst && LOWER_WORDS.has(lower)
            ? lower
            : lower.charAt(0).toUpperCase() + lower.slice(1)
          isFirst = false
          return recased
        })
        .join("")
    })
    .join(" ")
}

// An ODS record is "open" when it has no close date and its status isn't closed.
// Closed sites still ship in the extract, and routing someone to a demolished
// hospital is exactly the failure this app exists to prevent.
function isOpen(row) {
  const closeDate = (row[ODS_COL.closeDate] ?? "").trim()
  const status = (row[ODS_COL.statusCode] ?? "").trim().toUpperCase()
  return !closeDate && status !== "C"
}

export function parseOdsRows(rows, { sourceName }) {
  // Check the layout before reading anything positionally.
  const widths = new Map()
  for (const r of rows) widths.set(r.length, (widths.get(r.length) ?? 0) + 1)
  const modal = [...widths.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
  if (modal !== ODS_EXPECTED_FIELDS) {
    throw new Error(
      `${sourceName}: expected ${ODS_EXPECTED_FIELDS} fields per row but the commonest width is ${modal}. ` +
        `The ODS layout has probably changed — re-check the data dictionary and update ODS_COL in scripts/nhs/lib/ods.mjs.`
    )
  }

  const records = []
  const skipped = { short: 0, closed: 0, noPostcode: 0 }
  for (const row of rows) {
    if (row.length < MIN_FIELDS) { skipped.short++; continue }
    if (!isOpen(row)) { skipped.closed++; continue }

    const postcode = (row[ODS_COL.postcode] ?? "").trim().toUpperCase()
    if (!postcode) { skipped.noPostcode++; continue }

    const address = [ODS_COL.address1, ODS_COL.address2, ODS_COL.address3, ODS_COL.address4, ODS_COL.address5]
      .map((i) => (row[i] ?? "").trim())
      .filter(Boolean)
      .map(titleCase)

    records.push({
      odsCode: (row[ODS_COL.code] ?? "").trim().toUpperCase(),
      name: titleCase((row[ODS_COL.name] ?? "").trim()),
      address,
      postcode: normalisePostcode(postcode),
      parentCode: (row[ODS_COL.parentCode] ?? "").trim().toUpperCase() || null,
      openDate: (row[ODS_COL.openDate] ?? "").trim() || null,
    })
  }
  return { records, skipped }
}

// Canonical UK postcode spacing: postcodes.io and ONS both key on the spaced
// form, and ODS is inconsistent about whether the space is present.
export function normalisePostcode(pc) {
  const compact = pc.replace(/\s+/g, "").toUpperCase()
  if (compact.length < 5 || compact.length > 7) return pc.trim().toUpperCase()
  return `${compact.slice(0, compact.length - 3)} ${compact.slice(-3)}`
}

// Sites whose name makes clear they are not a place a member of the public
// would ever navigate to. ODS "sites" include administrative registrations —
// finance offices, mailrooms, mobile units — which would otherwise become map
// pins claiming to be hospitals.
const NON_PUBLIC_SITE = new RegExp(
  [
    "\\b(hq|head ?office|headquarters)\\b",
    "\\b(finance|payroll|procurement|estates|it services|archive|store|stores|warehouse|depot|laundry|mortuary)\\b",
    "\\b(mobile|temporary|decommissioned|do not use|not in use|dummy|test)\\b",
    "\\bpost ?box\\b",
    "\\b(trust )?board\\b",
  ].join("|"),
  "i"
)

export function looksPublicFacing(name) {
  return !NON_PUBLIC_SITE.test(name)
}
