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
import { normaliseFloors } from "../../maps/sheets.mjs"

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

group("floors of one building")
// Trusts publish a hospital's levels as separate PDFs — Southampton's Princess
// Anne is nine, Lincoln three, Southend three. Left as one venue each they
// become nine pins on one address instead of one building you can move through.
//
// Both consumers see one shape: every sheet comes back with a `floors` array,
// synthesised when the sheet does not declare one. Making the single-floor case
// special inside each script is how generate-all and build-venues drifted apart
// before.
{
  const legacy = normaliseFloors({ slug: "wythenshawe", file: "map/w.pdf", page: 1, plan: [0, 0.02, 1, 0.72] })
  check("a sheet with no floors still has one", legacy.length === 1)
  check("and it is the ground floor", legacy[0].floor === 0 && legacy[0].label === "Ground Floor")
  check("it carries the sheet's own file and crop", legacy[0].file === "map/w.pdf" && legacy[0].plan[3] === 0.72)
  // public/floorplans is full of sitemap.svg and the venues point at it.
  // Renaming would be one silent 404 per venue.
  check("the existing image name is preserved", legacy[0].image === "sitemap")

  const multi = normaliseFloors({
    slug: "princess-anne",
    plan: [0, 0, 1, 1],
    floors: [
      { id: "fc", floor: 0, label: "Level C", file: "map/pah-c.pdf", page: 1 },
      { id: "fd", floor: 1, label: "Level D", file: "map/pah-d.pdf", page: 1, plan: [0, 0.1, 1, 0.9] },
    ],
  })
  check("declared floors come through", multi.length === 2)
  check("each floor images to its own file", multi[0].image === "fc" && multi[1].image === "fd")
  check("a floor with no crop inherits the sheet's", multi[0].plan[3] === 1)
  check("and a floor with its own keeps it", multi[1].plan[1] === 0.1)

  const throws = (sheet) => { try { normaliseFloors(sheet); return false } catch { return true } }
  // Two floors sharing an id overwrite each other's SVG; two sharing a storey
  // stack their waypoints on one level. Both build cleanly and navigate wrongly.
  check("a repeated floor id is refused", throws({
    slug: "x", plan: [0, 0, 1, 1],
    floors: [{ id: "f0", floor: 0, label: "A", file: "a.pdf", page: 1 }, { id: "f0", floor: 1, label: "B", file: "b.pdf", page: 1 }],
  }))
  check("a repeated storey is refused", throws({
    slug: "x", plan: [0, 0, 1, 1],
    floors: [{ id: "f0", floor: 2, label: "A", file: "a.pdf", page: 1 }, { id: "f1", floor: 2, label: "B", file: "b.pdf", page: 1 }],
  }))
  check("an empty floors array is refused", throws({ slug: "x", plan: [0, 0, 1, 1], floors: [] }))
  check("a floor missing its file is refused", throws({
    slug: "x", plan: [0, 0, 1, 1], floors: [{ id: "f0", floor: 0, label: "A", page: 1 }],
  }))
  // A non-numeric storey would reach the venue as `floor: undefined` and put the
  // waypoints on no level at all.
  check("a non-numeric storey is refused", throws({
    slug: "x", plan: [0, 0, 1, 1], floors: [{ id: "f0", floor: "ground", label: "A", file: "a.pdf", page: 1 }],
  }))

  // Which floor a venue opens on. The app hardcoded 0, which was right while
  // every generated venue had exactly one ground-floor plan and wrong the moment
  // one did not: Princess Anne's levels are lettered A upward and only C to H
  // have usable plans, so its storeys run 2 to 7 and floor 0 shows nothing.
  // Mirrors openingFloor in src/lib/venues/index.ts, which TypeScript checks but
  // no runner here can import.
  const openingFloor = (floorPlans) => (floorPlans.length ? Math.min(...floorPlans.map((p) => p.floor)) : 0)
  check("a single ground-floor site plan still opens at 0", openingFloor([{ floor: 0 }]) === 0)
  check(
    "a building whose plans start above ground opens on its lowest",
    openingFloor([{ floor: 2 }, { floor: 3 }, { floor: 7 }]) === 2
  )
  check("a basement opens below ground", openingFloor([{ floor: -1 }, { floor: 0 }]) === -1)
  check("a venue with no plans falls back to 0", openingFloor([]) === 0)
}

report()
