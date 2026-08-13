# Putting a hospital's map where the hospital is

*Analysis of why a placed floor plan does not line up with the basemap under it,
and what to replace the placement model with. Measurements from
`node scripts/maps/audit-placement.mjs`, added alongside this document; run it
for the current numbers and `--json` to diff two runs.*

This is defect 1 of [`mapping-review.md`](./mapping-review.md) taken on its own
and to the bottom. That review named the symptom — sheets pinned north-up — and
recommended a similarity transform. This one measures how far out the estate
actually is, separates the three errors that are being blamed on one, and says
what the georeference should be stored as.

---

## The observation

A trust's site map, laid over the basemap, sits across the road from the
hospital. Its buildings do not agree with the buildings in the aerial imagery.
It is at the wrong angle.

That is not one fault. It is three, and they compound:

| | what it does | how big | measurable today |
| --- | --- | --- | --- |
| **Angle** | the whole plan is turned about its centre | tens of metres at the edges | no — needs footprints |
| **Scale** | the plan is bigger or smaller than the ground | 14% median, 85% at the tenth percentile | partly |
| **Anchor** | the plan is slid bodily off the site | 24 m median, up to 198 m | partly |

Each one alone reads to a user as "the map is in the wrong place". Fixing one
without the others leaves the complaint intact, which is why they are worth
separating before any code is written.

---

## What placement is today

`data/mapped-sites.json` gives each sheet a `center` and a `spanM`, and
`placeFloor()` (`scripts/maps/build-venues.mjs:40`) turns them into an
axis-aligned rectangle:

```js
const dLng = v.spanM / (R * Math.cos((lat0 * Math.PI) / 180))
const dLat = (v.spanM * (H / W)) / R
```

Three numbers: two of translation and one of uniform scale. A similarity
transform — the least a georeference can be — needs four. The missing one is the
angle, and there is nowhere in the schema to put it.

Everything downstream inherits that. `L.imageOverlay` takes a `LatLngBounds` and
nothing else, so the renderer could not turn the picture even if the angle were
known — except that it now can: `FloorPlan.rotation` exists in `src/lib/types.ts`
and `FloorPlanMap.tsx:233` renders a rotated plan in its own pane. **It is set by
nothing. 0 of 72 venues carry a rotation.** The last mile is built; the
georeference that would drive it was never computed.

---

## Measurements

72 venues with a floor plan, 55 of them built from a trust's published sheet.

```
  rotation set                      0
  scale measured from a footprint   27
  scale is the default constant     18
  full-page crop                    45
  raster plan                       5
  median plan fill of page width    0.88
  median plan off-centre (m)        24
  median anchor offset (m)          18
  anchor offset >= 60 m (sheet)     9
```

### Angle: 50 of 63 sheets claim their hospital is aligned to north

`dominantAngle()` (`scripts/maps/lib/placement.mjs`) recovers the grid a drawing
is built on from its own edges — the length-weighted circular mean of 4θ over
every building outline, wall bar and stroked road, which folds the four
directions of a rectangular grid onto one angle. It comes with a strength: 1.0 is
a perfect grid, 0 is a drawing of blobs. **Median strength across the estate is
0.85** — these sheets have a very definite grid.

Of the 63 venues where it is measurable, **50 are drawn square to their page**
(within 5°). Draughtsmen fit the drawing to the paper; that is the whole
convention. And every one of those sheets is then placed north-up.

So each of those 50 venues asserts *this hospital's buildings run exactly
east-west and north-south*. Real estates are not distributed that way — building
orientation follows the street, the river and the site boundary, which is close
to uniform over the 90° a rectangular grid can occupy. Under that prior the
expected error is **22.5°**, and it exceeds 5° about 89% of the time. This is an
argument from how the sheets are drawn, not a measurement of each estate — the
measurement needs footprints (see [Ground truth](#ground-truth-is-one-file-away)) —
but it is not a close call.

What that costs, in metres, for a plan turned about its centre:

| distance from centre | 10° | 20° | 30° |
| ---: | ---: | ---: | ---: |
| 100 m | 17 m | 35 m | 52 m |
| 250 m | 44 m | 87 m | 129 m |
| 400 m | 70 m | 139 m | 207 m |

A 20° error on a 500 m campus puts its far corner 87 m out — a main road, its
verges and the building behind it. And the error is zero at the centre and worst
at the edges, which is exactly the pattern of "it looks about right until you
walk to A&E".

The 13 sheets whose own grid is *not* square to the page are the interesting
minority: Ormskirk (-26°), St Bartholomew's (+35°), Tunbridge Wells (+24°),
St George's Tooting (-18°). Those draughtsmen turned the site to fit the page —
so those sheets are wrong by their own drawn angle *plus* whatever the estate's
true bearing is.

### Scale: the ruler and the thing measured are different rectangles

Two bugs, both in `draft-sheets.mjs`, and they do not cancel.

**The wrong axis.** `footprintSpanM()` (`scripts/nhs/lib/match.mjs:91`) returns
`Math.max(widthM, heightM)` of the footprint bounding box, and `draft-sheets.mjs`
applies it as the sheet's **width**. For a site that is wider than it is tall
this is roughly right. For a site that is taller than it is wide — a hospital on
a narrow street frontage — the estate's *height* is applied to the sheet's
*width*, and the plan is inflated by the site's aspect ratio, often 40–60%.

**The wrong rectangle.** `spanM` describes the site; `placeFloor()` spreads it
across the **whole page**, margins, title block, key and directory table
included. The audit measures how much of the page the drawing occupies, using
the same `planRegion()` the corridor extractor uses to tell plan from margin:

| percentile | plan fills | so the site is drawn |
| --- | ---: | ---: |
| p90 | 0.97 | 3% too large |
| p50 | 0.88 | **14% too large** |
| p10 | 0.54 | **85% too large** |

Nine venues fill less than 60% of their page and are therefore drawn at nearly
twice the size of the ground they cover. Distances and ETAs in the UI carry the
same error.

**And 18 of 55 sheets never measured anything at all**: no OSM footprint was
found for the site, so `spanM` is `DEFAULT_SPAN_M`, a flat 450 m
(`draft-sheets.mjs:43`). A third of the estate is placed at a constant.

### Anchor: two different points, both assumed to be the middle of the plan

`center` is the site's ODS registry coordinate, and `placeFloor()` builds the
bounds so that the **centre of the crop** lands on it. Both halves of that are
wrong.

*The crop centre is not the drawing's centre.* 45 of 55 sheets still carry the
`[0, 0, 1, 1]` full-page crop, so the "centre of the plan" is the centre of the
**paper**. A site drawn to one side of its sheet — because the legend takes the
right third — is translated by however far off-centre it sits. Median **24 m**,
p90 **101 m**, worst 198 m:

| venue | plan drawn off page centre |
| --- | ---: |
| University Hospital Lewisham | 198 m |
| Queen Elizabeth Hospital, Woolwich | 163 m |
| St Bartholomew's Hospital | 132 m |
| Newham University Hospital | 128 m |
| The Tunbridge Wells Hospital | 117 m |

*The ODS point is not the estate's centre either.* It is a registry address — a
postal point for a trust's site record. It can sit at the main entrance, at the
postcode centroid, or on the road outside. Nothing in the register promises it is
in the middle of the site, or on it. This is the error most likely to read
literally as "the hospital is across the road", and it is the one this audit
cannot size without footprints.

Note what these two have in common: **both anchor the plan by a point, and a
point cannot be verified.** An anchor derived from matched geometry can be.

### The compounding

Take a 600 m sheet, drawn 20° off north, filling 75% of its page, sitting 60 m
left of centre, anchored on an ODS point 40 m off the estate's middle. The
building at the far corner of the site is displaced by the rotation (~90 m), by
the scale error (~30 m outward), and bodily by the two anchor errors (up to
100 m). None of those is visible in the current QA overlay (`overlay.mjs`),
because it draws the extracted pins on the extracted sheet — pins and picture
come from the same transform, so they always agree. **The existing check can only
confirm that extraction was self-consistent. It can never detect that placement
was wrong.** That is why 69 venues ship `verified: false` and nobody knows which
ones are actually fine.

---

## Ground truth is one file away

Everything above is measured from the sheets themselves — how they are drawn and
what they claim. The real question, *where are this hospital's buildings*, needs
an external answer, and the repo already fetches one:
`scripts/nhs/fetch-osm.mjs` writes OpenStreetMap building outlines per ODS code
to `data/footprints.geojson`.

`audit-placement.mjs` uses it when present and reports three more columns —
distance from the anchor to the real buildings, drawn extent ÷ real extent per
axis, and the turn between the sheet's grid and the estate's grid. Without it,
those columns read `-`.

**The file is gitignored** (`/data/footprints.geojson`), on the sound reasoning
that the national collection is far too large to commit. The consequence is that
placement is unauditable in CI and in any checkout that has not run the
pipeline — including sandboxes where `overpass-api.de` is not on the network
allowlist.

The fix is small: commit the subset for the sites that actually have sheets.
55 hospitals' worth of building polygons is a few hundred KB, it changes about
monthly, and it makes placement reproducible everywhere. Everything else about
the footprint pipeline can stay as it is.

---

## What to build instead

### 1. Store ground control points, not a centre and a width

The unit of placement should be correspondences: *this point on the sheet is that
point on the Earth*.

```jsonc
"gcps": [
  { "sheet": [0.284, 0.611], "world": [53.544883, -0.096293], "note": "main entrance canopy" },
  { "sheet": [0.712, 0.208], "world": [53.546901, -0.093117], "note": "NE corner, tower block" },
  { "sheet": [0.660, 0.845], "world": [53.543012, -0.094880], "note": "car park 3 entrance" }
]
```

Why this and not four scalars:

- **Two points fully determine a similarity transform** — scale, rotation and
  translation — as a closed form. Four numbers out of four, with no axis
  convention to get wrong, and the transform for a sheet you already trust can be
  recovered from the two points instead of being reverse-engineered.
- **Three or more are solved least-squares** (Umeyama / orthogonal Procrustes in
  2D: mean-centre both sets, `θ = atan2(Σ cross, Σ dot)`, `s = Σ dot′ / Σ |sheet|²`),
  and the residual — the RMS distance between where each control point lands and
  where it should — **is the quality number the pipeline has never had**. "This
  plan is placed to ±4 m" is a statement the app can act on. `verified: false` on
  69 venues is not.
- **It is the standard representation.** GDAL (`gdal_translate -gcp`), QGIS's
  Georeferencer, world files and GeoTIFF all express exactly this. Storing GCPs
  keeps the door open to `gdalwarp`, to a `.wld` sidecar, and to anyone else's
  tooling.

Keep `center` and `spanM` as derived outputs so nothing downstream breaks; add
the `rotation` the renderer already reads. Use a **similarity** transform, not a
full affine — six-parameter affine allows shear and unequal axis scales, which a
scale drawing does not have, and letting the solver use them hides real errors as
distortion. The exception is the 5 venues whose plans are raster
images (10 images in all): where one of those is a photograph of a wall-mounted
board rather than a scan, it needs a homography (8 parameters), because a photo
of a flat board taken off-axis is a projective transform, not a similarity.

**Rotate the pins with the picture.** `types.ts:78` already warns about this:
`rotation` turns the image only, so the waypoints and trails — ordinary world
coordinates — must be transformed by the same solved similarity at build time, or
they slide off the drawing. Two representations of one transform is a bug
waiting; deriving both from the GCPs in `build-venues.mjs` is the way to keep
them in step.

### 2. Get the control points — cheapest first

**a. Automatic, against the OSM footprints.** This is image registration, and it
is a solved problem. Render the sheet's `planRegion()` masses to a binary mask
and the ODS code's footprints to another at the same resolution, then recover the
transform between them:

- Seed the angle with `dominantAngle()` on both sides — the audit already
  computes it. That leaves four candidates (θ, θ+90, θ+180, θ+270), because the
  fold cannot tell which way up the sheet is.
- Resolve the four, and the scale and translation, by maximising mask overlap
  (IoU) — a coarse search over the four angles × a scale range, with translation
  from FFT phase correlation at each step, refined by local search. Fourier–Mellin
  (log-polar of the magnitude spectrum, then phase correlation) recovers rotation
  and scale in one pass if the search proves too slow.
- Emit the best fit as GCPs and **report its IoU**. Accept above a threshold,
  queue for a human below it. A confidently wrong automatic placement is worse
  than an obviously missing one.

This works because a hospital site map and an OSM footprint set are two drawings
of the same buildings — which is also why it will fail on schematic sheets that
draw blocks as rounded lozenges. Expect it to carry the majority, not all.

**b. A two-click georeferencer, for the rest and for the ground truth.** A small
internal page: the sheet at 50% opacity over the satellite basemap, click a
recognisable point on the sheet, click the same point on the imagery, twice.
Solve, show the residual, write the GCPs back to `mapped-sites.json`. Roughly two
minutes a hospital, so the entire 55-sheet estate is an afternoon — and it
produces the labelled set the automatic method has to be graded against. Build
this even if (a) works, because without it there is no way to know whether (a)
works.

**c. Roads, where buildings fail.** Schematic sheets draw the road network
faithfully even when the buildings are cartoons. Matching the sheet's stroked
polylines against OSM `highway=*` gives the same transform from different
evidence.

**d. A survey walk.** The app already supports one. Standing at two named
entrances with GPS gives two control points at metre accuracy, and unlike every
other source it verifies the whole chain end to end — the same coordinate the
"you are here" dot uses.

**e. Estates CAD or BIM.** A DWG or IFC set from a trust's estates team arrives
already georeferenced and outranks every method above. It is also what MazeMap,
Pointr and Mappedin insist on for hospital deployments. One trust handing over
one drawing set would beat the whole current sheet corpus for that site.

### 3. Fix the two scale bugs while you are there

Neither needs GCPs, and both are small:

- `footprintSpanM()` should return width and height separately, and the caller
  should match axis to axis **after** rotation is known. Collapsing an estate to
  one number and calling it a width is the bug.
- Measure and apply against the **same rectangle**: the plan area, not the page.
  `trimToCore()` in `lib/placement.mjs` already finds the plan area from the
  drawing's own ink, which is what the audit uses to produce the fill column.

### 4. Derive the crop instead of defaulting it

45 sheets carry `[0, 0, 1, 1]` because `draft-sheets.mjs:497` says a tighter crop
can only be judged from the preview, and nobody has judged them. That is now
false: the same `trimToCore()` measurement gives a plan rectangle per sheet
automatically. Drafting each sheet with its measured crop instead of the whole
page fixes the scale denominator and the anchor point together, and it keeps the
title block, key and directory table out of the waypoint set as a side effect
(defect 3 of the mapping review).

### 5. Then go vector

Once a transform is known, the better end state is not a rotated image overlay —
it is to reproject the traced SVG's paths into WGS84 at build time and render
buildings, corridors and rooms as real map layers. The plan then zooms as vector,
labels stay upright, rooms become hit-testable, dark mode becomes possible, and
the CSS-rotated pane goes away with its rough edges (a rotated overlay's
`LatLngBounds` no longer describes what is on screen, so `fitBounds` and any
bounds-based hit testing quietly work on the unrotated rectangle).

### 6. Say what is placed, and stop asserting a heading when it is not

The audit should gate the pipeline once thresholds are agreed:

- **Aligned** — GCP residual under ~5 m and footprint IoU above ~0.6. The live
  position dot, `bearing()` in route steps and the AR overlay can all be trusted.
- **Approximate** — placed automatically, unverified. Draw the plan, but suppress
  the "you are here" dot and the compass arrow, because a confidently wrong
  heading is worse than no heading: it sends a walker down the wrong corridor
  with no reason to doubt it.
- **Unplaced** — no measurement at all (today: the 18 sheets on the 450 m
  default). Show the sheet as a document, not as a map layer.

That tier belongs next to the "Navigable / Located / Directory" tier the mapping
review recommends. They answer different questions — *can it route you* versus
*is it in the right place* — and a venue can fail either independently.

---

## Suggested order

1. **Commit the footprint subset** for sheets in `mapped-sites.json`, so
   placement is measurable in CI and in every checkout. Hours.
2. **Fix the scale bugs** — per-axis footprint extent, and measure and apply on
   the same rectangle. No new data, immediate improvement on all 55.
3. **Derive the crop** per sheet from `trimToCore()`. Fixes the anchor's
   within-page error and the legend-as-destination problem at once.
4. **Build the two-click georeferencer** and do the estate by hand. This is the
   step that actually delivers "the map sits on the hospital", and it produces
   the ground truth for step 5.
5. **Automate the registration** against footprints, graded against step 4's
   answers, so the next hundred sheets do not need the afternoon.
6. **Reproject to vector** and retire the image overlay.

Steps 2 and 3 are the ones that need no new data and no new UI. Step 4 is the one
that ends the complaint.

---

## Reproducing the numbers

```
node scripts/maps/audit-placement.mjs                  # the scoreboard
node scripts/maps/audit-placement.mjs --venue <slug>   # one venue
node scripts/maps/audit-placement.mjs --json           # for diffing runs
npm run nhs:osm                                        # fetch footprints first
                                                       # for the ground-truth columns
```

The geometry it relies on is unit-tested against synthetic shapes whose answer is
known by construction — `scripts/maps/test/placement.test.mjs`, in
`npm run nhs:test`.
