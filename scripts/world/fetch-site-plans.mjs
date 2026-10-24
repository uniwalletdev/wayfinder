// Run the site-plans stages (discover -> approve -> fetch -> draft ->
// rasterize -> build) in sequence for the given countries: crawl each
// hospital's own website for a real floor-plan PDF, the complement to
// fetch-indoor.mjs/fetch-campus.mjs (which only see what OpenStreetMap
// volunteers tagged). Each stage is scripts/world/site-plans/*.mjs, adapted
// from backup/legacy-world-pipeline — see that directory's lib.mjs header.
//
// Run AFTER build.mjs, BEFORE publish.mjs (see world-data.yml): build.mjs
// deletes any public/world/venues/ file it doesn't recognise, and this
// stage's build step is meant to overwrite a same-hospital sparse OSM venue
// with a richer crawled one, not race it.
//
// Run: node scripts/world/fetch-site-plans.mjs --countries US,CA
import { execFileSync } from "child_process"
import { log } from "../nhs/lib/paths.mjs"

const STAGE = "site-plans"
const i = process.argv.indexOf("--countries")
if (i === -1) {
  console.error(`[${STAGE}] --countries is required (comma-separated ISO codes)`)
  process.exit(1)
}
const countries = process.argv[i + 1]

const STAGES = ["discover.mjs", "approve.mjs", "fetch.mjs", "draft.mjs"]
for (const stage of STAGES) {
  try {
    execFileSync("node", [`scripts/world/site-plans/${stage}`, "--countries", countries], { stdio: "inherit" })
  } catch (err) {
    // A stage failing for this batch of countries (a crawl crash, a bad PDF)
    // isn't worth aborting the whole run over — whatever it half-wrote is
    // exactly what the next stage, or a re-run, picks up from.
    console.error(`[${STAGE}] ${stage} failed: ${err.message}`)
  }
}
// rasterize/build read mapped-sites.json whole, not filtered by --countries
// (draft.mjs already scoped what's in it to this run's countries plus
// whatever an earlier run for other countries left there) — no --countries
// argument for these two.
for (const stage of ["rasterize.mjs", "build.mjs"]) {
  try {
    execFileSync("node", [`scripts/world/site-plans/${stage}`], { stdio: "inherit" })
  } catch (err) {
    console.error(`[${STAGE}] ${stage} failed: ${err.message}`)
  }
}
log(STAGE, "done")
