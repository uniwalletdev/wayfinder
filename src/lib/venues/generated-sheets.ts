// GENERATED FILE — do not edit by hand.
//
// Written by scripts/nhs/generate-registry.mjs. Collects the venues built
// automatically from NHS trust site-map PDFs discovered by the ingestion
// pipeline, so src/lib/venues/index.ts doesn't need an import line per
// hospital as the batch grows.
//
// Placement for these is derived, not hand-tuned: the centre comes from the NHS
// ODS register and the scale from the site's OpenStreetMap footprint. They are
// left unverified until someone checks the sheet against the map.
//
// Source maps remain the copyright of the publishing trust; each sheet's origin
// URL is recorded in data/plan-sources.json.

import { Venue } from "../types"
import { ALEX_MAP_A4_VENUE } from "./alex-map-a4"
import { CH_HOSPITAL_SITEMAP_VENUE } from "./ch-hospital-sitemap"
import { CHELSEA_AND_WESTMINSTER_HOSPITAL_SITE_MAP_VENUE } from "./chelsea-and-westminster-hospital-site-map"
import { DIANA_PRINCESS_OF_WALES_HOSPITAL_INTERNAL_2D_2025_VENUE } from "./diana-princess-of-wales-hospital-internal-2d-2025"
import { EALING_HOSPITAL_SITE_MAP_VENUE } from "./ealing-hospital-site-map"
import { GRANTHAM_AND_DISTRICT_HOSPITAL_MAP_VENUE } from "./grantham-and-district-hospital-map"
import { HOSPITAL_MAP_EXTERNAL_2025_VENUE } from "./hospital-map-external-2025"
import { JR_HOSPITAL_SITEMAP_VENUE } from "./jr-hospital-sitemap"
import { MACCLESFIELD_DISTRICT_GENERAL_HOSPITAL_VENUE } from "./macclesfield-district-general-hospital"
import { NGH_HOSPITAL_MAP_VENUE } from "./ngh-hospital-map"
import { NOC_SITE_MAP_VENUE } from "./noc-site-map"
import { NORTHWICK_PARK_HOSPITAL_SITE_MAP_VENUE } from "./northwick-park-hospital-site-map"
import { ORMSKIRK_SITE_MAP_A3_VENUE } from "./ormskirk-site-map-a3"
import { PRINCESS_ANNE_HOSPITAL_VENUE } from "./princess-anne-hospital"
import { PRINCESS_OF_WALES_COMMUNITY_HOSPITAL_SITE_MAP_VENUE } from "./princess-of-wales-community-hospital-site-map"
import { SITE_1253769_HULL_TEACHING_CASTLE_HILL_MAP_VENUE } from "./site-1253769-hull-teaching-castle-hill-map"
import { SITE_6458_WEST_PARK_REHABILITATION_HOSPITAL_VENUE } from "./site-6458-west-park-rehabilitation-hospital"
import { TRUST_MAP_JUNE_2026_VENUE } from "./trust-map-june-2026"
import { TUNBRIDGE_WELLS_HOSPITAL_MAPPDF_VENUE } from "./tunbridge-wells-hospital-mappdf"
import { WEST_MIDDLESEX_UNIVERSITY_HOSPITAL_SITE_MAP_VENUE } from "./west-middlesex-university-hospital-site-map"
import { WHISTON_SITE_MAP_FULL_SITE_VENUE } from "./whiston-site-map-full-site"

// 21 venue(s) built from published trust site maps.
export const GENERATED_SHEET_VENUES: Venue[] = [
  ALEX_MAP_A4_VENUE,
  CH_HOSPITAL_SITEMAP_VENUE,
  CHELSEA_AND_WESTMINSTER_HOSPITAL_SITE_MAP_VENUE,
  DIANA_PRINCESS_OF_WALES_HOSPITAL_INTERNAL_2D_2025_VENUE,
  EALING_HOSPITAL_SITE_MAP_VENUE,
  GRANTHAM_AND_DISTRICT_HOSPITAL_MAP_VENUE,
  HOSPITAL_MAP_EXTERNAL_2025_VENUE,
  JR_HOSPITAL_SITEMAP_VENUE,
  MACCLESFIELD_DISTRICT_GENERAL_HOSPITAL_VENUE,
  NGH_HOSPITAL_MAP_VENUE,
  NOC_SITE_MAP_VENUE,
  NORTHWICK_PARK_HOSPITAL_SITE_MAP_VENUE,
  ORMSKIRK_SITE_MAP_A3_VENUE,
  PRINCESS_ANNE_HOSPITAL_VENUE,
  PRINCESS_OF_WALES_COMMUNITY_HOSPITAL_SITE_MAP_VENUE,
  SITE_1253769_HULL_TEACHING_CASTLE_HILL_MAP_VENUE,
  SITE_6458_WEST_PARK_REHABILITATION_HOSPITAL_VENUE,
  TRUST_MAP_JUNE_2026_VENUE,
  TUNBRIDGE_WELLS_HOSPITAL_MAPPDF_VENUE,
  WEST_MIDDLESEX_UNIVERSITY_HOSPITAL_SITE_MAP_VENUE,
  WHISTON_SITE_MAP_FULL_SITE_VENUE,
]
