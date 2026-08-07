// End-to-end check of the offline half of the pipeline — build-sites and
// generate-venues — driven by synthetic ODS fixtures.
//
// The behaviour that matters most here is the exclusion of already-mapped
// venues. Get it wrong and a hospital with a real surveyed interior gets a
// second, unnavigable pin sitting on top of it; that used to be prevented by a
// hand-written prose comment, and this is what replaced it.
//
// Fixtures are written into data/ and the real contents restored afterwards.
//
// Run: node scripts/nhs/test/build.test.mjs
import { execFileSync } from "child_process"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { REPO_ROOT } from "../lib/paths.mjs"
import { group, check, report } from "./harness.mjs"

process.chdir(REPO_ROOT)

const backup = join(mkdtempSync(join(tmpdir(), "wayfinder-nhs-test-")), "data")
cpSync("data", backup, { recursive: true })
const originalVenueData = readFileSync("src/lib/venues/nhs-hospitals-data.ts", "utf8")

const FIELDS = 27
function row({ code, name, postcode, parent = "RJ1", addr = "1 Test Road", close = "", status = "A" }) {
  const r = new Array(FIELDS).fill("")
  r[0] = code; r[1] = name; r[4] = addr; r[9] = postcode
  r[10] = "19910401"; r[11] = close; r[12] = status; r[14] = parent
  return r.join(",")
}

const run = (script) => execFileSync("node", [script], { encoding: "utf8" })

try {
  mkdirSync("data/raw/ods", { recursive: true })

  writeFileSync("data/raw/ods/etr.csv", [
    row({ code: "RJ1", name: "GUY'S AND ST THOMAS' NHS FOUNDATION TRUST", postcode: "SE1 7EH", parent: "" }),
    row({ code: "RP4", name: "GREAT ORMOND STREET HOSPITAL FOR CHILDREN NHS FOUNDATION TRUST", postcode: "WC1N 3JH", parent: "" }),
  ].join("\n") + "\n")

  writeFileSync("data/raw/ods/ets.csv", [
    // An ordinary directory site, nowhere near a mapped venue — must be kept.
    row({ code: "RJ122", name: "ST THOMAS' HOSPITAL", postcode: "SE1 7EH" }),
    // Sits exactly on a fully-mapped venue, but ODS calls it "Great Ormond
    // Street Hospital For Children" while the venue module calls itself "GOSH
    // Wayfinder" — zero shared words. Only data/venue-aliases.json catches this.
    row({ code: "RP401", name: "GREAT ORMOND STREET HOSPITAL FOR CHILDREN", postcode: "WC1N 3JH", parent: "RP4" }),
    // Name matches its mapped venue directly — must be excluded with no alias.
    row({ code: "RQM91", name: "CHARING CROSS HOSPITAL", postcode: "W6 8RF", parent: "RQM" }),
    // An administrative registration — must never become a hospital pin.
    row({ code: "RJ1HQ", name: "TRUST HEAD OFFICE", postcode: "SE1 7EH" }),
    // Closed — must be dropped.
    row({ code: "RJ199", name: "OLD HOSPITAL", postcode: "SE1 7EH", close: "20200101" }),
  ].join("\n") + "\n")

  writeFileSync("data/geocode-cache.json", JSON.stringify({
    "SE1 7EH": { lat: 51.4989, lng: -0.1187, source: "test" },
    "WC1N 3JH": { lat: 51.52267, lng: -0.1199, source: "test" }, // GOSH's own coordinates
    "W6 8RF": { lat: 51.487045, lng: -0.219921, source: "test" }, // Charing Cross's
  }))

  writeFileSync("data/footprints.geojson", JSON.stringify({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { osmId: "way/1", name: "St Thomas' Hospital", odsCode: "RJ122" },
      geometry: { type: "Polygon", coordinates: [[[-0.119, 51.498], [-0.118, 51.498], [-0.118, 51.499], [-0.119, 51.498]]] },
    }],
  }))

  group("build-sites")
  const buildOut = run("scripts/nhs/build-sites.mjs")
  const data = JSON.parse(readFileSync("data/nhs-sites.json", "utf8"))
  const byCode = Object.fromEntries(data.sites.map((s) => [s.odsCode, s]))

  check("drops closed sites", !byCode.RJ199)
  check("drops administrative registrations", !byCode.RJ1HQ, "a head office became a map pin")
  check("keeps real hospitals", !!byCode.RJ122)
  check("joins the parent trust name", byCode.RJ122?.trustName === "Guy's and St Thomas' NHS Foundation Trust", byCode.RJ122?.trustName)
  check("counts footprints per site", byCode.RJ122?.footprints === 1, String(byCode.RJ122?.footprints))
  check("leaves an ordinary site unmapped", byCode.RJ122?.mappedVenueSlug === null)
  check("excludes a mapped venue found only via its alias", byCode.RP401?.mappedVenueSlug === "gosh", String(byCode.RP401?.mappedVenueSlug))
  check("excludes a mapped venue matched on its own name", byCode.RQM91?.mappedVenueSlug === "charing-cross", String(byCode.RQM91?.mappedVenueSlug))
  check("records source attribution", !!data.attribution?.ods && !!data.attribution?.osm)
  check("reports the exclusions it made", /excluded as already fully mapped/.test(buildOut))

  group("generate-venues")
  run("scripts/nhs/generate-venues.mjs")
  const generated = readFileSync("src/lib/venues/nhs-hospitals-data.ts", "utf8")

  check("emits the kept site", generated.includes("\"St Thomas' Hospital\""))
  check("omits the aliased mapped venue", !generated.includes("Great Ormond Street"), "GOSH leaked into the directory")
  check("omits the name-matched mapped venue", !generated.includes("Charing Cross"))
  check("carries the ODS code through", generated.includes('"RJ122"'))
  check("carries the postcode through", generated.includes('"SE1 7EH"'))
  check("marks the file as generated", generated.startsWith("// GENERATED FILE"))
  check("sets the generated-at export", /NHS_DATA_GENERATED_AT = "\d{4}-/.test(generated))

  group("guard rails")
  // Losing a site's position drops it. Dropping a few is normal; dropping a
  // tenth of the estate means the geocoder misbehaved, and shipping a quietly
  // shrunken national directory is worse than failing the run.
  writeFileSync("data/geocode-cache.json", JSON.stringify({
    "SE1 7EH": { lat: 0, lng: 0, source: "test" }, // null island
    "WC1N 3JH": { lat: 51.52267, lng: -0.1199, source: "test" },
    "W6 8RF": { lat: 51.487045, lng: -0.219921, source: "test" },
  }))
  let stderr = ""
  let rejected = false
  try {
    execFileSync("node", ["scripts/nhs/build-sites.mjs"], { encoding: "utf8", stdio: "pipe" })
  } catch (err) {
    rejected = true
    stderr = String(err.stderr ?? "")
  }
  check("fails when too many sites lose their position", rejected, "a null-island coordinate was accepted silently")
  check("says why it failed", /had no usable position/.test(stderr), stderr.slice(0, 200))
} finally {
  rmSync("data", { recursive: true, force: true })
  cpSync(backup, "data", { recursive: true })
  rmSync(join(backup, ".."), { recursive: true, force: true })
  writeFileSync("src/lib/venues/nhs-hospitals-data.ts", originalVenueData)
}

report()
