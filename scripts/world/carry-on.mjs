// After a run: should the next one start by itself, and for which countries?
// (.github/workflows/world-data.yml, the "Carry on" steps.)
//
// A country whose grounds did not all come in is held back from publishing
// (publish.mjs) until a run completes it. Rather than wait for someone to
// press Run workflow, or for next month's schedule, the run starts the next
// one itself, for just the countries still held back, reusing everything
// fetched so far — as many runs as it takes. It stops when every country is
// complete; when a run kept nothing new (the servers are down, or the areas
// left cannot be answered, and another run would spend its five hours the same
// way); or after `max` runs in a row; and says which.
//
// Run: node scripts/world/carry-on.mjs — reads data/world/campus-raw/status.json
// and CHAIN, CARRY_ON_MAX from the environment; writes `countries` and `chain`
// to $GITHUB_OUTPUT and a line to $GITHUB_STEP_SUMMARY.
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function nextRun(status, chain, max) {
  if (!status) return { countries: [], why: "no grounds status from this run" }
  const held = Object.entries(status.countries ?? {})
    .filter(([, c]) => !c.complete)
    .map(([k]) => k)
  if (!held.length) return { countries: [], held, why: "every country this run covered is complete" }
  if (!(status.fetchedNew > 0)) return { countries: [], held, why: `nothing new came in this run, so another would go the same way; still held back: ${held.join(", ")}` }
  if (chain >= max) return { countries: [], held, why: `${max} runs in a row have carried on; start the next by hand. Still held back: ${held.join(", ")}` }
  return { countries: held, held, chain: chain + 1, why: `carrying on with ${held.join(", ")} (run ${chain + 1} of at most ${max} in a row)` }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = "data/world/campus-raw/status.json"
  const status = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null
  const r = nextRun(status, Number(process.env.CHAIN) || 0, Number(process.env.CARRY_ON_MAX) || 8)
  console.log(r.why)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `countries=${r.countries.join(",")}\nchain=${r.chain ?? ""}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- next run: ${r.why}\n`)
}
