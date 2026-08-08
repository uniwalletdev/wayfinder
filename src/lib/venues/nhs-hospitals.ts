import { Venue } from "../types"
import { NHS_HOSPITAL_SITES, NHS_DATA_GENERATED_AT } from "./nhs-hospitals-data"

// The NHS hospital directory: every open NHS hospital from the Organisation Data
// Service, added as a located, public "hospital" venue. These carry a real map
// position but no interior floor plan or waypoints — selecting one drops you on
// the hospital so its inside can then be surveyed/mapped in-app (the same
// starting point a user-created venue has).
//
// Hospitals, not every trust site. ODS's site register turned out to be every
// location a trust operates — around 38,000 clinics, health centres, dental
// surgeries and community units — and each row here becomes a Venue object at
// module load. The pipeline filters to hospitals before writing the data file.
//
// Sites that already ship as fully-mapped venues are excluded upstream, in the
// pipeline that generates nhs-hospitals-data.ts, by reconciling against the
// venue modules themselves — so there is no hand-kept exclusion list here or
// there to fall out of date. See scripts/nhs/ and data/mapped-coverage.json.

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Build the venue list once at module load. Names repeat across the country
// (several "St Michael's Hospital"), so slugs are de-duplicated with a numeric
// suffix to keep every venue independently addressable by URL.
//
// The id stays slug-derived rather than moving to the ODS code, even though the
// ODS code is the better identifier: ids are what venue-store.ts writes into
// localStorage and what saved links resolve, so re-keying the directory would
// orphan every device's saved venue. The ODS code rides along as its own field,
// which is what a data refresh reconciles on.
export const NHS_HOSPITAL_VENUES: Venue[] = (() => {
  const used = new Map<string, number>()
  return NHS_HOSPITAL_SITES.map(([name, lat, lng, odsCode, postcode]) => {
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
      // Empty for rows carried over from the pre-pipeline dataset, which had no
      // ODS codes to carry. The first pipeline refresh fills them in.
      ...(odsCode ? { odsCode } : {}),
      ...(postcode ? { postcode } : {}),
      dataSource: "NHS Organisation Data Service",
      ...(NHS_DATA_GENERATED_AT ? { updatedAt: NHS_DATA_GENERATED_AT } : {}),
    }
  })
})()
