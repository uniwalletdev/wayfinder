import { Site, Building, MapLocation } from "../types"
import { GOSH_SITE, GOSH_BUILDINGS, GOSH_LOCATIONS } from "./gosh"

/**
 * A fully-loaded site: its metadata, buildings and directory of locations.
 * The app is site-agnostic — add another dataset here and the UI works unchanged.
 */
export interface SiteData {
  site: Site
  buildings: Building[]
  locations: MapLocation[]
}

export const SITES: SiteData[] = [
  { site: GOSH_SITE, buildings: GOSH_BUILDINGS, locations: GOSH_LOCATIONS },
]

/** The site shown by default. */
export const DEFAULT_SITE_ID = GOSH_SITE.id

export function getSite(id: string = DEFAULT_SITE_ID): SiteData {
  return SITES.find((s) => s.site.id === id) ?? SITES[0]
}
