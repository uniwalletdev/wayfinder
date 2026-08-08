// Checks for the ingestion half: which discovered PDFs get approved, and the
// name/scale matching that decides where a sheet lands on the map.
//
// Approval is the consequential step. It runs without anyone looking at each
// PDF, so its filters are the only thing standing between "the crawl found a
// link" and "this hospital's map is published in the app". A loosened filter
// here republishes material nobody chose to.
//
// Run: node scripts/nhs/test/ingest.test.mjs
import { execFileSync } from "child_process"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { REPO_ROOT } from "../lib/paths.mjs"
import { nameTokens, tokenOverlap, footprintSpanM, DOCUMENT_STOPWORDS } from "../lib/match.mjs"
import { CRAWLER_VERSION } from "../lib/discovery-match.mjs"
import { mappedVenueNames, mappedVenueFor } from "../lib/mapped.mjs"
import { group, check, report } from "./harness.mjs"

process.chdir(REPO_ROOT)

group("name matching")
check(
  "recognises a venue named more fully than the site",
  tokenOverlap(nameTokens("Queen Elizabeth Hospital Birmingham"), nameTokens("Queen Elizabeth Hospital")) >= 0.5
)
check(
  "does not confuse two 'Royal' hospitals",
  tokenOverlap(nameTokens("Royal Free Hospital"), nameTokens("Royal United Hospital")) < 0.5,
  String(tokenOverlap(nameTokens("Royal Free Hospital"), nameTokens("Royal United Hospital")))
)
check(
  "ignores document words when matching a filename",
  tokenOverlap(
    nameTokens("wythenshawe-hospital-sitemap.pdf", DOCUMENT_STOPWORDS),
    nameTokens("Wythenshawe Hospital")
  ) >= 0.5
)
check(
  "a filename with no hospital name in it matches nothing",
  tokenOverlap(nameTokens("site-map-final-v2.pdf", DOCUMENT_STOPWORDS), nameTokens("Wythenshawe Hospital")) === 0
)

group("footprint scale")
// A square roughly 0.005° of longitude wide at ~51.5°N — about 350m.
const square = [{
  geometry: {
    type: "Polygon",
    coordinates: [[[-0.100, 51.500], [-0.095, 51.500], [-0.095, 51.503], [-0.100, 51.503], [-0.100, 51.500]]],
  },
}]
const span = footprintSpanM(square)
check("measures a site's extent in metres", span > 250 && span < 500, `${Math.round(span)}m`)
check("returns null with no geometry", footprintSpanM([]) === null)

group("hospitals that are already mapped")
// The crawl finds maps for hospitals mapped long before it ran: Wythenshawe
// publishes a 3D version of the sheet already built, Birmingham Women's its own
// alongside the Clinical Genetics one. Approving those puts two venues on one
// hospital — two pins, two sets of waypoints, no way to tell which is real.
//
// The danger in the other direction is worse, because it is silent: a rule loose
// enough to catch those also refused Evelina London for resembling the Royal
// London, and North Devon for resembling North Manchester. Every row below is a
// pair that a previous version of this matcher got wrong.
{
  const venues = mappedVenueNames()
  const cases = [
    // Genuinely the same hospital — refuse.
    ["R0A", "Wythenshawe Hospital site map wythenshawe-hospital-sitemap-3D.pdf", "wythenshawe"],
    ["RQ3", "Birmingham Women's Hospital map birmingham-womens-hospital-map.pdf", "bwh"],
    ["R1H", "Mile End Hospital site map mile-end-hospital-site-map.pdf", "mile-end-hospital"],
    ["RF4", "King George Hospital map king-george-hospital-map.pdf", "king-george-hospital"],
    ["RF4", "Queen's Hospital map queens-hospital-map.pdf", "queens-hospital-romford"],
    ["RGT", "Cambridge Biomedical Campus map 151750_MS_Biomedical_Campus_map.pdf", "cuh"],
    ["RJ2", "UHL site map with wards uhl-site-map-with-wards.pdf", "university-hospital-lewisham"],
    ["RJ7", "St George's map and key St-Georges-Map-and-Key-July-2021.pdf", "st-georges"],
    // The same PDF is published by both trusts that ran the Basildon site.
    ["RDD", "Basildon Hospital map basildon-hospital-map-level-by-level.pdf", "basildon-hospital"],
    ["RQ8", "Basildon Hospital map basildon-hospital-map-level-by-level.pdf", "basildon-hospital"],

    // Different hospitals that merely read alike — approve.
    ["RJ1", "Evelina London site map 2024-evelina-hospital-map.pdf", null],
    ["RK9", "North Devon north-devon-2d-map.pdf", null],
    ["RWA", "Hull Royal Infirmary Hull-Royal-Infirmary-Site-Map.pdf", null],
    ["RQM", "Chelsea and Westminster Hospital Chelsea-and-Westminster-Hospital-Site-Map.pdf", null],
    ["RFR", "Wayfinder Rotherham Hospital Wayfinder-Rotherham-Hospital.pdf", null],
    ["RL4", "New Cross Hospital new-cross-hospital-map.pdf", null],
    // Birmingham Women's and Children's hosts maps for hospitals across the
    // region; only its own is already mapped.
    ["RQ3", "Hereford Hospital map hereford-hospital-map.pdf", null],
    // Same name, different hospital, different trust: St George's runs Queen
    // Mary's in Roehampton (mapped), Oxleas runs Queen Mary's in Sidcup (not).
    // Nothing but the trust code separates these two.
    ["RJ7", "Queen Mary's Hospital Queen-Marys-Hospital-map.pdf", "queen-marys-roehampton"],
    ["RPG", "Queen Mary's Hospital queen-marys-hospital-site-map.pdf", null],
  ]
  for (const [trustCode, text, expected] of cases) {
    const got = mappedVenueFor(text, venues, trustCode)?.slug ?? null
    check(
      `${expected ? "refuses" : "allows"} ${trustCode} ${text.split(" ").pop()}`,
      got === expected,
      `matched ${got}, expected ${expected}`
    )
  }

  // Aliases are hand-written, and a typo'd venue slug would sit there doing
  // nothing while the hospital it was meant to protect got a duplicate.
  const slugs = new Set(venues.map((v) => v.slug))
  const aliases = JSON.parse(readFileSync("data/venue-aliases.json", "utf8")).aliases
  for (const slug of Object.keys(aliases)) {
    check(`alias names a venue that exists: ${slug}`, slugs.has(slug), "no such venue module")
  }
}

group("approve-plans")
const backup = join(mkdtempSync(join(tmpdir(), "wayfinder-ingest-test-")), "data")
cpSync("data", backup, { recursive: true })

try {
  writeFileSync("data/trust-websites.json", JSON.stringify({
    R0A: "https://mft.nhs.uk",
    RJ1: "https://www.guysandstthomas.nhs.uk",
    RDD: "https://www.basildonandthurrock.nhs.uk",
    RQ8: "https://www.meht.nhs.uk",
    // Recorded before the trust rebranded; the override below is where it lives
    // now, and a map on either host is still the trust's own.
    RBN: "https://www.sthk.nhs.uk",
  }))

  writeFileSync("data/trust-website-overrides.json", JSON.stringify({
    overrides: { RBN: { websites: ["https://sthk.merseywestlancs.nhs.uk"] } },
  }))

  writeFileSync("data/plan-candidates.json", JSON.stringify({
    candidates: [
      // Approve: high confidence, site-map, on the trust's own host.
      { trustCode: "R0A", trustName: "Manchester University NHS Foundation Trust", url: "https://mft.nhs.uk/files/royal-oldham-hospital-sitemap.pdf", linkText: "Royal Oldham Hospital site map", kind: "site-map", confidence: "high" },
      // Approve: a documents subdomain of the same trust host still counts.
      { trustCode: "R0A", trustName: "Manchester University NHS Foundation Trust", url: "https://documents.mft.nhs.uk/altrincham-hospital-floor-plan.pdf", linkText: "Altrincham Hospital floor plan", kind: "floor-plan", confidence: "high" },
      // Reject: Wythenshawe already ships as a full venue, so republishing the
      // trust's own sheet would put a second pin on the same hospital.
      { trustCode: "R0A", trustName: "Manchester University NHS Foundation Trust", url: "https://mft.nhs.uk/files/wythenshawe-hospital-sitemap-3D.pdf", linkText: "Wythenshawe Hospital site map", kind: "site-map", confidence: "high" },
      // Approve: on the host the trust moved to after rebranding, which ODS
      // still doesn't know about. Without the override this reads as a
      // third-party mirror and the trust's own map is thrown away.
      { trustCode: "RBN", trustName: "Mersey and West Lancashire Teaching Hospitals NHS Trust", url: "https://sthk.merseywestlancs.nhs.uk/media/whiston-floor-map.pdf", linkText: "Whiston Hospital floor map", kind: "floor-plan", confidence: "high" },
      // Reject: right trust, but hosted somewhere we can't attribute.
      { trustCode: "R0A", trustName: "Manchester University NHS Foundation Trust", url: "https://cdn.somewhere-else.com/a-hospital-map.pdf", linkText: "Hospital map", kind: "site-map", confidence: "high" },
      // Reject: only matched the loose "contains the word map" signal.
      { trustCode: "RJ1", trustName: "Guy's and St Thomas' NHS Foundation Trust", url: "https://www.guysandstthomas.nhs.uk/roadmap.pdf", linkText: "Our roadmap", kind: "unknown", confidence: "low" },
      // Reject: the same document the trust already publishes, reached by the
      // bare domain instead of www. One PDF, one venue.
      { trustCode: "R0A", trustName: "Manchester University NHS Foundation Trust", url: "http://mft.nhs.uk/files/royal-oldham-hospital-sitemap.pdf", linkText: "Royal Oldham Hospital site map", kind: "site-map", confidence: "high" },
      // Reject, but recorded: a real map published as a PNG. draft-sheets places
      // waypoints from a PDF's text layer, which an image has none of, so this
      // must be visible as a gap rather than approved and failed later.
      { trustCode: "R0A", trustName: "Manchester University NHS Foundation Trust", url: "https://mft.nhs.uk/files/withington-hospital-site-map.png", linkText: "Withington Hospital site map", kind: "site-map", confidence: "high", format: "image" },
      // Reject: high confidence but not a map kind we auto-approve.
      { trustCode: "RJ1", trustName: "Guy's and St Thomas' NHS Foundation Trust", url: "https://www.guysandstthomas.nhs.uk/ward-directory.pdf", linkText: "Ward directory", kind: "directory", confidence: "medium" },
      // Approve, and exercise the identifier guard: a filename starting with a
      // digit would generate `2024_SITE_MAP_VENUE`, which does not parse.
      { trustCode: "RJ1", trustName: "Guy's and St Thomas' NHS Foundation Trust", url: "https://www.guysandstthomas.nhs.uk/2024-evelina-hospital-map.pdf", linkText: "Evelina London site map", kind: "site-map", confidence: "high" },
      // Reject: two trusts that merged serve one CMS, so the identical path and
      // query is the identical document however many trust codes point at it.
      { trustCode: "RDD", trustName: "Basildon and Thurrock University Hospitals NHS Foundation Trust", url: "https://www.basildonandthurrock.nhs.uk/download/southend-ground-floor-map.pdf?ver=31231", linkText: "Southend Hospital ground floor map", kind: "floor-plan", confidence: "high" },
      { trustCode: "RQ8", trustName: "Mid Essex Hospital Services NHS Trust", url: "https://www.meht.nhs.uk/download/southend-ground-floor-map.pdf?ver=31231", linkText: "Southend Hospital ground floor map", kind: "floor-plan", confidence: "high" },
    ],
  }))

  writeFileSync("data/plan-sources.json", JSON.stringify({ sources: [] }))

  const out = execFileSync("node", ["scripts/nhs/approve-plans.mjs"], { encoding: "utf8" })
  const approved = JSON.parse(readFileSync("data/plan-sources.json", "utf8")).sources
  const slugs = approved.map((s) => s.slug)

  check("holds back a map in a format it cannot place", !approved.some((s) => /\.png$/.test(s.url)), "approved an image")
  check("says which hospital's map it could not use", /withington-hospital-site-map\.png\s+\(image/.test(out), out.slice(-600))
  check("treats a candidate with no format as the PDF it is", approved.some((s) => /royal-oldham/.test(s.url)), "dropped a pre-format candidate")
  check("approves exactly the eligible candidates", approved.length === 5, `${approved.length}: ${slugs.join(", ")}`)
  check("accepts a host the trust moved to after rebranding", slugs.includes("whiston-floor-map"), slugs.join(", "))
  check(
    "takes one copy of a document served from two of its own hosts",
    approved.filter((s) => /royal-oldham-hospital-sitemap/.test(s.url)).length === 1,
    approved.filter((s) => /royal-oldham/.test(s.url)).map((s) => s.url).join(", ")
  )
  check("prefers https for the copy it keeps", !approved.some((s) => s.url.startsWith("http://")), "kept an http URL")
  check(
    "takes one copy of a document two merged trusts both publish",
    approved.filter((s) => /southend-ground-floor-map/.test(s.url)).length === 1,
    approved.filter((s) => /southend/.test(s.url)).map((s) => s.url).join(", ")
  )
  check("counts the copies it dropped", /"duplicateDocument":2/.test(out), out.match(/rejected: .*/)?.[0])
  check("approves a same-host site map", slugs.includes("royal-oldham-hospital-sitemap"), slugs.join(", "))
  check("accepts a subdomain of the trust's host", slugs.includes("altrincham-hospital-floor-plan"), slugs.join(", "))
  check("refuses a hospital that already ships as a venue", !approved.some((s) => /wythenshawe/.test(s.url)), "duplicated a mapped venue")
  check("says which venue already covers it", /already mapped as wythenshawe/.test(out), out.slice(-400))
  check("rejects an off-domain PDF", !approved.some((s) => s.url.includes("somewhere-else")), "third-party host approved")
  check("rejects low confidence", !approved.some((s) => s.url.includes("roadmap")))
  check("rejects a non-map kind", !approved.some((s) => s.url.includes("ward-directory")))
  check("prefixes a slug that would start with a digit", slugs.includes("site-2024-evelina-hospital-map"), slugs.join(", "))
  check("every slug is a valid identifier base", slugs.every((s) => /^[a-z][a-z0-9-]*$/.test(s)), slugs.join(", "))
  check("records where each sheet came from", approved.every((s) => s.url && s.trustCode && s.approvedBy))
  check("downloads land apart from hand-collected maps", approved.every((s) => s.file.startsWith("map/auto/")))
  check("reports its rejections", /rejected:/.test(out))

  // Re-running must not duplicate: the crawl re-finds the same PDFs every time.
  execFileSync("node", ["scripts/nhs/approve-plans.mjs"], { encoding: "utf8" })
  const second = JSON.parse(readFileSync("data/plan-sources.json", "utf8")).sources
  check("is idempotent across runs", second.length === 5, `grew to ${second.length}`)

  group("generate-registry")
  // A drafted sheet whose venue module doesn't exist yet must be skipped, not
  // imported — a dangling import breaks the entire app build.
  const sheets = JSON.parse(readFileSync("data/mapped-sites.json", "utf8"))
  sheets.sheets.push({
    slug: "not-built-yet", id: "x", name: "Nowhere", subtitle: "t", file: "map/auto/x.pdf",
    page: 1, center: [51.5, -0.1], spanM: 400, plan: [0, 0, 1, 1], quick: [], notes: "",
    auto: { odsCode: "X1", spanSource: "default", labels: 10 },
  })
  writeFileSync("data/mapped-sites.json", JSON.stringify(sheets, null, 2))

  execFileSync("node", ["scripts/nhs/generate-registry.mjs"], { encoding: "utf8" })
  const barrel = readFileSync("src/lib/venues/generated-sheets.ts", "utf8")
  check("skips a sheet with no venue module", !barrel.includes("not-built-yet"), "dangling import emitted")
  check("still exports the array", /export const GENERATED_SHEET_VENUES: Venue\[\]/.test(barrel))

  group("discover resume")
  // A full crawl runs for hours, so an interrupted run must continue rather than
  // start over. Exercised without network: every trust here fails its website
  // lookup, which still counts as a conclusion the resume should not revisit.
  const FIELDS = 27
  const trustRow = (code, name) => {
    const r = new Array(FIELDS).fill("")
    r[0] = code; r[1] = name; r[4] = "1 Test Road"; r[9] = "SE1 7EH"; r[10] = "19910401"; r[12] = "A"
    return r.join(",")
  }
  mkdirSync("data/raw/ods", { recursive: true })
  writeFileSync("data/raw/ods/etr.csv", [
    trustRow("RJ1", "ALPHA NHS FOUNDATION TRUST"),
    trustRow("RJ2", "BETA NHS FOUNDATION TRUST"),
    trustRow("RJ3", "GAMMA NHS FOUNDATION TRUST"),
  ].join("\n") + "\n")

  // Prior state: one trust already crawled, one candidate already banked.
  writeFileSync("data/plan-candidates.json", JSON.stringify({
    count: 1,
    // Results only resume when they came from this crawler; older ones re-crawl.
    crawlerVersion: CRAWLER_VERSION,
    crawled: { RJ1: "ok" },
    candidates: [{
      trustCode: "RJ1", trustName: "Alpha NHS Foundation Trust",
      url: "https://alpha.nhs.uk/site-map.pdf", linkText: "Site map",
      kind: "site-map", confidence: "high",
    }],
  }))

  const resumeOut = execFileSync("node", ["scripts/nhs/discover-plans.mjs"], { encoding: "utf8" })
  const resumed = JSON.parse(readFileSync("data/plan-candidates.json", "utf8"))

  check("announces that it is resuming", /resuming — 1 candidate\(s\) and 1 trust\(s\) already done/.test(resumeOut), resumeOut.slice(0, 300))
  check("reports only the outstanding trusts", /3 trusts in scope, 2 still to crawl/.test(resumeOut))
  check("keeps the candidate banked by the earlier run", resumed.candidates.some((c) => c.trustCode === "RJ1"), "prior work was discarded")
  check("does not duplicate it", resumed.candidates.filter((c) => c.url === "https://alpha.nhs.uk/site-map.pdf").length === 1)
  check("does not re-crawl a completed trust", resumed.crawled.RJ1 === "ok")
  check("records an outcome for each trust it attempted", !!resumed.crawled.RJ2 && !!resumed.crawled.RJ3, JSON.stringify(resumed.crawled))
  check("counts outcomes across the whole run, not just this one", resumed.stats.crawled === 3, JSON.stringify(resumed.stats))

  // A second run with everything already recorded should do no work at all.
  const secondOut = execFileSync("node", ["scripts/nhs/discover-plans.mjs"], { encoding: "utf8" })
  check("a finished crawl re-runs as a no-op", /3 trusts in scope, 0 still to crawl/.test(secondOut), secondOut.slice(0, 300))

  group("doctor")
  // The doctor is the first thing anyone runs on a new machine, so its advice
  // has to track what the pipeline has actually produced. It is also the only
  // check that has to stay correct in an environment with no network at all.
  let doctorOut = ""
  let doctorFailed = false
  try {
    doctorOut = execFileSync("node", ["scripts/nhs/doctor.mjs"], { encoding: "utf8" })
  } catch (err) {
    doctorFailed = true
    doctorOut = String(err.stdout ?? "")
  }

  check("recognises a checkout that has the pipeline", /ok\s+pipeline scripts present/.test(doctorOut), doctorOut.slice(0, 200))
  check("does not hard-fail on a healthy checkout", !doctorFailed, "exited non-zero")
  // The resume group above wrote an etr.csv, so the doctor must now report the
  // extracts as present — the point being that it reads real state off disk
  // rather than printing a fixed list.
  check("reads pipeline state off disk", /ok\s+ODS extracts/.test(doctorOut), doctorOut.slice(0, 400))
  check("notices the geocode cache is still missing", /geocode cache — not built yet/.test(doctorOut))
  check("sees the discovery results this test wrote", /candidates found/.test(doctorOut), "did not read plan-candidates.json")
  check("always ends with a next step", /\nNext: \S/.test(doctorOut))
  // A proxy denial must never read as "reachable" — a doctor that green-lights a
  // machine which cannot fetch anything is worse than no doctor.
  check(
    "never reports a 403 as reachable",
    !/ok\s+\S+ — .*\(HTTP 40[37]\)/.test(doctorOut),
    "a policy-blocked host was reported ok"
  )
} finally {
  rmSync("data", { recursive: true, force: true })
  cpSync(backup, "data", { recursive: true })
  rmSync(join(backup, ".."), { recursive: true, force: true })
  execFileSync("node", ["scripts/nhs/generate-registry.mjs"], { encoding: "utf8" })
}

report()
