// Run the downstream pipeline (approve -> fetch -> draft -> rasterize -> build)
// one country at a time, instead of across every country in a single process.
//
// This machine is memory-constrained, and running fetch-plans/draft-sheets
// (PDF downloads, pdfjs text extraction, SVG rasterisation) across 150+
// countries' worth of sources in one process is what crashed it with an
// out-of-memory error. A fresh `node` process per country per stage means
// each one's memory is freed when it exits, before the next starts — the
// total work is the same, but no single process ever holds more than one
// country's worth of PDFs and extracted text at once.
//
// generate-registry/build-sites/generate-venues run after EVERY country, by
// explicit request — the app's venue list should pick up each country as
// soon as it's done, not wait for the whole multi-day global run to finish.
// They're cheap aggregation (read JSON, write one file) even re-run this
// often; the cost is re-scanning all of src/lib/venues/ (readMappedVenues)
// once per country instead of once per run, which is fine at this scale.
//
// Run: node scripts/world/ingest-all.mjs
import { execFileSync } from "child_process"
import { countriesFromArgs } from "./lib/osm.mjs"
import { log } from "../nhs/lib/paths.mjs"

const STAGE = "world-ingest-all"
const STAGES = ["approve-plans.mjs", "fetch-plans.mjs", "draft-sheets.mjs", "generate-floorplans.mjs", "build-venues.mjs"]
const AGGREGATE_STAGES = ["generate-registry.mjs", "build-sites.mjs", "generate-venues.mjs"]

const countries = countriesFromArgs()
log(STAGE, `${countries.length} country(ies) to ingest, one at a time`)

let done = 0
for (const cc of countries) {
  for (const stage of STAGES) {
    try {
      execFileSync("node", [`scripts/world/${stage}`, "--country", cc], { stdio: "inherit" })
    } catch (err) {
      // A single stage failing for a single country (a crash, a bad PDF) is
      // not worth aborting the whole run over — log it and move to the next
      // country. Whatever that stage half-wrote is exactly what resuming
      // without --force already knows how to pick up correctly next time.
      console.error(`[${STAGE}] ${cc} ${stage} failed: ${err.message}`)
    }
  }
  for (const stage of AGGREGATE_STAGES) {
    try {
      execFileSync("node", [`scripts/world/${stage}`], { stdio: "inherit" })
    } catch (err) {
      console.error(`[${STAGE}] ${cc} ${stage} (aggregate) failed: ${err.message}`)
    }
  }
  done++
  log(STAGE, `${cc} done (${done}/${countries.length}), app venue list refreshed`)
}

log(STAGE, "done")
