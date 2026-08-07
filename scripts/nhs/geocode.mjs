// Stage 2 — turn ODS postcodes into coordinates.
//
// ODS gives every site a postcode but no latitude/longitude, and a map needs
// coordinates. postcodes.io wraps the ONS Postcode Directory, needs no API key,
// and takes 100 postcodes per bulk POST — so the whole NHS estate is ~30 calls
// rather than 2,500.
//
// Results accumulate in data/geocode-cache.json, keyed by postcode. A monthly
// refresh then only pays for postcodes it hasn't seen, which keeps the scheduled
// workflow cheap and, more importantly, keeps it working if postcodes.io is down
// — a failed lookup leaves the previous coordinates in place instead of blanking
// a site off the map.
//
// Run: node scripts/nhs/geocode.mjs
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { fetchRetry } from "./lib/net.mjs"
import { parseCsv } from "./lib/csv.mjs"
import { parseOdsRows, normalisePostcode } from "./lib/ods.mjs"
import { RAW_DIR, dataPath, readJson, writeJson, log } from "./lib/paths.mjs"

const STAGE = "geocode"
const BULK_ENDPOINT = "https://api.postcodes.io/postcodes"
const BATCH = 100
const CACHE = dataPath("geocode-cache.json")

// Postcodes for sites that have closed or moved are "terminated" — postcodes.io
// still knows roughly where they were, via a separate endpoint. Worth the extra
// call: an approximate position is far better than dropping a live hospital
// because its postcode was retired in a boundary change.
async function geocodeTerminated(postcode) {
  try {
    const res = await fetchRetry(
      `https://api.postcodes.io/terminated_postcodes/${encodeURIComponent(postcode)}`,
      {},
      { retries: 1 }
    )
    const body = await res.json()
    const r = body?.result
    if (r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)) {
      return { lat: r.latitude, lng: r.longitude, source: "postcodes.io/terminated" }
    }
  } catch {
    // Falls through to unresolved; the caller reports the count.
  }
  return null
}

async function geocodeBatch(postcodes) {
  const res = await fetchRetry(BULK_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ postcodes }),
  })
  const body = await res.json()
  const found = new Map()
  for (const item of body?.result ?? []) {
    const r = item?.result
    if (r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)) {
      found.set(normalisePostcode(item.query), {
        lat: r.latitude,
        lng: r.longitude,
        district: r.admin_district ?? null,
        country: r.country ?? null,
        source: "postcodes.io",
      })
    }
  }
  return found
}

// Collect every postcode the pipeline needs, across all ODS extracts we hold.
function postcodesFromRaw() {
  const wanted = new Set()
  for (const key of ["ets", "etr", "epraccur"]) {
    const path = join(RAW_DIR, "ods", `${key}.csv`)
    if (!existsSync(path)) continue
    const { records } = parseOdsRows(parseCsv(readFileSync(path, "utf8")), { sourceName: key })
    for (const r of records) wanted.add(r.postcode)
  }
  return [...wanted]
}

const cache = readJson(CACHE, {})
const wanted = postcodesFromRaw()
if (!wanted.length) {
  console.error(`[${STAGE}] no ODS extracts found in data/raw/ods — run fetch-ods.mjs first`)
  process.exit(1)
}

const missing = wanted.filter((pc) => !cache[pc])
log(STAGE, `${wanted.length} distinct postcodes, ${cache ? Object.keys(cache).length : 0} cached, ${missing.length} to look up`)

let resolved = 0
let terminated = 0
for (let i = 0; i < missing.length; i += BATCH) {
  const batch = missing.slice(i, i + BATCH)
  const found = await geocodeBatch(batch)
  for (const pc of batch) {
    const hit = found.get(pc)
    if (hit) { cache[pc] = hit; resolved++ }
  }
  log(STAGE, `batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(missing.length / BATCH)} — ${found.size}/${batch.length} resolved`)
}

// Second pass for anything the live directory didn't know about.
for (const pc of missing) {
  if (cache[pc]) continue
  const hit = await geocodeTerminated(pc)
  if (hit) { cache[pc] = hit; terminated++ }
}

const unresolved = wanted.filter((pc) => !cache[pc])
writeJson(CACHE, Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]])))

log(STAGE, `resolved ${resolved} live + ${terminated} terminated; ${unresolved.length} still unresolved`)
if (unresolved.length) {
  log(STAGE, `unresolved sample: ${unresolved.slice(0, 10).join(", ")}`)
}

// A handful of unresolvable postcodes is normal (very new builds, some Welsh and
// Scottish entries in shared extracts). A large fraction means the API contract
// changed or we were rate-limited into uselessness, and the run should fail
// rather than quietly halving the map.
if (wanted.length && unresolved.length / wanted.length > 0.05) {
  console.error(
    `[${STAGE}] FAILED: ${unresolved.length}/${wanted.length} postcodes unresolved (>5%). ` +
      `Check postcodes.io availability before trusting this run.`
  )
  process.exit(1)
}
log(STAGE, "done")
