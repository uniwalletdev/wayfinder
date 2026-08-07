// Check this machine can run the NHS pipeline, and say what to run next.
//
// This exists because the pipeline is meant to be run somewhere other than where
// it was written — the upstreams it needs are blocked in plenty of development
// environments, so somebody else's laptop or a CI runner does the fetching. The
// first attempt at that produced `Missing script: "nhs:fetch"`, which tells you
// nothing about the actual cause (a checkout without the pipeline on it).
//
// Every check prints what to do about a failure, not just that it failed.
//
// Run: node scripts/nhs/doctor.mjs
import { existsSync, readFileSync } from "fs"
import { dataPath, repoPath, RAW_DIR } from "./lib/paths.mjs"
import { join } from "path"

const OK = "  ok  "
const WARN = " warn "
const FAIL = " FAIL "

let hardFailures = 0
const notes = []

function report(status, label, detail = "") {
  console.log(`${status} ${label}${detail ? ` — ${detail}` : ""}`)
  if (status === FAIL) hardFailures++
}

console.log("Wayfinder NHS pipeline — preflight\n")

// ── Is this even a checkout with the pipeline on it? ────────────────────────
console.log("Checkout")
let pkg = null
try {
  pkg = JSON.parse(readFileSync(repoPath("package.json"), "utf8"))
} catch {
  report(FAIL, "package.json unreadable", "run this from inside the repository")
}

if (pkg) {
  const missing = ["nhs:fetch", "nhs:discover", "nhs:build"].filter((s) => !pkg.scripts?.[s])
  if (missing.length) {
    report(FAIL, "pipeline scripts missing", `no ${missing.join(", ")} in package.json`)
    notes.push(
      "This checkout doesn't have the pipeline. It lives on the branch that added it:\n" +
        "    git fetch origin\n" +
        "    git checkout claude/nhs-maps-multiple-sources-2jlit7\n" +
        "    npm ci\n" +
        "  Or pull main once that branch has been merged."
    )
  } else {
    report(OK, "pipeline scripts present")
  }
}
report(existsSync(repoPath("scripts", "nhs")) ? OK : FAIL, "scripts/nhs/ present")
report(existsSync(dataPath("mapped-sites.json")) ? OK : FAIL, "data/ present")

// ── Toolchain ──────────────────────────────────────────────────────────────
console.log("\nToolchain")
const [major, minor] = process.versions.node.split(".").map(Number)
const nodeOk = major > 20 || (major === 20 && minor >= 9)
report(nodeOk ? OK : FAIL, `Node ${process.versions.node}`, nodeOk ? "" : "needs >= 20.9")

// sharp renders the sheet previews. npm 11 added an allow-scripts gate that
// blocks install scripts by default, and sharp's is one of them — usually
// harmless because the prebuilt binary is a normal dependency, but when it
// isn't, the failure surfaces halfway through a batch rather than here.
try {
  const sharp = (await import("sharp")).default
  await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).png().toBuffer()
  report(OK, "sharp works", "sheet previews will render")
} catch (err) {
  report(WARN, "sharp is not working", err.message.split("\n")[0])
  notes.push(
    "sharp renders the sheet previews (npm run nhs:previews). On npm 11+ its install\n" +
      "  script may have been skipped:\n" +
      "    npm approve-scripts sharp\n" +
      "    npm rebuild sharp\n" +
      "  Everything except previews works without it."
  )
}

// ── How far has the pipeline got on this machine? ───────────────────────────
console.log("\nPipeline state")
const has = {
  ods: existsSync(join(RAW_DIR, "ods", "etr.csv")),
  geocode: existsSync(dataPath("geocode-cache.json")),
  footprints: existsSync(dataPath("footprints.geojson")),
  sites: existsSync(dataPath("nhs-sites.json")),
  candidates: existsSync(dataPath("plan-candidates.json")),
}
report(has.ods ? OK : WARN, "ODS extracts", has.ods ? "data/raw/ods/" : "not fetched yet")
report(has.geocode ? OK : WARN, "geocode cache", has.geocode ? "" : "not built yet")
report(has.footprints ? OK : WARN, "OSM footprints", has.footprints ? "" : "not fetched yet")
report(has.sites ? OK : WARN, "merged site list", has.sites ? "data/nhs-sites.json" : "not built yet")
report(has.candidates ? OK : WARN, "discovery results", has.candidates ? "data/plan-candidates.json" : "crawl not run yet")

if (has.candidates) {
  try {
    const doc = JSON.parse(readFileSync(dataPath("plan-candidates.json"), "utf8"))
    const high = (doc.candidates ?? []).filter((c) => c.confidence === "high").length
    report(OK, "candidates found", `${doc.count ?? 0} total, ${high} high confidence`)
  } catch {
    report(WARN, "plan-candidates.json unreadable", "re-run the crawl")
  }
}

// ── Can this machine actually reach the upstreams? ──────────────────────────
// This is the whole reason the pipeline runs here rather than wherever it was
// written, so it is worth confirming before starting a job that takes hours.
console.log("\nUpstream reachability")
const UPSTREAMS = [
  ["files.digital.nhs.uk", "https://files.digital.nhs.uk/assets/ods/current/etr.zip", "NHS ODS bulk downloads"],
  ["api.postcodes.io", "https://api.postcodes.io/postcodes/SW1A1AA", "postcode geocoding"],
  ["directory.spineservices.nhs.uk", "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations?Limit=1", "trust websites"],
  ["overpass-api.de", "https://overpass-api.de/api/status", "OpenStreetMap footprints"],
]

let reachable = 0
let policyBlocked = 0
for (const [host, url, purpose] of UPSTREAMS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, headers: { "user-agent": "wayfinder-nhs-doctor/1.0" } })
    if (res.ok || (res.status >= 300 && res.status < 400)) {
      report(OK, host, `${purpose} (HTTP ${res.status})`)
      reachable++
    } else if (res.status === 403 || res.status === 407) {
      // Every one of these URLs answers 200 when it is genuinely reachable, so a
      // 403 or 407 here is an egress proxy refusing the connection rather than
      // the upstream refusing the request. Reading it as "reachable" would have
      // the doctor cheerfully green-light a machine that cannot fetch anything —
      // which is the single most important thing it exists to detect.
      report(WARN, host, `${purpose} — blocked by a network policy (HTTP ${res.status})`)
      policyBlocked++
    } else {
      report(WARN, host, `${purpose} — reachable but returned HTTP ${res.status}`)
      reachable++
    }
  } catch (err) {
    const why = err?.name === "AbortError" ? "timed out" : (err?.cause?.message ?? err.message).split("\n")[0]
    report(WARN, host, `${purpose} — unreachable (${why})`)
  } finally {
    clearTimeout(timer)
  }
}

if (reachable === 0) {
  notes.push(
    policyBlocked
      ? "Every upstream was refused by a network policy, not by the upstream itself. That is\n" +
          "  what a sandboxed or proxied environment looks like, and it is exactly why the\n" +
          "  fetching stages are meant to run on an ordinary machine or in CI. Nothing here\n" +
          "  is broken — but no fetching stage will work until you move or open the policy."
      : "No upstream is reachable from this machine. Check your internet connection, or run\n" +
          "  the fetching stages somewhere else — nothing in the pipeline is broken by this."
  )
}

// ── What to do next ────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(64))
for (const note of notes) console.log(`\n${note}`)

let next
if (hardFailures) next = "Fix the failures above first."
else if (reachable === 0) next = "Run the fetching stages on a machine with internet access."
else if (!has.ods) next = "npm run nhs:fetch"
else if (!has.candidates) next = "npm run nhs:discover:quick        (then: npm run nhs:discover for all trusts)"
else if (!has.geocode) next = "npm run nhs:geocode"
else if (!has.sites) next = "npm run nhs:build"
else next = "git add data && git commit -m \"Add NHS map discovery results\" && git push"

console.log(`\nNext: ${next}\n`)

// Unreachable upstreams are reported, not treated as a failure: the doctor is
// also useful for confirming the state of an environment where you already know
// the network is closed.
process.exit(hardFailures ? 1 : 0)
