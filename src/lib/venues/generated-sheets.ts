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

// No auto-generated sheet venues yet — the discovery pipeline hasn't run,
// or nothing it found passed the quality gate in scripts/nhs/draft-sheets.mjs.
export const GENERATED_SHEET_VENUES: Venue[] = []
