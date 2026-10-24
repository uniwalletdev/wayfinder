// Work out where each downloaded PDF belongs, reject the ones that aren't
// usable maps, and group multi-floor sheets. Unchanged from backup/legacy-
// world-pipeline's scripts/world/draft-sheets.mjs, including its cross-
// hospital-misattribution guard (a hospital's recorded website is sometimes
// a shared government/network document host that also serves unrelated
// sibling hospitals' documents — see the comment below) and its two
// documented false-positive traps (generic hospital names flooding the
// token-frequency filter; multi-language sites linking to a language name
// that happens to also be a real hospital's name elsewhere). Writes
// data/world/mapped-sites.json, the input build.mjs (in this directory)
// reads.
//
// Run: node scripts/world/site-plans/draft.mjs --countries US,CA
import { existsSync } from "fs"
import { extractLabels } from "../../maps/extract.mjs"
import { nameTokens, documentContainment, DOCUMENT_STOPWORDS } from "../../nhs/lib/match.mjs"
import { floorFromSlug, stemWithoutFloor } from "../../nhs/lib/floors.mjs"
import { dataPath, repoPath, readJson, writeJson, log } from "../../nhs/lib/paths.mjs"
import { countriesFromArgs } from "./lib.mjs"

const STAGE = "site-plans-draft"
const COUNTRIES = countriesFromArgs()

const MIN_WAYPOINTS = 8
const MAX_ASPECT = 2.0
// No OSM building-footprint fetch for these hospitals (that's fetch-campus.mjs's
// job, keyed differently) — every sheet uses the same default-estimate scale
// the NHS pipeline falls back to when it has no footprint either, labelled
// "estimated" in the venue's own notes, not measured.
const DEFAULT_SPAN_M = 450

const COUNTRY_NAMES = readJson(dataPath("world", "countries.json"), {})

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
rejectedDoc.rejections = rejectedDoc.rejections.filter((r) => !COUNTRIES.includes(r.countryCode))

const drafted = []

for (const countryCode of COUNTRIES) {
  const sourcesDoc = readJson(dataPath("world", `plan-sources-${countryCode.toLowerCase()}.json`), { sources: [] })
  const hospitalsDoc = readJson(dataPath("world", `hospitals-${countryCode.toLowerCase()}.json`))
  if (!hospitalsDoc) {
    log(STAGE, `${countryCode}: no hospitals-${countryCode.toLowerCase()}.json — skipping`)
    continue
  }
  const hospitalsByCode = new Map(hospitalsDoc.hospitals.map((h) => [h.code, h]))

  // Index for cross-hospital reassignment: every hospital in this country, by
  // its name tokens, built once per country.
  const hospitalIndex = hospitalsDoc.hospitals
    .map((h) => ({ hospital: h, tokens: tokens(h.name) }))
    .filter((h) => h.tokens.size > 0)

  // How many DIFFERENT hospitals in this country share each name token — a
  // reassignment needs at least one token that is actually distinctive
  // (shared by only a handful of hospitals nationally), not just a token
  // that happens to be a common hospital-naming word ("General Hospital
  // Campus" flooding every unrelated "Campus Map" sheet otherwise).
  const tokenFrequency = new Map()
  for (const { tokens: t } of hospitalIndex) {
    for (const token of t) tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1)
  }
  const DISTINCTIVE_MAX = 3
  // Multi-language hospital sites link to "Chinese (Traditional)" or
  // "French" as a language choice, not a hospital name — and real hospitals
  // named "Chinese Hospital" / "French Hospital" exist elsewhere, so those
  // tokens pass the frequency filter above on their own merit. A short
  // blocklist beats trying to generalise "is this a language name" from
  // frequency alone.
  const LANGUAGE_NAMES = new Set([
    "english", "spanish", "chinese", "french", "vietnamese", "korean", "russian",
    "arabic", "tagalog", "somali", "hmong", "portuguese", "haitian", "creole",
    "japanese", "german", "italian", "polish", "farsi", "urdu", "punjabi",
  ])
  const isDistinctive = (t) =>
    [...t].some((token) => !LANGUAGE_NAMES.has(token) && (tokenFrequency.get(token) ?? 0) <= DISTINCTIVE_MAX)

  // Country-scoped slug: generic PDF filenames ("hospital-map") repeat across
  // completely unrelated hospitals in different countries.
  const worldSlug = (slug) => `${slug}-${countryCode.toLowerCase()}`

  for (const source of sourcesDoc.sources) {
    const slug = worldSlug(source.slug)

    const reject = (reason, detail) => {
      rejectedDoc.rejections.push({ slug, url: source.url, hospitalName: source.hospitalName, countryCode, reason, detail })
      log(STAGE, `  reject ${slug}: ${reason}${detail ? ` (${detail})` : ""}`)
    }

    const file = repoPath(source.file)
    if (!existsSync(file)) { reject("not-downloaded", "fetch.mjs didn't download it"); continue }

    let hospital = hospitalsByCode.get(source.hospitalCode)
    if (!hospital || !Number.isFinite(hospital.lat) || !Number.isFinite(hospital.lng)) {
      reject("no-hospital-position", source.hospitalCode)
      continue
    }

    // Reassign when the sheet's own filename/link text clearly names a
    // DIFFERENT hospital than the one whose crawl found it — a hospital's
    // recorded website is sometimes a shared government/network document
    // host that also serves documents for unrelated sibling hospitals in the
    // same network. Only reassigns on a UNIQUE full-name match; otherwise the
    // crawl's attribution stands.
    const sheetHint = tokens(`${source.linkText ?? ""} ${source.slug}`)
    const echoesAttributed = contains(tokens(hospital.name), sheetHint) > 0
    if (!echoesAttributed && sheetHint.size) {
      const matches = hospitalIndex.filter(
        (h) => h.hospital.code !== hospital.code && isDistinctive(h.tokens) && contains(h.tokens, sheetHint) === 1
      )
      if (matches.length === 1) {
        log(STAGE, `  reassign ${slug}: "${source.linkText ?? source.slug}" names ${matches[0].hospital.name}, not crawl origin ${hospital.name}`)
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
      auto: { hospitalCode: hospital.code, labels: labels.length, aspect: Number(aspect.toFixed(2)), sourceUrl: source.url, draftedAt: new Date().toISOString() },
    })
    log(STAGE, `  draft ${slug} -> ${hospital.name} (${countryCode}, ${labels.length} labels)`)
  }
}

// Fold several sheets of one building into a single multi-floor venue: same
// hospital, each filename names a storey, and what remains of each filename
// once the storey words come out is identical.
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
    notes: `${members.length} floor plans published by the hospital. Placement is derived automatically (centre from OpenStreetMap, scale estimated) and has not been checked by eye.`,
  })
  floorGroups.push(`${members[0].name} (${members[0].countryCode}): ${floors.length} floors`)
}

// mapped-sites.json is append-only across runs otherwise — withdraw entries
// this run refused but an earlier run drafted, same as NHS.
const rejectedNow = new Set(rejectedDoc.rejections.map((r) => r.slug))
const bySlug = new Map(sheetsDoc.sheets.map((s) => [s.slug, s]))
for (const [slug, sheet] of bySlug) {
  if (sheet.auto && rejectedNow.has(slug)) bySlug.delete(slug)
}
const absorbed = new Set(drafted.map((d) => d.slug))
for (const g of grouped) absorbed.delete(g.slug)
for (const slug of absorbed) bySlug.delete(slug)
for (const g of grouped) bySlug.set(g.slug, g)
sheetsDoc.sheets = [...bySlug.values()]
writeJson(sheetsPath, sheetsDoc)
writeJson(dataPath("world", "plan-rejected.json"), rejectedDoc)

log(STAGE, `${drafted.length} sheet(s) drafted, ${rejectedDoc.rejections.length} rejected`)
if (floorGroups.length) {
  log(STAGE, `${floorGroups.length} building(s) assembled from several floor sheets:`)
  for (const line of floorGroups) log(STAGE, `  ${line}`)
}
log(STAGE, `mapped-sites.json now has ${sheetsDoc.sheets.length} sheet(s)`)
