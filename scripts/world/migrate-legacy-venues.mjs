// One-off: recover the PDF-derived floor-plan venues the abandoned local
// pipeline built (328 of them, on the backup/legacy-world-pipeline branch —
// real waypoint-level floor plans reconstructed from hospitals' own site-map
// PDFs, for US/AU/CA/IE/NZ/BE) into the live Postgres-backed system.
//
// Each venue is matched to its real OSM hospital (by name + distance) so its
// id follows the osm-<cc>-<osm id> convention publish.mjs expects — anything
// else gets deleted the next time publish.mjs runs for that country, since it
// only keeps venues whose id maps to a hospital it currently lists.
//
// Needs DATABASE_URL and the backup branch's objects available locally
// (`git fetch origin backup/legacy-world-pipeline` first if not already).
//
// Run: node scripts/world/migrate-legacy-venues.mjs [--dry-run]
import { execSync } from "node:child_process"
import { writeFileSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import pg from "pg"
import { nameTokens, tokenOverlap } from "../nhs/lib/match.mjs"
import { metresBetween } from "../nhs/lib/sites.mjs"

const REF = process.env.LEGACY_REF || "origin/backup/legacy-world-pipeline"
const DRY_RUN = process.argv.includes("--dry-run")
const MATCH_RADIUS_M = 1500
const MIN_OVERLAP = 0.5

const sh = (cmd) => execSync(cmd, { maxBuffer: 1024 * 1024 * 64 }).toString()
// A PDF that rasterized into thousands of pixel-sized individual shapes
// instead of clean vector paths (seen once, in practice) produces an SVG of
// tens of megabytes — unusable (and likely to crash a phone's browser as an
// image overlay), not something to force into production just because the
// data exists. A real floor plan is tens to low hundreds of KB.
const MAX_SVG_BYTES = 5 * 1024 * 1024
const show = (path) => {
  try {
    return sh(`git show ${REF}:${JSON.stringify(path).slice(1, -1)}`)
  } catch {
    return null
  }
}

const registry = show("src/lib/venues/world-generated-sheets.ts")
if (!registry) {
  console.error(`Could not read world-generated-sheets.ts from ${REF} — is that ref fetched locally?`)
  process.exit(1)
}
const slugs = [...registry.matchAll(/from "\.\/([a-z0-9-]+)"/g)].map((m) => m[1])
console.log(`${slugs.length} legacy venue slugs found on ${REF}`)

// Each file is `export const X_VENUE: Venue = {...}` of a plain JS object
// literal (no TS-specific syntax inside) — stripping the import and the type
// annotation leaves something importable as a plain ES module.
function toVenueObject(slug, src) {
  const body = src.replace(/^import .*\n/, "").replace(/export const \w+: Venue = /, "export default ")
  const tmp = join(tmpdir(), `legacy-venue-${slug}-${process.pid}.mjs`)
  writeFileSync(tmp, body)
  return tmp
}

const venues = []
for (const slug of slugs) {
  const src = show(`src/lib/venues/${slug}.ts`)
  if (!src) {
    console.warn(`${slug}: missing from ${REF}, skipped`)
    continue
  }
  const tmp = toVenueObject(slug, src)
  try {
    const mod = await import(`file://${tmp}`)
    venues.push(mod.default)
  } catch (err) {
    console.warn(`${slug}: failed to parse — ${err.message}`)
  } finally {
    try {
      unlinkSync(tmp)
    } catch {}
  }
}
console.log(`${venues.length} venues parsed\n`)

const byCountry = new Map()
for (const v of venues) {
  const m = v.slug.match(/-([a-z]{2})$/)
  if (!m) {
    console.warn(`${v.slug}: no trailing country code, skipped`)
    continue
  }
  const cc = m[1].toUpperCase()
  if (!byCountry.has(cc)) byCountry.set(cc, [])
  byCountry.get(cc).push(v)
}
console.log([...byCountry.entries()].map(([cc, l]) => `${cc}: ${l.length}`).join(", "))

if (DRY_RUN) {
  console.log("\n--dry-run: stopping before any database connection or write")
  process.exit(0)
}

const dbUrl = (process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || "").trim().replace(/^['"]+|['"]+$/g, "")
if (!dbUrl) {
  console.error("DATABASE_URL is not set — nothing published")
  process.exit(1)
}
const host = (() => {
  try {
    return new URL(dbUrl).hostname
  } catch {
    return ""
  }
})()
const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".railway.internal") || /sslmode=disable/.test(dbUrl)
const client = new pg.Client({ connectionString: dbUrl, ssl: local ? undefined : { rejectUnauthorized: false } })
await client.connect()

let matched = 0
let unmatched = 0
let superseded = 0
let plansInserted = 0

for (const [cc, list] of byCountry) {
  const { rows: hospitals } = await client.query("select id, name, lat, lng from public.world_hospitals where country = $1", [cc])
  if (!hospitals.length) {
    console.warn(`${cc}: no hospitals published for this country yet — skipping its ${list.length} legacy venue(s)`)
    unmatched += list.length
    continue
  }
  const withTokens = hospitals.map((h) => ({ ...h, tokens: nameTokens(h.name) }))

  // Pass 1: match every legacy venue to a hospital and collect its usable
  // plans, without writing anything yet. The schema only has room for one
  // venue per hospital (world_venues.id is deterministic from the hospital's
  // own id), so a multi-building campus with several separate legacy PDFs —
  // one per wing — would otherwise collide: each "matches" successfully, but
  // only the last one processed actually survives in the database, silently
  // overwriting the others. Grouping by the resulting id first and keeping
  // the richest candidate (most waypoints) makes that an explicit choice
  // instead of an accident of processing order.
  const candidates = []
  for (const v of list) {
    const tokens = nameTokens(v.name)
    let best = null
    let bestScore = -1
    for (const h of withTokens) {
      if (metresBetween(v.center.lat, v.center.lng, h.lat, h.lng) > MATCH_RADIUS_M) continue
      const overlap = tokenOverlap(tokens, h.tokens)
      if (overlap > bestScore) {
        bestScore = overlap
        best = h
      }
    }
    if (!best || bestScore < MIN_OVERLAP) {
      console.warn(`UNMATCHED ${cc} "${v.name}" (${v.slug}) — best within ${MATCH_RADIUS_M}m scored ${bestScore.toFixed(2)}`)
      unmatched++
      continue
    }

    const plans = []
    for (const p of v.floorPlans ?? []) {
      const svg = show(`public${p.imageUrl}`)
      if (!svg) {
        console.warn(`  ${v.slug} plan ${p.id}: SVG missing at public${p.imageUrl}`)
        continue
      }
      if (Buffer.byteLength(svg) > MAX_SVG_BYTES) {
        console.warn(`  ${v.slug} plan ${p.id}: SVG is ${(Buffer.byteLength(svg) / 1024 / 1024).toFixed(1)}MB — likely a degenerate rasterization, skipping`)
        continue
      }
      plans.push({ ...p, svg })
    }
    const suffix = best.id.slice(4) // "osm-w123" -> "w123"
    const newId = `osm-${cc.toLowerCase()}-${suffix}`
    if (!plans.length) {
      console.warn(`UNMATCHED ${cc} "${v.name}" (${v.slug}) — matched ${best.name} but has no usable plan`)
      unmatched++
      // Still tracked (with no plans) so the cleanup pass below removes any
      // stale row an earlier, less careful run of this script left behind
      // under this id.
      candidates.push({ v, best, plans, newId, bestScore, richness: -1 })
      continue
    }

    candidates.push({ v, best, plans, newId, bestScore, richness: v.waypoints?.length ?? 0 })
  }

  // Pass 2: one winner per hospital id — the richest candidate with at least
  // one usable plan — then write. Anything else that computed the same id
  // (superseded, or matched but plan-less) is cleaned up rather than left as
  // a stale row from an earlier run.
  const byNewId = new Map()
  for (const c of candidates) {
    const prev = byNewId.get(c.newId)
    if (!prev || c.richness > prev.richness) byNewId.set(c.newId, c)
  }
  for (const c of candidates) {
    const winner = byNewId.get(c.newId)
    if (winner !== c && winner.plans.length) {
      console.warn(`SUPERSEDED ${cc} "${c.v.name}" (${c.v.slug}, ${c.richness} waypoints) — same hospital as "${winner.v.name}" (${winner.v.slug}, ${winner.richness} waypoints), which wins the one venue slot`)
      superseded++
    }
  }

  const staleIds = []
  for (const winner of byNewId.values()) {
    const { v, best, plans, newId, bestScore } = winner
    if (!plans.length) {
      staleIds.push(newId)
      await client.query("update public.world_hospitals set mapped = false where country = $1 and id = $2", [cc, best.id])
      continue
    }

    const venue = {
      ...v,
      id: newId,
      country: cc,
      floorPlans: plans.map(({ svg, ...p }) => ({ ...p, imageUrl: `/floorplans/osm/${newId}/${p.id}.svg` })),
    }
    await client.query(
      `insert into public.world_venues (id, country, kind, venue, updated_at) values ($1,$2,'indoor',$3::jsonb, now())
       on conflict (id) do update set country = excluded.country, kind = excluded.kind, venue = excluded.venue, updated_at = now()`,
      [newId, cc, JSON.stringify(venue)]
    )
    for (const p of plans) {
      await client.query(
        `insert into public.world_plans (venue_id, plan_id, svg) values ($1,$2,$3)
         on conflict (venue_id, plan_id) do update set svg = excluded.svg`,
        [newId, p.id, p.svg]
      )
      plansInserted++
    }
    await client.query("delete from public.world_plans where venue_id = $1 and not (plan_id = any($2::text[]))", [newId, plans.map((p) => p.id)])
    await client.query("update public.world_hospitals set mapped = true where country = $1 and id = $2", [cc, best.id])

    console.log(`MATCHED ${cc} "${v.name}" -> "${best.name}" (${newId}), overlap ${bestScore.toFixed(2)}, ${plans.length} plan(s)`)
    matched++
  }
  if (staleIds.length) {
    await client.query("delete from public.world_venues where id = any($1::text[])", [staleIds])
    await client.query("delete from public.world_plans where venue_id = any($1::text[])", [staleIds])
  }
}

await client.end()
console.log(
  `\n${matched} matched and published, ${unmatched} unmatched (left alone), ${superseded} superseded by a richer venue for the same hospital, ${plansInserted} plans inserted`
)
