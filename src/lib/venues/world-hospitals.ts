import { Venue } from "../types"
import { WORLD_HOSPITAL_SITES, WORLD_DATA_GENERATED_AT } from "./world-hospitals-data"

// The world hospital directory: every hospital OpenStreetMap volunteers have
// tagged amenity=hospital (with a website) outside NHS England, added as a
// located, public "hospital" venue — the same role NHS_HOSPITAL_VENUES plays
// for England, built the same way: a real map position, no interior floor
// plan or waypoints. Selecting one drops you on the hospital so its inside
// can then be surveyed/mapped in-app.
//
// Source is OpenStreetMap rather than a national register, because no country
// in scope here publishes the equivalent of NHS ORD. That means coverage is a
// floor, not a census — whatever volunteers have mapped, not every hospital
// that exists.

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  AU: "Australia",
  IE: "Ireland",
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Built once at module load, same pattern as NHS_HOSPITAL_VENUES — see that
// file for why ids stay slug-derived (saved links resolve by id) while the
// source code rides along as its own field for later reconciliation.
//
// Slugs are country-scoped (`-us`, `-ca`, …), not just de-duplicated within
// this list. NHS_HOSPITAL_VENUES slugs carry no country suffix, and common
// names repeat worldwide — a US "St Mary's Hospital" sharing NHS's bare
// "st-marys-hospital" slug would make one of the two unreachable by its own
// URL once both lists are merged in index.ts. The suffix guarantees no
// collision with NHS's slugs, or with another country's same-named hospital.
export const WORLD_HOSPITAL_VENUES: Venue[] = (() => {
  const used = new Map<string, number>()
  return WORLD_HOSPITAL_SITES.map(([name, lat, lng, code, countryCode]) => {
    const base = `${slugify(name) || "hospital"}-${countryCode.toLowerCase()}`
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    const slug = seen === 0 ? base : `${base}-${seen + 1}`
    return {
      id: `world-${slug}`,
      slug,
      name,
      subtitle: `Hospital — ${COUNTRY_NAMES[countryCode] ?? countryCode}`,
      category: "hospital" as const,
      center: { lat, lng },
      defaultZoom: 17,
      floorPlans: [],
      waypoints: [],
      visibility: "public" as const,
      // Real hospitals, but interiors are unmapped until surveyed — not the
      // same as an owner-confirmed, fully-mapped venue, so left unverified.
      verified: false,
      dataSource: "OpenStreetMap contributors",
      ...(WORLD_DATA_GENERATED_AT ? { updatedAt: WORLD_DATA_GENERATED_AT } : {}),
    }
  })
})()
