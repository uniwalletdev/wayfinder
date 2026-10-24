// Download the approved floor-plan PDFs. Unchanged from backup/legacy-
// world-pipeline's scripts/world/fetch-plans.mjs. Downloads land in
// map/world/, gitignored like NHS's map/ — this CI job's own temp disk, torn
// down with the runner.
//
// Run: node scripts/world/site-plans/fetch.mjs --countries US,CA
import { writeFileSync } from "fs"
import { dirname } from "path"
import { fetchBuffer } from "../../nhs/lib/net.mjs"
import { dataPath, repoPath, readJson, writeJson, ensureDir, log } from "../../nhs/lib/paths.mjs"
import { countriesFromArgs } from "./lib.mjs"

const STAGE = "site-plans-fetch"
const COUNTRIES = countriesFromArgs()

for (const countryCode of COUNTRIES) {
  const sourcesPath = dataPath("world", `plan-sources-${countryCode.toLowerCase()}.json`)
  const doc = readJson(sourcesPath)
  if (!doc) {
    log(STAGE, `${countryCode}: no plan-sources file — approve.mjs found nothing or wasn't run`)
    continue
  }

  const pending = (doc.sources ?? []).filter((s) => s.url)
  log(STAGE, `${countryCode}: ${pending.length} source(s) with a URL`)

  let failures = 0
  for (const source of pending) {
    const target = repoPath(source.file)
    try {
      const { buf, sha256, contentType } = await fetchBuffer(source.url)
      if (!/pdf/i.test(contentType) && !buf.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
        throw new Error(`not a PDF (content-type: ${contentType || "none"})`)
      }
      ensureDir(dirname(target))
      writeFileSync(target, buf)
      source.sha256 = sha256
      source.bytes = buf.length
      source.fetchedAt = new Date().toISOString()
      log(STAGE, `${source.file} <- ${source.url} (${(buf.length / 1024).toFixed(0)}KB)`)
    } catch (err) {
      failures++
      console.error(`[${STAGE}] FAILED ${source.file}: ${err.message}`)
    }
  }

  writeJson(sourcesPath, doc)
  log(STAGE, `${countryCode}: done: ${pending.length - failures} fetched, ${failures} failed`)
}
