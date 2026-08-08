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
import { identifyingTokens, looksSpecialtyQualified } from "./lib/site-name.mjs"
import { looksLikeHospital } from "./lib/ods.mjs"
import { floorFromSlug, stemWithoutFloor } from "./lib/floors.mjs"
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

// Two ODS records this close together are the same hospital written down twice.
// A large teaching campus is a few hundred metres across, so this is well inside
// "same site" and well outside "the hospital next door".
const SAME_SITE_M = 250

// Sites that were actually surveyed, so a record without a footprint can take
// its scale from the copy of itself that has one.
const footprintedSites = sitesDoc.sites.filter(
  (s) => footprintsBySite.has(s.odsCode) && Number.isFinite(s.lat) && Number.isFinite(s.lng)
)

function metresBetween(a, b) {
  if (![a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) return Infinity
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Every hospital in the country, for the national fallback when a sheet names a
// hospital its host trust does not own. Restricted to hospital-named sites: the
// within-trust matcher can afford a wider net because the trust bounds it, and
// this one cannot.
const nationalHospitals = sitesDoc.sites.filter((s) => looksLikeHospital(s.name))

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
  let crossTrustNote = null
  if (namedHospital) {
    // Resolution runs strongest-evidence-first, and the order is the whole
    // design. Both exact-name steps come before any token work, because
    // tokenising throws away exactly what distinguishes these names:
    // "Cheltenham General Hospital" reduces to {cheltenham} once "general" and
    // "hospital" drop as stopwords, and "St George's Hospital" to {georges}.
    // One common word cannot carry the decision.
    const plainWanted = plainName(namedHospital)

    // 1. The trust's own register, matched on the written name.
    site = trustSites.find((s) => plainName(s.name) === plainWanted) ?? null

    // 2. The same written name anywhere in the country, when it is unique.
    //    ODS often files a hospital under a predecessor trust — the John
    //    Radcliffe under RBF, dissolved into RTH in 2011 — or holds only
    //    departments where the hospital should be: United Lincolnshire has
    //    "Pilgrim A&E" and "Pilgrim Surgery" but no Pilgrim Hospital.
    //
    //    This has to run BEFORE the token step, not after it. Ordered the other
    //    way, an ambiguous token match refuses the sheet and never reaches the
    //    exact answer waiting one trust over.
    if (!site) {
      const nationwide = sitesByName.get(plainWanted) ?? []
      if (nationwide.length === 1) {
        site = nationwide[0]
        if (site.trustCode !== source.trustCode) {
          crossTrustNote = `${source.slug}: ${namedHospital} filed under ${site.trustCode}, sheet from ${source.trustCode}`
        }
      } else if (nationwide.length > 1) {
        reject(
          "alias-names-a-hospital-several-trusts-claim",
          `"${namedHospital}" is filed under ${nationwide.map((s) => s.trustCode).join(", ")} — none of them ${source.trustCode}`
        )
        continue
      }
    }

    // 3. Failing an exact name, sites carrying every distinctive word — but
    //    only the hospital-named ones. Widening this to every site of the trust
    //    broke Cheltenham: {cheltenham} is all that survives tokenising, so
    //    "Cheltenham Childrens Centre" and "Cheltenham Leisure Centre" both fit,
    //    tie on length, and beat the hospital that had been resolving fine.
    //    looksLikeHospital is too crude to gate an exact name — it hides the
    //    Nuffield Orthopaedic CENTRE — but it is exactly right for keeping a
    //    leisure centre out of a fuzzy match.
    if (!site) {
      const wanted = tokens(namedHospital)
      let best = []
      let fewest = Infinity
      for (const candidate of candidateSites) {
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
      // Nothing anywhere. The alias is wrong, or ODS writes the name
      // differently. Both need a person, and both are invisible if this
      // silently falls through to guessing — so name what the trust does have,
      // which is the thing needed to fix it.
      const had = trustSites.slice(0, 6).map((s) => s.name).join("; ")
      reject(
        "alias-names-an-unknown-hospital",
        `"${namedHospital}" is nowhere in the register — ${source.trustCode} has: ${had}${trustSites.length > 6 ? ` (+${trustSites.length - 6} more)` : ""}`
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
      // Before refusing: the sheet may name its hospital perfectly well, just
      // not one of THIS trust's. Birmingham Women's and Children's publishes
      // site maps for Hereford, Royal Shrewsbury, Russells Hall, Walsall Manor
      // and Worcester Royal; ODS files Lincoln County and Pilgrim under trusts
      // that are not the one whose website the sheet came from. Eight sheets
      // named "hereford-hospital-map", "royal-shrewsbury-hospital-map" and the
      // like were refused for naming a hospital the host trust does not own.
      //
      // Looking nationally is only safe under a much stricter rule than the
      // within-trust one, because the trust is no longer bounding anything:
      // every distinctive word of the sheet must appear in the site's name, and
      // exactly one hospital in the country may satisfy that.
      //
      // The uniqueness requirement is what makes this self-limiting rather than
      // reckless. "new-cross-hospital-map" reduces to {cross}, which fits New
      // Cross, Charing Cross and Whipps Cross — three hospitals, so it stays
      // refused. "royal-shrewsbury-hospital-map" reduces to {shrewsbury}, which
      // fits one.
      // Uniqueness is absolute here, with no shortest-name tiebreak. Within a
      // trust, preferring the site that says least beyond the sheet is what
      // stops a department outranking its hospital. Nationally the same rule is
      // just "shortest name wins", and that is not evidence: {cross} carried by
      // New Cross, Charing Cross and Whipps Cross would resolve to New Cross for
      // being the shortest, and would resolve "cross-hospital-map" there too.
      const national = nationalHospitals.filter((candidate) => {
        const candidateTokens = tokens(candidate.name)
        for (const token of hint) if (!candidateTokens.has(token)) return false
        return true
      })

      if (national.length === 1) {
        site = national[0]
        crossTrustNote = `${source.slug}: ${site.name} filed under ${site.trustCode}, sheet from ${source.trustCode}`
      } else {
        // Name the closest sites. "best name match 0.00" says a match failed but
        // not against what, which is the difference between "the threshold is too
        // strict" and "this hospital belongs to another trust entirely".
        const closest = scored
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((s) => `${s.name} ${s.score.toFixed(2)}`)
          .join("; ")
        const nationally = national.length > 1
          ? `; nationally ${national.length} hospitals fit: ${national.slice(0, 3).map((s) => s.name).join(", ")}`
          : ""
        reject("ambiguous-site", `${sites.length} hospital site(s), best ${best.toFixed(2)}, closest: ${closest}${nationally}`)
        continue
      }
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

  // …but "any shared word" is not a test when every candidate shares the same
  // words. The Pinderfields sheet was matched to "Dewsbury & District Hospital-
  // Combined Elective Surgical Hub" — a different hospital ten miles away — and
  // passed this check on the word "hospital" alone, then shipped under the
  // Dewsbury name at Dewsbury's coordinates. So the echo has to be carried by a
  // token that actually identifies a place: the hospital's own name, not the
  // vocabulary every NHS site shares.
  const siteIdentity = identifyingTokens(site.name)
  const echoesIdentity = siteIdentity.size === 0 || contains(siteIdentity, labelTokens) > 0
  if (!echoesIdentity) {
    reject(
      "site-name-not-on-sheet",
      `no label mentions ${[...siteIdentity].join("/")} — "${site.name}" is probably the wrong site for this sheet`
    )
    continue
  }

  // Scale from whichever record of this hospital actually has a footprint.
  //
  // ODS files a hospital more than once, and the copy with the best NAME is not
  // always the copy with a footprint. Northampton General is the clear case: the
  // exact-named record under RP1 has none, while the trust's own "Northampton
  // General Hospital (Acute)" is measured at 1376m. Taking the better name cost
  // the measurement and dropped the sheet to the 450m default — a threefold
  // scale error, which on a preview looks like the map is simply wrong.
  //
  // Two records within 250m of each other are the same site, so the name comes
  // from the match and the scale from whichever copy was surveyed.
  let footprints = footprintsBySite.get(site.odsCode) ?? []
  let scaleBorrowedFrom = null
  if (!footprints.length) {
    for (const neighbour of footprintedSites) {
      if (neighbour.odsCode === site.odsCode) continue
      if (metresBetween(site, neighbour) > SAME_SITE_M) continue
      footprints = footprintsBySite.get(neighbour.odsCode) ?? []
      scaleBorrowedFrom = neighbour.name
      break
    }
  }
  const measured = footprints.length ? footprintSpanM(footprints) : null
  const spanM = measured ? Math.round(measured * FOOTPRINT_PADDING) : DEFAULT_SPAN_M

  const address = site.address?.length ? site.address.join(", ") : site.postcode
  // Only report a crossing for a sheet that survived every other gate. Three
  // Princess Anne levels were listed as cross-trust and then rejected for too
  // few labels, which reads as ten sheets placed when six were.
  if (crossTrustNote) crossTrust.push(crossTrustNote)

  drafted.push({
    slug: source.slug,
    id: `${source.slug}-venue`,
    // Which storey this sheet is, when its filename says. Used by the grouping
    // pass below; harmless on a sheet that stands alone.
    floorOf: floorFromSlug(source.slug),
    stem: stemWithoutFloor(source.slug),
    odsCode: site.odsCode,
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
      spanSource: measured ? (scaleBorrowedFrom ? "osm-footprint-colocated" : "osm-footprint") : "default",
      labels: labels.length,
      aspect: Number(aspect.toFixed(2)),
      echoesSiteName: echoesSite,
      // ODS files departments as sites, so a sheet can match a record named for
      // a specialty rather than the hospital ("Immunology - Derriford
      // Hospital"). Flagged rather than rejected: a specialist hospital's real
      // name reads the same way, and only a person can tell them apart.
      specialtyQualifiedName: looksSpecialtyQualified(site.name),
      sourceUrl: source.url,
      draftedAt: new Date().toISOString(),
    },
  })
  log(
    STAGE,
    `  draft ${source.slug} -> ${site.name} (span ${spanM}m from ` +
      `${measured ? (scaleBorrowedFrom ? `footprint of "${scaleBorrowedFrom}"` : "footprint") : "default"}, ${labels.length} labels)`
  )
}

// Fold several sheets of one building into a single multi-floor venue.
//
// Southampton publishes the Princess Anne as nine PDFs, one per level. Drafted
// one at a time they are nine venues at one address — nine pins where there
// should be one building you can move through.
//
// Two sheets are floors of one building when all three hold: they resolved to
// the SAME ODS site, each filename names a storey, and what remains of each
// filename once the storey words come out is identical. That last test is what
// keeps "internal-site-map-north-tees" and "external-site-map-north-tees" apart
// — same hospital, both name no storey, and two views of one site are not two
// floors of it.
const grouped = []
const byBuilding = new Map()
for (const d of drafted) {
  // No storey in the name, or no site to group on: stands alone.
  if (!d.floorOf || !d.odsCode) { grouped.push(d); continue }
  const key = `${d.odsCode}::${d.stem}`
  const list = byBuilding.get(key)
  if (list) list.push(d)
  else byBuilding.set(key, [d])
}

const floorGroups = []
for (const members of byBuilding.values()) {
  if (members.length < 2) { grouped.push(...members); continue }

  // Two sheets claiming one storey means the filenames were read wrongly, and
  // the venue would silently drop a floor. Leave them separate for a person.
  const storeys = new Set(members.map((m) => m.floorOf.floor))
  if (storeys.size !== members.length) {
    log(STAGE, `  not grouping ${members.length} sheets of ${members[0].name}: two claim the same storey`)
    grouped.push(...members)
    continue
  }

  const floors = members
    .map((m) => ({ id: `f${m.floorOf.floor}`, floor: m.floorOf.floor, label: m.floorOf.label, file: m.file, page: m.page }))
    .sort((a, b) => a.floor - b.floor)

  // The venue is named after the hospital, not after whichever PDF happened to
  // sort first, and its slug comes from the same place — nine sheets called
  // pah-c-level-floor-plan through pah-j make a poor venue address.
  const slug = plainName(members[0].name).replace(/\s+/g, "-")
  const ground = members.find((m) => m.floorOf.floor === 0) ?? members[0]
  grouped.push({
    ...ground,
    slug,
    id: `${slug}-venue`,
    floors,
    notes:
      `${members.length} floor plans published by ${ground.subtitle.split(" · ")[0]}. Placement is derived ` +
      `automatically (centre from the NHS ODS register) and has not been checked by eye.`,
  })
  floorGroups.push(`${members[0].name}: ${floors.length} floors (${floors.map((f) => f.label).join(", ")})`)
}

// Drop venues this run refuses but an earlier one drafted.
//
// mapped-sites.json was append-only, so every hospital a looser version of the
// matcher ever guessed at stayed published. Twenty-four of the fifty-five venues
// on a national run were placed by logic since found to be wrong, including
// several the regression tests now assert must never happen:
//
//   sgh-site-map           -> St Georges at Woking, not Tooting
//   pinderfields-map       -> Dewsbury & District, a different hospital
//   royal-berkshire-map    -> "P Rbh Virtual Hospital", a service record
//   lincoln-map-level-1..3 -> "Lincoln Surgery", a GP practice
//
// The tests passed the whole time. They check the matcher; these were data
// written before the matcher was fixed, and nothing went back for them.
//
// Only auto-drafted entries are removed — they carry an `auto` block, the ten
// hand-tuned sheets do not, and those must survive untouched. And only sheets
// this run actually looked at: without --force a re-run skips anything already
// drafted, so it neither drafts nor rejects them and they are left alone.
const rejectedNow = new Set(rejectedDoc.rejections.map((r) => r.slug))

if (grouped.length || rejectedNow.size) {
  const bySlug = new Map(sheetsDoc.sheets.map((s) => [s.slug, s]))

  // `keep: true` is a person overruling this stage. A venue the matcher refuses
  // can still be one somebody wants published — they may know the sheet is right
  // where the matcher cannot tell, or they may simply prefer coverage to
  // certainty. Either way the decision belongs to them, and it has to survive
  // the next --force run or it is not a decision, just a delay.
  const dropped = []
  const kept = []
  for (const [slug, sheet] of bySlug) {
    if (!sheet.auto || !rejectedNow.has(slug)) continue
    if (sheet.keep) { kept.push(`${slug} (${sheet.name})`); continue }
    bySlug.delete(slug)
    dropped.push(`${slug} (was ${sheet.name})`)
  }

  // A sheet that becomes part of a multi-floor venue must not also survive as
  // the single-floor venue it drafted as on an earlier run.
  const absorbed = new Set(drafted.map((d) => d.slug))
  for (const g of grouped) absorbed.delete(g.slug)
  for (const slug of absorbed) bySlug.delete(slug)

  for (const g of grouped) bySlug.set(g.slug, g)
  sheetsDoc.sheets = [...bySlug.values()]
  writeJson(dataPath("mapped-sites.json"), sheetsDoc)

  if (dropped.length) {
    log(STAGE, `${dropped.length} venue(s) withdrawn — drafted by an earlier run, refused by this one:`)
    for (const line of dropped) log(STAGE, `  ${line}`)
    log(STAGE, "  their venue modules and floor plans are now unused; see docs for cleanup")
  }
  if (kept.length) {
    // Said every run, not once. These are published against this stage's own
    // judgement, and that is worth restating rather than letting it settle into
    // the background.
    log(STAGE, `${kept.length} venue(s) kept by request although this run refuses them (keep: true):`)
    for (const line of kept) log(STAGE, `  ${line}`)
  }
}
writeJson(dataPath("plan-rejected.json"), rejectedDoc)

log(STAGE, `${drafted.length} sheet(s) drafted, ${rejectedDoc.rejections.length} rejected`)
if (floorGroups.length) {
  log(STAGE, `${floorGroups.length} building(s) assembled from several floor sheets:`)
  for (const line of floorGroups) log(STAGE, `  ${line}`)
}
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
