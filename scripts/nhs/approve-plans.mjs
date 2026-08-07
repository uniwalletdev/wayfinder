// Promote discovered map PDFs into the approved download list.
//
// discover-plans.mjs produces a queue of everything it found; fetch-plans.mjs
// downloads only what is in data/plan-sources.json. This is the step between
// them, and it is the step that decides what gets republished.
//
// The selection is deliberately narrow, because it runs without a human looking
// at each PDF:
//   - only "high" confidence signals (an explicit floor-plan or site-map match,
//     not the loose "contains the word map" fallback)
//   - only URLs on the trust's OWN website host, as recorded in
//     data/trust-websites.json. A PDF on a random CDN or a third-party mirror
//     can't be attributed to the trust with any confidence, and attribution is
//     the whole basis on which this material is being used.
//
// Everything selected records where it came from, so any sheet in the app can be
// traced back to a URL and a discovery run.
//
// Run: node scripts/nhs/approve-plans.mjs [--dry-run] [--limit N]
import { dataPath, readJson, writeJson, log } from "./lib/paths.mjs"

const STAGE = "approve-plans"
const DRY_RUN = process.argv.includes("--dry-run")
const limitArg = process.argv.indexOf("--limit")
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

// Auto-approval is restricted to the signals that named a map explicitly.
const APPROVED_KINDS = new Set(["floor-plan", "site-map"])

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Prefer a slug that names the hospital over one that names the trust: the PDF's
// own filename usually does ("wythenshawe-hospital-sitemap.pdf"), and it becomes
// the venue's URL. Falls back to the trust when the filename is uninformative.
function slugFor(candidate) {
  let filename = ""
  try {
    filename = decodeURIComponent(new URL(candidate.url).pathname.split("/").pop() ?? "")
  } catch {
    filename = ""
  }
  const fromFile = slugify(filename)
  // Reject filenames that are hashes, dates or bare numbers — common on CMS
  // upload paths and useless as a venue URL.
  const informative =
    fromFile.length >= 6 &&
    /[a-z]{4}/.test(fromFile) &&
    !/^[0-9-]+$/.test(fromFile) &&
    !/^[0-9a-f]{16,}$/.test(fromFile.replace(/-/g, ""))
  const slug = informative ? fromFile : `${slugify(candidate.trustName)}-map`
  // build-venues.mjs turns the slug into a TypeScript identifier
  // (`WYTHENSHAWE_VENUE`), so one starting with a digit — "2024-site-map.pdf" is
  // a real filename shape — would emit a module that doesn't parse.
  return /^[0-9]/.test(slug) ? `site-${slug}` : slug
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./i, "").toLowerCase()
  } catch {
    return null
  }
}

const candidatesDoc = readJson(dataPath("plan-candidates.json"))
if (!candidatesDoc) {
  console.error(
    `[${STAGE}] missing data/plan-candidates.json.\n` +
      `        Run the crawl on a machine with internet access:\n` +
      `          npm run nhs:fetch && npm run nhs:discover\n` +
      `        then commit data/plan-candidates.json.`
  )
  process.exit(1)
}

const websites = readJson(dataPath("trust-websites.json"), {})
const sourcesDoc = readJson(dataPath("plan-sources.json"), { sources: [] })
const existingUrls = new Set(sourcesDoc.sources.filter((s) => s.url).map((s) => s.url))
const usedSlugs = new Set(sourcesDoc.sources.map((s) => s.slug))

const approved = []
const rejected = { lowConfidence: 0, wrongKind: 0, offDomain: 0, alreadyApproved: 0, badUrl: 0 }

for (const candidate of candidatesDoc.candidates ?? []) {
  if (approved.length >= LIMIT) break

  if (candidate.confidence !== "high") { rejected.lowConfidence++; continue }
  if (!APPROVED_KINDS.has(candidate.kind)) { rejected.wrongKind++; continue }
  if (existingUrls.has(candidate.url)) { rejected.alreadyApproved++; continue }

  const host = hostOf(candidate.url)
  if (!host) { rejected.badUrl++; continue }

  // The trust's own host, as ODS recorded it. Subdomains count (many trusts put
  // documents on a `www2.` or `documents.` host of the same registrable domain),
  // but an unrelated domain does not.
  const trustHost = hostOf(websites[candidate.trustCode] ?? "")
  const sameSite =
    trustHost && (host === trustHost || host.endsWith(`.${trustHost}`) || trustHost.endsWith(`.${host}`))
  if (!sameSite) { rejected.offDomain++; continue }

  let slug = slugFor(candidate)
  // Slugs address venues by URL and name the floor-plan asset directory, so a
  // collision would have one hospital silently overwrite another's plan.
  if (usedSlugs.has(slug)) {
    let n = 2
    while (usedSlugs.has(`${slug}-${n}`)) n++
    slug = `${slug}-${n}`
  }
  usedSlugs.add(slug)

  approved.push({
    slug,
    // Auto-fetched PDFs live apart from the ten that were collected by hand, so
    // it stays obvious which sheets nobody has ever looked at.
    file: `map/auto/${slug}.pdf`,
    url: candidate.url,
    sha256: null,
    trustCode: candidate.trustCode,
    trustName: candidate.trustName,
    linkText: candidate.linkText,
    kind: candidate.kind,
    approvedAt: new Date().toISOString(),
    approvedBy: "auto:high-confidence-official-domain",
  })
}

log(STAGE, `${candidatesDoc.candidates?.length ?? 0} candidates -> ${approved.length} approved`)
log(STAGE, `rejected: ${JSON.stringify(rejected)}`)
for (const a of approved.slice(0, 30)) log(STAGE, `  + ${a.slug}  (${a.kind}, ${a.trustName})`)
if (approved.length > 30) log(STAGE, `  … and ${approved.length - 30} more`)

if (DRY_RUN) {
  log(STAGE, "dry run — data/plan-sources.json not written")
  process.exit(0)
}

sourcesDoc.sources = [...sourcesDoc.sources, ...approved]
writeJson(dataPath("plan-sources.json"), sourcesDoc)
log(STAGE, `data/plan-sources.json now lists ${sourcesDoc.sources.length} source(s)`)
log(STAGE, "done — next: npm run nhs:plans")
