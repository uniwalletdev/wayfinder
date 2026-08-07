// Checks for the source-fallback chain: local file, bulk download, ORD API.
//
// The pipeline was built on a single bulk-download host, and on a real network
// that host answers 403 while the ORD API — the same register, same publisher —
// answers 200. Depending on one mirror was the bug; this covers the fix.
//
// The live ORD call cannot be exercised here (this sandbox reaches nothing), so
// these tests drive the mapping and the CSV synthesis directly against a
// recorded payload shape. What they prove is that a correct payload maps to the
// right fields and a wrong one fails loudly — not that the endpoint is up.
//
// Run: node scripts/nhs/test/fallback.test.mjs
import { execFileSync } from "child_process"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { REPO_ROOT } from "../lib/paths.mjs"
import { parseCsv } from "../lib/csv.mjs"
import { parseOdsRows, recordsToCsv, ODS_EXPECTED_FIELDS } from "../lib/ods.mjs"
import { ORD_ROLES } from "../lib/ord.mjs"
import { BROWSER_HEADERS } from "../lib/net.mjs"
import { group, check, report } from "./harness.mjs"

process.chdir(REPO_ROOT)

group("ORD role mapping")
check("trusts map to the NHS TRUST role", ORD_ROLES.etr === "RO197")
check("sites map to the NHS TRUST SITE role", ORD_ROLES.ets === "RO198")

group("browser headers")
// The download host refuses the honest agent string. The retry has to look like
// a browser or it is pointless.
check("sends a browser user-agent", /Mozilla\/5\.0/.test(BROWSER_HEADERS["user-agent"]))
check("accepts zip content", /zip/.test(BROWSER_HEADERS.accept))

group("synthesised CSV round-trips")
// The whole point of the fallback is that downstream cannot tell the difference,
// so the proof is that records survive a round trip through the fixed-column
// layout that every later stage reads.
const records = [
  { odsCode: "RJ1", name: "Guy's and St Thomas' NHS Foundation Trust", address: [], postcode: "SE1 7EH", parentCode: null, openDate: null },
  // A comma in the name is what breaks a naive CSV writer, and it silently
  // shifts every later column — including the postcode.
  { odsCode: "RJ122", name: "St Thomas' Hospital, Lambeth", address: ["Westminster Bridge Road"], postcode: "SE1 7EH", parentCode: "RJ1", openDate: null },
  { odsCode: "RP401", name: 'Quote "Test" Hospital', address: [], postcode: "WC1N 3JH", parentCode: "RP4", openDate: null },
]
const csv = recordsToCsv(records)
const rows = parseCsv(csv)

check("emits the published column count", rows.every((r) => r.length === ODS_EXPECTED_FIELDS), String(rows[0]?.length))
const { records: parsed, skipped } = parseOdsRows(rows, { sourceName: "ord-test" })
check("every record survives the round trip", parsed.length === 3, `${parsed.length}, skipped ${JSON.stringify(skipped)}`)
check("a comma in a name does not shift columns", parsed[1].postcode === "SE1 7EH", parsed[1].postcode)
check("keeps the name intact", parsed[1].name === "St Thomas' Hospital, Lambeth", parsed[1].name)
check("quotes survive", parsed[2].name === 'Quote "Test" Hospital', parsed[2].name)
check("carries the parent trust code", parsed[1].parentCode === "RJ1", String(parsed[1].parentCode))
check("a trust has no parent", parsed[0].parentCode === null, String(parsed[0].parentCode))
check("synthesised rows are treated as open", skipped.closed === 0, JSON.stringify(skipped))

group("fetch-ods source chain")
const backup = join(mkdtempSync(join(tmpdir(), "wayfinder-fallback-test-")), "data")
cpSync("data", backup, { recursive: true })

try {
  // --use-local must prefer a file that is already there over any network call.
  // This is the escape hatch for a machine where every host is refused, which is
  // exactly the situation this sandbox is in — so it is genuinely exercised.
  mkdirSync("data/raw/ods", { recursive: true })
  writeFileSync("data/raw/ods/etr.csv", csv)
  writeFileSync("data/raw/ods/ets.csv", csv)

  let out = ""
  let failed = false
  try {
    out = execFileSync("node", ["scripts/nhs/fetch-ods.mjs", "--use-local"], { encoding: "utf8" })
  } catch (err) {
    failed = true
    out = String(err.stdout ?? "") + String(err.stderr ?? "")
  }

  check("uses the local file without touching the network", /via local file/.test(out), out.slice(-400))
  check("succeeds on required sources from local files", !failed, out.slice(-400))

  const manifest = JSON.parse(readFileSync("data/manifest.json", "utf8"))
  check("records which source was used", manifest["ods.etr"]?.via === "local file", JSON.stringify(manifest["ods.etr"]))
  check("still hashes what it wrote", /^[0-9a-f]{64}$/.test(manifest["ods.etr"]?.sha256 ?? ""), manifest["ods.etr"]?.sha256)

  // Without --use-local and with no network, every source is refused and the
  // stage must fail with the manual instructions rather than a bare stack trace.
  rmSync("data/manifest.json", { force: true })
  let offlineOut = ""
  let offlineFailed = false
  try {
    offlineOut = execFileSync("node", ["scripts/nhs/fetch-ods.mjs"], { encoding: "utf8", stdio: "pipe" })
  } catch (err) {
    offlineFailed = true
    offlineOut = String(err.stdout ?? "") + String(err.stderr ?? "")
  }
  check("tries the ORD API when the download is refused", /trying the ORD API/.test(offlineOut), offlineOut.slice(0, 400))
  // Asking this service for application/json gets a 406 while the same URL with
  // no Accept header returns 200, so the client negotiates rather than assuming.
  // If it ever stops trying the alternatives, that is silent breakage.
  for (const variant of ["no Accept header", "Accept: \\*/\\*", "Accept: application/json"]) {
    check(`negotiates ${variant.replace(/\\/g, "")}`, new RegExp(variant).test(offlineOut), offlineOut.slice(0, 300))
  }
  check("also tries dropping the Status filter", /without Status/.test(offlineOut), offlineOut.slice(0, 300))
  // A bare status code is a poor diagnostic when the run is on someone else's
  // machine; the server's own explanation is usually the answer.
  check("reports the server's explanation, not just the code", /-> HTTP \d+ [^—]*— \S/.test(offlineOut), offlineOut.slice(0, 400))
  check("falls back to an existing file before giving up", /may be out of date/.test(offlineOut), offlineOut.slice(-500))
  // With a stale local file present it should still succeed — losing the
  // network must not lose a register we already have.
  check("survives on a stale local file", !offlineFailed, offlineOut.slice(-400))

  // With nothing on disk and nothing reachable, it must fail and say what to do.
  rmSync("data/raw", { recursive: true, force: true })
  let bareOut = ""
  let bareFailed = false
  try {
    execFileSync("node", ["scripts/nhs/fetch-ods.mjs"], { encoding: "utf8", stdio: "pipe" })
  } catch (err) {
    bareFailed = true
    bareOut = String(err.stdout ?? "") + String(err.stderr ?? "")
  }
  check("fails when no source is available at all", bareFailed)
  check("tells the user how to supply the file by hand", /--use-local/.test(bareOut), bareOut.slice(-400))
  check("does not blame the internet connection", !/check (your |the )?internet/i.test(bareOut), bareOut.slice(-400))
} finally {
  rmSync("data", { recursive: true, force: true })
  cpSync(backup, "data", { recursive: true })
  rmSync(join(backup, ".."), { recursive: true, force: true })
  if (!existsSync("src/lib/venues/generated-sheets.ts")) {
    execFileSync("node", ["scripts/nhs/generate-registry.mjs"], { encoding: "utf8" })
  }
}

report()
