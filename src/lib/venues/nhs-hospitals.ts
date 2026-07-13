import { Venue } from "../types"
import { NHS_HOSPITAL_SITES } from "./nhs-hospitals-data"

// The NHS hospital directory: every hospital in the England open dataset added
// as a located, public "hospital" venue. These carry a real map position but no
// interior floor plan or waypoints — selecting one drops you on the hospital so
// its inside can then be surveyed/mapped in-app (the same starting point a
// user-created venue has). GOSH, St George's and Addenbrooke's (CUH) are
// excluded from the dataset because they ship as full interior venues in
// their own modules.

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Build the venue list once at module load. Names repeat across cities (e.g.
// several "St Michael's Hospital"), so slugs are de-duplicated with a numeric
// suffix to keep every venue independently addressable by URL.
export const NHS_HOSPITAL_VENUES: Venue[] = (() => {
  const used = new Map<string, number>()
  return NHS_HOSPITAL_SITES.map(([name, lat, lng]) => {
    const base = slugify(name) || "nhs-hospital"
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    const slug = seen === 0 ? base : `${base}-${seen + 1}`
    return {
      id: `nhs-${slug}`,
      slug,
      name,
      subtitle: "NHS Hospital",
      category: "hospital" as const,
      center: { lat, lng },
      defaultZoom: 17,
      floorPlans: [],
      waypoints: [],
      visibility: "public" as const,
      // Real NHS sites, but interiors are unmapped until surveyed — not the same
      // as an owner-confirmed, fully-mapped venue, so left unverified.
      verified: false,
    }
  })
})()
