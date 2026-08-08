# Hospital mapping review

*Reviewed August 2026 at commit `eb2a15f`. Scope: all 72 venues reachable from
`SEED_VENUES`, the sheet-ingestion pipeline that builds most of them, and the
navigation code that consumes them.*

Measurements in this document come from `scripts/maps/audit-venues.mjs`, added
alongside it. Run `node scripts/maps/audit-venues.mjs` for the scoreboard,
`--full` for every finding, `--json` to diff two runs.

---

## Verdict

The instinct behind the request is right, and the numbers are worse than they
look from the venue picker.

**71 of 72 venues have no corridor network.** Only GOSH does. For every other
hospital, `indoorLeg()` (`src/lib/routing.ts:238`) finds no trail to follow and
falls back to a straight line between two points, the route is flagged
`approximate`, and the map draws a dashed "this is only the direction" guide
(`FloorPlanMap.tsx:550`). Nobody is being navigated anywhere. They are being
shown a picture of a hospital with a dashed line drawn across it, through
walls, across courtyards, between buildings.

**58 of 72 are a single floor.** 48 have no lift waypoint at all. Ten venues
declare multiple floors and cannot connect any of them, because there is no
lift or stairs modelled on any storey — St George's Tooting spans seven levels
with no vertical circulation, Lewisham the same. Choosing floor 3 in the floor
selector on those venues shows a plan; asking to be routed there does nothing
useful.

**53 of 72 floor plans are vector traces of the trust's published PDF.** The
drawing was converted; the building was not modelled. Nine more are literally
raster pictures. So the diagnosis in the request — "just like pasting picture
and not creating or re-creating the structure" — is precisely correct, and it
describes the pipeline's designed behaviour rather than an accident: nothing in
`scripts/maps/` or `scripts/nhs/` ever produces geometry the router can use.

Grades across the 72: **A:2 B:0 C:5 D:33 E:22 F:10**. The two A's are GOSH
(hand-built, 228 waypoints, 10 levels, 136 corridor trails) and Addenbrooke's
(hand-built, 5 levels, 7 lifts, but still no trails). Everything else is a
directory of pins on a picture.

---

## The scoreboard

| Venues | Finding | Consequence |
| ---: | --- | --- |
| 71 | No corridor network (`trails`) | Every indoor route is a straight line flagged `approximate` |
| 69 | `verified: false` | Placement and content never checked against the real site |
| 58 | Single floor | A site map with pins on buildings; no interior to navigate |
| 53 | Floor plan is a trace of the published sheet | Nothing to route on |
| 52 | Label-quality problems | 417 bad names across 4,364 waypoints (10%) |
| 48 | No lift waypoint anywhere | Step-free routing impossible |
| 39 | >75% of waypoints typed `other`/`department` | Icons, filters and type-aware search all degrade |
| 10 | Multi-floor with no vertical circulation on any floor | Floors are unreachable from each other |
| 9 | Floor plan is a raster image | No structure, no legible text at zoom |
| 9 | Dead `quickAccess` entries (25 chips) | Shortcut chips silently render nothing |

Plus eight venue modules on disk that nothing imports
(`pah-{c..h}-level-floor-plan.ts`, two `site-2025-05-05-mdgh-*` files) — left
behind when `draft-sheets.mjs` regrouped their sheets into multi-floor venues.
Harmless, but they make the venue directory look like it contains seven
Princess Anne Hospitals when it ships one.

---

## Five structural defects

### 1. Sheets are pinned north-up, and hospital site maps are not drawn north-up

`placeFloor()` (`scripts/maps/build-venues.mjs:46-56`) computes a floor plan's
bounds as an axis-aligned rectangle:

```js
const dLng = v.spanM / (R * Math.cos((lat0 * Math.PI) / 180))
const dLat = (v.spanM * (H / W)) / R
```

There is no rotation term, `data/mapped-sites.json` has no rotation field, and
the renderer is `L.imageOverlay` (`FloorPlanMap.tsx:200`), which cannot rotate a
raster or SVG overlay at all — it takes a `LatLngBounds` and nothing else.

Trusts draw site maps to suit the page, not to suit north. So each sheet is
nailed to the basemap at whatever angle it happened to be drawn, typically tens
of degrees out. This is invisible in the QA overlay
(`scripts/maps/overlay.mjs`), because pins and picture come from the same
transform and therefore always agree with each other — the overlay can only
show that extraction was self-consistent, never that placement was right.

What it breaks is everything that arrives from the real world:

- the live GPS dot lands in the wrong part of the building;
- `bearing()` in every route step points the walker the wrong way;
- compass-overlay AR and dead reckoning are aiming at a rotated world;
- the plan visibly disagrees with the basemap underneath it.

This is the defect that most directly costs "the real in-ward feeling". A
correctly-scaled plan at the wrong angle is worse than no plan, because the app
still asserts a heading with confidence.

**Fix:** solve a similarity transform (scale, rotation, translation) instead of
a bbox fit — two or three correspondences between sheet features and the OSM
footprint are enough, and `data/footprints.geojson` already holds the target
geometry. Rendering then needs `L.imageOverlay.rotated` or an SVG overlay with a
CSS transform; alternatively reproject the traced SVG's paths into WGS84 at
build time and drop the image overlay entirely, which is the better end state
(see §4 of the recommendations).

### 2. Scale is measured against the footprint but applied to the whole sheet

`draft-sheets.mjs:454` sets `spanM` from the OSM footprint width times a padding
factor, and `placeFloor()` spreads that distance across the **full page width**,
margins, title block, legend and all. Every sheet is therefore too small by
whatever fraction of the page the site actually occupies — commonly 30–40%.
Distances and ETAs in the UI inherit the same error.

The two numbers need to describe the same thing: either measure the footprint
and apply it to the cropped plan area, or keep applying it to the full sheet and
scale it up by the crop's share of the page.

### 3. The plan crop is `[0, 0, 1, 1]`, so the sheet's furniture becomes destinations

`draft-sheets.mjs:476` drafts every sheet with a full-page crop, with an honest
comment saying a tighter crop can only be judged from the preview. Nobody has
judged them: all 55 sheets in `data/mapped-sites.json` still carry
`[0, 0, 1, 1]`. So the title block, the key, the legend and the alphabetical
directory table are all scraped as waypoints. James Cook ships
`"(IN ALPHABETICAL ORDER)"`, `"ICONS KEY:"`, `"LOCATION"` and `"FLOOR & ROUTE"`
as places you can navigate to. Whiston ships thirteen car park and parking
labels. Derriford's `quickAccess` offers `"Site Map - September 2025"`. Western
Eye offers `"Marylebone Station"` and `"Marylebone"` — real places 150 m up the
road, listed as destinations inside the hospital.

Northampton ships a waypoint named
`"KDXCLKHHCRERLKLKUMJKKJDBKYBDSGACQBQJNALMFRJKHKJEQ"` — a PDF with a subsetted
font and no `ToUnicode` map, decoded as gibberish and published without anything
noticing. That one string is a good summary of the current quality gate.

### 4. The floor is written on the label, and the pipeline throws it away

This is the clearest case of the picture being copied instead of the structure
being rebuilt.

`scripts/nhs/lib/floors.mjs` reads a storey only from the **filename**, so a
hospital that publishes one PDF per level gets floors, and a hospital that
publishes one sheet listing every ward with its floor gets everything dumped on
floor 0. Northampton General is the example: 109 waypoints, all on floor 0,
named `"Allebone (Second Floor)"`, `"Becket (First Floor)"`,
`"Balmoral - Birth Centre (First Floor)"`. The building's vertical structure was
printed on the sheet, extracted into the label string, and discarded.

99 waypoints across the estate name a storey that contradicts the floor they sit
on. Parsing the storey out of the label — and removing it from the display name
— would convert a good handful of single-floor pin boards into real multi-floor
venues without a single new data source.

### 5. Venue identity is bound to the wrong ODS record

Sheets are matched to an ODS site record, and the record's name becomes the
venue name. ODS files departments as sites, so venues ship as:

| Venue name shown to users | What the sheet actually is |
| --- | --- |
| Immunology - Derriford Hospital | Derriford Hospital site map |
| Uh North Tees Dermatology | North Tees site map |
| Uh Hartlepool Dermatology | Hartlepool site map |
| Lincoln Surgery | Lincoln County Hospital, levels 1–3 |
| Sexual Health Sheffield | a Sheffield hospital sheet |
| P Rbh Virtual Hospital | Royal Berkshire sheet |
| Castle Hill Hospital Elective Surgical Hub | Castle Hill site map |
| **Dewsbury & District Hospital-Combined Elective Surgical Hub** | **Pinderfields Hospital, Wakefield** |

The last one is not cosmetic. `pinderfields-hospital-map` ships under a Dewsbury
name at Dewsbury-adjacent coordinates, with `quickAccess: ["Main Entrance", …,
"Pinderfields Hospital", …]`. Pinderfields and Dewsbury are different hospitals
about ten miles apart. A patient searching "Dewsbury" is offered a map of the
wrong hospital. Everything downstream — search, saved venues, the ODS
reconciliation on refresh — is keyed off that wrong identity.

The matcher should reject any ODS record whose name carries a specialty
qualifier (`Immunology - …`, `… Dermatology`, `… Elective Surgical Hub`) and
walk up to the parent site, and it should hard-fail rather than accept a match
whose name shares no token with the sheet's own title text. `draft-sheets.mjs`
already computes `echoesSiteName` for exactly this purpose and only records it
as provenance; make it a gate.

Related: grouping levels into one venue keys on `odsCode::stem`
(`draft-sheets.mjs:521`), and stems come from filenames. Lincoln publishes
`lincoln-hospital-map-level-1`, `lincoln-hospital-map-level-3` and
`lincoln-hospital-maps-level-2-blank` — the plural in one filename yields a
different stem, so Lincoln ships as three separate one-floor "hospitals"
instead of one three-level building. (The level-2 sheet is also, per its own
filename, the *blank* version — an unlabelled template shipped as a venue with
13 waypoints.) Normalise stems before grouping; group on `odsCode` plus fuzzy
stem, not exact stem.

---

## What the good ones do

GOSH is the only venue in the repo that was actually *built* rather than
converted, and it is worth stating precisely what makes it different, because it
is the specification for everything else:

- **10 levels**, with `floorNaming: { word: "Level", groundLevel: 2 }` so the app
  says what the lift panel says.
- **136 corridor trails** — so routes follow hallways, cross-floor legs connect,
  and `approximate` never fires.
- **56 lift waypoints**, named per bank and mirrored across levels, which is what
  lets `buildRoute()` match "Lift A" on the departure floor to "Lift A" on the
  arrival floor.
- **Reconstructed SVGs** — drawn rooms, cores and corridors as `<rect>` and
  `<text>`, not a wall of traced `<path>`. They stay legible at every zoom.
- **Sourced and reconciled**: the header records that ward-per-level came from
  three lift directories, geometry from the estates fire drawings, orientation
  from the true-north arrows, and states which source wins when they disagree.

Addenbrooke's is the second tier done well: real levels, real lifts, honest
naming — missing only the corridor network.

Everything else in the repo is tier three, and the app currently presents all
three tiers identically.

---

## Recommendations

### 1. Make the tier visible, today

This is the cheapest thing on the list and the most valuable, because it stops
the app over-claiming. Add a derived quality level to `Venue` and show it in the
picker and on the venue card:

- **Navigable** — corridor network + vertical circulation + multi-floor. Turn-by-turn.
- **Located** — floor plans and waypoints, no corridors. Search and "it's in
  that building", with routing explicitly presented as a direction guide.
- **Directory** — a pin on a hospital (the existing NHS directory venues).

Right now `verified: false` carries this weight, and 69 of 72 venues set it, so
it communicates nothing. Users find out a venue is a picture by trying to
navigate with it — in a hospital, when they are late and anxious.

### 2. Extract the corridor network from the sheets you already have

The highest-leverage new work, and the thing that turns a traced picture into a
building. The traced SVGs contain closed building polygons; the walkable space
is the negative space between them. So:

1. Rasterise the traced SVG to a binary mask (buildings/obstacles = 0, free = 1).
2. Skeletonise the free space — a medial-axis / distance-transform thinning pass.
3. Prune spurs shorter than a threshold, simplify with Douglas–Peucker.
4. Emit the result as `SurveyTrail[]` in the venue's existing `trails` field.

Nothing in the data model has to change: `trails` already exists,
`buildTrailGraph()` already consumes it, and `schematic.ts` already knows how to
render corridors with real width and hang rooms off them. This is the same
medial-axis approach the indoor-mapping industry uses to derive navigation
meshes from CAD, and it works on exactly the input already in `public/floorplans`.

For interior plans (Princess Anne's six levels, Lincoln's three, the Queen's
Romford rasters) it produces genuine hallways. For campus site maps it produces
the path and road network between buildings, which is still a large improvement
on a straight line through three wards.

Gate it: emit trails only where the skeleton has a plausible corridor count and
total length for the site's area, and leave the venue at "Located" otherwise.
A wrong corridor network is worse than none.

### 3. Add a ward interior primitive

"The real in-ward feeling" needs a level of detail the schema cannot currently
express. A `ward` today is one point with a name. What a visitor actually needs,
once through the ward door, is: which bay, which bed, where the nurses' station
is, where the entry intercom is, and whether they can just walk in.

Extend `Waypoint` with an optional parent (`within?: string`, a waypoint id) and
add `bay`, `bed`, `nurse-station`, `day-room`, `intercom` to `WaypointType`.
That gives hierarchical destinations — "Kangaroo Ward → Bay 3 → Bed 12" — with
routing terminating at the ward door and the last leg rendered as an in-ward
schematic. `schematic.ts` can already draw rooms beside a corridor; a ward is
that same drawing at a smaller scale.

This also fixes a real safety-adjacent detail: visiting hours and access rules
belong on the ward, and `Waypoint` already has `hours` and `arrivalNotes` fields
that no generated venue populates.

### 4. Reproject the traced geometry instead of overlaying an image

Once §1 of the defects is fixed and a rotation is known, the better end state is
not a rotated image overlay — it is to transform the traced SVG's path
coordinates into WGS84 at build time and render them as real map layers
(buildings, corridors, room outlines). Then the plan zooms as vector, labels
stay upright and legible, rooms become hit-testable, dark mode is possible, and
the "picture" stops being a picture. The traced paths are already there; only the
transform is missing.

### 5. Standards worth borrowing from

The repo's `Venue` model is sound and does not need replacing, but three
external models are worth aligning to at the edges, because they solve problems
this pipeline will hit next:

- **Apple IMDF** (an open GeoJSON profile, and the closest thing to a de-facto
  standard for venue data): the `venue → building → level → unit → opening →
  anchor` decomposition is exactly the missing structure here. `unit` is the
  room, `opening` is the door, and `opening` is what this codebase lacks most —
  routing that never models doors will route through walls even with a corridor
  graph. Adopting IMDF's *shape* also gives an export path.
- **OGC IndoorGML**: the formal separation of *cellular space* from the *dual
  navigation graph*, plus inter-layer connections for lifts and stairs. This
  names the thing the ten multi-floor venues are missing: a lift is not a
  waypoint that appears on several floors, it is an edge connecting cells across
  levels. Modelling lift banks as first-class objects also closes the routing
  bug where a walker can enter one lift and exit from another
  (`REVIEW.md` #9).
- **OSM Simple Indoor Tagging** (`indoor=room/corridor/area`, `level`,
  `repeat_on`): the pragmatic subset, and the right vocabulary if any of this
  data is ever contributed back or cross-checked against OSM — which matters
  because `data/footprints.geojson` already depends on OSM.

For source data, the ladder is: **IFC/BIM or CAD from the trust's estates team**
(what MazeMap, Pointr and Mappedin all insist on for hospital deployments, and
what produces sub-metre interiors) → **CAD/DWG floor plans** → **published PDF
sheets** (where this pipeline sits, the bottom rung) → **walk survey** (which
this app can already do, and which is more accurate than the PDF route). A single
trust's estates department handing over one DWG set would outrank the entire
current sheet corpus.

Worth noting: NHS wayfinding guidance treats consistent naming and consistent
orientation as the core of the discipline. Both are currently broken here — 255
ALL-CAPS labels lifted verbatim, and every sheet at the wrong angle.

### 6. Gate the pipeline on the audit

`npm run nhs:ingest` can currently publish a venue named after a font-decoding
failure at the wrong hospital. Wire `audit-venues.mjs` into CI as a report, then
pick thresholds and fail on regression: no new venue with zero waypoints, no
venue whose name shares no token with its sheet, no dead `quickAccess` entry,
no multi-floor venue without vertical circulation.

---

## Suggested order

1. **Stop over-claiming** — quality tiers in the picker (§1). Days, not weeks.
2. **Fix identity** — reject specialty-qualified ODS matches, gate on
   `echoesSiteName`, normalise grouping stems, drop the "blank" Lincoln sheet.
   Pinderfields-under-Dewsbury is a correctness bug, not a polish item.
3. **Fix placement** — similarity transform with rotation, scale measured and
   applied to the same rectangle, crop tuned per sheet.
4. **Recover the structure that is already in the data** — storey from labels
   (99 waypoints), stairs typing (all twelve `"STAIRWELL"` labels are typed
   `other`, so `preference: "fastest"` can never use them even though `"LIFT"`
   and the WCs beside them were typed correctly), title-case normalisation,
   legend/off-site filtering.
5. **Build the corridor networks** — medial-axis extraction into `trails` (§2).
6. **Go vector** — reproject traced geometry, retire the image overlay (§4).
7. **Ward interiors** — the hierarchical primitive (§3).

Steps 1–4 use no new data and would move most of the estate from F/E to C/D.
Step 5 is what earns the word "wayfinder".
