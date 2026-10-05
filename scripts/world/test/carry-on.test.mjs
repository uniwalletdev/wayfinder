// Checks when a world-data run starts the next one by itself
// (scripts/world/carry-on.mjs).
//
// Run: node scripts/world/test/carry-on.test.mjs
import { nextRun } from "../carry-on.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

const status = (countries, fetchedNew) => ({ countries, fetchedNew })
const done = { complete: true }
const open = { complete: false, left: 3 }

group("nextRun")
{
  const r = nextRun(status({ LU: done, KE: open, NG: open, US: open }, 12), 0, 8)
  check("carries on with the countries still held back, in order", r.countries.join(",") === "KE,NG,US")
  check("counts the run in the chain", r.chain === 1 && /run 1 of at most 8/.test(r.why))
  check("stops when every country is complete", nextRun(status({ LU: done, KE: done }, 5), 0, 8).countries.length === 0)
  const stalled = nextRun(status({ KE: open }, 0), 2, 8)
  check("stops when the run kept nothing new, and says what is still held back", stalled.countries.length === 0 && /nothing new/.test(stalled.why) && /KE/.test(stalled.why))
  check("a missing count of new areas counts as none", nextRun({ countries: { KE: open } }, 0, 8).countries.length === 0)
  const capped = nextRun(status({ US: open }, 4), 8, 8)
  check("stops after the most runs in a row", capped.countries.length === 0 && /8 runs in a row/.test(capped.why))
  check("carries on just under the cap", nextRun(status({ US: open }, 4), 7, 8).chain === 8)
  check("stops with no status at all", nextRun(null, 0, 8).countries.length === 0)
}

report()
