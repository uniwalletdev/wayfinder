import "server-only"
import { SEED_VENUES, getVenueById } from "../venues"
import { isDatabaseConfigured, query } from "../db"
import { getHospital, getVenue as getWorldVenue, parseWorldId } from "../world-db"
import { getVenue as getSharedVenue } from "../venues-db"
import { tierFor, type Tier } from "./plans"
import type { SiteKind } from "./claim"
import type { Venue } from "../types"
import ODS_PARENTS from "../../../data/ods-parents.json"
import TRUST_WEBSITES from "../../../data/trust-websites.json"

// The hospital sites an organisation can list: any hospital the app knows,
// mapped or not. The UK's from the venue registry (the mapped hospitals and
// the NHS directory), everywhere else's from the world data, and venues people
// published themselves.

export interface ClaimableSite {
  venueId: string
  name: string
  subtitle: string | null
  country: string
  kind: SiteKind
  website: string | null
  mapped: boolean
  tier: Tier
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const parents = ODS_PARENTS as Record<string, string>
const websites = TRUST_WEBSITES as Record<string, string | null>

// An NHS site's trust website: the site's own ODS code may be a trust's, or
// its parent's is.
export function nhsWebsite(odsCode: string | undefined): string | null {
  if (!odsCode) return null
  return websites[odsCode] ?? websites[parents[odsCode] ?? ""] ?? null
}

function sizeOf(v: Pick<Venue, "floorPlans" | "waypoints">): Tier {
  return tierFor({ floors: new Set(v.floorPlans.map((p) => p.floor)).size, places: v.waypoints.length })
}

function fromVenue(v: Venue, kind: SiteKind, website: string | null): ClaimableSite {
  return {
    venueId: v.id,
    name: v.name,
    subtitle: v.subtitle ?? null,
    country: v.country ?? "GB",
    kind,
    website,
    mapped: v.floorPlans.length > 0 || v.waypoints.length > 0,
    tier: sizeOf(v),
  }
}

export async function findSite(venueId: string): Promise<ClaimableSite | null> {
  const seed = getVenueById(venueId)
  // Every bundled hospital is an NHS one.
  if (seed) return seed.visibility === "public" ? fromVenue(seed, "nhs", nhsWebsite(seed.odsCode)) : null
  if (!isDatabaseConfigured()) return null
  const world = parseWorldId(venueId)
  try {
    if (world) {
      const row = await getHospital(world.country, world.rowId)
      if (!row) return null
      const built = row.mapped ? await getWorldVenue(world.id) : null
      return {
        venueId: world.id,
        name: row.name,
        subtitle: [row.street, row.city].filter(Boolean).join(", ") || row.operator || null,
        country: world.country,
        kind: "other",
        website: null,
        mapped: !!built,
        tier: built ? sizeOf(built) : "small",
      }
    }
    if (UUID.test(venueId)) {
      const shared = await getSharedVenue(venueId)
      return shared && shared.visibility === "public" ? fromVenue(shared, "other", null) : null
    }
  } catch (err) {
    console.warn("Could not look up a hospital site:", err instanceof Error ? err.message : err)
  }
  return null
}

export interface SiteHit {
  venueId: string
  name: string
  subtitle: string | null
  mapped: boolean
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "")

// Hospitals whose name holds every word typed, in the given country.
export async function searchSites(q: string, country: string, limit = 12): Promise<SiteHit[]> {
  const words = norm(q).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const out: SiteHit[] = []
  for (const v of SEED_VENUES) {
    if (v.visibility !== "public" || (v.country ?? "GB") !== country) continue
    const name = norm(`${v.name} ${v.subtitle ?? ""}`)
    if (words.every((w) => name.includes(w))) out.push({ venueId: v.id, name: v.name, subtitle: v.subtitle ?? null, mapped: v.floorPlans.length > 0 || v.waypoints.length > 0 })
    if (out.length >= limit) return out
  }
  if (!isDatabaseConfigured()) return out
  const like = words.map((w) => `%${w.replace(/[%_\\]/g, "\\$&")}%`)
  if (country !== "GB") {
    try {
      const { rows } = await query<{ id: string; name: string; city: string | null; mapped: boolean }>(
        `select id, name, city, mapped from public.world_hospitals
          where country = $1 and ${words.map((_, i) => `name ilike $${i + 2}`).join(" and ")}
          order by mapped desc, name limit ${Math.max(1, limit - out.length)}`,
        [country, ...like]
      )
      for (const r of rows) out.push({ venueId: `osm-${country.toLowerCase()}-${r.id.replace(/^osm-/, "")}`, name: r.name, subtitle: r.city, mapped: r.mapped })
    } catch (err) {
      // The world tables exist only once the world data has been published.
      console.warn("Could not search the world hospitals:", err instanceof Error ? err.message : err)
    }
  }
  try {
    const { rows } = await query<{ id: string; name: string; subtitle: string | null }>(
      `select id::text, name, subtitle from public.wf_venues
        where visibility = 'public' and category = 'hospital' and ${words.map((_, i) => `name ilike $${i + 1}`).join(" and ")}
        order by name limit ${Math.max(1, limit - out.length)}`,
      like
    )
    for (const r of rows) out.push({ venueId: r.id, name: r.name, subtitle: r.subtitle, mapped: true })
  } catch (err) {
    console.warn("Could not search shared hospitals:", err instanceof Error ? err.message : err)
  }
  return out.slice(0, limit)
}
