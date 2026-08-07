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

group("approve-plans")
const backup = join(mkdtempSync(join(tmpdir(), "wayfinder-ingest-test-")), "data")
cpSync("data", backup, { recursive: true })

try {
  writeFileSync("data/trust-websites.json", JSON.stringify({
    R0A: "https://mft.nhs.uk",
    RJ1: "https://www.guysandstthomas.nhs.uk",
  }))

  writeFileSync("data/plan-candidates.json", JSON.stringify({
    candidates: [
      // Approve: high confidence, site-map, on the trust's own host.
      { trustCode: "R0A", trustName: "Manchester University NHS Foundation Trust", url: "https://mft.nhs.uk/files/wythenshawe-hospital-sitemap.pdf", linkText: "Wythenshawe Hospital site map", kind: "site-map", confidence: "high" },
      // Approve: a documents subdomain of the same trust host still counts.
      { trustCode: "R0A", trustName: "Manchester University NHS Foundation Trust", url: "https://documents.mft.nhs.uk/trafford-general-floor-plan.pdf", linkText: "Trafford General floor plan", kind: "floor-plan", confidence: "high" },
      // Reject: right trust, but hosted somewhere we can't attribute.
      { trustCode: "R0A", trustName: "Manchester University NHS Foundation Trust", url: "https://cdn.somewhere-else.com/a-hospital-map.pdf", linkText: "Hospital map", kind: "site-map", confidence: "high" },
      // Reject: only matched the loose "contains the word map" signal.
      { trustCode: "RJ1", trustName: "Guy's and St Thomas' NHS Foundation Trust", url: "https://www.guysandstthomas.nhs.uk/roadmap.pdf", linkText: "Our roadmap", kind: "unknown", confidence: "low" },
      // Reject: high confidence but not a map kind we auto-approve.
      { trustCode: "RJ1", trustName: "Guy's and St Thomas' NHS Foundation Trust", url: "https://www.guysandstthomas.nhs.uk/ward-directory.pdf", linkText: "Ward directory", kind: "directory", confidence: "medium" },
      // Approve, and exercise the identifier guard: a filename starting with a
      // digit would generate `2024_SITE_MAP_VENUE`, which does not parse.
      { trustCode: "RJ1", trustName: "Guy's and St Thomas' NHS Foundation Trust", url: "https://www.guysandstthomas.nhs.uk/2024-evelina-hospital-map.pdf", linkText: "Evelina London site map", kind: "site-map", confidence: "high" },
    ],
  }))

  writeFileSync("data/plan-sources.json", JSON.stringify({ sources: [] }))

  const out = execFileSync("node", ["scripts/nhs/approve-plans.mjs"], { encoding: "utf8" })
  const approved = JSON.parse(readFileSync("data/plan-sources.json", "utf8")).sources
  const slugs = approved.map((s) => s.slug)

  check("approves exactly the eligible candidates", approved.length === 3, `${approved.length}: ${slugs.join(", ")}`)
  check("approves a same-host site map", slugs.includes("wythenshawe-hospital-sitemap"), slugs.join(", "))
  check("accepts a subdomain of the trust's host", slugs.includes("trafford-general-floor-plan"), slugs.join(", "))
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
  check("is idempotent across runs", second.length === 3, `grew to ${second.length}`)

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
