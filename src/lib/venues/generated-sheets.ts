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
import { A5_SITE_MAP_OF_STRATFORD_HOSPITAL_JULY_2025_UPDATE_VENUE } from "./a5-site-map-of-stratford-hospital-july-2025-update"
import { ALEX_MAP_A4_VENUE } from "./alex-map-a4"
import { BISHOP_AUCKLAND_FLOOR_PLAN_2023_VENUE } from "./bishop-auckland-floor-plan-2023"
import { CH_HOSPITAL_SITEMAP_VENUE } from "./ch-hospital-sitemap"
import { CHELSEA_AND_WESTMINSTER_HOSPITAL_SITE_MAP_VENUE } from "./chelsea-and-westminster-hospital-site-map"
import { COMMUNITY_DIAGNOSTIC_CENTRE_SITE_MAP_VENUE } from "./community-diagnostic-centre-site-map"
import { DERRIFORD_HOSPITAL_SITE_MAPPDF_VENUE } from "./derriford-hospital-site-mappdf"
import { DIANA_PRINCESS_OF_WALES_HOSPITAL_INTERNAL_2D_2025_VENUE } from "./diana-princess-of-wales-hospital-internal-2d-2025"
import { EALING_HOSPITAL_SITE_MAP_VENUE } from "./ealing-hospital-site-map"
import { EXTERNAL_SITE_MAP_NORTH_TEES_2019_VENUE } from "./external-site-map-north-tees-2019"
import { FORDCOMBE_HOSPITAL_MAPPDF_VENUE } from "./fordcombe-hospital-mappdf"
import { FRIARAGE_SITE_MAP_JULY_2025_VENUE } from "./friarage-site-map-july-2025"
import { GRANTHAM_AND_DISTRICT_HOSPITAL_MAP_VENUE } from "./grantham-and-district-hospital-map"
import { HOSPITAL_MAP_EXTERNAL_2025_VENUE } from "./hospital-map-external-2025"
import { HULL_ROYAL_INFIRMARY_SITE_MAP_VENUE } from "./hull-royal-infirmary-site-map"
import { INTERNAL_SITE_MAP_HARTLEPOOL_2018_VENUE } from "./internal-site-map-hartlepool-2018"
import { INTERNAL_SITE_MAP_NORTH_TEES_2019_VENUE } from "./internal-site-map-north-tees-2019"
import { JAMES_COOK_CAMPUS_MAP_JUL25_VENUE } from "./james-cook-campus-map-jul25"
import { JR_HOSPITAL_SITEMAP_VENUE } from "./jr-hospital-sitemap"
import { LEVEL_3_FLOORPLAN_CUH_MAP_VENUE } from "./level-3-floorplan-cuh-map"
import { LINCOLN_HOSPITAL_MAP_LEVEL_1_VENUE } from "./lincoln-hospital-map-level-1"
import { LINCOLN_HOSPITAL_MAP_LEVEL_3_VENUE } from "./lincoln-hospital-map-level-3"
import { LINCOLN_HOSPITAL_MAPS_LEVEL_2_BLANK_VENUE } from "./lincoln-hospital-maps-level-2-blank"
import { LISTER_MAP_2026_VENUE } from "./lister-map-2026"
import { MACCLESFIELD_DISTRICT_GENERAL_HOSPITAL_VENUE } from "./macclesfield-district-general-hospital"
import { MAIDSTONE_HOSPITAL_MAPPDF_VENUE } from "./maidstone-hospital-mappdf"
import { NGH_HOSPITAL_MAP_VENUE } from "./ngh-hospital-map"
import { NOC_SITE_MAP_VENUE } from "./noc-site-map"
import { NORTHWICK_PARK_HOSPITAL_SITE_MAP_VENUE } from "./northwick-park-hospital-site-map"
import { ORMSKIRK_SITE_MAP_A3_VENUE } from "./ormskirk-site-map-a3"
import { PILGRIM_GROUND_FLOOR_VENUE } from "./pilgrim-ground-floor"
import { PINDERFIELDS_HOSPITAL_MAP_VENUE } from "./pinderfields-hospital-map"
import { PRINCESS_ANNE_HOSPITAL_VENUE } from "./princess-anne-hospital"
import { PRINCESS_OF_WALES_COMMUNITY_HOSPITAL_SITE_MAP_VENUE } from "./princess-of-wales-community-hospital-site-map"
import { ROYAL_BERKSHIRE_HOSPITAL_MAP_JAN23_VENUE } from "./royal-berkshire-hospital-map-jan23"
import { SGH_SITE_MAP_VENUE } from "./sgh-site-map"
import { SHEFFIELD_TEACHING_HOSPITALS_NHS_FOUNDATION_TRUST_MAP_VENUE } from "./sheffield-teaching-hospitals-nhs-foundation-trust-map"
import { SITE_1253769_HULL_TEACHING_CASTLE_HILL_MAP_VENUE } from "./site-1253769-hull-teaching-castle-hill-map"
import { SITE_6458_WEST_PARK_REHABILITATION_HOSPITAL_VENUE } from "./site-6458-west-park-rehabilitation-hospital"
import { SITE_MAP_2024PDF_VENUE } from "./site-map-2024pdf"
import { SOUTHPORT_HOSPITAL_SITE_MAP_A3_SEPT_2024_VENUE } from "./southport-hospital-site-map-a3-sept-2024"
import { TRUST_MAP_JUNE_2026_VENUE } from "./trust-map-june-2026"
import { TUNBRIDGE_WELLS_HOSPITAL_MAPPDF_VENUE } from "./tunbridge-wells-hospital-mappdf"
import { WEST_MIDDLESEX_UNIVERSITY_HOSPITAL_SITE_MAP_VENUE } from "./west-middlesex-university-hospital-site-map"
import { WHISTON_SITE_MAP_FULL_SITE_VENUE } from "./whiston-site-map-full-site"

// 45 venue(s) built from published trust site maps.
export const GENERATED_SHEET_VENUES: Venue[] = [
  A5_SITE_MAP_OF_STRATFORD_HOSPITAL_JULY_2025_UPDATE_VENUE,
  ALEX_MAP_A4_VENUE,
  BISHOP_AUCKLAND_FLOOR_PLAN_2023_VENUE,
  CH_HOSPITAL_SITEMAP_VENUE,
  CHELSEA_AND_WESTMINSTER_HOSPITAL_SITE_MAP_VENUE,
  COMMUNITY_DIAGNOSTIC_CENTRE_SITE_MAP_VENUE,
  DERRIFORD_HOSPITAL_SITE_MAPPDF_VENUE,
  DIANA_PRINCESS_OF_WALES_HOSPITAL_INTERNAL_2D_2025_VENUE,
  EALING_HOSPITAL_SITE_MAP_VENUE,
  EXTERNAL_SITE_MAP_NORTH_TEES_2019_VENUE,
  FORDCOMBE_HOSPITAL_MAPPDF_VENUE,
  FRIARAGE_SITE_MAP_JULY_2025_VENUE,
  GRANTHAM_AND_DISTRICT_HOSPITAL_MAP_VENUE,
  HOSPITAL_MAP_EXTERNAL_2025_VENUE,
  HULL_ROYAL_INFIRMARY_SITE_MAP_VENUE,
  INTERNAL_SITE_MAP_HARTLEPOOL_2018_VENUE,
  INTERNAL_SITE_MAP_NORTH_TEES_2019_VENUE,
  JAMES_COOK_CAMPUS_MAP_JUL25_VENUE,
  JR_HOSPITAL_SITEMAP_VENUE,
  LEVEL_3_FLOORPLAN_CUH_MAP_VENUE,
  LINCOLN_HOSPITAL_MAP_LEVEL_1_VENUE,
  LINCOLN_HOSPITAL_MAP_LEVEL_3_VENUE,
  LINCOLN_HOSPITAL_MAPS_LEVEL_2_BLANK_VENUE,
  LISTER_MAP_2026_VENUE,
  MACCLESFIELD_DISTRICT_GENERAL_HOSPITAL_VENUE,
  MAIDSTONE_HOSPITAL_MAPPDF_VENUE,
  NGH_HOSPITAL_MAP_VENUE,
  NOC_SITE_MAP_VENUE,
  NORTHWICK_PARK_HOSPITAL_SITE_MAP_VENUE,
  ORMSKIRK_SITE_MAP_A3_VENUE,
  PILGRIM_GROUND_FLOOR_VENUE,
  PINDERFIELDS_HOSPITAL_MAP_VENUE,
  PRINCESS_ANNE_HOSPITAL_VENUE,
  PRINCESS_OF_WALES_COMMUNITY_HOSPITAL_SITE_MAP_VENUE,
  ROYAL_BERKSHIRE_HOSPITAL_MAP_JAN23_VENUE,
  SGH_SITE_MAP_VENUE,
  SHEFFIELD_TEACHING_HOSPITALS_NHS_FOUNDATION_TRUST_MAP_VENUE,
  SITE_1253769_HULL_TEACHING_CASTLE_HILL_MAP_VENUE,
  SITE_6458_WEST_PARK_REHABILITATION_HOSPITAL_VENUE,
  SITE_MAP_2024PDF_VENUE,
  SOUTHPORT_HOSPITAL_SITE_MAP_A3_SEPT_2024_VENUE,
  TRUST_MAP_JUNE_2026_VENUE,
  TUNBRIDGE_WELLS_HOSPITAL_MAPPDF_VENUE,
  WEST_MIDDLESEX_UNIVERSITY_HOSPITAL_SITE_MAP_VENUE,
  WHISTON_SITE_MAP_FULL_SITE_VENUE,
]
