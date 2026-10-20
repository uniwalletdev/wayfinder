// GENERATED FILE — do not edit by hand.
//
// Written by scripts/world/generate-registry.mjs. Collects the venues built
// automatically from hospital site-map PDFs discovered by scripts/world/, so
// src/lib/venues/index.ts doesn't need an import line per hospital.
//
// Placement for these is derived, not hand-tuned: the centre comes from
// OpenStreetMap and the scale is a default estimate (no building-footprint
// fetch for world hospitals yet, unlike the NHS pipeline's). Unverified until
// someone checks the sheet against the map.
//
// Source maps remain the copyright of the publishing hospital; each sheet's
// origin URL is recorded in data/world/plan-sources-<cc>.json.

import { Venue } from "../types"
import { A4_WAYFINDING_FLYER_24_02_2026_AU_VENUE } from "./a4-wayfinding-flyer-24-02-2026-au"
import { ABBOTT_NORTHWESTERN_HOSPITAL_CAMPUS_MAP_US_VENUE } from "./abbott-northwestern-hospital-campus-map-us"
import { ACH_MV_BEEGHLY_DRIVING_DIRECTIONS_MAP_082521_US_VENUE } from "./ach-mv-beeghly-driving-directions-map-082521-us"
import { ANGLISS_HOSPITAL_MAP_2025_AU_VENUE } from "./angliss-hospital-map-2025-au"
import { ANW_CONSTRUCTION_UPDATE_US_VENUE } from "./anw-construction-update-us"
import { APD_CAMPUSMAP_04_08_26_US_VENUE } from "./apd-campusmap-04-08-26-us"
import { ASL_479_BROCHURE_CAMPUS_MAP_US_VENUE } from "./asl-479-brochure-campus-map-us"
import { ATLANTICARE_CAMPUS_MAP_AIRPORT_COMM_US_VENUE } from "./atlanticare-campus-map-airport-comm-us"
import { ATLANTICARE_REGIONAL_MEDICAL_CENTER_ATLANTIC_CITY_CAMPUS_MAP_US_VENUE } from "./atlanticare-regional-medical-center-atlantic-city-campus-map-us"
import { ATLANTICARE_REGIONAL_MEDICAL_CENTER_MAINLAND_CAMPUS_MAP_US_VENUE } from "./atlanticare-regional-medical-center-mainland-campus-map-us"
import { ATLANTICARE_YOUNIVERSITY_TRAINING_SPACE_FLOORPLAN_US_VENUE } from "./atlanticare-youniversity-training-space-floorplan-us"
import { AURORA_MEDICAL_CENTER_BAY_AREA_FLOOR_MAP_US_VENUE } from "./aurora-medical-center-bay-area-floor-map-us"
import { AUSTIN_HOSPITAL_MAP_2025_AU_VENUE } from "./austin-hospital-map-2025-au"
import { BALLARD_FLOORPLAN_US_VENUE } from "./ballard-floorplan-us"
import { BALLARDCAMPUS_US_VENUE } from "./ballardcampus-us"
import { BANKSTOWN_LIDCOMBE_HOSPITAL_MAP_AU_VENUE } from "./bankstown-lidcombe-hospital-map-au"
import { BAPTIST_MEDICAL_CENTER_SOUTH_CAMPUS_MAP_US_VENUE } from "./baptist-medical-center-south-campus-map-us"
import { BEACHES_CAMPUS_MAP_US_VENUE } from "./beaches-campus-map-us"
import { BELPH_PPH_MAP_AU_VENUE } from "./belph-pph-map-au"
import { BENDIGO_HEALTH_CLINICAL_SERVICES_CAMPUS_SITE_MAP_2026_AU_VENUE } from "./bendigo-health-clinical-services-campus-site-map-2026-au"
import { BHH_BUILDING_A_FLOOR_BY_FLOOR_CONSUMER_MAP_AU_VENUE } from "./bhh-building-a-floor-by-floor-consumer-map-au"
import { BHS_MAP_UPDATE_L_BLOCK_OCT_5_AU_VENUE } from "./bhs-map-update-l-block-oct-5-au"
import { BIDMC_FULL_CAMPUS_DIRECTIONS_MAP_US_VENUE } from "./bidmc-full-campus-directions-map-us"
import { BLUEBONNET_ENTRANCES_MAP_2024_US_VENUE } from "./bluebonnet-entrances-map-2024-us"
import { BMCC_CAMPUS_MAP_US_VENUE } from "./bmcc-campus-map-us"
import { BMCJ_CAMPUSMAP_BROCHURE_US_VENUE } from "./bmcj-campusmap-brochure-us"
import { BOX_HILL_HOSPITAL_MAP_2025_AU_VENUE } from "./box-hill-hospital-map-2025-au"
import { BRG_ASCENSION_CAMPUS_MAP_US_VENUE } from "./brg-ascension-campus-map-us"
import { BRG_MID_CITY_CAMPUS_MAP_US_VENUE } from "./brg-mid-city-campus-map-us"
import { BUI_MAP_DODD_DAVIS_012318_US_VENUE } from "./bui-map-dodd-davis-012318-us"
import { C_5029_ADM_COXNORTHHOSPITAL_MAP_FINAL_US_VENUE } from "./c-5029-adm-coxnorthhospital-map-final-us"
import { CABOOLTURE_HOSPITAL_MAP_AU_VENUE } from "./caboolture-hospital-map-au"
import { CAMPUS_ENTRANCE_MAP_W_HIGHWAY_DIRECTIONS_2026_US_VENUE } from "./campus-entrance-map-w-highway-directions-2026-us"
import { CAMPUS_MAP_1_AU_VENUE } from "./campus-map-1-au"
import { CAMPUS_MAP_11X8_5_202602_US_VENUE } from "./campus-map-11x8-5-202602-us"
import { CAMPUS_MAP_2_US_VENUE } from "./campus-map-2-us"
import { CAMPUS_MAP_3_US_VENUE } from "./campus-map-3-us"
import { CAMPUS_MAP_5_1_23_SPANISH_US_VENUE } from "./campus-map-5-1-23-spanish-us"
import { CAMPUS_MAP_5_US_VENUE } from "./campus-map-5-us"
import { CAMPUS_MAP_7_16_2026_US_VENUE } from "./campus-map-7-16-2026-us"
import { CAMPUS_MAP_8_2020_ENG_US_VENUE } from "./campus-map-8-2020-eng-us"
import { CAMPUS_MAP_9_25_26_US_VENUE } from "./campus-map-9-25-26-us"
import { CAMPUS_MAP_COMMUNITY_REGIONAL_MEDICAL_CENTER_US_VENUE } from "./campus-map-community-regional-medical-center-us"
import { CAMPUS_MAP_GENERAL_8_5X11_4_27_2026_US_VENUE } from "./campus-map-general-8-5x11-4-27-2026-us"
import { CAMPUS_MAP_GENERAL_US_VENUE } from "./campus-map-general-us"
import { CAMPUS_MAP_LETTER_23_005_US_VENUE } from "./campus-map-letter-23-005-us"
import { CAMPUS_MAP_SMD_US_VENUE } from "./campus-map-smd-us"
import { CAMPUS_MAP_TPCH_AU_VENUE } from "./campus-map-tpch-au"
import { CAMPUS_MAP_UPDATE_US_VENUE } from "./campus-map-update-us"
import { CAMPUS_MAP_US_VENUE } from "./campus-map-us"
import { CAMPUS_OVERVIEW_MAP_US_VENUE } from "./campus-overview-map-us"
import { CAMPUS_US_VENUE } from "./campus-us"
import { CAMPUSMAPBACK_US_VENUE } from "./campusmapback-us"
import { CAMPUSMAPFRONT_US_VENUE } from "./campusmapfront-us"
import { CAMPUSMAPJODIE2026_US_VENUE } from "./campusmapjodie2026-us"
import { CAMPUSMAPL_070126_US_VENUE } from "./campusmapl-070126-us"
import { CANCER_PAVILION_1ST_FLOOR_US_VENUE } from "./cancer-pavilion-1st-floor-us"
import { CANCER_PAVILION_3RD_FLOOR_US_VENUE } from "./cancer-pavilion-3rd-floor-us"
import { CANCER_PAVILION_5TH_FLOOR_US_VENUE } from "./cancer-pavilion-5th-floor-us"
import { CFMC_CAMPUS_MAP_US_VENUE } from "./cfmc-campus-map-us"
import { CHARLTON_CAMPUS_JUNE_2025_V1_UPDATED_FOR_GIM_4_BD_SURGE_SPACE_CA_VENUE } from "./charlton-campus-june-2025-v1-updated-for-gim-4-bd-surge-space-ca"
import { CHILDRENS_HOSPITAL_FLOOR_MAP_US_VENUE } from "./childrens-hospital-floor-map-us"
import { CHILDRENS_MEMORIAL_HERMANN_CAMPUSMAP_US_VENUE } from "./childrens-memorial-hermann-campusmap-us"
import { CLINIC_CAMPUS_MAP_8_26_2026_US_VENUE } from "./clinic-campus-map-8-26-2026-us"
import { CLINTON_MAP_FINAL_US_VENUE } from "./clinton-map-final-us"
import { CMC_HOSPITAL_MAP_1ST_FLOOR_APRIL_2026_US_VENUE } from "./cmc-hospital-map-1st-floor-april-2026-us"
import { COA_RUSSELL_CAMPUS_DIRECTORY_JULY2025_V8_US_VENUE } from "./coa-russell-campus-directory-july2025-v8-us"
import { COFFS_HARBOUR_HEALTH_CAMPUS_SITE_MAP_AU_VENUE } from "./coffs-harbour-health-campus-site-map-au"
import { COH_FIFTHFLOOR_070126_US_VENUE } from "./coh-fifthfloor-070126-us"
import { COH_FIRSTFLOOR_070126_US_VENUE } from "./coh-firstfloor-070126-us"
import { COH_FOURTHFLOOR_070126_US_VENUE } from "./coh-fourthfloor-070126-us"
import { COH_SECONDFLOOR_070126_US_VENUE } from "./coh-secondfloor-070126-us"
import { COH_THIRDFLOOR_070126_US_VENUE } from "./coh-thirdfloor-070126-us"
import { CRMC_CAMPUS_MAP_11_25_US_VENUE } from "./crmc-campus-map-11-25-us"
import { CRMC_CAMPUS_MAP_SPANISH_US_VENUE } from "./crmc-campus-map-spanish-us"
import { CRMC_DIRECTIONAL_MAP_2024_AUG_US_VENUE } from "./crmc-directional-map-2024-aug-us"
import { CRMCFULLMAP2023_US_VENUE } from "./crmcfullmap2023-us"
import { CROSS_PROGRAMMATIC_1_1_A4_HOSPITAL_CAMPUS_MAP_IE_VENUE } from "./cross-programmatic-1-1-a4-hospital-campus-map-ie"
import { CYPRESS_CAMPUS_MAP_US_VENUE } from "./cypress-campus-map-us"
import { DGH_CAMPUS_MAP_F5841_3_US_VENUE } from "./dgh-campus-map-f5841-3-us"
import { DGH_CAMPUS_MAP_F5841_US_VENUE } from "./dgh-campus-map-f5841-us"
import { DHH_CAMPUS_MAP_F8689_US_VENUE } from "./dhh-campus-map-f8689-us"
import { DIRECTIONAL_CAMPUS_MAP_1_2025_US_VENUE } from "./directional-campus-map-1-2025-us"
import { DIRECTIONAL_MAPS_2026R_PRINT_1_CA_VENUE } from "./directional-maps-2026r-print-1-ca"
import { DMH_CAMPUS_MAP_F5160_US_VENUE } from "./dmh-campus-map-f5160-us"
import { DMH_CAMPUS_MAP_US_VENUE } from "./dmh-campus-map-us"
import { DOWNSTATE_CAMPUS_MAP_US_VENUE } from "./downstate-campus-map-us"
import { DUKE_UNIVERSITY_HOSPITAL_MAPS_0_US_VENUE } from "./duke-university-hospital-maps-0-us"
import { DUKECAMPUSMAP_V3_1_2_US_VENUE } from "./dukecampusmap-v3-1-2-us"
import { EMC_CAMPUS_MAP_ESPANOL_US_VENUE } from "./emc-campus-map-espanol-us"
import { EMC_CAMPUS_MAP_US_VENUE } from "./emc-campus-map-us"
import { ENTRANCEMAP_US_VENUE } from "./entrancemap-us"
import { ESPANOL_GS_CAMPUS_MAP_COLOR_US_VENUE } from "./espanol-gs-campus-map-color-us"
import { ESPANOL_MH_CAMPUS_MAP_US_VENUE } from "./espanol-mh-campus-map-us"
import { ESPANOL_MP_CAMPUS_MAP_US_VENUE } from "./espanol-mp-campus-map-us"
import { ESPANOL_RCH_CAMPUS_MAP_US_VENUE } from "./espanol-rch-campus-map-us"
import { ESPANOL_SC_CAMPUS_MAP_US_VENUE } from "./espanol-sc-campus-map-us"
import { ESPANOL_SH_CAMPUS_MAP_US_VENUE } from "./espanol-sh-campus-map-us"
import { FINAL_WMH_CAMPUS_MAP_AU_VENUE } from "./final-wmh-campus-map-au"
import { FLC_OB_ED_CAMPUS_MAP_09_14_21_US_VENUE } from "./flc-ob-ed-campus-map-09-14-21-us"
import { FLOOR_PLAN_HGH_CA_VENUE } from "./floor-plan-hgh-ca"
import { FLOOR_PLAN_MUMC_MCH_CA_VENUE } from "./floor-plan-mumc-mch-ca"
import { FLOOR_PLAN_SPH_CA_VENUE } from "./floor-plan-sph-ca"
import { FLOOR_PLAN_UCC_CA_VENUE } from "./floor-plan-ucc-ca"
import { FLOORPLAN_MAP_ALPHABETICAL_8_5X11_092026_FINAL_US_VENUE } from "./floorplan-map-alphabetical-8-5x11-092026-final-us"
import { FLOWERS_HOSPITAL_MAP_5_10_21_V2_US_VENUE } from "./flowers-hospital-map-5-10-21-v2-us"
import { FRANKLINTON_CAMPUS_MAP_2023_US_VENUE } from "./franklinton-campus-map-2023-us"
import { FY26_CAROMONT_GASTONIA_MAP_FLYER_0508_US_VENUE } from "./fy26-caromont-gastonia-map-flyer-0508-us"
import { GAYLORD_CAMPUS_MAP_1_US_VENUE } from "./gaylord-campus-map-1-us"
import { GBMC_INTERIOR_CAMPUS_MAP_25_US_VENUE } from "./gbmc-interior-campus-map-25-us"
import { GOSFORDHOSPITALSITEMAP_AU_VENUE } from "./gosfordhospitalsitemap-au"
import { GS_CAMPUS_MAP_US_VENUE } from "./gs-campus-map-us"
import { GSRMC_CAMPUS_MAP_US_VENUE } from "./gsrmc-campus-map-us"
import { HAMMOND_HENRY_HOSPITAL_FLOOR_PLAN_2024_US_VENUE } from "./hammond-henry-hospital-floor-plan-2024-us"
import { HANNIBAL_CAMPUS_MAP_US_VENUE } from "./hannibal-campus-map-us"
import { HCGH_HOSPITAL_MAP_US_VENUE } from "./hcgh-hospital-map-us"
import { HILLSDALE_HOSPITAL_MAP_US_VENUE } from "./hillsdale-hospital-map-us"
import { HMC_CAMPUS_DIRECTORY_AND_MAP_US_VENUE } from "./hmc-campus-directory-and-map-us"
import { HOLLYWOOD_MAP_PROOF_AU_VENUE } from "./hollywood-map-proof-au"
import { HOLY_CROSS_HOSPITAL_MAP_US_VENUE } from "./holy-cross-hospital-map-us"
import { HOSPITAL_CAMPUS_MAP_REV09_AU_VENUE } from "./hospital-campus-map-rev09-au"
import { HOSPITAL_CLINIC_WAYFINDING_MAP_2026_US_VENUE } from "./hospital-clinic-wayfinding-map-2026-us"
import { HOSPITAL_FLOOR_MAP_2025_COMPRESSED_US_VENUE } from "./hospital-floor-map-2025-compressed-us"
import { HOSPITAL_MAP_2_CA_VENUE } from "./hospital-map-2-ca"
import { HOSPITAL_MAP_2314_US_VENUE } from "./hospital-map-2314-us"
import { HOURSDIRECTIONS_CAMPUSMAP_03_11_2024_US_VENUE } from "./hoursdirections-campusmap-03-11-2024-us"
import { HOURSDIRECTIONS_NORTHWINGFLOORMAP_US_VENUE } from "./hoursdirections-northwingfloormap-us"
import { HRHS_INTERNAL_MAP_US_VENUE } from "./hrhs-internal-map-us"
import { ICPH_CAMPUS_MAP_8_2024_US_VENUE } from "./icph-campus-map-8-2024-us"
import { IF_PMAP_FOOTHILLS_MEDICAL_CENTRE_CA_VENUE } from "./if-pmap-foothills-medical-centre-ca"
import { IFOH_MAP_12_2023_US_VENUE } from "./ifoh-map-12-2023-us"
import { ILH_FIRST_FLOOR_INTERIOR_MAP_G40031_FINAL_US_VENUE } from "./ilh-first-floor-interior-map-g40031-final-us"
import { IMVH_MAP_AUG_2024_US_VENUE } from "./imvh-map-aug-2024-us"
import { INOVA_MEDICAL_CENTER_RESTON_MAP_US_VENUE } from "./inova-medical-center-reston-map-us"
import { INSIDE_MAP_EAST_HOSPITAL_US_VENUE } from "./inside-map-east-hospital-us"
import { INSIGHT_COLDWATER_MAP_US_VENUE } from "./insight-coldwater-map-us"
import { JFPH_SITE_MAP_AU_VENUE } from "./jfph-site-map-au"
import { JOHN_HUNTER_HOSPITAL_MAP_AU_VENUE } from "./john-hunter-hospital-map-au"
import { KATY_HOSPITAL_CAMPUS_MAP_US_VENUE } from "./katy-hospital-campus-map-us"
import { KOSCIUSKO_COMMUNITY_HOSPITAL_MAP_US_VENUE } from "./kosciusko-community-hospital-map-us"
import { LAKESIDE_FLOOR_MAP_CA_VENUE } from "./lakeside-floor-map-ca"
import { LAUREATE_MAP_US_VENUE } from "./laureate-map-us"
import { LHSC_UH_SITE_MAP_PARKING_TRANSIT_EMERGENCY_CYCLING_INFRASTRUCTURE_LETTER_CA_VENUE } from "./lhsc-uh-site-map-parking-transit-emergency-cycling-infrastructure-letter-ca"
import { LHSC_VH_SITE_MAP_PARKING_TRANSIT_EMERGENCY_CYCLING_INFRASTRUCTURE_LETTER_CA_VENUE } from "./lhsc-vh-site-map-parking-transit-emergency-cycling-infrastructure-letter-ca"
import { LMC_NAVIGATING_CAMPUS_MAP2_US_VENUE } from "./lmc-navigating-campus-map2-us"
import { LONG_JETTY_SITE_MAP_AU_VENUE } from "./long-jetty-site-map-au"
import { MAIN_CAMPUS_MAP_US_VENUE } from "./main-campus-map-us"
import { MAIN_CAMPUS_US_VENUE } from "./main-campus-us"
import { MAIN_HOSPITAL_MAP_EN_US_VENUE } from "./main-hospital-map-en-us"
import { MAIN_HOSPITAL_MAP_PO_US_VENUE } from "./main-hospital-map-po-us"
import { MAIN_HOSPITAL_MAP_SP_US_VENUE } from "./main-hospital-map-sp-us"
import { MAP_CAMPUS_SJS_US_VENUE } from "./map-campus-sjs-us"
import { MAP_IMMANUEL_US_VENUE } from "./map-immanuel-us"
import { MAP_NEBRASKA_HEART_US_VENUE } from "./map-nebraska-heart-us"
import { MAP_OSBORNE_PARK_HOSPITAL_AU_VENUE } from "./map-osborne-park-hospital-au"
import { MAP_REVISED_CAMPUS_MAP_MAY_2025_US_VENUE } from "./map-revised-campus-map-may-2025-us"
import { MAP_SCAN_US_VENUE } from "./map-scan-us"
import { MAPMAINCAMPUS_DAYTON_CHILDRENS_US_VENUE } from "./mapmaincampus-dayton-childrens-us"
import { MAROODAH_HOSPITAL_MAP_2025_AU_VENUE } from "./maroodah-hospital-map-2025-au"
import { MATER_PRIVATE_HOSPITAL_BRISBANE_ANNERLEY_ROAD_A4_MUD_CAMPUS_MAP_AU_VENUE } from "./mater-private-hospital-brisbane-annerley-road-a4-mud-campus-map-au"
import { MATERCHILDRENSPRIVATEBRISBANE_SOUTHBRISBANECAMPUS_MAPS_A4_LANDSCAPE_AU_VENUE } from "./materchildrensprivatebrisbane-southbrisbanecampus-maps-a4-landscape-au"
import { MATERMOTHERSPRIVATEBRISBANE_SOUTHBRISBANECAMPUS_MAPS_A4_LANDSCAPE_AU_VENUE } from "./matermothersprivatebrisbane-southbrisbanecampus-maps-a4-landscape-au"
import { MCKENZIEWILLAMETTECAMPUSMAP2020_US_VENUE } from "./mckenziewillamettecampusmap2020-us"
import { MDMC_FLOOR_MAP_FEB_2026_US_VENUE } from "./mdmc-floor-map-feb-2026-us"
import { MENA_REGIONAL_CAMPUS_MAP_US_VENUE } from "./mena-regional-campus-map-us"
import { MERCY_HOSPITAL_FORT_SMITH_CONSTRUCTION_MAP_9_2_US_VENUE } from "./mercy-hospital-fort-smith-construction-map-9-2-us"
import { MERCY_WAYFINDING_JEFFERSON_CAMPUS_JANUARY_2018_US_VENUE } from "./mercy-wayfinding-jefferson-campus-january-2018-us"
import { METHODIST_HOSPITAL_FLOOR_MAP_US_VENUE } from "./methodist-hospital-floor-map-us"
import { MH_26818_CAMPUS_MAP_2026_2_US_VENUE } from "./mh-26818-campus-map-2026-2-us"
import { MH_CAMPUS_MAP_US_VENUE } from "./mh-campus-map-us"
import { MIDLAND_MEMORIAL_HOSPITAL_MAP_US_VENUE } from "./midland-memorial-hospital-map-us"
import { MIH_WAYFINDING_GUIDE_US_VENUE } from "./mih-wayfinding-guide-us"
import { MMC_EC_LEVEL1_US_VENUE } from "./mmc-ec-level1-us"
import { MP_CAMPUS_MAP_US_VENUE } from "./mp-campus-map-us"
import { MTDRUITT_HOSPITAL_MAP_AU_VENUE } from "./mtdruitt-hospital-map-au"
import { MWH_MOB_CAMPUS_MAP_US_VENUE } from "./mwh-mob-campus-map-us"
import { NATIVIDAD_CAMPUS_MAP_2025_US_VENUE } from "./natividad-campus-map-2025-us"
import { NEBH_CAMPUS_MAP_US_VENUE } from "./nebh-campus-map-us"
import { NET8161_2023_MAPS_BOOKLET_SCH_ALL_SCH_BUILDINGS_0226_FA_1_AU_VENUE } from "./net8161-2023-maps-booklet-sch-all-sch-buildings-0226-fa-1-au"
import { NET8161_HOSPITAL_MAP_BOOKLETS_CHW_1225_FA_V2_AU_VENUE } from "./net8161-hospital-map-booklets-chw-1225-fa-v2-au"
import { NEW_TRIN_HEALTH_HCMD_CAMPUS_MAP_US_VENUE } from "./new-trin-health-hcmd-campus-map-us"
import { NMC023_25_CAMPUSMAPUPDATE_JULY25_FRENCH_US_VENUE } from "./nmc023-25-campusmapupdate-july25-french-us"
import { NMC023_25_CAMPUSMAPUPDATE_JULY25_SPANISH_US_VENUE } from "./nmc023-25-campusmapupdate-july25-spanish-us"
import { NMC035_25_CAMPUSMAP_OCT25_US_VENUE } from "./nmc035-25-campusmap-oct25-us"
import { NMC056_26_CAMPUSMAPUPDATE_OCT26_FRENCH_US_VENUE } from "./nmc056-26-campusmapupdate-oct26-french-us"
import { NMC056_26_CAMPUSMAPUPDATE_OCT26_SPANISH_US_VENUE } from "./nmc056-26-campusmapupdate-oct26-spanish-us"
import { NMC056_26_CAMPUSMAPUPDATE_OCT26_US_VENUE } from "./nmc056-26-campusmapupdate-oct26-us"
import { NORTHWESTERN_MEDICINE_CDH_CAMPUS_MAP_US_VENUE } from "./northwestern-medicine-cdh-campus-map-us"
import { NORTHWESTERN_MEDICINE_MARIANJOY_CAMPUS_MAP_25_US_VENUE } from "./northwestern-medicine-marianjoy-campus-map-25-us"
import { NVRH_CAMPUSMAP_2018_US_VENUE } from "./nvrh-campusmap-2018-us"
import { NVRH_CAMPUSMAP_2025_V4_US_VENUE } from "./nvrh-campusmap-2025-v4-us"
import { NWB_SITE_MAP_AU_VENUE } from "./nwb-site-map-au"
import { NWCH_CAMPUS_MAP_1_US_VENUE } from "./nwch-campus-map-1-us"
import { OMC_CAMPUS_MAP_HANDOUT_MAY_050625_US_VENUE } from "./omc-campus-map-handout-may-050625-us"
import { OMC_CAMPUS_MAP_US_VENUE } from "./omc-campus-map-us"
import { ONCOLOGY_DEARBORN_CANCER_CENTER_ORIENTATION_PLANS_2024V4_US_VENUE } from "./oncology-dearborn-cancer-center-orientation-plans-2024v4-us"
import { OSH_CAMPUS_MAP_10_2020_CROPPED_US_VENUE } from "./osh-campus-map-10-2020-cropped-us"
import { P2019_0263_GVMH_INTERNAL_EXTERNAL_MAP_US_VENUE } from "./p2019-0263-gvmh-internal-external-map-us"
import { PARKING_CAMPUS_MAP_MOB_MAY_2025_1_US_VENUE } from "./parking-campus-map-mob-may-2025-1-us"
import { PATIENT_GUEST_CAMPUS_FIRSTFLOORMAP_US_VENUE } from "./patient-guest-campus-firstfloormap-us"
import { PENSACOLA_CAMPUS_MAP_1_US_VENUE } from "./pensacola-campus-map-1-us"
import { PHC_HOSPITAL_MAP_AU_VENUE } from "./phc-hospital-map-au"
import { PINPH_HOSPITAL_MAPS_AU_VENUE } from "./pinph-hospital-maps-au"
import { PMH_MAP_FLOOR2_CA_VENUE } from "./pmh-map-floor2-ca"
import { PROPERTY_MAP_2024_US_VENUE } from "./property-map-2024-us"
import { RALEIGH_CAMPUS_MAP_US_VENUE } from "./raleigh-campus-map-us"
import { RANDWICK_2520CAMPUS_2520ACCESSIBILITY_2520GUIDE_FINAL_230617_AU_VENUE } from "./randwick-2520campus-2520accessibility-2520guide-final-230617-au"
import { RCH_CAMPUS_MAP_US_VENUE } from "./rch-campus-map-us"
import { REDCLIFFE_HOSPITAL_MAP_AU_VENUE } from "./redcliffe-hospital-map-au"
import { REPAT_MAP_MAY_2026_AU_VENUE } from "./repat-map-may-2026-au"
import { RIVERSIDESERVICEAREAMAP2026V1_US_VENUE } from "./riversideserviceareamap2026v1-us"
import { RMC_1ST_FLOOR_MAP_VISITOR_DL_US_VENUE } from "./rmc-1st-floor-map-visitor-dl-us"
import { RMC_2ND_FLOOR_MAP_VISITOR_DL_US_VENUE } from "./rmc-2nd-floor-map-visitor-dl-us"
import { RMCWAYFINDINGMAPJUNE2025_US_VENUE } from "./rmcwayfindingmapjune2025-us"
import { RMH_PARKVILLE_SITE_PLAN_AU_VENUE } from "./rmh-parkville-site-plan-au"
import { ROSWELL_CAMPUS_MAP_DEC_2023_RSC_HIGHLIGHT_US_VENUE } from "./roswell-campus-map-dec-2023-rsc-highlight-us"
import { ROSWELL_CAMPUS_MAP_DEC_2023_US_VENUE } from "./roswell-campus-map-dec-2023-us"
import { SAE_CAMPUS_1ST_FLOOR_MAP_US_VENUE } from "./sae-campus-1st-floor-map-us"
import { SAINT_JOSEPH_HOSPITAL_CAMPUS_MAP_US_VENUE } from "./saint-joseph-hospital-campus-map-us"
import { SAMARITAN_LEBANON_COMMUNITY_HOSPITAL_MAPS_COMBINED_2024_07_02_US_VENUE } from "./samaritan-lebanon-community-hospital-maps-combined-2024-07-02-us"
import { SARH_CAMPUS_MAP_12_2025_US_VENUE } from "./sarh-campus-map-12-2025-us"
import { SC_CAMPUS_MAP_US_VENUE } from "./sc-campus-map-us"
import { SCRIPPS_MERCY_HOSPITAL_CHULA_VISTA_CAMPUS_MAP_US_VENUE } from "./scripps-mercy-hospital-chula-vista-campus-map-us"
import { SCRIPPS_MERCY_HOSPITAL_SAN_DIEGO_CAMPUS_MAP_US_VENUE } from "./scripps-mercy-hospital-san-diego-campus-map-us"
import { SEMC_VISITORS_GUIDE_2020_R_US_VENUE } from "./semc-visitors-guide-2020-r-us"
import { SENECA_HOSPITAL_REPLACEMENT_6_2_23_US_VENUE } from "./seneca-hospital-replacement-6-2-23-us"
import { SH_CAMPUS_MAP_US_VENUE } from "./sh-campus-map-us"
import { SHODAIR_CAMPUS_MAP_OCTOBER_2023_US_VENUE } from "./shodair-campus-map-october-2023-us"
import { SICKKIDS_MAIN_FLOOR_MAP_CA_VENUE } from "./sickkids-main-floor-map-ca"
import { SITE_0003_1467_FSR_CAMPUS_MAP_2023_NEW_LOGO_R3_US_VENUE } from "./site-0003-1467-fsr-campus-map-2023-new-logo-r3-us"
import { SITE_0326_MMS_SPRINGFIELD_CAMPUS_MAP_UPDATES_F2_AU_VENUE } from "./site-0326-mms-springfield-campus-map-updates-f2-au"
import { SITE_0326_MPHS_SPRINGFIELD_CAMPUS_MAP_UPDATES_F2_AU_VENUE } from "./site-0326-mphs-springfield-campus-map-updates-f2-au"
import { SITE_04170216_PATHWAYS_REVISED_4_17_US_VENUE } from "./site-04170216-pathways-revised-4-17-us"
import { SITE_08_16_2021_TOBACCO_FREE_CAMPUS_MAP_CLR_US_VENUE } from "./site-08-16-2021-tobacco-free-campus-map-clr-us"
import { SITE_0826_MMPGC_CAMPUS_MAP_UPDATE_F_AU_VENUE } from "./site-0826-mmpgc-campus-map-update-f-au"
import { SITE_0826_MPHBG_CAMPUS_MAP_UPDATES_F_1_AU_VENUE } from "./site-0826-mphbg-campus-map-updates-f-1-au"
import { SITE_0826_MPHGC_CAMPUS_MAP_UPDATE_F_AU_VENUE } from "./site-0826-mphgc-campus-map-update-f-au"
import { SITE_2017_RVH_CAMPUS_MAP_BARRIER_FREE_PARKING_CA_VENUE } from "./site-2017-rvh-campus-map-barrier-free-parking-ca"
import { SITE_2018_WAYPOINT_PARKING_MAP_CA_VENUE } from "./site-2018-waypoint-parking-map-ca"
import { SITE_20230606_SENECA_FLOOR_PLAN_US_VENUE } from "./site-20230606-seneca-floor-plan-us"
import { SITE_2024_05_11_CORVALLIS_FLOOR_MAPS_US_VENUE } from "./site-2024-05-11-corvallis-floor-maps-us"
import { SITE_2025_UHD_PHYSICIANS_HEALTH_FAIR_SITE_MAP_FINAL_C_US_VENUE } from "./site-2025-uhd-physicians-health-fair-site-map-final-c-us"
import { SITE_2026_HOSPITAL_CAMPUS_MAP_US_VENUE } from "./site-2026-hospital-campus-map-us"
import { SITE_2026_MAP_UPDATED_8_5_2026_US_VENUE } from "./site-2026-map-updated-8-5-2026-us"
import { SITE_21_OCHCS_1333_SMMC_LOCATIONS_MAP_P6_UPLOAD_HR_US_VENUE } from "./site-21-ochcs-1333-smmc-locations-map-p6-upload-hr-us"
import { SITE_22_02_1435_HSC_CAMPUSMAPREVISED_2_22_US_VENUE } from "./site-22-02-1435-hsc-campusmaprevised-2-22-us"
import { SITE_230301_CAMPUS_MAP_DRAFT_REV08_ED_IN_EXISTING_LOCATION_AU_VENUE } from "./site-230301-campus-map-draft-rev08-ed-in-existing-location-au"
import { SITE_2627503_APH_FACILITY_CAMPUS_MAP_FINAL_US_VENUE } from "./site-2627503-aph-facility-campus-map-final-us"
import { SITE_28895_MHS_84TH_ST_CAMPUS_MAP_EDITS_FINAL_US_VENUE } from "./site-28895-mhs-84th-st-campus-map-edits-final-us"
import { SITE_29639_MHS_BESTCARE_FREMONT_CAMPUS_MAP_01_US_VENUE } from "./site-29639-mhs-bestcare-fremont-campus-map-01-us"
import { SITE_3032MC_MAINCAMUPSMAPVS2_06_16_26_PS8366_US_VENUE } from "./site-3032mc-maincamupsmapvs2-06-16-26-ps8366-us"
import { SITE_31460_MJE_ELEVATOR_MAP_FINAL_US_VENUE } from "./site-31460-mje-elevator-map-final-us"
import { SITE_32414_MHS_JENNIE_EDMUNDSON_CAMPUS_MAP_NO_BLEEDSFINAL_US_VENUE } from "./site-32414-mhs-jennie-edmundson-campus-map-no-bleedsfinal-us"
import { SITE_3RD_FLOOR_MAP_92818_US_VENUE } from "./site-3rd-floor-map-92818-us"
import { SITE_676100_CANCER_ADMIN_CANCER_CENTER_FLOOR_MAP_UPDATE_022025V3_US_VENUE } from "./site-676100-cancer-admin-cancer-center-floor-map-update-022025v3-us"
import { SITE_8315_F08HOSPITALLOCATIONGUIDE_US_VENUE } from "./site-8315-f08hospitallocationguide-us"
import { SJ_CAMPUS_MAP_0416_US_VENUE } from "./sj-campus-map-0416-us"
import { SJ_FACILITY_MAP_8_5X11_0416_US_VENUE } from "./sj-facility-map-8-5x11-0416-us"
import { SJB_CAMPUS_MAP_US_VENUE } from "./sjb-campus-map-us"
import { SM_CAMPUS_MAP_0315_US_VENUE } from "./sm-campus-map-0315-us"
import { SMH_CAMPUS_MAP_3_2023_FULL_MAP_W_STREETS_ADDED_BOTH_PAGES_US_VENUE } from "./smh-campus-map-3-2023-full-map-w-streets-added-both-pages-us"
import { SMH_SARASOTA_3D_CAMPUS_MAP_FLYER_US_VENUE } from "./smh-sarasota-3d-campus-map-flyer-us"
import { SMH_SARASOTA_CAMPUS_MAP_2026_2_US_VENUE } from "./smh-sarasota-campus-map-2026-2-us"
import { SMH_SARASOTA_CAMPUS_MAP_2026_US_VENUE } from "./smh-sarasota-campus-map-2026-us"
import { SMITHBLDG_FIRSTFLOOR_1_US_VENUE } from "./smithbldg-firstfloor-1-us"
import { SMITHBLDG_SECONDFLOOR_070126_US_VENUE } from "./smithbldg-secondfloor-070126-us"
import { SMITHBLDG_THIRDFLOOR_070126_US_VENUE } from "./smithbldg-thirdfloor-070126-us"
import { SNLHCAMPUSMAP_US_VENUE } from "./snlhcampusmap-us"
import { SOUTHWEST_CAMPUS_MAP_PDF_US_VENUE } from "./southwest-campus-map-pdf-us"
import { SPCH_CAMPUS_MAP_US_VENUE } from "./spch-campus-map-us"
import { SPH_CAMPUS_MAP_COLOR_DL_US_VENUE } from "./sph-campus-map-color-dl-us"
import { SPMG_B_1ST_FLOOR_MAP_VISITOR_DL_US_VENUE } from "./spmg-b-1st-floor-map-visitor-dl-us"
import { SPMG_B_2ND_FLOOR_MAP_DL_US_VENUE } from "./spmg-b-2nd-floor-map-dl-us"
import { SPMG_B_3RD_FLOOR_MAP_DL_US_VENUE } from "./spmg-b-3rd-floor-map-dl-us"
import { SRHC_FACILITIES_MAP_2023_US_VENUE } from "./srhc-facilities-map-2023-us"
import { ST_LUKES_VISITOR_MAP_2020R_US_VENUE } from "./st-lukes-visitor-map-2020r-us"
import { STARS_CAMPUS_MAP_AU_VENUE } from "./stars-campus-map-au"
import { STJOHNSCAMPUS_MAP_2017_CA_VENUE } from "./stjohnscampus-map-2017-ca"
import { SUGAR_LAND_CAMPUS_MAP_US_VENUE } from "./sugar-land-campus-map-us"
import { SUMMA_HEALTH_AKRON_CAMPUS_MAP_2026_US_VENUE } from "./summa-health-akron-campus-map-2026-us"
import { SUNNYBROOK_BAYVIEW_CAMPUS_MAP_CA_VENUE } from "./sunnybrook-bayview-campus-map-ca"
import { TAMWORTHHEALTHSERVICE_CAMPUSMAP_05_10_23_AU_VENUE } from "./tamworthhealthservice-campusmap-05-10-23-au"
import { THE_QUEENS_MEDICAL_CENTER_MAP_US_VENUE } from "./the-queens-medical-center-map-us"
import { TR_LYNDHURST_FLOOR_MAP_CA_VENUE } from "./tr-lyndhurst-floor-map-ca"
import { TR_RUMSEY_CARDIAC_FLOOR_MAP_CA_VENUE } from "./tr-rumsey-cardiac-floor-map-ca"
import { TR_UC_FLOOR_MAP_CA_VENUE } from "./tr-uc-floor-map-ca"
import { TRAVELSMART_AU_VENUE } from "./travelsmart-au"
import { TRIN_HEALTH_HCMD_DOWNTOWNCAMPUS_MAP_3_23_22_US_VENUE } from "./trin-health-hcmd-downtowncampus-map-3-23-22-us"
import { TWH_FLOOR_MAP_CA_VENUE } from "./twh-floor-map-ca"
import { UHK_FLOORMAP_2022_IE_VENUE } from "./uhk-floormap-2022-ie"
import { VALLEY_CHILDRENS_HOSPITAL_MAP_2_US_VENUE } from "./valley-childrens-hospital-map-2-us"
import { VALLEY_CHILDRENS_HOSPITAL_MAP_3_US_VENUE } from "./valley-childrens-hospital-map-3-us"
import { VALLEY_CHILDRENS_HOSPITAL_MAP_US_VENUE } from "./valley-childrens-hospital-map-us"
import { VMC_VISITORS_GUIDE_6_2025_US_VENUE } from "./vmc-visitors-guide-6-2025-us"
import { VMCC_VISITOR_GUIDE_US_VENUE } from "./vmcc-visitor-guide-us"
import { VUMC_2DCAMPUS_2025_US_VENUE } from "./vumc-2dcampus-2025-us"
import { VUMC_3D_CAMPUS_RENDERING_WITH_CENTRAL_GARAGE_NOTICE_US_VENUE } from "./vumc-3d-campus-rendering-with-central-garage-notice-us"
import { WAKEMED_CARY_HOSPITAL_MAP_2_US_VENUE } from "./wakemed-cary-hospital-map-2-us"
import { WANTIRNA_SITE_MAP_MARCH_2026_AU_VENUE } from "./wantirna-site-map-march-2026-au"
import { WAYFINDING_ALL_LEVELS_FINAL_SPANISH_V4_US_VENUE } from "./wayfinding-all-levels-final-spanish-v4-us"
import { WAYFINDING_ALL_LEVELS_US_VENUE } from "./wayfinding-all-levels-us"
import { WAYFINDING_BROCHURES_DIGITAL_JULY_13_CA_VENUE } from "./wayfinding-brochures-digital-july-13-ca"
import { WAYFINDING_GUIDE_US_VENUE } from "./wayfinding-guide-us"
import { WAYFINDING_MAP_JUNE_2026_CA_VENUE } from "./wayfinding-map-june-2026-ca"
import { WEST_CAMPUS_MAP_JPN_8_11_23_US_VENUE } from "./west-campus-map-jpn-8-11-23-us"
import { WEST_CAMPUS_MAP_KOR_8_11_23_US_VENUE } from "./west-campus-map-kor-8-11-23-us"
import { WEST_CAMPUS_MAP_RUS_8_11_23_US_VENUE } from "./west-campus-map-rus-8-11-23-us"
import { WEST_CAMPUS_MAP_SOM_8_11_23_US_VENUE } from "./west-campus-map-som-8-11-23-us"
import { WEST_CAMPUS_MAP_SPA_US_8_11_23_US_VENUE } from "./west-campus-map-spa-us-8-11-23-us"
import { WEST_CAMPUS_MAP_THA_8_11_23_US_VENUE } from "./west-campus-map-tha-8-11-23-us"
import { WEST_CAMPUS_MAP_US_VENUE } from "./west-campus-map-us"
import { WEST_CAMPUS_MAP_VIE_8_11_23_US_VENUE } from "./west-campus-map-vie-8-11-23-us"
import { WEST_CAMPUS_MAP_ZHO_CN_8_11_23_US_VENUE } from "./west-campus-map-zho-cn-8-11-23-us"
import { WEST_CAMPUS_MAP_ZHO_TW_8_11_23_US_VENUE } from "./west-campus-map-zho-tw-8-11-23-us"
import { WEST_PENN_HOSPITAL_FIND_YOUR_WAY_BROCHURE_US_VENUE } from "./west-penn-hospital-find-your-way-brochure-us"
import { WESTMEAD_HOSPITAL_MAP_AU_VENUE } from "./westmead-hospital-map-au"
import { WH_CAMPUS_ENGLISH_WEB_US_VENUE } from "./wh-campus-english-web-us"
import { WH_CAMPUS_SPANISH_WEB_US_VENUE } from "./wh-campus-spanish-web-us"
import { WHITE_RIVER_MEDICAL_CENTER_CAMPUS_MAP_US_VENUE } from "./white-river-medical-center-campus-map-us"
import { WOYWOYHOSPITALSITEMAP_AU_VENUE } from "./woywoyhospitalsitemap-au"
import { WRM14957_CAMPUSMAPUPDATE_081726_FNL_DIGITAL_US_VENUE } from "./wrm14957-campusmapupdate-081726-fnl-digital-us"
import { WRM14957_VISITOR_AND_PATIENT_PARKING_MAP_090926_US_VENUE } from "./wrm14957-visitor-and-patient-parking-map-090926-us"
import { WSLHD_AUBURN_HOSPITAL_MAP_A4_SIZE_PORTRAIT_AU_VENUE } from "./wslhd-auburn-hospital-map-a4-size-portrait-au"
import { WSLHD_BLACKTOWN_HOSPITAL_MAP_A4_SIZE_AU_VENUE } from "./wslhd-blacktown-hospital-map-a4-size-au"
import { WYONGHOSPITALSITEMAP_AU_VENUE } from "./wyonghospitalsitemap-au"
import { ZSFG_CAMPUS_MAP_260618_US_VENUE } from "./zsfg-campus-map-260618-us"

// 326 venue(s) built from published hospital site maps.
export const WORLD_GENERATED_SHEET_VENUES: Venue[] = [
  A4_WAYFINDING_FLYER_24_02_2026_AU_VENUE,
  ABBOTT_NORTHWESTERN_HOSPITAL_CAMPUS_MAP_US_VENUE,
  ACH_MV_BEEGHLY_DRIVING_DIRECTIONS_MAP_082521_US_VENUE,
  ANGLISS_HOSPITAL_MAP_2025_AU_VENUE,
  ANW_CONSTRUCTION_UPDATE_US_VENUE,
  APD_CAMPUSMAP_04_08_26_US_VENUE,
  ASL_479_BROCHURE_CAMPUS_MAP_US_VENUE,
  ATLANTICARE_CAMPUS_MAP_AIRPORT_COMM_US_VENUE,
  ATLANTICARE_REGIONAL_MEDICAL_CENTER_ATLANTIC_CITY_CAMPUS_MAP_US_VENUE,
  ATLANTICARE_REGIONAL_MEDICAL_CENTER_MAINLAND_CAMPUS_MAP_US_VENUE,
  ATLANTICARE_YOUNIVERSITY_TRAINING_SPACE_FLOORPLAN_US_VENUE,
  AURORA_MEDICAL_CENTER_BAY_AREA_FLOOR_MAP_US_VENUE,
  AUSTIN_HOSPITAL_MAP_2025_AU_VENUE,
  BALLARD_FLOORPLAN_US_VENUE,
  BALLARDCAMPUS_US_VENUE,
  BANKSTOWN_LIDCOMBE_HOSPITAL_MAP_AU_VENUE,
  BAPTIST_MEDICAL_CENTER_SOUTH_CAMPUS_MAP_US_VENUE,
  BEACHES_CAMPUS_MAP_US_VENUE,
  BELPH_PPH_MAP_AU_VENUE,
  BENDIGO_HEALTH_CLINICAL_SERVICES_CAMPUS_SITE_MAP_2026_AU_VENUE,
  BHH_BUILDING_A_FLOOR_BY_FLOOR_CONSUMER_MAP_AU_VENUE,
  BHS_MAP_UPDATE_L_BLOCK_OCT_5_AU_VENUE,
  BIDMC_FULL_CAMPUS_DIRECTIONS_MAP_US_VENUE,
  BLUEBONNET_ENTRANCES_MAP_2024_US_VENUE,
  BMCC_CAMPUS_MAP_US_VENUE,
  BMCJ_CAMPUSMAP_BROCHURE_US_VENUE,
  BOX_HILL_HOSPITAL_MAP_2025_AU_VENUE,
  BRG_ASCENSION_CAMPUS_MAP_US_VENUE,
  BRG_MID_CITY_CAMPUS_MAP_US_VENUE,
  BUI_MAP_DODD_DAVIS_012318_US_VENUE,
  C_5029_ADM_COXNORTHHOSPITAL_MAP_FINAL_US_VENUE,
  CABOOLTURE_HOSPITAL_MAP_AU_VENUE,
  CAMPUS_ENTRANCE_MAP_W_HIGHWAY_DIRECTIONS_2026_US_VENUE,
  CAMPUS_MAP_1_AU_VENUE,
  CAMPUS_MAP_11X8_5_202602_US_VENUE,
  CAMPUS_MAP_2_US_VENUE,
  CAMPUS_MAP_3_US_VENUE,
  CAMPUS_MAP_5_1_23_SPANISH_US_VENUE,
  CAMPUS_MAP_5_US_VENUE,
  CAMPUS_MAP_7_16_2026_US_VENUE,
  CAMPUS_MAP_8_2020_ENG_US_VENUE,
  CAMPUS_MAP_9_25_26_US_VENUE,
  CAMPUS_MAP_COMMUNITY_REGIONAL_MEDICAL_CENTER_US_VENUE,
  CAMPUS_MAP_GENERAL_8_5X11_4_27_2026_US_VENUE,
  CAMPUS_MAP_GENERAL_US_VENUE,
  CAMPUS_MAP_LETTER_23_005_US_VENUE,
  CAMPUS_MAP_SMD_US_VENUE,
  CAMPUS_MAP_TPCH_AU_VENUE,
  CAMPUS_MAP_UPDATE_US_VENUE,
  CAMPUS_MAP_US_VENUE,
  CAMPUS_OVERVIEW_MAP_US_VENUE,
  CAMPUS_US_VENUE,
  CAMPUSMAPBACK_US_VENUE,
  CAMPUSMAPFRONT_US_VENUE,
  CAMPUSMAPJODIE2026_US_VENUE,
  CAMPUSMAPL_070126_US_VENUE,
  CANCER_PAVILION_1ST_FLOOR_US_VENUE,
  CANCER_PAVILION_3RD_FLOOR_US_VENUE,
  CANCER_PAVILION_5TH_FLOOR_US_VENUE,
  CFMC_CAMPUS_MAP_US_VENUE,
  CHARLTON_CAMPUS_JUNE_2025_V1_UPDATED_FOR_GIM_4_BD_SURGE_SPACE_CA_VENUE,
  CHILDRENS_HOSPITAL_FLOOR_MAP_US_VENUE,
  CHILDRENS_MEMORIAL_HERMANN_CAMPUSMAP_US_VENUE,
  CLINIC_CAMPUS_MAP_8_26_2026_US_VENUE,
  CLINTON_MAP_FINAL_US_VENUE,
  CMC_HOSPITAL_MAP_1ST_FLOOR_APRIL_2026_US_VENUE,
  COA_RUSSELL_CAMPUS_DIRECTORY_JULY2025_V8_US_VENUE,
  COFFS_HARBOUR_HEALTH_CAMPUS_SITE_MAP_AU_VENUE,
  COH_FIFTHFLOOR_070126_US_VENUE,
  COH_FIRSTFLOOR_070126_US_VENUE,
  COH_FOURTHFLOOR_070126_US_VENUE,
  COH_SECONDFLOOR_070126_US_VENUE,
  COH_THIRDFLOOR_070126_US_VENUE,
  CRMC_CAMPUS_MAP_11_25_US_VENUE,
  CRMC_CAMPUS_MAP_SPANISH_US_VENUE,
  CRMC_DIRECTIONAL_MAP_2024_AUG_US_VENUE,
  CRMCFULLMAP2023_US_VENUE,
  CROSS_PROGRAMMATIC_1_1_A4_HOSPITAL_CAMPUS_MAP_IE_VENUE,
  CYPRESS_CAMPUS_MAP_US_VENUE,
  DGH_CAMPUS_MAP_F5841_3_US_VENUE,
  DGH_CAMPUS_MAP_F5841_US_VENUE,
  DHH_CAMPUS_MAP_F8689_US_VENUE,
  DIRECTIONAL_CAMPUS_MAP_1_2025_US_VENUE,
  DIRECTIONAL_MAPS_2026R_PRINT_1_CA_VENUE,
  DMH_CAMPUS_MAP_F5160_US_VENUE,
  DMH_CAMPUS_MAP_US_VENUE,
  DOWNSTATE_CAMPUS_MAP_US_VENUE,
  DUKE_UNIVERSITY_HOSPITAL_MAPS_0_US_VENUE,
  DUKECAMPUSMAP_V3_1_2_US_VENUE,
  EMC_CAMPUS_MAP_ESPANOL_US_VENUE,
  EMC_CAMPUS_MAP_US_VENUE,
  ENTRANCEMAP_US_VENUE,
  ESPANOL_GS_CAMPUS_MAP_COLOR_US_VENUE,
  ESPANOL_MH_CAMPUS_MAP_US_VENUE,
  ESPANOL_MP_CAMPUS_MAP_US_VENUE,
  ESPANOL_RCH_CAMPUS_MAP_US_VENUE,
  ESPANOL_SC_CAMPUS_MAP_US_VENUE,
  ESPANOL_SH_CAMPUS_MAP_US_VENUE,
  FINAL_WMH_CAMPUS_MAP_AU_VENUE,
  FLC_OB_ED_CAMPUS_MAP_09_14_21_US_VENUE,
  FLOOR_PLAN_HGH_CA_VENUE,
  FLOOR_PLAN_MUMC_MCH_CA_VENUE,
  FLOOR_PLAN_SPH_CA_VENUE,
  FLOOR_PLAN_UCC_CA_VENUE,
  FLOORPLAN_MAP_ALPHABETICAL_8_5X11_092026_FINAL_US_VENUE,
  FLOWERS_HOSPITAL_MAP_5_10_21_V2_US_VENUE,
  FRANKLINTON_CAMPUS_MAP_2023_US_VENUE,
  FY26_CAROMONT_GASTONIA_MAP_FLYER_0508_US_VENUE,
  GAYLORD_CAMPUS_MAP_1_US_VENUE,
  GBMC_INTERIOR_CAMPUS_MAP_25_US_VENUE,
  GOSFORDHOSPITALSITEMAP_AU_VENUE,
  GS_CAMPUS_MAP_US_VENUE,
  GSRMC_CAMPUS_MAP_US_VENUE,
  HAMMOND_HENRY_HOSPITAL_FLOOR_PLAN_2024_US_VENUE,
  HANNIBAL_CAMPUS_MAP_US_VENUE,
  HCGH_HOSPITAL_MAP_US_VENUE,
  HILLSDALE_HOSPITAL_MAP_US_VENUE,
  HMC_CAMPUS_DIRECTORY_AND_MAP_US_VENUE,
  HOLLYWOOD_MAP_PROOF_AU_VENUE,
  HOLY_CROSS_HOSPITAL_MAP_US_VENUE,
  HOSPITAL_CAMPUS_MAP_REV09_AU_VENUE,
  HOSPITAL_CLINIC_WAYFINDING_MAP_2026_US_VENUE,
  HOSPITAL_FLOOR_MAP_2025_COMPRESSED_US_VENUE,
  HOSPITAL_MAP_2_CA_VENUE,
  HOSPITAL_MAP_2314_US_VENUE,
  HOURSDIRECTIONS_CAMPUSMAP_03_11_2024_US_VENUE,
  HOURSDIRECTIONS_NORTHWINGFLOORMAP_US_VENUE,
  HRHS_INTERNAL_MAP_US_VENUE,
  ICPH_CAMPUS_MAP_8_2024_US_VENUE,
  IF_PMAP_FOOTHILLS_MEDICAL_CENTRE_CA_VENUE,
  IFOH_MAP_12_2023_US_VENUE,
  ILH_FIRST_FLOOR_INTERIOR_MAP_G40031_FINAL_US_VENUE,
  IMVH_MAP_AUG_2024_US_VENUE,
  INOVA_MEDICAL_CENTER_RESTON_MAP_US_VENUE,
  INSIDE_MAP_EAST_HOSPITAL_US_VENUE,
  INSIGHT_COLDWATER_MAP_US_VENUE,
  JFPH_SITE_MAP_AU_VENUE,
  JOHN_HUNTER_HOSPITAL_MAP_AU_VENUE,
  KATY_HOSPITAL_CAMPUS_MAP_US_VENUE,
  KOSCIUSKO_COMMUNITY_HOSPITAL_MAP_US_VENUE,
  LAKESIDE_FLOOR_MAP_CA_VENUE,
  LAUREATE_MAP_US_VENUE,
  LHSC_UH_SITE_MAP_PARKING_TRANSIT_EMERGENCY_CYCLING_INFRASTRUCTURE_LETTER_CA_VENUE,
  LHSC_VH_SITE_MAP_PARKING_TRANSIT_EMERGENCY_CYCLING_INFRASTRUCTURE_LETTER_CA_VENUE,
  LMC_NAVIGATING_CAMPUS_MAP2_US_VENUE,
  LONG_JETTY_SITE_MAP_AU_VENUE,
  MAIN_CAMPUS_MAP_US_VENUE,
  MAIN_CAMPUS_US_VENUE,
  MAIN_HOSPITAL_MAP_EN_US_VENUE,
  MAIN_HOSPITAL_MAP_PO_US_VENUE,
  MAIN_HOSPITAL_MAP_SP_US_VENUE,
  MAP_CAMPUS_SJS_US_VENUE,
  MAP_IMMANUEL_US_VENUE,
  MAP_NEBRASKA_HEART_US_VENUE,
  MAP_OSBORNE_PARK_HOSPITAL_AU_VENUE,
  MAP_REVISED_CAMPUS_MAP_MAY_2025_US_VENUE,
  MAP_SCAN_US_VENUE,
  MAPMAINCAMPUS_DAYTON_CHILDRENS_US_VENUE,
  MAROODAH_HOSPITAL_MAP_2025_AU_VENUE,
  MATER_PRIVATE_HOSPITAL_BRISBANE_ANNERLEY_ROAD_A4_MUD_CAMPUS_MAP_AU_VENUE,
  MATERCHILDRENSPRIVATEBRISBANE_SOUTHBRISBANECAMPUS_MAPS_A4_LANDSCAPE_AU_VENUE,
  MATERMOTHERSPRIVATEBRISBANE_SOUTHBRISBANECAMPUS_MAPS_A4_LANDSCAPE_AU_VENUE,
  MCKENZIEWILLAMETTECAMPUSMAP2020_US_VENUE,
  MDMC_FLOOR_MAP_FEB_2026_US_VENUE,
  MENA_REGIONAL_CAMPUS_MAP_US_VENUE,
  MERCY_HOSPITAL_FORT_SMITH_CONSTRUCTION_MAP_9_2_US_VENUE,
  MERCY_WAYFINDING_JEFFERSON_CAMPUS_JANUARY_2018_US_VENUE,
  METHODIST_HOSPITAL_FLOOR_MAP_US_VENUE,
  MH_26818_CAMPUS_MAP_2026_2_US_VENUE,
  MH_CAMPUS_MAP_US_VENUE,
  MIDLAND_MEMORIAL_HOSPITAL_MAP_US_VENUE,
  MIH_WAYFINDING_GUIDE_US_VENUE,
  MMC_EC_LEVEL1_US_VENUE,
  MP_CAMPUS_MAP_US_VENUE,
  MTDRUITT_HOSPITAL_MAP_AU_VENUE,
  MWH_MOB_CAMPUS_MAP_US_VENUE,
  NATIVIDAD_CAMPUS_MAP_2025_US_VENUE,
  NEBH_CAMPUS_MAP_US_VENUE,
  NET8161_2023_MAPS_BOOKLET_SCH_ALL_SCH_BUILDINGS_0226_FA_1_AU_VENUE,
  NET8161_HOSPITAL_MAP_BOOKLETS_CHW_1225_FA_V2_AU_VENUE,
  NEW_TRIN_HEALTH_HCMD_CAMPUS_MAP_US_VENUE,
  NMC023_25_CAMPUSMAPUPDATE_JULY25_FRENCH_US_VENUE,
  NMC023_25_CAMPUSMAPUPDATE_JULY25_SPANISH_US_VENUE,
  NMC035_25_CAMPUSMAP_OCT25_US_VENUE,
  NMC056_26_CAMPUSMAPUPDATE_OCT26_FRENCH_US_VENUE,
  NMC056_26_CAMPUSMAPUPDATE_OCT26_SPANISH_US_VENUE,
  NMC056_26_CAMPUSMAPUPDATE_OCT26_US_VENUE,
  NORTHWESTERN_MEDICINE_CDH_CAMPUS_MAP_US_VENUE,
  NORTHWESTERN_MEDICINE_MARIANJOY_CAMPUS_MAP_25_US_VENUE,
  NVRH_CAMPUSMAP_2018_US_VENUE,
  NVRH_CAMPUSMAP_2025_V4_US_VENUE,
  NWB_SITE_MAP_AU_VENUE,
  NWCH_CAMPUS_MAP_1_US_VENUE,
  OMC_CAMPUS_MAP_HANDOUT_MAY_050625_US_VENUE,
  OMC_CAMPUS_MAP_US_VENUE,
  ONCOLOGY_DEARBORN_CANCER_CENTER_ORIENTATION_PLANS_2024V4_US_VENUE,
  OSH_CAMPUS_MAP_10_2020_CROPPED_US_VENUE,
  P2019_0263_GVMH_INTERNAL_EXTERNAL_MAP_US_VENUE,
  PARKING_CAMPUS_MAP_MOB_MAY_2025_1_US_VENUE,
  PATIENT_GUEST_CAMPUS_FIRSTFLOORMAP_US_VENUE,
  PENSACOLA_CAMPUS_MAP_1_US_VENUE,
  PHC_HOSPITAL_MAP_AU_VENUE,
  PINPH_HOSPITAL_MAPS_AU_VENUE,
  PMH_MAP_FLOOR2_CA_VENUE,
  PROPERTY_MAP_2024_US_VENUE,
  RALEIGH_CAMPUS_MAP_US_VENUE,
  RANDWICK_2520CAMPUS_2520ACCESSIBILITY_2520GUIDE_FINAL_230617_AU_VENUE,
  RCH_CAMPUS_MAP_US_VENUE,
  REDCLIFFE_HOSPITAL_MAP_AU_VENUE,
  REPAT_MAP_MAY_2026_AU_VENUE,
  RIVERSIDESERVICEAREAMAP2026V1_US_VENUE,
  RMC_1ST_FLOOR_MAP_VISITOR_DL_US_VENUE,
  RMC_2ND_FLOOR_MAP_VISITOR_DL_US_VENUE,
  RMCWAYFINDINGMAPJUNE2025_US_VENUE,
  RMH_PARKVILLE_SITE_PLAN_AU_VENUE,
  ROSWELL_CAMPUS_MAP_DEC_2023_RSC_HIGHLIGHT_US_VENUE,
  ROSWELL_CAMPUS_MAP_DEC_2023_US_VENUE,
  SAE_CAMPUS_1ST_FLOOR_MAP_US_VENUE,
  SAINT_JOSEPH_HOSPITAL_CAMPUS_MAP_US_VENUE,
  SAMARITAN_LEBANON_COMMUNITY_HOSPITAL_MAPS_COMBINED_2024_07_02_US_VENUE,
  SARH_CAMPUS_MAP_12_2025_US_VENUE,
  SC_CAMPUS_MAP_US_VENUE,
  SCRIPPS_MERCY_HOSPITAL_CHULA_VISTA_CAMPUS_MAP_US_VENUE,
  SCRIPPS_MERCY_HOSPITAL_SAN_DIEGO_CAMPUS_MAP_US_VENUE,
  SEMC_VISITORS_GUIDE_2020_R_US_VENUE,
  SENECA_HOSPITAL_REPLACEMENT_6_2_23_US_VENUE,
  SH_CAMPUS_MAP_US_VENUE,
  SHODAIR_CAMPUS_MAP_OCTOBER_2023_US_VENUE,
  SICKKIDS_MAIN_FLOOR_MAP_CA_VENUE,
  SITE_0003_1467_FSR_CAMPUS_MAP_2023_NEW_LOGO_R3_US_VENUE,
  SITE_0326_MMS_SPRINGFIELD_CAMPUS_MAP_UPDATES_F2_AU_VENUE,
  SITE_0326_MPHS_SPRINGFIELD_CAMPUS_MAP_UPDATES_F2_AU_VENUE,
  SITE_04170216_PATHWAYS_REVISED_4_17_US_VENUE,
  SITE_08_16_2021_TOBACCO_FREE_CAMPUS_MAP_CLR_US_VENUE,
  SITE_0826_MMPGC_CAMPUS_MAP_UPDATE_F_AU_VENUE,
  SITE_0826_MPHBG_CAMPUS_MAP_UPDATES_F_1_AU_VENUE,
  SITE_0826_MPHGC_CAMPUS_MAP_UPDATE_F_AU_VENUE,
  SITE_2017_RVH_CAMPUS_MAP_BARRIER_FREE_PARKING_CA_VENUE,
  SITE_2018_WAYPOINT_PARKING_MAP_CA_VENUE,
  SITE_20230606_SENECA_FLOOR_PLAN_US_VENUE,
  SITE_2024_05_11_CORVALLIS_FLOOR_MAPS_US_VENUE,
  SITE_2025_UHD_PHYSICIANS_HEALTH_FAIR_SITE_MAP_FINAL_C_US_VENUE,
  SITE_2026_HOSPITAL_CAMPUS_MAP_US_VENUE,
  SITE_2026_MAP_UPDATED_8_5_2026_US_VENUE,
  SITE_21_OCHCS_1333_SMMC_LOCATIONS_MAP_P6_UPLOAD_HR_US_VENUE,
  SITE_22_02_1435_HSC_CAMPUSMAPREVISED_2_22_US_VENUE,
  SITE_230301_CAMPUS_MAP_DRAFT_REV08_ED_IN_EXISTING_LOCATION_AU_VENUE,
  SITE_2627503_APH_FACILITY_CAMPUS_MAP_FINAL_US_VENUE,
  SITE_28895_MHS_84TH_ST_CAMPUS_MAP_EDITS_FINAL_US_VENUE,
  SITE_29639_MHS_BESTCARE_FREMONT_CAMPUS_MAP_01_US_VENUE,
  SITE_3032MC_MAINCAMUPSMAPVS2_06_16_26_PS8366_US_VENUE,
  SITE_31460_MJE_ELEVATOR_MAP_FINAL_US_VENUE,
  SITE_32414_MHS_JENNIE_EDMUNDSON_CAMPUS_MAP_NO_BLEEDSFINAL_US_VENUE,
  SITE_3RD_FLOOR_MAP_92818_US_VENUE,
  SITE_676100_CANCER_ADMIN_CANCER_CENTER_FLOOR_MAP_UPDATE_022025V3_US_VENUE,
  SITE_8315_F08HOSPITALLOCATIONGUIDE_US_VENUE,
  SJ_CAMPUS_MAP_0416_US_VENUE,
  SJ_FACILITY_MAP_8_5X11_0416_US_VENUE,
  SJB_CAMPUS_MAP_US_VENUE,
  SM_CAMPUS_MAP_0315_US_VENUE,
  SMH_CAMPUS_MAP_3_2023_FULL_MAP_W_STREETS_ADDED_BOTH_PAGES_US_VENUE,
  SMH_SARASOTA_3D_CAMPUS_MAP_FLYER_US_VENUE,
  SMH_SARASOTA_CAMPUS_MAP_2026_2_US_VENUE,
  SMH_SARASOTA_CAMPUS_MAP_2026_US_VENUE,
  SMITHBLDG_FIRSTFLOOR_1_US_VENUE,
  SMITHBLDG_SECONDFLOOR_070126_US_VENUE,
  SMITHBLDG_THIRDFLOOR_070126_US_VENUE,
  SNLHCAMPUSMAP_US_VENUE,
  SOUTHWEST_CAMPUS_MAP_PDF_US_VENUE,
  SPCH_CAMPUS_MAP_US_VENUE,
  SPH_CAMPUS_MAP_COLOR_DL_US_VENUE,
  SPMG_B_1ST_FLOOR_MAP_VISITOR_DL_US_VENUE,
  SPMG_B_2ND_FLOOR_MAP_DL_US_VENUE,
  SPMG_B_3RD_FLOOR_MAP_DL_US_VENUE,
  SRHC_FACILITIES_MAP_2023_US_VENUE,
  ST_LUKES_VISITOR_MAP_2020R_US_VENUE,
  STARS_CAMPUS_MAP_AU_VENUE,
  STJOHNSCAMPUS_MAP_2017_CA_VENUE,
  SUGAR_LAND_CAMPUS_MAP_US_VENUE,
  SUMMA_HEALTH_AKRON_CAMPUS_MAP_2026_US_VENUE,
  SUNNYBROOK_BAYVIEW_CAMPUS_MAP_CA_VENUE,
  TAMWORTHHEALTHSERVICE_CAMPUSMAP_05_10_23_AU_VENUE,
  THE_QUEENS_MEDICAL_CENTER_MAP_US_VENUE,
  TR_LYNDHURST_FLOOR_MAP_CA_VENUE,
  TR_RUMSEY_CARDIAC_FLOOR_MAP_CA_VENUE,
  TR_UC_FLOOR_MAP_CA_VENUE,
  TRAVELSMART_AU_VENUE,
  TRIN_HEALTH_HCMD_DOWNTOWNCAMPUS_MAP_3_23_22_US_VENUE,
  TWH_FLOOR_MAP_CA_VENUE,
  UHK_FLOORMAP_2022_IE_VENUE,
  VALLEY_CHILDRENS_HOSPITAL_MAP_2_US_VENUE,
  VALLEY_CHILDRENS_HOSPITAL_MAP_3_US_VENUE,
  VALLEY_CHILDRENS_HOSPITAL_MAP_US_VENUE,
  VMC_VISITORS_GUIDE_6_2025_US_VENUE,
  VMCC_VISITOR_GUIDE_US_VENUE,
  VUMC_2DCAMPUS_2025_US_VENUE,
  VUMC_3D_CAMPUS_RENDERING_WITH_CENTRAL_GARAGE_NOTICE_US_VENUE,
  WAKEMED_CARY_HOSPITAL_MAP_2_US_VENUE,
  WANTIRNA_SITE_MAP_MARCH_2026_AU_VENUE,
  WAYFINDING_ALL_LEVELS_FINAL_SPANISH_V4_US_VENUE,
  WAYFINDING_ALL_LEVELS_US_VENUE,
  WAYFINDING_BROCHURES_DIGITAL_JULY_13_CA_VENUE,
  WAYFINDING_GUIDE_US_VENUE,
  WAYFINDING_MAP_JUNE_2026_CA_VENUE,
  WEST_CAMPUS_MAP_JPN_8_11_23_US_VENUE,
  WEST_CAMPUS_MAP_KOR_8_11_23_US_VENUE,
  WEST_CAMPUS_MAP_RUS_8_11_23_US_VENUE,
  WEST_CAMPUS_MAP_SOM_8_11_23_US_VENUE,
  WEST_CAMPUS_MAP_SPA_US_8_11_23_US_VENUE,
  WEST_CAMPUS_MAP_THA_8_11_23_US_VENUE,
  WEST_CAMPUS_MAP_US_VENUE,
  WEST_CAMPUS_MAP_VIE_8_11_23_US_VENUE,
  WEST_CAMPUS_MAP_ZHO_CN_8_11_23_US_VENUE,
  WEST_CAMPUS_MAP_ZHO_TW_8_11_23_US_VENUE,
  WEST_PENN_HOSPITAL_FIND_YOUR_WAY_BROCHURE_US_VENUE,
  WESTMEAD_HOSPITAL_MAP_AU_VENUE,
  WH_CAMPUS_ENGLISH_WEB_US_VENUE,
  WH_CAMPUS_SPANISH_WEB_US_VENUE,
  WHITE_RIVER_MEDICAL_CENTER_CAMPUS_MAP_US_VENUE,
  WOYWOYHOSPITALSITEMAP_AU_VENUE,
  WRM14957_CAMPUSMAPUPDATE_081726_FNL_DIGITAL_US_VENUE,
  WRM14957_VISITOR_AND_PATIENT_PARKING_MAP_090926_US_VENUE,
  WSLHD_AUBURN_HOSPITAL_MAP_A4_SIZE_PORTRAIT_AU_VENUE,
  WSLHD_BLACKTOWN_HOSPITAL_MAP_A4_SIZE_AU_VENUE,
  WYONGHOSPITALSITEMAP_AU_VENUE,
  ZSFG_CAMPUS_MAP_260618_US_VENUE,
]
