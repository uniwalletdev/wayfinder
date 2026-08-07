// Stage 7 — download the floor-plan PDFs that a human has approved.
//
// Reads data/plan-sources.json, which is the approved list — NOT
// plan-candidates.json, which is only what discovery happened to find. Nothing
// gets downloaded until someone has moved it across, because these PDFs are the
// trusts' copyright and the decision to use one is a judgement, not a match.
//
// Downloads land in map/, which is deliberately untracked: the repo ships the
// derived SVGs it needs, not a mirror of other organisations' PDFs. Recording
// each URL and hash here is what makes scripts/maps/generate-all.mjs
// reproducible without redistributing the sources.
//
// Run: node scripts/nhs/fetch-plans.mjs
import { writeFileSync } from "fs"
import { dirname } from "path"
import { fetchBuffer } from "./lib/net.mjs"
import { dataPath, repoPath, readJson, writeJson, ensureDir, log } from "./lib/paths.mjs"

const STAGE = "fetch-plans"
const SOURCES = dataPath("plan-sources.json")

const doc = readJson(SOURCES)
if (!doc) {
  console.error(`[${STAGE}] missing data/plan-sources.json — nothing approved to download`)
  process.exit(1)
}

const pending = (doc.sources ?? []).filter((s) => s.url)
const unsourced = (doc.sources ?? []).filter((s) => !s.url)
log(STAGE, `${pending.length} source(s) with a URL, ${unsourced.length} awaiting one`)

let failures = 0
let changed = 0
for (const source of pending) {
  const target = repoPath(source.file)
  try {
    const { buf, sha256, contentType } = await fetchBuffer(source.url)
    if (!/pdf/i.test(contentType) && !buf.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
      throw new Error(`not a PDF (content-type: ${contentType || "none"})`)
    }
    // A recorded hash is a contract: if the trust has republished a different
    // map, that must surface as an explicit change rather than silently
    // regenerating every waypoint on the next build.
    if (source.sha256 && source.sha256 !== sha256) {
      console.warn(
        `[${STAGE}] ${source.file}: upstream CHANGED (was ${source.sha256.slice(0, 12)}…, now ${sha256.slice(0, 12)}…). ` +
          `Re-check the map, then update the hash in data/plan-sources.json.`
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

writeJson(SOURCES, doc)

for (const s of unsourced) {
  log(STAGE, `no URL recorded for ${s.file} — add one so this sheet becomes reproducible`)
}
log(STAGE, `done: ${pending.length - failures} fetched, ${failures} failed, ${changed} upstream change(s)`)
if (failures) process.exit(1)
