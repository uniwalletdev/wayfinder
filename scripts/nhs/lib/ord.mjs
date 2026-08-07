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
import { normalisePostcode } from "./ods.mjs"
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

// One page of organisations for a role. `Offset` paging is what the API exposes;
// it returns fewer than Limit on the last page.
async function fetchPage(roleId, offset) {
  const url = `${ORD_API}/organisations?PrimaryRoleId=${encodeURIComponent(roleId)}&Limit=${PAGE_SIZE}&Offset=${offset}&Status=Active`
  const res = await fetchRetry(url, { headers: { accept: "application/json" } }, { retries: 3, timeoutMs: 60_000 })
  return assertOrganisations(await res.json(), url)
}

// Fetch every active organisation holding a role.
export async function fetchOrganisations(roleId, { onProgress } = {}) {
  const all = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await fetchPage(roleId, offset)
    all.push(...page)
    onProgress?.(all.length)
    if (page.length < PAGE_SIZE) break
    // A national register of a few thousand rows should never need this many
    // pages; bail rather than loop forever if paging misbehaves.
    if (offset > PAGE_SIZE * 50) throw new Error(`${roleId}: paging did not terminate`)
  }
  return all
}

// The summary listing carries the code, name and postcode but not the site's
// parent trust — that is only on the detail record. Cached, because it is one
// request per site and the relationships barely change between refreshes.
export async function enrichParentCodes(codes, { onProgress } = {}) {
  const cache = readJson(PARENT_CACHE, {})
  const missing = codes.filter((code) => !(code in cache))

  for (const [i, code] of missing.entries()) {
    try {
      const res = await fetchRetry(
        `${ORD_API}/organisations/${encodeURIComponent(code)}`,
        { headers: { accept: "application/json" } },
        { retries: 2, timeoutMs: 30_000 }
      )
      const rels = (await res.json())?.Organisation?.Rels?.Rel ?? []
      // "is a site of"/"is operated by" style relationships point at the parent.
      // Take the first active one; a site belongs to one trust.
      const parent = rels.find(
        (r) => String(r?.Status).toLowerCase() === "active" && r?.Target?.OrgId?.extension
      )
      cache[code] = parent?.Target?.OrgId?.extension ?? null
    } catch {
      // Leave it unresolved rather than caching a wrong answer — the next run
      // retries it, and the site still works as a directory pin meanwhile.
    }
    if ((i + 1) % 50 === 0) {
      writeJson(PARENT_CACHE, cache)
      onProgress?.(i + 1, missing.length)
    }
    await sleep(DETAIL_PAUSE_MS)
  }

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
  })

  let parents = {}
  if (withParents) {
    const codes = orgs.map((o) => String(o?.OrgId ?? "").trim().toUpperCase()).filter(Boolean)
    log?.(`  resolving parent trusts for ${codes.length} sites (cached between runs)`)
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
  return records
}
