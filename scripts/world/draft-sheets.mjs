// Work out where each downloaded world map sheet belongs, and reject the ones
// that aren't usable maps. World equivalent of scripts/nhs/draft-sheets.mjs —
// read that file's header first; this one only explains where it differs.
//
// The NHS version spends most of its length on a problem that doesn't exist
// here: an NHS trust runs several hospitals, so a sheet found on the trust's
// website could be a map of any of them, and most of draft-sheets.mjs is the
// disambiguation (abbreviations, cross-trust aliases, token-overlap scoring).
// A world candidate already carries hospitalCode/hospitalName directly — the
// crawl in discover-plans.mjs visited that ONE hospital's own site, so there
// is no "which of this trust's hospitals" question to answer. What remains is
// genuinely simpler: place the sheet at a known hospital's known coordinates,
// run the same PDF quality gates, and group multi-floor sheets.
//
// Known simplification: NHS placement gets its scale (spanM) from an OSM
// building-footprint fetch keyed by ODS code (scripts/nhs/fetch-osm.mjs). That
// doesn't exist for world hospitals yet, so every world venue uses the same
// DEFAULT_SPAN_M estimate NHS falls back to when it has no footprint either —
// honestly labelled as estimated, not pretending to be measured.
//
// Run: node scripts/world/draft-sheets.mjs [--country US] [--force]
import { existsSync } from "fs"
import { extractLabels } from "../maps/extract.mjs"
import { nameTokens, documentContainment, DOCUMENT_STOPWORDS } from "../nhs/lib/match.mjs"
import { floorFromSlug, stemWithoutFloor } from "../nhs/lib/floors.mjs"
import { dataPath, repoPath, readJson, writeJson, log } from "../nhs/lib/paths.mjs"

const STAGE = "world-draft-sheets"
const FORCE = process.argv.includes("--force")
const countryArg = process.argv.indexOf("--country")
const COUNTRIES = countryArg > -1 ? [process.argv[countryArg + 1].toUpperCase()] : ["US", "CA", "AU", "IE"]

// Same thresholds as NHS — these gate on the PDF's own shape (page aspect,
// label count), which has nothing to do with which country published it.
const MIN_WAYPOINTS = 8
const MAX_ASPECT = 2.0
const DEFAULT_SPAN_M = 450

// Must match src/lib/venues/world-hospitals.ts's COUNTRY_NAMES — kept as a
// separate small copy rather than a shared import across the script/app
// boundary, which nothing else here crosses.
const COUNTRY_NAMES = { US: "United States", CA: "Canada", AU: "Australia", IE: "Ireland" }

const tokens = (s) => nameTokens(s, DOCUMENT_STOPWORDS)
const contains = documentContainment
const plainName = (s) => String(s).toLowerCase().replace(/['‘’]/g, "").replace(/[^a-z0-9]+/g, " ").trim()

const QUICK_PRIORITY = /^(main entrance|entrance|a&e|accident|emergency|reception|outpatients|urgent (care|treatment))/i
function pickQuick(labels) {
  const seen = new Set()
  const ordered = [...labels.filter((l) => QUICK_PRIORITY.test(l.text)), ...labels.filter((l) => !QUICK_PRIORITY.test(l.text))]
  const out = []
  for (const l of ordered) {
    const key = l.text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(l.text)
    if (out.length === 5) break
  }
  return out
}

const sheetsPath = dataPath("world", "mapped-sites.json")
const sheetsDoc = readJson(sheetsPath, { sheets: [] })
const rejectedDoc = readJson(dataPath("world", "plan-rejected.json"), { rejections: [] })
rejectedDoc.generatedAt = new Date().toISOString()
// Only replace rejections for the countries this run actually looked at —
// otherwise a `--country IE` run would erase AU/CA/US's rejection history.
rejectedDoc.rejections = rejectedDoc.rejections.filter((r) => !COUNTRIES.includes(r.countryCode))

const alreadyDrafted = new Set(sheetsDoc.sheets.map((s) => s.slug))
const drafted = []

for (const countryCode of COUNTRIES) {
  const sourcesDoc = readJson(dataPath("world", `plan-sources-${countryCode.toLowerCase()}.json`), { sources: [] })
  const hospitalsDoc = readJson(dataPath("world", `hospitals-${countryCode.toLowerCase()}.json`))
  if (!hospitalsDoc) {
    log(STAGE, `${countryCode}: no hospitals-${countryCode.toLowerCase()}.json — skipping`)
    continue
  }
  const hospitalsByCode = new Map(hospitalsDoc.hospitals.map((h) => [h.code, h]))

  // Index for cross-hospital reassignment (see below): every hospital in this
  // country, by its name tokens. Built once per country rather than per
  // candidate — up to 6,461 entries for the US, scanned against ~100 candidates,
  // not worth repeating.
  const hospitalIndex = hospitalsDoc.hospitals
    .map((h) => ({ hospital: h, tokens: tokens(h.name) }))
    .filter((h) => h.tokens.size > 0)

  // How many DIFFERENT hospitals in this country share each name token —
  // needed because a full-containment match alone is not enough evidence. A
  // hospital literally named "General Hospital Campus" reduces to {general,
  // campus}, and a huge fraction of real sheets' own link text is generically
  // "Campus Map" / "Download Campus Map" — so without this, dozens of
  // completely unrelated hospitals' sheets all matched "General Hospital
  // Campus" and got reassigned to it. A reassignment needs at least one token
  // that is actually distinctive — shared by only a handful of hospitals
  // nationally, like "auburn" or "heidelberg" — not just a token that happens
  // to be a common hospital-naming word.
  const tokenFrequency = new Map()
  for (const { tokens: t } of hospitalIndex) {
    for (const token of t) tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1)
  }
  const DISTINCTIVE_MAX = 3
  // A second, narrower false-positive: multi-language hospital sites link to
  // "Chinese (Traditional)" or "French" as a language choice, not a hospital
  // name — and real (if unrelated) hospitals named "Chinese Hospital" and
  // "French Hospital" exist, so those tokens pass the frequency filter above
  // on their own merit. A short blocklist beats trying to generalise "is this
  // token a language name" from frequency alone.
  const LANGUAGE_NAMES = new Set([
    "english", "spanish", "chinese", "french", "vietnamese", "korean", "russian",
    "arabic", "tagalog", "somali", "hmong", "portuguese", "haitian", "creole",
    "japanese", "german", "italian", "polish", "farsi", "urdu", "punjabi",
  ])
  const isDistinctive = (t) =>
    [...t].some((token) => !LANGUAGE_NAMES.has(token) && (tokenFrequency.get(token) ?? 0) <= DISTINCTIVE_MAX)

  // A country-scoped slug on every drafted entry, not just the slug
  // approve-plans.mjs already assigned. Generic PDF filenames repeat across
  // completely unrelated hospitals — several countries independently produced
  // a candidate literally called "hospital-map" — and approve-plans.mjs only
  // de-duplicates slugs WITHIN its own country's run. Without this suffix, two
  // different hospitals in two different countries would both try to write
  // src/lib/venues/hospital-map.ts, and the second to run wins.
  const worldSlug = (slug) => `${slug}-${countryCode.toLowerCase()}`

  for (const source of sourcesDoc.sources) {
    const slug = worldSlug(source.slug)
    if (alreadyDrafted.has(slug) && !FORCE) continue

    const reject = (reason, detail) => {
      rejectedDoc.rejections.push({ slug, url: source.url, hospitalName: source.hospitalName, countryCode, reason, detail })
      log(STAGE, `  reject ${slug}: ${reason}${detail ? ` (${detail})` : ""}`)
    }

    const file = repoPath(source.file)
    if (!existsSync(file)) { reject("not-downloaded", `run node scripts/world/fetch-plans.mjs --country ${countryCode}`); continue }

    let hospital = hospitalsByCode.get(source.hospitalCode)
    if (!hospital || !Number.isFinite(hospital.lat) || !Number.isFinite(hospital.lng)) {
      reject("no-hospital-position", source.hospitalCode)
      continue
    }

    // Reassign when the sheet's own filename/link text clearly names a
    // DIFFERENT hospital than the one whose crawl found it. Most world
    // hospitals have one site each, so the crawl's attribution is normally
    // right — but a hospital's recorded website is sometimes a shared
    // government/network document host (nsw.gov.au, a health district's own
    // domain) that also serves documents for unrelated sibling hospitals in
    // the same network. A Westmead Hospital crawl finding
    // "wslhd-auburn-hospital-map.pdf" is not a map of Westmead; it just
    // happened to be linked from a page the crawl visited.
    //
    // Only reassigns on a UNIQUE full-name match — same discipline as NHS's
    // national fallback in draft-sheets.mjs ("new-cross-hospital-map" reduces
    // to {cross}, which fits three hospitals, and stays refused rather than
    // guessing). If the attributed hospital's own name is already echoed, or
    // no other single hospital's full name is contained in the sheet's own
    // text, the crawl's attribution stands.
    const sheetHint = tokens(`${source.linkText ?? ""} ${source.slug}`)
    // Loose on purpose, matching NHS's echoesSite check: any shared word
    // between the sheet's own text and the attributed hospital's name is
    // enough to trust the crawl's attribution and skip the override search.
    const echoesAttributed = contains(tokens(hospital.name), sheetHint) > 0
    if (!echoesAttributed && sheetHint.size) {
      const matches = hospitalIndex.filter(
        (h) => h.hospital.code !== hospital.code && isDistinctive(h.tokens) && contains(h.tokens, sheetHint) === 1
      )
      if (matches.length === 1) {
        log(
          STAGE,
          `  reassign ${slug}: "${source.linkText ?? source.slug}" names ${matches[0].hospital.name}, not crawl origin ${hospital.name}`
        )
        hospital = matches[0].hospital
      }
    }

    let labels, W, H
    try {
      ({ labels, W, H } = await extractLabels(file, 1))
    } catch (err) {
      reject("unreadable-pdf", err.message)
      continue
    }

    const aspect = H / W
    if (aspect > MAX_ASPECT) { reject("not-a-site-plan", `aspect ${aspect.toFixed(2)} — too tall`); continue }
    if (labels.length < MIN_WAYPOINTS) { reject("too-few-labels", `${labels.length} < ${MIN_WAYPOINTS}`); continue }

    // Informational only — there is no ambiguity to gate on here, since the
    // hospital came from the crawl target, not a name match. Still worth
    // recording: a sheet whose labels never echo the hospital's own name is
    // worth a second look (wrong PDF linked, or a campus map of a group of
    // hospitals rather than this one specifically).
    const siteTokens = tokens(hospital.name)
    const labelTokens = tokens(labels.map((l) => l.text).join(" "))
    const echoesSite = siteTokens.size === 0 || contains(siteTokens, labelTokens) > 0

    drafted.push({
      slug,
      id: `${slug}-venue`,
      floorOf: floorFromSlug(source.slug),
      stem: stemWithoutFloor(source.slug),
      hospitalCode: hospital.code,
      countryCode,
      name: hospital.name,
      subtitle: `Hospital — ${COUNTRY_NAMES[countryCode] ?? countryCode}`,
      file: source.file,
      page: 1,
      center: [hospital.lat, hospital.lng],
      spanM: DEFAULT_SPAN_M,
      plan: [0, 0, 1, 1],
      quick: pickQuick(labels),
      notes:
        `Site map published by the hospital. Placement is derived automatically ` +
        `(centre from OpenStreetMap, scale estimated — no building footprint on file for this hospital yet) ` +
        `and has not been checked by eye.`,
      auto: {
        hospitalCode: hospital.code,
        spanSource: "default",
        labels: labels.length,
        aspect: Number(aspect.toFixed(2)),
        echoesSiteName: echoesSite,
        sourceUrl: source.url,
        draftedAt: new Date().toISOString(),
      },
    })
    log(STAGE, `  draft ${slug} -> ${hospital.name} (${countryCode}, ${labels.length} labels)`)
  }
}

// Fold several sheets of one building into a single multi-floor venue. Same
// rule as NHS: same hospital, each filename names a storey, and what remains
// of each filename once the storey words come out is identical.
const grouped = []
const byBuilding = new Map()
for (const d of drafted) {
  if (!d.floorOf || !d.hospitalCode) { grouped.push(d); continue }
  const key = `${d.countryCode}::${d.hospitalCode}::${d.stem}`
  const list = byBuilding.get(key)
  if (list) list.push(d)
  else byBuilding.set(key, [d])
}

const floorGroups = []
for (const members of byBuilding.values()) {
  if (members.length < 2) { grouped.push(...members); continue }

  const storeys = new Set(members.map((m) => m.floorOf.floor))
  if (storeys.size !== members.length) {
    log(STAGE, `  not grouping ${members.length} sheets of ${members[0].name}: two claim the same storey`)
    grouped.push(...members)
    continue
  }

  const floors = members
    .map((m) => ({ id: `f${m.floorOf.floor}`, floor: m.floorOf.floor, label: m.floorOf.label, file: m.file, page: m.page }))
    .sort((a, b) => a.floor - b.floor)

  const slug = `${plainName(members[0].name).replace(/\s+/g, "-")}-${members[0].countryCode.toLowerCase()}`
  const ground = members.find((m) => m.floorOf.floor === 0) ?? members[0]
  grouped.push({
    ...ground,
    slug,
    id: `${slug}-venue`,
    floors,
    notes:
      `${members.length} floor plans published by the hospital. Placement is derived ` +
      `automatically (centre from OpenStreetMap, scale estimated) and has not been checked by eye.`,
  })
  floorGroups.push(`${members[0].name} (${members[0].countryCode}): ${floors.length} floors (${floors.map((f) => f.label).join(", ")})`)
}

// Withdraw auto entries this run refused but an earlier run drafted — same
// reasoning as NHS: mapped-sites.json is append-only otherwise, and a matcher
// fix should retract what it previously got wrong, not just stop repeating it.
const rejectedNow = new Set(rejectedDoc.rejections.map((r) => r.slug))
if (grouped.length || rejectedNow.size) {
  const bySlug = new Map(sheetsDoc.sheets.map((s) => [s.slug, s]))

  const dropped = []
  for (const [slug, sheet] of bySlug) {
    if (!sheet.auto || !rejectedNow.has(slug)) continue
    bySlug.delete(slug)
    dropped.push(`${slug} (was ${sheet.name})`)
  }

  const absorbed = new Set(drafted.map((d) => d.slug))
  for (const g of grouped) absorbed.delete(g.slug)
  for (const slug of absorbed) bySlug.delete(slug)

  for (const g of grouped) bySlug.set(g.slug, g)
  sheetsDoc.sheets = [...bySlug.values()]
  writeJson(sheetsPath, sheetsDoc)

  if (dropped.length) {
    log(STAGE, `${dropped.length} venue(s) withdrawn — drafted by an earlier run, refused by this one:`)
    for (const line of dropped) log(STAGE, `  ${line}`)
  }
}
writeJson(dataPath("world", "plan-rejected.json"), rejectedDoc)

log(STAGE, `${drafted.length} sheet(s) drafted, ${rejectedDoc.rejections.length} rejected`)
if (floorGroups.length) {
  log(STAGE, `${floorGroups.length} building(s) assembled from several floor sheets:`)
  for (const line of floorGroups) log(STAGE, `  ${line}`)
}
log(STAGE, `data/world/mapped-sites.json now has ${sheetsDoc.sheets.length} sheet(s)`)
log(STAGE, "done — next: node scripts/world/generate-floorplans.mjs && node scripts/world/build-venues.mjs")
