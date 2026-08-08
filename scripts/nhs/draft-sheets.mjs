// Work out where each downloaded map sheet belongs in the world, and reject the
// ones that aren't usable maps.
//
// The ten hand-built sheets in data/mapped-sites.json have their `center`,
// `spanM` and `plan` crop tuned by eye. That doesn't scale, so this derives them
// from data the pipeline already holds:
//
//   center — the hospital's real coordinates from the ODS register. Exact.
//   spanM  — the width of the site's OpenStreetMap footprint, padded. This is
//            the payoff for fetching footprints: a hospital's true extent is a
//            far better guess at a site plan's scale than any constant.
//   name   — the ODS site name, so venues are named after the hospital rather
//            than after whatever the PDF happened to be called.
//
// Nothing here can tell whether the *image* is well aligned — that needs eyes on
// the rendered sheet (see data/previews/). What it can do is refuse to ship a
// sheet that clearly isn't a site map at all, which auto-approval will produce.
//
// Run: node scripts/nhs/draft-sheets.mjs [--force]
import { existsSync } from "fs"
import { extractLabels } from "../maps/extract.mjs"
import { nameTokens, tokenOverlap, footprintSpanM, DOCUMENT_STOPWORDS } from "./lib/match.mjs"
import { looksLikeHospital } from "./lib/ods.mjs"
import { dataPath, repoPath, readJson, writeJson, log } from "./lib/paths.mjs"

const STAGE = "draft-sheets"
const FORCE = process.argv.includes("--force")

// Quality thresholds. Each one exists because auto-approval will hand us
// something that isn't a hospital site map.
const MIN_WAYPOINTS = 8 // a real site plan labels its buildings; a leaflet doesn't
const MAX_ASPECT = 2.0 // taller than this is a poster or a column of text, not a plan
// How closely a sheet's link text must match one of the trust's hospital names
// before we believe it's a map of that one. Below this, with several sites to
// choose from, guessing would put one hospital's map on top of another.
const MIN_SITE_NAME_MATCH = 0.34

// When a site has no OpenStreetMap footprint we can't measure it. A mid-sized
// hospital campus is a few hundred metres across; this gets the sheet on the map
// at a plausible scale and is flagged so it can be corrected from the preview.
const DEFAULT_SPAN_M = 450
const FOOTPRINT_PADDING = 1.4

// Matching a sheet to a hospital compares link text and filenames against
// organisation names, so it drops the document-y words ("map", "pdf", "plan")
// alongside the ones every NHS name carries.
const tokens = (s) => nameTokens(s, DOCUMENT_STOPWORDS)
const overlap = tokenOverlap

// Waypoint labels that make the best search shortcuts: the things people
// actually ask for at a hospital.
const QUICK_PRIORITY = /^(main entrance|entrance|a&e|accident|emergency|reception|outpatients|urgent (care|treatment))/i

function pickQuick(labels) {
  const seen = new Set()
  const ordered = [
    ...labels.filter((l) => QUICK_PRIORITY.test(l.text)),
    ...labels.filter((l) => !QUICK_PRIORITY.test(l.text)),
  ]
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

const sourcesDoc = readJson(dataPath("plan-sources.json"), { sources: [] })
const sitesDoc = readJson(dataPath("nhs-sites.json"))
if (!sitesDoc) {
  console.error(`[${STAGE}] missing data/nhs-sites.json — run: npm run nhs:build`)
  process.exit(1)
}
const sheetsDoc = readJson(dataPath("mapped-sites.json"))
const rejectedDoc = { generatedAt: new Date().toISOString(), rejections: [] }

// Footprints grouped by site, for the span estimate.
const footprintsBySite = new Map()
for (const f of readJson(dataPath("footprints.geojson"), { features: [] }).features ?? []) {
  const code = f.properties?.odsCode
  if (!code) continue
  const list = footprintsBySite.get(code)
  if (list) list.push(f)
  else footprintsBySite.set(code, [f])
}

const sitesByTrust = new Map()
for (const site of sitesDoc.sites) {
  if (!site.trustCode) continue
  const list = sitesByTrust.get(site.trustCode)
  if (list) list.push(site)
  else sitesByTrust.set(site.trustCode, [site])
}

const alreadyDrafted = new Set(sheetsDoc.sheets.map((s) => s.slug))
const drafted = []

for (const source of sourcesDoc.sources) {
  // Only sheets this stage is responsible for: the hand-built ten keep their
  // tuned values, and re-drafting them would throw that work away.
  if (!source.trustCode) continue
  if (alreadyDrafted.has(source.slug) && !FORCE) continue

  const reject = (reason, detail) => {
    rejectedDoc.rejections.push({ slug: source.slug, url: source.url, trustName: source.trustName, reason, detail })
    log(STAGE, `  reject ${source.slug}: ${reason}${detail ? ` (${detail})` : ""}`)
  }

  const file = repoPath(source.file)
  if (!existsSync(file)) { reject("not-downloaded", "run npm run nhs:plans first"); continue }

  // Which of the trust's hospitals is this a map of? Most trusts run several.
  const trustSites = sitesByTrust.get(source.trustCode) ?? []
  if (!trustSites.length) { reject("no-site-for-trust", source.trustCode); continue }

  const hint = tokens(`${source.linkText ?? ""} ${source.slug}`)

  // A sheet is a map of a hospital, so only hospitals are candidates. The ODS
  // trust-site register is every location a trust operates, which put 258 sites
  // in front of an Oxford sheet and 133 in front of a Reading one — clinics,
  // departments and outpatient services, none of which publish a site plan.
  //
  // The count is the point, not just the noise: with the clinics in, a trust
  // that runs ONE hospital never looks like it, so the single-site shortcut
  // below could never fire and every such sheet needed a name match it had no
  // way to win. Where a trust has no hospital-named site at all, fall back to
  // the full list rather than refusing outright.
  const candidateSites = trustSites.filter((s) => looksLikeHospital(s.name))
  const sites = candidateSites.length ? candidateSites : trustSites

  let site = null
  if (sites.length === 1) {
    site = sites[0]
  } else if (!hint.size) {
    // Not ambiguity — there is nothing to be ambiguous with. "jr-hospital-
    // sitemap" reduces to no tokens at all: "jr" is two characters and both
    // "hospital" and "sitemap" are stopwords. Trusts name these sheets by
    // initials (JR, SGH, PAH, CGH, NOC), and reporting that as a failed match
    // sends anyone reading it looking for the wrong problem. The fix is an
    // alias, not a lower threshold.
    reject("no-hospital-name-in-filename", `${sites.length} hospital site(s), nothing to match "${source.slug}" on`)
    continue
  } else {
    let best = 0
    const scored = []
    for (const candidate of sites) {
      const score = overlap(hint, tokens(candidate.name))
      scored.push({ name: candidate.name, score })
      if (score > best) { best = score; site = candidate }
    }
    if (!site || best < MIN_SITE_NAME_MATCH) {
      // Name the closest sites. "best name match 0.00" says a match failed but
      // not against what, which is the difference between "the threshold is too
      // strict" and "this hospital belongs to another trust entirely".
      const closest = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => `${s.name} ${s.score.toFixed(2)}`)
        .join("; ")
      reject("ambiguous-site", `${sites.length} hospital site(s), best ${best.toFixed(2)}, closest: ${closest}`)
      continue
    }
  }

  let labels, W, H
  try {
    // The resolved path, not source.file — the existence check above already
    // resolved it, and reading the relative one would only work when the stage
    // happens to be run from the repo root.
    ({ labels, W, H } = await extractLabels(file, 1))
  } catch (err) {
    reject("unreadable-pdf", err.message)
    continue
  }

  const aspect = H / W
  if (aspect > MAX_ASPECT) { reject("not-a-site-plan", `aspect ${aspect.toFixed(2)} — too tall`); continue }
  if (labels.length < MIN_WAYPOINTS) { reject("too-few-labels", `${labels.length} < ${MIN_WAYPOINTS}`); continue }

  // Sanity-check that the sheet is a map of THIS hospital and not a different
  // one the trust also publishes: some of the labels should echo the site name.
  const siteTokens = tokens(site.name)
  const labelTokens = tokens(labels.map((l) => l.text).join(" "))
  const echoesSite = siteTokens.size === 0 || overlap(siteTokens, labelTokens) > 0

  const footprints = footprintsBySite.get(site.odsCode) ?? []
  const measured = footprints.length ? footprintSpanM(footprints) : null
  const spanM = measured ? Math.round(measured * FOOTPRINT_PADDING) : DEFAULT_SPAN_M

  const address = site.address?.length ? site.address.join(", ") : site.postcode
  drafted.push({
    slug: source.slug,
    id: `${source.slug}-venue`,
    name: site.name,
    subtitle: `${site.trustName ?? source.trustName} · ${address}`,
    file: source.file,
    page: 1,
    center: [site.lat, site.lng],
    spanM,
    // Full sheet. A tighter crop keeps a sheet's directory table and key out of
    // the waypoint set, but where those sit differs per sheet and can only be
    // judged from the preview.
    plan: [0, 0, 1, 1],
    quick: pickQuick(labels),
    notes:
      `Site map published by ${site.trustName ?? source.trustName}. Placement is derived automatically ` +
      `(centre from the NHS ODS register${measured ? ", scale from the OpenStreetMap footprint" : ", scale estimated"}) ` +
      `and has not been checked by eye.`,
    // Provenance for the review pass — which numbers are measured and which are
    // guesses, so a reviewer knows what to look at first.
    auto: {
      odsCode: site.odsCode,
      spanSource: measured ? "osm-footprint" : "default",
      labels: labels.length,
      aspect: Number(aspect.toFixed(2)),
      echoesSiteName: echoesSite,
      sourceUrl: source.url,
      draftedAt: new Date().toISOString(),
    },
  })
  log(STAGE, `  draft ${source.slug} -> ${site.name} (span ${spanM}m from ${measured ? "footprint" : "default"}, ${labels.length} labels)`)
}

if (drafted.length) {
  const bySlug = new Map(sheetsDoc.sheets.map((s) => [s.slug, s]))
  for (const d of drafted) bySlug.set(d.slug, d)
  sheetsDoc.sheets = [...bySlug.values()]
  writeJson(dataPath("mapped-sites.json"), sheetsDoc)
}
writeJson(dataPath("plan-rejected.json"), rejectedDoc)

log(STAGE, `${drafted.length} sheet(s) drafted, ${rejectedDoc.rejections.length} rejected`)
log(STAGE, `data/mapped-sites.json now has ${sheetsDoc.sheets.length} sheet(s)`)
if (rejectedDoc.rejections.length) log(STAGE, "rejections recorded in data/plan-rejected.json")
log(STAGE, "done — next: node scripts/maps/generate-all.mjs data/previews")
