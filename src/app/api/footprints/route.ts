// Building outlines for a hospital site.
//
// Most NHS sites in the directory have a pin and nothing else — no floor plan
// until someone surveys the interior. A footprint is the cheapest useful thing
// to show in the meantime: it tells the walker which buildings on the street are
// actually the hospital, which a single pin never does.
//
// Footprints come from OpenStreetMap via scripts/nhs/fetch-osm.mjs and live in
// data/footprints.geojson — served from here rather than bundled because the
// full national collection is far too large to ship to every client for the one
// site they're looking at.
//
// Licence: © OpenStreetMap contributors, ODbL 1.0. The attribution travels in
// the response and is displayed by the map.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { readFile } from "fs/promises"
import { join } from "path"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

interface Feature {
  type: "Feature"
  properties: { odsCode?: string | null; name?: string | null; [k: string]: unknown }
  geometry: unknown
}

interface Collection {
  type: "FeatureCollection"
  attribution?: string
  features: Feature[]
}

const OSM_ATTRIBUTION = "© OpenStreetMap contributors"

// Indexed once per server process and reused. The file is a single large read;
// doing it per request would be wasteful, and it never changes at runtime — a
// data refresh ships as a new deployment.
let indexPromise: Promise<Map<string, Feature[]>> | null = null

async function loadIndex(): Promise<Map<string, Feature[]>> {
  const index = new Map<string, Feature[]>()
  const path = join(process.cwd(), "data", "footprints.geojson")
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch {
    // The pipeline hasn't run yet, or footprints were skipped. Not an error —
    // the map simply shows no outlines, exactly as it did before this existed.
    return index
  }
  const collection = JSON.parse(raw) as Collection
  for (const feature of collection.features ?? []) {
    const code = feature.properties?.odsCode
    if (!code) continue
    const list = index.get(code)
    if (list) list.push(feature)
    else index.set(code, [feature])
  }
  return index
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "footprints", LIMITS.footprints.limit, LIMITS.footprints.windowMs)
  if (limited) return limited

  const ods = new URL(request.url).searchParams.get("ods")?.trim().toUpperCase()
  if (!ods) {
    return Response.json({ type: "FeatureCollection", features: [], attribution: OSM_ATTRIBUTION })
  }

  try {
    if (!indexPromise) indexPromise = loadIndex()
    const index = await indexPromise
    return Response.json(
      { type: "FeatureCollection", attribution: OSM_ATTRIBUTION, features: index.get(ods) ?? [] },
      // Footprints change monthly at most, so let the browser and any CDN in
      // front of this hold onto them.
      { headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" } }
    )
  } catch {
    // A malformed data file must not take the map down with it.
    indexPromise = null
    return Response.json({ type: "FeatureCollection", features: [], attribution: OSM_ATTRIBUTION })
  }
}
