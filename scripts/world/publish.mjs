// Stage 4 — publish what build.mjs wrote into the shared Postgres, where
// /api/world/* serves it (src/lib/world-db.ts).
//
// The per-country lists, venues and plans are too large and too often
// refreshed to live in the repository, so the workflow runs this right after
// the build, with DATABASE_URL from a secret. Each country is replaced whole
// in one transaction: its hospitals, then the venues and plans built for it;
// a hospital this run did not list for a country it covered is removed, and
// its map with it. A map the run did not rebuild stays as long as its hospital
// is listed: an indoor stage that looked at fewer hospitals is no reason to
// take a map away. Countries this run did not cover are left untouched, and so
// is a country whose grounds did not all come in (fetch-campus.mjs): it is
// held back whole, list and all, until a run completes it, because a complete
// answer late is preferred to a partial one on time.
//
// Run: DATABASE_URL=postgres://… node scripts/world/publish.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs"
import pg from "pg"

const url = (process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || "").trim().replace(/^['"]+|['"]+$/g, "")
if (!url) {
  console.log("DATABASE_URL is not set; nothing published")
  process.exit(0)
}
// The same TLS rule as src/lib/db.ts: Railway's public host needs it, local
// and private hosts refuse it.
const host = (() => { try { return new URL(url).hostname } catch { return "" } })()
const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".railway.internal") || /sslmode=disable/.test(url)
const client = new pg.Client({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } })
await client.connect()

const ddl = readFileSync(new URL("../../db/migrations/0005_world.sql", import.meta.url), "utf8")
await client.query(ddl)

const OUT = "public/world"
const PLANS = "public/floorplans/osm"
const CAMPUS_RAW = "data/world/campus-raw"
// Stage 2b's verdict per country. Without the stage at all (no directory, as
// in a run that skipped it) everything goes.
const groundsStatus = existsSync(`${CAMPUS_RAW}/status.json`) ? JSON.parse(readFileSync(`${CAMPUS_RAW}/status.json`, "utf8")) : null
function groundsComplete(country) {
  if (!existsSync(CAMPUS_RAW)) return true
  if (groundsStatus) return groundsStatus.countries?.[country]?.complete === true
  const path = `${CAMPUS_RAW}/${country}.json`
  if (!existsSync(path)) return false
  const g = JSON.parse(readFileSync(path, "utf8"))
  return g.complete ?? !(g.failed > 0)
}
const countries = readdirSync(OUT).filter((f) => /^[A-Z]{2}\.json$/.test(f)).map((f) => f.slice(0, 2)).sort()
const venueFiles = existsSync(`${OUT}/venues`) ? readdirSync(`${OUT}/venues`).filter((f) => f.endsWith(".json")) : []
const venuesByCountry = new Map()
for (const f of venueFiles) {
  const v = JSON.parse(readFileSync(`${OUT}/venues/${f}`, "utf8"))
  if (!venuesByCountry.has(v.country)) venuesByCountry.set(v.country, [])
  venuesByCountry.get(v.country).push(v)
}

const CHUNK = 500
// The venue id a hospital row maps to: rows are osm-w123, venues osm-us-w123.
const VENUE_ID_OF_ROW = "'osm-' || lower(h.country) || '-' || substr(h.id, 5)"
let totalHospitals = 0
let totalVenues = 0
let totalKept = 0
let totalPlans = 0
const published = []
const held = []
for (const country of countries) {
  if (!groundsComplete(country)) {
    held.push(country)
    console.log(`${country}: grounds incomplete; held back until a run completes them`)
    continue
  }
  const file = JSON.parse(readFileSync(`${OUT}/${country}.json`, "utf8"))
  const rows = file.hospitals
  const venues = venuesByCountry.get(country) ?? []
  await client.query("begin")
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      const values = []
      const params = []
      slice.forEach((h, j) => {
        const b = j * 11
        values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},now())`)
        params.push(country, h.id, h.name, h.lat, h.lng, h.city ?? null, h.street ?? null, h.postcode ?? null, h.operator ?? null, !!h.emergency, !!h.mapped)
      })
      await client.query(
        `insert into public.world_hospitals (country, id, name, lat, lng, city, street, postcode, operator, emergency, mapped, updated_at)
         values ${values.join(",")}
         on conflict (country, id) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng, city = excluded.city,
           street = excluded.street, postcode = excluded.postcode, operator = excluded.operator, emergency = excluded.emergency,
           mapped = excluded.mapped, updated_at = now()`,
        params
      )
    }
    await client.query("delete from public.world_hospitals where country = $1 and not (id = any($2::text[]))", [country, rows.map((h) => h.id)])

    for (const v of venues) {
      const kind = v.floorPlans?.[0]?.id === "site" ? "campus" : "indoor"
      await client.query(
        `insert into public.world_venues (id, country, kind, venue, updated_at) values ($1, $2, $3, $4::jsonb, now())
         on conflict (id) do update set country = excluded.country, kind = excluded.kind, venue = excluded.venue, updated_at = now()`,
        [v.id, country, kind, JSON.stringify(v)]
      )
      const planIds = []
      for (const p of v.floorPlans ?? []) {
        const path = `${PLANS}/${v.id}/${p.id}.svg`
        if (!existsSync(path)) continue
        planIds.push(p.id)
        await client.query(
          `insert into public.world_plans (venue_id, plan_id, svg) values ($1, $2, $3)
           on conflict (venue_id, plan_id) do update set svg = excluded.svg`,
          [v.id, p.id, readFileSync(path, "utf8")]
        )
        totalPlans++
      }
      await client.query("delete from public.world_plans where venue_id = $1 and not (plan_id = any($2::text[]))", [v.id, planIds])
    }
    await client.query(
      `delete from public.world_venues v where v.country = $1
         and not exists (select 1 from public.world_hospitals h where h.country = v.country and ${VENUE_ID_OF_ROW} = v.id)`,
      [country]
    )
    // The list says "mapped" for the maps this run built; the kept ones count too.
    await client.query(
      `update public.world_hospitals h set mapped = true where h.country = $1 and not h.mapped
         and exists (select 1 from public.world_venues v where v.id = ${VENUE_ID_OF_ROW})`,
      [country]
    )
    const kept = await client.query("select count(*)::int as n from public.world_venues where country = $1", [country])

    await client.query(
      `insert into public.world_countries (country, name, hospitals, mapped, generated_at, updated_at)
       values ($1, $2, $3, (select count(*)::int from public.world_hospitals where country = $1 and mapped), $4, now())
       on conflict (country) do update set name = excluded.name, hospitals = excluded.hospitals, mapped = excluded.mapped,
         generated_at = excluded.generated_at, updated_at = now()`,
      [country, file.name ?? null, rows.length, file.generatedAt ?? null]
    )
    await client.query("commit")
    totalKept += kept.rows[0].n - venues.length
  } catch (err) {
    await client.query("rollback")
    throw err
  }
  totalHospitals += rows.length
  totalVenues += venues.length
  published.push(country)
  console.log(`${country}: ${rows.length} hospitals, ${venues.length} venues`)
}
await client.end()
console.log(
  `\nPublished ${totalHospitals} hospitals, ${totalVenues} venues and ${totalPlans} plans for ${published.length} countries${totalKept ? `; ${totalKept} venues from earlier runs kept` : ""}${held.length ? `; held back, grounds incomplete: ${held.join(", ")}` : ""}`
)
