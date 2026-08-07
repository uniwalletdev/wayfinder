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
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from "fs"
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
} finally {
  rmSync("data", { recursive: true, force: true })
  cpSync(backup, "data", { recursive: true })
  rmSync(join(backup, ".."), { recursive: true, force: true })
  execFileSync("node", ["scripts/nhs/generate-registry.mjs"], { encoding: "utf8" })
}

report()
