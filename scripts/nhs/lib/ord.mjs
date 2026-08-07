// The NHS Organisation Reference Data (ORD) API, as a stand-in for the bulk
// downloads.
//
// The pipeline was built on NHS Digital's bulk extracts, which is a single point
// of failure: that host sits behind a CDN that refuses non-browser clients on
// some networks, answering 403 while the ORD API — the same organisation data,
// same publisher — answers 200 from the very same machine. Depending on one
// mirror for the entire register was the actual bug.
//
// This returns records in exactly the shape parseOdsRows() produces, so every
// stage downstream is unaware of which source was used.
//
// Licence: Open Government Licence v3.0, as with the bulk extracts.
import { fetchRetry } from "./net.mjs"
import { normalisePostcode, looksPublicFacing } from "./ods.mjs"
import { dataPath, readJson, writeJson } from "./paths.mjs"

const ORD_API = "https://directory.spineservices.nhs.uk/ORD/2-0-0"

// ODS primary role codes. These select the same populations the bulk files hold:
// etr.zip is trusts, ets.zip is the sites those trusts run.
export const ORD_ROLES = {
  etr: "RO197", // NHS TRUST
  ets: "RO198", // NHS TRUST SITE
}

const PAGE_SIZE = 1000
// The API is a shared national service. Paging is a handful of requests, but the
// per-organisation enrichment below is thousands, so it is paced.
const DETAIL_PAUSE_MS = 120
// A handful of requests in flight, not a stampede. With the pause above this is
// roughly 50 requests/second at most against a free national service.
const DETAIL_CONCURRENCY = 6
const PARENT_CACHE = dataPath("ods-parents.json")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The response shape is asserted rather than assumed. A silently-changed API
// that yields zero records would otherwise look like "this trust has no sites",
// which is indistinguishable from a real empty result downstream.
function assertOrganisations(body, url) {
  const list = body?.Organisations
  if (!Array.isArray(list)) {
    const shape = body && typeof body === "object" ? Object.keys(body).join(", ") : typeof body
    throw new Error(
      `${url}: expected an "Organisations" array, got { ${shape} }. ` +
        `The ORD API contract may have changed — check scripts/nhs/lib/ord.mjs against ` +
        `https://digital.nhs.uk/services/organisation-data-service/apis`
    )
  }
  return list
}

// Request shapes to try, most-likely-correct first.
//
// Asking for `Accept: application/json` — the obvious thing for a JSON API —
// gets HTTP 406 Not Acceptable from this service, while the identical URL with
// no Accept header returns 200. Rather than hard-code a guess about a remote
// server's content negotiation, the client tries variants until one answers and
// then reuses it. A national data API changing its handling shouldn't cost a
// round trip through someone else's terminal to diagnose.
const HEADER_VARIANTS = [
  { name: "no Accept header", headers: {} },
  { name: "Accept: */*", headers: { accept: "*/*" } },
  { name: "Accept: application/json", headers: { accept: "application/json" } },
]

// Likewise for query parameters: `Status=Active` is documented, but if the
// service rejects it we would rather have every organisation and filter locally
// than have nothing at all.
const QUERY_VARIANTS = [
  { name: "with Status=Active", status: true },
  { name: "without Status", status: false },
]

// Paging here is 1-based, and the service says so in its own words: an
// `Offset=0` is rejected with
//
//     {"errorCode":406,"errorText":"Suppied Offset must be greater than 1"}
//
// So the first request omits Offset entirely rather than guessing whether the
// first page is 1 or 2, and later pages skip by however many records are already
// held. That count is always well past the minimum, so the boundary never
// arises again.
export function buildPageUrl(roleId, offset, useStatus, limit = PAGE_SIZE) {
  const params = [`PrimaryRoleId=${encodeURIComponent(roleId)}`, `Limit=${limit}`]
  if (offset > 0) params.push(`Offset=${offset}`)
  if (useStatus) params.push("Status=Active")
  return `${ORD_API}/organisations?${params.join("&")}`
}

// Locked in after the first successful page so the rest of the paging doesn't
// re-negotiate on every request.
let chosen = null

async function fetchPage(roleId, offset, log) {
  if (chosen) {
    const url = buildPageUrl(roleId, offset, chosen.status)
    const res = await fetchRetry(url, { headers: chosen.headers }, { retries: 3, timeoutMs: 60_000 })
    return assertOrganisations(await res.json(), url)
  }

  const failures = []
  for (const query of QUERY_VARIANTS) {
    for (const variant of HEADER_VARIANTS) {
      const url = buildPageUrl(roleId, offset, query.status)
      try {
        const res = await fetchRetry(url, { headers: variant.headers }, { retries: 1, timeoutMs: 60_000 })
        const list = assertOrganisations(await res.json(), url)
        chosen = { headers: variant.headers, status: query.status }
        log?.(`  ORD accepted: ${variant.name}, ${query.name}`)
        return list
      } catch (err) {
        failures.push(`${variant.name} + ${query.name}: ${err.message}`)
      }
    }
  }
  throw new Error(
    `every ORD request shape was rejected.\n    ` + failures.join("\n    ")
  )
}

// Fetch every organisation holding a role.
//
// The offset for each page is simply how many records are already held. If the
// service reads that as "skip this many" we get the next page exactly; if it
// reads it as "start at this record" we get one record of overlap, which the
// de-duplication absorbs. That asymmetry is the point — an off-by-one that
// repeats a hospital is harmless, one that drops a hospital is not, and without
// being able to call the API from here it is not worth betting on which
// interpretation is right.
export async function fetchOrganisations(roleId, { onProgress, log } = {}) {
  const seen = new Set()
  const all = []

  for (let page = 0; ; page++) {
    const batch = await fetchPage(roleId, all.length, log)
    let added = 0
    for (const org of batch) {
      const code = String(org?.OrgId ?? "").trim().toUpperCase()
      if (!code || seen.has(code)) continue
      seen.add(code)
      all.push(org)
      added++
    }
    onProgress?.(all.length)

    // A short page is the last one. No new records means the service is handing
    // back the same window, which would otherwise loop forever.
    if (batch.length < PAGE_SIZE || added === 0) break
    if (page > 50) throw new Error(`${roleId}: paging did not terminate after ${all.length} records`)
  }

  // When the Status filter had to be dropped, closed organisations come back
  // too. parseOdsRows drops them downstream on the status column, but filtering
  // here keeps the synthesised CSV honest about what it contains.
  return chosen?.status === false
    ? all.filter((o) => String(o?.Status ?? "Active").toLowerCase() === "active")
    : all
}

async function parentOf(code) {
  const res = await fetchRetry(
    `${ORD_API}/organisations/${encodeURIComponent(code)}`,
    // Whatever the listing negotiated successfully — this endpoint is the same
    // service and refuses the same headers.
    { headers: chosen?.headers ?? {} },
    { retries: 2, timeoutMs: 30_000 }
  )
  const rels = (await res.json())?.Organisation?.Rels?.Rel ?? []
  // "is a site of"/"is operated by" style relationships point at the parent.
  // Take the first active one; a site belongs to one trust.
  const parent = rels.find(
    (r) => String(r?.Status).toLowerCase() === "active" && r?.Target?.OrgId?.extension
  )
  return parent?.Target?.OrgId?.extension ?? null
}

// The summary listing carries the code, name and postcode but not the site's
// parent trust — that is only on the detail record, one request per site.
//
// Run strictly one at a time this took hours against the real register, which is
// why callers now filter the list down before asking and why a few requests are
// in flight at once. Still deliberately modest: this is a shared national
// service, and the cache means a second run pays almost nothing.
export async function enrichParentCodes(codes, { onProgress } = {}) {
  const cache = readJson(PARENT_CACHE, {})
  const missing = codes.filter((code) => !(code in cache))
  let done = 0

  async function worker(queue) {
    for (const code of queue) {
      try {
        cache[code] = await parentOf(code)
      } catch {
        // Leave it unresolved rather than caching a wrong answer — the next run
        // retries it, and the site still works as a directory pin meanwhile.
      }
      done++
      // Checkpoint often enough that an interrupted run keeps nearly all of its
      // work, which matters when the list is long.
      if (done % 50 === 0) {
        writeJson(PARENT_CACHE, cache)
        onProgress?.(done, missing.length)
      }
      await sleep(DETAIL_PAUSE_MS)
    }
  }

  // Deal the work out round-robin so every worker finishes at about the same time.
  const queues = Array.from({ length: DETAIL_CONCURRENCY }, () => [])
  missing.forEach((code, i) => queues[i % DETAIL_CONCURRENCY].push(code))
  await Promise.all(queues.map(worker))

  writeJson(PARENT_CACHE, cache)
  return cache
}

// Map an ORD organisation onto the record shape parseOdsRows() produces, so the
// rest of the pipeline cannot tell the two sources apart.
function toRecord(org, parents) {
  const code = String(org?.OrgId ?? "").trim().toUpperCase()
  if (!code) return null
  const postcode = String(org?.PostCode ?? "").trim()
  if (!postcode) return null
  return {
    odsCode: code,
    // ORD returns names already in title case, unlike the bulk extracts.
    name: String(org?.Name ?? "").trim(),
    // The listing has no address lines; sites still place correctly because
    // geocoding works from the postcode.
    address: [],
    postcode: normalisePostcode(postcode),
    parentCode: parents?.[code] ?? null,
    openDate: null,
  }
}

// Everything above, assembled: the drop-in replacement for a bulk extract.
export async function fetchOdsViaOrd(sourceKey, { log, withParents = false } = {}) {
  const roleId = ORD_ROLES[sourceKey]
  if (!roleId) throw new Error(`no ORD role mapping for "${sourceKey}"`)

  const orgs = await fetchOrganisations(roleId, {
    onProgress: (n) => log?.(`  ${n} organisations…`),
    log,
  })

  let parents = {}
  if (withParents) {
    // Enrich only what survives filtering. looksPublicFacing() already knows a
    // mailroom or a finance office isn't somewhere a patient goes, but it used
    // to run several stages later — so every one of those records cost a
    // request before being discarded. Filtering first is the difference between
    // hundreds of requests and tens of thousands.
    const codes = orgs
      .filter((o) => looksPublicFacing(String(o?.Name ?? "")))
      .map((o) => String(o?.OrgId ?? "").trim().toUpperCase())
      .filter(Boolean)
    log?.(
      `  resolving parent trusts for ${codes.length} of ${orgs.length} sites ` +
        `(the rest are administrative registrations; cached between runs)`
    )
    parents = await enrichParentCodes(codes, {
      onProgress: (done, total) => log?.(`  parents ${done}/${total}…`),
    })
  }

  const records = orgs.map((o) => toRecord(o, parents)).filter(Boolean)
  if (orgs.length && !records.length) {
    throw new Error(
      `ORD returned ${orgs.length} organisations for ${roleId} but none had a usable code and postcode — ` +
        `the field names have probably changed. First entry: ${JSON.stringify(orgs[0]).slice(0, 300)}`
    )
  }

  // RO198 returns ~38,000 active organisations, but NHS trust *sites* number a
  // few thousand — so either that role covers far more than hospitals or the
  // mapping is wrong. That can't be settled without looking at the data, and it
  // can't be looked at from where this was written, so record a sample instead
  // of guessing again. A committed sample is one round trip; a guess is several.
  const publicFacing = orgs.filter((o) => looksPublicFacing(String(o?.Name ?? ""))).length
  writeJson(dataPath("ord-sample.json"), {
    generatedAt: new Date().toISOString(),
    description:
      "A sample of what the ORD API returns for each role, recorded so the population can be checked " +
      "against what the pipeline actually wants. Diagnostic only — nothing reads this at build time.",
    role: roleId,
    source: sourceKey,
    total: orgs.length,
    withUsableCodeAndPostcode: records.length,
    survivingPublicFacingFilter: publicFacing,
    sample: orgs.slice(0, 200).map((o) => ({
      OrgId: o?.OrgId ?? null,
      Name: o?.Name ?? null,
      Status: o?.Status ?? null,
      PrimaryRoleId: o?.PrimaryRoleId ?? null,
      PrimaryRoleDescription: o?.PrimaryRoleDescription ?? null,
      PostCode: o?.PostCode ?? null,
    })),
  })
  log?.(
    `  ${orgs.length} organisations, ${records.length} usable, ${publicFacing} look public-facing ` +
      `— sample written to data/ord-sample.json`
  )

  return records
}
