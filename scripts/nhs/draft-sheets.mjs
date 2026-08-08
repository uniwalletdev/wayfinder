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
import { nameTokens, documentContainment, footprintSpanM, DOCUMENT_STOPWORDS } from "./lib/match.mjs"
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

// A name with the punctuation taken out, for comparing two written names rather
// than two bags of words. "St George's Hospital" and "St Georges Hospital" are
// the same place; ODS is inconsistent about the apostrophe.
// Apostrophes are removed rather than spaced, or "George's" becomes "george s"
// and stops matching "Georges".
const plainName = (s) => String(s).toLowerCase().replace(/['‘’]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
// How much of the sheet's own name a site accounts for. NOT tokenOverlap:
// that divides by the smaller set, which lets a short site name win by being
// short — see documentContainment in lib/match.mjs.
const contains = documentContainment

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

// Trust-scoped abbreviations, so "jr-hospital-sitemap" can be read as the John
// Radcliffe. See data/hospital-aliases.json.
const abbreviations = new Map()
for (const [code, entry] of Object.entries(readJson(dataPath("hospital-aliases.json"), { trusts: {} }).trusts ?? {})) {
  abbreviations.set(code, new Map(Object.entries(entry?.expands ?? {}).map(([k, v]) => [k.toLowerCase(), v])))
}

// Words an abbreviation gets glued to when a filename skips the separator.
// "chhsitemap" is Castle Hill's site map with nothing between the two.
const GLUED_SUFFIX = /^(site)?maps?|plans?|floors?|sitemap|internal|external$/

// Which hospital a sheet's abbreviation names, if any.
//
// This has to work on the RAW text, not on tokens: abbreviations are exactly
// what tokenising throws away. "jr" is two characters and nameTokens keeps only
// what is longer, so by the time there are tokens to inspect the evidence is
// gone — which is why these sheets scored 0.00 against every site.
//
// The answer is used as a FACT, not folded into the fuzzy score. Someone checked
// that CGH is Cheltenham General and wrote it down; treating that as one more
// weak signal buries it, because the rest of the filename is noise that dilutes
// it. "cgh-colour-map-0325-v1" scores 0.25 against Cheltenham General even with
// the expansion added, purely because "colour" and "0325" are in the denominator.
function hospitalNamedBy(text, trustCode) {
  const expansions = abbreviations.get(trustCode)
  if (!expansions) return null
  const found = []
  for (const part of String(text).toLowerCase().split(/[^a-z0-9]+/)) {
    let expanded = expansions.get(part)
    if (!expanded) {
      // Glued: "chhsitemap". Only accept when what follows the abbreviation is
      // a document word, so "chester" can't be read as "ch" plus "ester".
      for (const [abbr, name] of expansions) {
        if (part.length > abbr.length && part.startsWith(abbr) && GLUED_SUFFIX.test(part.slice(abbr.length))) {
          expanded = name
          break
        }
      }
    }
    if (expanded && !found.includes(expanded)) found.push(expanded)
  }
  // Two different hospitals named in one filename is not a fact, it's a
  // question — leave it to the ordinary matcher rather than picking one.
  return found.length === 1 ? found[0] : null
}

const sitesByTrust = new Map()
for (const site of sitesDoc.sites) {
  if (!site.trustCode) continue
  const list = sitesByTrust.get(site.trustCode)
  if (list) list.push(site)
  else sitesByTrust.set(site.trustCode, [site])
}

// Every site by its written name, for the cross-trust alias lookup below. ODS
// often files a hospital under a predecessor trust, so the trust that publishes
// a map and the trust the register attributes the site to need not agree.
const sitesByName = new Map()
for (const site of sitesDoc.sites) {
  const key = plainName(site.name)
  const list = sitesByName.get(key)
  if (list) list.push(site)
  else sitesByName.set(key, [site])
}

const alreadyDrafted = new Set(sheetsDoc.sheets.map((s) => s.slug))
const drafted = []
// Sheets whose hospital the register files under a different trust. Worth
// stating plainly at the end rather than burying one line at a time.
const crossTrust = []

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

  const sheetText = `${source.linkText ?? ""} ${source.slug}`
  const hint = tokens(sheetText)
  const namedHospital = hospitalNamedBy(sheetText, source.trustCode)

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
  if (namedHospital) {
    // Aliases search every site of the trust, not just the hospital-named ones.
    // looksLikeHospital asks whether a name contains "hospital" or "infirmary",
    // and plenty of real hospitals do not: the Nuffield Orthopaedic CENTRE is
    // Oxford's orthopaedic hospital, and noc-site-map was refused as naming an
    // unknown hospital while the site sat in the register the whole time.
    //
    // That heuristic exists to keep fetch-osm's request volume down, which is a
    // fine reason to skip a footprint and a bad reason to disbelieve a name
    // somebody checked by hand.
    const aliasSites = trustSites

    // An exact name settles it outright, and has to come first: tokenising
    // "St George's Hospital" leaves {georges}, because "st" is too short and
    // "hospital" is a stopword, and one common word is not enough to tell
    // St George's in Tooting from "St Georges at Woking Hospital". Matching the
    // written name never has that problem.
    site = aliasSites.find((s) => plainName(s.name) === plainName(namedHospital)) ?? null

    if (!site) {
      // Otherwise take sites carrying every distinctive word, preferring the one
      // that says least beyond it — so "Cheltenham General Hospital" beats the
      // same name with "Elective Surgical Hub" on the end.
      const wanted = tokens(namedHospital)
      let best = []
      let fewest = Infinity
      for (const candidate of aliasSites) {
        const candidateTokens = tokens(candidate.name)
        let carries = wanted.size > 0
        for (const token of wanted) if (!candidateTokens.has(token)) { carries = false; break }
        if (!carries) continue
        if (candidateTokens.size < fewest) { fewest = candidateTokens.size; best = [candidate] }
        else if (candidateTokens.size === fewest) best.push(candidate)
      }
      // A tie is not a winner. Picking one arbitrarily is how "sgh-site-map"
      // landed on St Georges at Woking — the wrong hospital, stated confidently.
      if (best.length > 1) {
        reject("alias-matches-several-sites", `"${namedHospital}" fits ${best.length}: ${best.slice(0, 3).map((s) => s.name).join("; ")}`)
        continue
      }
      site = best[0] ?? null
    }

    if (!site) {
      // Last resort: the register files the hospital under a different trust
      // than the website it was crawled from. This is common and it is not an
      // error in either place —
      //
      //   John Radcliffe Hospital  ODS: RBF   sheet: RTH
      //   Princess Anne Hospital   ODS: R1C   sheet: RHM
      //   Pilgrim Hospital         ODS: RJL   sheet: RWD
      //
      // RBF is Oxford Radcliffe Hospitals, the predecessor trust dissolved into
      // RTH in 2011; ODS keeps the historic record and the site hangs off it.
      // United Lincolnshire, meanwhile, holds only "Pilgrim A&E", "Pilgrim
      // Surgery", "Pilgrim Medicine" — departments, not the hospital.
      //
      // So the trust the map was published by and the trust the register
      // attributes the site to are two different questions. Only an EXACT name
      // match is allowed to cross that boundary, and only when it is unique
      // nationally: much stricter than the within-trust rule, because the trust
      // is no longer there to bound the search.
      const nationwide = sitesByName.get(plainName(namedHospital)) ?? []
      if (nationwide.length === 1) {
        site = nationwide[0]
        crossTrust.push(`${source.slug}: ${namedHospital} filed under ${site.trustCode}, sheet from ${source.trustCode}`)
      } else if (nationwide.length > 1) {
        reject(
          "alias-names-a-hospital-several-trusts-claim",
          `"${namedHospital}" is filed under ${nationwide.map((s) => s.trustCode).join(", ")} — none of them ${source.trustCode}`
        )
        continue
      }
    }

    if (!site) {
      // Nothing anywhere. The alias is wrong, or ODS writes the name
      // differently. Both need a person, and both are invisible if this
      // silently falls through to guessing — so name what the trust does have,
      // which is the thing needed to fix it.
      const had = aliasSites.slice(0, 6).map((s) => s.name).join("; ")
      reject(
        "alias-names-an-unknown-hospital",
        `"${namedHospital}" is nowhere in the register — ${source.trustCode} has: ${had}${aliasSites.length > 6 ? ` (+${aliasSites.length - 6} more)` : ""}`
      )
      continue
    }
  } else if (sites.length === 1) {
    // One candidate is not the same as the right one. Royal Berkshire's only
    // hospital-named site is "P Rbh Virtual Hospital" — not a building at all —
    // and taking it blindly put the trust's site map on a service record. If the
    // sheet names something, the one site has to account for part of it.
    const only = tokens(sites[0].name)
    if (!hint.size || contains(hint, only) > 0) {
      site = sites[0]
    } else {
      reject("ambiguous-site", `only hospital site is "${sites[0].name}", which the sheet does not name`)
      continue
    }
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
    let bestExtra = Infinity
    const scored = []
    for (const candidate of sites) {
      const candidateTokens = tokens(candidate.name)
      const score = contains(hint, candidateTokens)
      scored.push({ name: candidate.name, score })
      // On a tie, the site that says least beyond the sheet's own name. ODS
      // registers departments as sites — "Immunology - Derriford Hospital"
      // scores exactly what "Derriford Hospital" does against a Derriford
      // sheet, and without this the department wins on document order and the
      // venue ends up named after a clinic.
      if (score > best || (score === best && score > 0 && candidateTokens.size < bestExtra)) {
        best = score
        bestExtra = candidateTokens.size
        site = candidate
      }
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
  // Asked the other way round to everything above: how much of the SITE's name
  // the labels account for. Only the "> 0" matters — any shared word will do.
  const echoesSite = siteTokens.size === 0 || contains(siteTokens, labelTokens) > 0

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
if (crossTrust.length) {
  // Not a warning — this is normal, and ODS is right about it as often as the
  // website is. Said out loud because the coordinates come from the register's
  // record, so it should be obvious which record was used.
  log(STAGE, `${crossTrust.length} sheet(s) matched a hospital the register files under another trust:`)
  for (const line of crossTrust) log(STAGE, `  ${line}`)
}
log(STAGE, `data/mapped-sites.json now has ${sheetsDoc.sheets.length} sheet(s)`)
if (rejectedDoc.rejections.length) log(STAGE, "rejections recorded in data/plan-rejected.json")
log(STAGE, "done — next: node scripts/maps/generate-all.mjs data/previews")
