// Download the floor-plan PDFs approved for hospitals outside NHS England.
//
// Mirrors scripts/nhs/fetch-plans.mjs. Reads data/world/plan-sources-<cc>.json
// (written by approve-plans.mjs in this directory) — never the candidates
// file, for the same reason the NHS stage doesn't: candidates are only what
// discovery happened to find.
//
// Downloads land in map/world/, which is untracked like map/ — the repo ships
// the derived SVGs, not a mirror of other organisations' PDFs.
//
// Run: node scripts/world/fetch-plans.mjs --country US
import { writeFileSync } from "fs"
import { dirname } from "path"
import { fetchBuffer } from "../nhs/lib/net.mjs"
import { dataPath, repoPath, readJson, writeJson, ensureDir, log } from "../nhs/lib/paths.mjs"
import { countriesFromArgs } from "./lib/osm.mjs"

const STAGE = "world-fetch-plans"
const COUNTRIES = countriesFromArgs()

for (const countryCode of COUNTRIES) {
  const sourcesPath = dataPath("world", `plan-sources-${countryCode.toLowerCase()}.json`)
  const doc = readJson(sourcesPath)
  if (!doc) {
    log(STAGE, `${countryCode}: no plan-sources file — run approve-plans.mjs --country ${countryCode} first`)
    continue
  }

  const pending = (doc.sources ?? []).filter((s) => s.url)
  log(STAGE, `${countryCode}: ${pending.length} source(s) with a URL`)

  let failures = 0
  let changed = 0
  for (const source of pending) {
    const target = repoPath(source.file)
    try {
      const { buf, sha256, contentType } = await fetchBuffer(source.url)
      if (!/pdf/i.test(contentType) && !buf.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
        throw new Error(`not a PDF (content-type: ${contentType || "none"})`)
      }
      if (source.sha256 && source.sha256 !== sha256) {
        console.warn(
          `[${STAGE}] ${source.file}: upstream CHANGED (was ${source.sha256.slice(0, 12)}…, now ${sha256.slice(0, 12)}…).`
        )
        changed++
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
  log(STAGE, `${countryCode}: done: ${pending.length - failures} fetched, ${failures} failed, ${changed} upstream change(s)`)
}
