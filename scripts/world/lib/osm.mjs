// Hospital directory for everywhere that isn't NHS England.
//
// There is no single "every hospital in country X, with its website" API once
// you leave NHS ORD. OpenStreetMap is the closest global approximation:
// hospitals are tagged amenity=hospital, and a fraction of them carry a
// website (or contact:website) tag that discover-plans.mjs can actually crawl.
// Coverage is whatever volunteers have mapped, so this is a floor on what
// exists, not a census — unmapped or website-less hospitals are invisible to
// it, same as a trust with no ODS record would be invisible to the NHS stage.
//
// Overpass is a shared public service with a strict fair-use policy: one query
// in flight, a generous per-query timeout, an honest User-Agent. Mirrors are
// tried in order on failure only, never in parallel — that would just be
// hitting the same community resource from two directions at once.
import { readdirSync } from "fs"
import { fetchRetry } from "../../nhs/lib/net.mjs"
import { dataPath, readJson, writeJson, log } from "../../nhs/lib/paths.mjs"

const STAGE = "osm-hospitals"
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]

function queryFor(countryCode) {
  // Nodes and ways only — relations (multipolygon hospital campuses) are rare
  // and their "center" is unreliable without a full geometry pass we don't need
  // here; a located pin just has to be close enough to identify the site.
  return `[out:json][timeout:180];
area["ISO3166-1:alpha2"="${countryCode}"][admin_level=2][boundary=administrative]->.a;
(
  node["amenity"="hospital"]["website"](area.a);
  way["amenity"="hospital"]["website"](area.a);
  node["amenity"="hospital"]["contact:website"](area.a);
  way["amenity"="hospital"]["contact:website"](area.a);
);
out center tags;`
}

function websiteOf(tags) {
  const raw = tags?.website ?? tags?.["contact:website"]
  if (!raw) return null
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin
  } catch {
    return null
  }
}

function toRecord(el, countryCode) {
  const tags = el.tags ?? {}
  const origin = websiteOf(tags)
  const name = tags.name ?? tags["name:en"] ?? null
  if (!origin || !name) return null
  const lat = el.center?.lat ?? el.lat
  const lng = el.center?.lon ?? el.lon
  return {
    // osm:<type>/<id> rather than a sequential index, so a re-fetch that finds
    // the same hospital again produces the same code — crawled.json resume
    // logic in discover-plans.mjs keys on this exactly like an ODS code.
    code: `osm:${el.type}/${el.id}`,
    name,
    countryCode,
    origin,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  }
}

async function queryOverpass(countryCode, { onLog } = {}) {
  const query = queryFor(countryCode)
  let lastErr
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetchRetry(
        endpoint,
        {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: { "content-type": "application/x-www-form-urlencoded" },
        },
        { retries: 1, timeoutMs: 200_000, baseMs: 5000 }
      )
      const body = await res.json()
      const elements = Array.isArray(body?.elements) ? body.elements : []
      onLog?.(`  ${endpoint}: ${elements.length} element(s) with a website tag`)
      return elements
    } catch (err) {
      lastErr = err
      onLog?.(`  ${endpoint} failed: ${err.message} — trying next mirror`)
    }
  }
  throw new Error(`every Overpass mirror failed for ${countryCode}: ${lastErr?.message}`)
}

export function hospitalsCachePath(countryCode) {
  return dataPath("world", `hospitals-${countryCode.toLowerCase()}.json`)
}

// Which countries a stage should process, shared by discover-plans.mjs,
// approve-plans.mjs, fetch-plans.mjs and draft-sheets.mjs so a new country
// doesn't need updating in four places. `--country` takes one code or a
// comma-separated list (`--country US,CA` or `--country US`); with neither,
// every country that has a cached hospital list on disk — i.e. every country
// loadOrFetchHospitals has ever been run for — is in scope. That means a bare
// run picks up a newly-added country automatically the moment its hospital
// list exists, with no hardcoded list to remember to extend.
export function countriesFromArgs(argv = process.argv) {
  const i = argv.indexOf("--country")
  if (i > -1) return argv[i + 1].split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
  const dir = dataPath("world")
  return readdirSync(dir)
    .map((f) => /^hospitals-([a-z]{2})\.json$/.exec(f)?.[1])
    .filter(Boolean)
    .map((cc) => cc.toUpperCase())
    .sort()
}

// Cached by default: this is a shared public service, and the hospital list
// for a country changes slowly enough that re-querying it on every discovery
// run would be pure waste. Pass refresh:true to force a re-pull.
export async function loadOrFetchHospitals(countryCode, { refresh = false } = {}) {
  const path = hospitalsCachePath(countryCode)
  if (!refresh) {
    const cached = readJson(path)
    if (cached?.hospitals) return cached.hospitals
  }
  log(STAGE, `querying Overpass for ${countryCode}…`)
  const elements = await queryOverpass(countryCode, { onLog: (m) => log(STAGE, m) })
  const seen = new Set()
  const hospitals = []
  let noWebsite = 0
  let noName = 0
  for (const el of elements) {
    const rec = toRecord(el, countryCode)
    if (!rec) {
      if (!websiteOf(el.tags)) noWebsite++
      else noName++
      continue
    }
    if (seen.has(rec.code)) continue
    seen.add(rec.code)
    hospitals.push(rec)
  }
  writeJson(path, {
    countryCode,
    fetchedAt: new Date().toISOString(),
    count: hospitals.length,
    droppedNoUsableWebsite: noWebsite,
    droppedNoName: noName,
    hospitals,
  })
  log(STAGE, `${countryCode}: ${hospitals.length} hospital(s) with a usable website (cached to data/world/hospitals-${countryCode.toLowerCase()}.json)`)
  return hospitals
}
