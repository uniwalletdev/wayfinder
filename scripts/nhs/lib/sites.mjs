// Loading ODS extracts back off disk, joined to the geocode cache.
//
// Both the OSM stage and the site-build stage need "every open NHS site, with
// coordinates". Keeping that join in one place means the two stages can't drift
// into disagreeing about which sites exist.
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { parseCsv } from "./csv.mjs"
import { parseOdsRows, looksPublicFacing } from "./ods.mjs"
import { RAW_DIR, dataPath, readJson } from "./paths.mjs"

// Great Britain and Northern Ireland, generously bounded. Used to reject
// geocodes that landed in the sea or, more usually, on the (0,0) null island
// that a bad parse produces.
export const UK_BBOX = { minLat: 49.8, maxLat: 60.9, minLng: -8.7, maxLng: 1.9 }

export function inUk(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= UK_BBOX.minLat && lat <= UK_BBOX.maxLat &&
    lng >= UK_BBOX.minLng && lng <= UK_BBOX.maxLng
  )
}

export function loadOdsRecords(key) {
  const path = join(RAW_DIR, "ods", `${key}.csv`)
  if (!existsSync(path)) {
    throw new Error(`missing ${path} — run: node scripts/nhs/fetch-ods.mjs`)
  }
  return parseOdsRows(parseCsv(readFileSync(path, "utf8")), { sourceName: key }).records
}

export function loadGeocodeCache() {
  const cache = readJson(dataPath("geocode-cache.json"))
  if (!cache) throw new Error("missing data/geocode-cache.json — run: node scripts/nhs/geocode.mjs")
  return cache
}

// Every open trust site that has a usable position and reads like somewhere a
// patient could actually be sent.
export function loadLocatedSites() {
  const cache = loadGeocodeCache()
  const trusts = new Map(loadOdsRecords("etr").map((t) => [t.odsCode, t]))

  const sites = []
  const dropped = { noGeocode: 0, outsideUk: 0, notPublic: 0 }
  for (const site of loadOdsRecords("ets")) {
    if (!looksPublicFacing(site.name)) { dropped.notPublic++; continue }
    const hit = cache[site.postcode]
    if (!hit) { dropped.noGeocode++; continue }
    if (!inUk(hit.lat, hit.lng)) { dropped.outsideUk++; continue }

    const trust = site.parentCode ? trusts.get(site.parentCode) : null
    sites.push({
      odsCode: site.odsCode,
      name: site.name,
      trustCode: site.parentCode,
      trustName: trust?.name ?? null,
      address: site.address,
      postcode: site.postcode,
      lat: hit.lat,
      lng: hit.lng,
      geocodeSource: hit.source,
      district: hit.district ?? null,
    })
  }
  return { sites, dropped, trusts }
}

// Metres between two coordinates. Equirectangular rather than haversine: at the
// few-hundred-metre scale this is used for the error is centimetres, and it
// matches the approximation the app already uses in src/lib/geo-local.ts.
const M_PER_DEG_LAT = 111320
export function metresBetween(aLat, aLng, bLat, bLng) {
  const mLng = M_PER_DEG_LAT * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180))
  const dy = (aLat - bLat) * M_PER_DEG_LAT
  const dx = (aLng - bLng) * mLng
  return Math.hypot(dx, dy)
}
