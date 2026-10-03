// Overpass, the OpenStreetMap query service, for the worldwide hospital data.
//
// Runs in CI only (.github/workflows/world-data.yml): sandboxed development
// environments routinely block these hosts, and the app must never depend on
// them. Every request goes through scripts/nhs/lib/net.mjs's retry policy, and
// requests are spaced out, because Overpass is a free service run by
// volunteers and a client that hammers it gets banned.
//
// Licence: OpenStreetMap data is © OpenStreetMap contributors, ODbL 1.0.
// Attribution is required wherever it is shown; the map credits it.
import { fetchRetry } from "../../nhs/lib/net.mjs"

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

export const USER_AGENT = "findway-world-data/1.0 (+https://github.com/uniwalletdev/wayfinder)"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let lastRequestAt = 0
const MIN_GAP_MS = Number(process.env.OVERPASS_GAP_MS ?? 2500)

// Run one Overpass QL query and return its elements. Tries each endpoint in
// turn, so one overloaded instance does not stop the run.
//
// `retries` is per endpoint (default 3, as for the small queries); `endpoints`
// caps how many instances are tried. A query the server itself times out after
// 15 minutes must not be retried a dozen times across three instances.
// The instance that gave the last answer, for the log.
export let lastHost = ""

export async function overpass(query, { timeoutMs = 600_000, retries = 3, endpoints = ENDPOINTS.length, gapMs = MIN_GAP_MS, validate } = {}) {
  let lastErr
  for (const endpoint of ENDPOINTS.slice(0, endpoints)) {
    const wait = lastRequestAt + gapMs - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()
    try {
      const res = await fetchRetry(
        endpoint,
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
          body: "data=" + encodeURIComponent(query),
        },
        { retries, baseMs: 5000, timeoutMs }
      )
      const text = await res.text()
      const json = JSON.parse(text)
      // Overpass reports a query that ran out of time or memory as a 200 with a
      // remark, not an error status. Treat it as a failure so the caller knows
      // the result is incomplete.
      if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) {
        throw new Error(`Overpass: ${json.remark.slice(0, 200)}`)
      }
      const elements = json.elements ?? []
      // A caller can refuse an answer that is well formed but wrong — an
      // instance whose area data is missing answers an area query with
      // nothing and no error — so that the next instance is asked instead.
      if (validate) validate(elements, new URL(endpoint).host)
      lastHost = new URL(endpoint).host
      return elements
    } catch (err) {
      lastErr = err
      console.warn(`  ${new URL(endpoint).host} failed: ${String(err.message ?? err).slice(0, 160)}`)
    }
  }
  throw lastErr
}

// The position of an element as returned with `out center` or `out geom`.
export function pointOf(el) {
  if (typeof el.lat === "number") return { lat: el.lat, lng: el.lon }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon }
  if (el.bounds) return { lat: (el.bounds.minlat + el.bounds.maxlat) / 2, lng: (el.bounds.minlon + el.bounds.maxlon) / 2 }
  return null
}

export const osmId = (el) => `${el.type[0]}${el.id}`

// `out count;` puts an element {type: "count", tags: {nodes, ways, relations,
// areas, total}} in the answer, in the order the statements ran. Split those
// from the real elements, with their numbers as numbers.
export function splitCounts(elements) {
  const counts = []
  const rest = []
  for (const el of elements) {
    if (el.type === "count") counts.push(Object.fromEntries(Object.entries(el.tags ?? {}).map(([k, v]) => [k, Number(v) || 0])))
    else rest.push(el)
  }
  return { counts, elements: rest }
}

// Whether the server that answers has area data at all, asked in the same
// request so that the answer and the probe come from the same machine
// (overpass-api.de spreads requests over several): Luxembourg's country area
// is in every working area database. A server without one — a volunteer
// mirror was like that all night, and one of overpass-api.de's machines for
// spells — makes no areas from the hospitals it finds and finds no hospitals
// inside a state, and both read as a complete, empty answer.
export const AREA_PROBE = `area["ISO3166-1"="LU"]["admin_level"="2"]->.probe;
.probe out count;`

// For a query that starts with AREA_PROBE, then counts the hospitals it found
// (`.h out count;`) and the areas made of them (`.ha out count;`). The probe
// alone decides whether the server has area data: a hospital with no area on
// a server that has it is real — an outline drawn as an open line, or one
// edited since the server last rebuilt its areas — and refusing those left
// cells that no server could ever answer. `minHospitals` is how many the
// caller knows to be there: none found where some are is a missing state area.
export function areaDataCheck({ minHospitals = 0 } = {}) {
  return (elements, host) => {
    const [probe, h, ha] = splitCounts(elements).counts
    if (!probe || !h || !ha) throw new Error(`${host}: the answer carries no counts`)
    if (!((probe.areas || probe.total) > 0)) throw new Error(`${host} has no area data: it does not know Luxembourg`)
    if (h.total < minHospitals) throw new Error(`${host} found ${h.total} hospitals where at least ${minHospitals} are known: its area is missing`)
  }
}
