# Hospitals and indoor maps worldwide

Findway shows a visitor the hospitals of the country they are in, and nothing
else: someone opening the app in Luxembourg sees Luxembourg's hospitals without
choosing a country or knowing the list has others. The UK keeps its NHS
register; every other country's hospitals come from OpenStreetMap.

## How the app decides the country

`src/lib/country.ts`, in order of trust:

1. A country the visitor reached by searching for it in the places list
   (typing "Luxembourg" offers *Hospitals in Luxembourg*). Remembered on the
   device.
2. The device's IANA time zone (`Europe/Luxembourg`), through the generated
   table `src/lib/data/timezone-countries.ts`. Every browser reports it, with
   no permission. Zones shared by several countries since the 2022 merges
   resolve to the country they are named for.
3. An explicit region in the language setting (`fr-LU`).
4. The United Kingdom.

Outside the UK, a visitor who has not picked a place opens on a hospital in
their country — the nearest one once there is a GPS fix — rather than on the
bundled London default. Picking a place themselves ends that.

## Where the data comes from

Three stages under `scripts/world/`, run by `.github/workflows/world-data.yml`
because Overpass is not reachable from sandboxed development machines:

| Stage | Script | Writes |
| --- | --- | --- |
| 1 | `fetch-hospitals.mjs` | `data/world/hospitals/<CC>.json` — every named hospital in each ISO country, from Overpass |
| 2 | `fetch-indoor.mjs` | `data/world/indoor-candidates.json`, `data/world/indoor-raw/<id>.json` — hospitals whose insides are mapped with OSM's Simple Indoor Tagging, and their full indoor geometry |
| 2b | `fetch-campus.mjs` | `data/world/campus-raw/<CC>.json` (not committed) — what is mapped on every hospital's grounds: buildings, entrances, car parks, facilities, footpaths. Countries with more than a thousand hospitals are fetched by state or Land; the countries named in `first` (Nigeria by default) are taken first, then the rest smallest-first. Each area that comes in is kept for a week (`data/world/campus-raw/areas/`, cached between runs by Actions) — whole, or when the server could only answer for it in cells, the cells that came in, so the next run asks only for the rest — so a run that stops at its time margin (`stop_grounds_at`: 290 minutes after the job started, 40 under its 330-minute limit, whatever the earlier stages took) carries on where the last one left off; a country with areas still to fetch is held back from publishing until a run completes it. Every query first asks the server, in the same request, whether it knows Luxembourg's country area: a server without area data is refused and the next one asked — it would otherwise answer with nothing and no error — and an area fetched before that check is fetched again |
| 3 | `build.mjs` | `public/world/<CC>.json`, `public/world/venues/<id>.json` and `public/floorplans/osm/<id>/*.svg` for the hospitals with indoor maps or site maps (not committed), `data/world/indoor-report.json`, `data/world/campus-report.json` |
| 4 | `publish.mjs` | the same, written into the shared Postgres (`db/migrations/0005_world.sql`), country by country in one transaction each; `/api/world/*` serves it; a map the run did not rebuild stays as long as its hospital is still listed, and a country whose grounds are incomplete is held back whole — a complete answer late is preferred to a partial one on time |
| 5 | `carry-on.mjs` | when countries are still held back, starts the next run itself for just those, reusing everything fetched so far — until all are complete, a run brings nothing new, or eight runs in a row |

A push that touches `scripts/world/` runs a sample of countries, reusing
hospital lists and indoor geometry fetched in the last two days, and commits
the results back to the branch. The monthly schedule, or *Run workflow* with
`ALL`, covers the world and opens a pull request.

## What an indoor map becomes

`scripts/world/lib/indoor.mjs` turns one hospital's indoor elements into a
venue (`scripts/world/test/indoor.test.mjs` checks it on a made-up hospital):

- a floor plan per OSM level, drawn as SVG: the building, the level outline,
  corridors, rooms coloured by kind, walls, doors, labels that fit;
- a waypoint for every named or recognisable room, lift, stair and entrance,
  typed in the app's vocabulary (ward, department, lift, stairs, toilet, exit,
  reception, canteen, pharmacy);
- corridor centre-lines for routing: `highway=corridor` ways where mappers
  drew them, otherwise the medial axis of the corridor polygons (the same
  skeletonisation the traced NHS sheets use).

OSM level 0 is internal floor 0 (the ground floor); level −1 is Basement 1.
Hospitals with fewer than eight rooms or four named places are not built —
the report says why.

## Site maps for everyone else

Indoor mapping is rare; mapped grounds are common. A hospital without an
indoor map but with named buildings on its grounds gets a site-map venue from
`scripts/world/lib/campus.mjs` (`scripts/world/test/campus.test.mjs`): one
plan drawn from the building outlines, car parks, footpaths and entrances; a
waypoint per named building, entrance (main, emergency, or on a named
building), car park, pharmacy, café, bus stop; the footpaths as corridors. The
bar is two named buildings plus a couple of entrances, or one building and a
handful of facilities. The hospital's own name on its main block is not a
place — a visitor knows which hospital they are at.

Ids are `osm-<cc>-<w|n|r><osm id>`, so an id alone says which country file
lists it and a saved venue survives a data refresh.

## Maps the hospitals publish themselves

OpenStreetMap has the insides of a few hundred hospitals and the grounds of
many thousands. The maps most visitors actually use are the ones hospitals
publish on their own websites: a PDF under *Maps & directions* or *Patient &
visitor information*, a page per floor if the hospital is thorough, the
campus from above if not. For the NHS, `scripts/nhs/discover-plans.mjs`
crawls every trust's website for them, and most of the mapped venues came
out of that queue (`data/README.md`). The same crawl now runs for everywhere
else, the United States first.

### How the NHS crawl works, and what is different elsewhere

The NHS crawl gets each trust's website from the NHS register. For each site
it reads robots.txt and stays out if told to; loads the homepage, through any
redirect, so it knows which host the site really is; reads the sitemap where
there is one; scores every link by how likely its page is to carry a map
(*our locations*, *getting here*, *maps and parking*…) and follows the best,
two hops deep, with a share of the page budget held back for the second hop;
and classifies every document it sees from its link text and filename
(`scripts/nhs/lib/discovery-match.mjs`) as `floor-plan`, `site-map`,
`directory` or `unknown`, with a confidence. That crawl is
`scripts/nhs/lib/crawl-site.mjs`, shared by both scripts and tested against
local servers in `scripts/nhs/test/crawl-site.test.mjs`.

Outside the UK there is no register that says which website belongs to which
hospital. `scripts/world/fetch-hospitals.mjs` keeps OpenStreetMap's `website`
tag where mappers filled it in, and `scripts/world/discover-plans.mjs` crawls
those sites, once each, because a health system runs dozens of hospitals on one
website (Allina Health a dozen, Sutter Health more than twenty). The page the
tag pointed at (`…/unity-hospital` rather than the system's homepage) is read
first. Each document found is attributed to the hospital whose distinctive
name words appear in its link text or filename; one that names none on a
shared site is kept with the site's hospitals listed, for a person to pick
from (`scripts/world/lib/plans.mjs`, `scripts/world/test/discover-plans.test.mjs`).

Maps found by hand go in `data/world/known-maps.json` and are merged on every
run, classified the same way, with the hospital id checked against the
country file. The result is `data/world/plan-candidates.json`: a triage
queue, not an import list. The maps are the hospitals' copyright.

```
npm run world:discover -- --countries US --limit 20    # a trial run
npm run world:discover -- --countries US               # the lot; hours
npm run world:discover:known                           # merge the hand-found maps; no network
```

Hospital websites are not reachable from sandboxed development environments,
so `.github/workflows/world-plan-discovery.yml` runs the crawl (*Run
workflow*, countries `US` by default), refreshes the hospital lists first so
they carry websites, and opens a pull request with the queue. Lists fetched
before websites were kept carry none, and the script says so.

### What the United States has so far

Found by hand on 10 October 2026 and recorded in `known-maps.json`, from a
machine that could search for the files but not open them: each entry's note
says what the search index showed of the document and when it is dated, so
check the file before building on it.

| Hospital | What it publishes |
| --- | --- |
| Mercy Hospital – Unity Campus, Fridley MN | floor maps, lower and main level (2017) |
| Tanner Medical Center/Villa Rica, GA | floor maps, floors 1–3; a 2025 edition on the staging host |
| St. Peter's Health Regional Medical Center, Helena MT | patient floors 1–4 on one map, the 2nd floor on its own |
| Stillwater Medical Center, OK | public floor maps, floors 1–5 (2025) |
| Montrose Regional Health, CO | floor maps with an elevator guide (May 2026) |
| Maria Fareri Children's Hospital, Valhalla NY | floor plan, floors 1–3 with room ranges |
| Lucile Packard Children's Hospital Stanford, CA | floor-by-floor wayfinding maps for two buildings, English and Spanish |
| Aultman Hospital, Canton OH | floor plans, ground to fourth floor (2023) |
| UW Medical Center – Montlake, Seattle | floor maps for patients and visitors (2019; revised twice a year) |
| Stormont Vail Health, Topeka KS | hospital maps with first-floor routes from the main entrance (2019) |
| Mills-Peninsula Medical Center, Burlingame CA | campus map covering floors 1–5 |
| Brigham and Women's Hospital, Boston | campus map and elevator directory in three languages |
| Cleveland Clinic main campus | campus map with the lettered building system |
| Northwestern Memorial Hospital, Chicago | medical campus map, English and Spanish |
| Rush University Medical Center, Chicago | street-level campus map (2017) |
| Johns Hopkins Hospital, Baltimore | campus map with a building index (2018) |
| Mayo Clinic, Rochester MN | campus maps booklet, downtown and Saint Marys |

Ten of the eighteen documents are indoor floor maps; the rest are campus
maps. What the search also showed, for the crawl and its reviewers to
expect:

- **Maps that are web pages, not documents.** Michigan Medicine, Children's
  Hospital of Philadelphia and Boston Children's publish a page per floor and
  no PDF. The crawl collects documents only (`data/README.md` says why), so
  these need their own treatment.
- **Documents with no extension.** Houston Methodist's wayfinding map is
  served as `….ashx`, and Cleveland Clinic's campus map also at a path with no
  extension; the classifier reads the filename and cannot see either.
- **Maps hosted off the hospital's own domain.** Brigham and Women's on the
  parent system's site, Mayo's on `mayo.edu`, UW Medical Center's on the
  patient-education site. The NHS approve stage refuses off-domain documents;
  a world equivalent needs the same rule, with the hosts that count recorded.
- **Apps instead of maps.** Mount Sinai, Cedars-Sinai, Mass General and NYU
  Langone offer an app or an interactive map and no printable plan.

### From a candidate to a venue

Not built for the world yet. For the NHS, `approve-plans`, `fetch-plans` and
`draft-sheets` take a candidate PDF to a placed sheet, with the hospital's
centre from the register and its span from the OpenStreetMap footprint
(`data/README.md`). A world candidate has both, `lat`, `lng` and `bbox` in
`data/world/hospitals/<CC>.json`, so the same chain can be pointed at it; the
missing pieces are a download stage keyed on the hospital id instead of an
ODS code, and the own-domain rule above. Until then a candidate is built by
hand the way the first NHS venues were: fetch the PDF, add a sheet to
`data/mapped-sites.json`, run the generators.

## Where it lives, and how the apps get it

The per-country lists, venues and plans add up to hundreds of megabytes across
the world and are refreshed monthly, so they live in the shared Postgres (the
same Railway database the venue store uses) rather than in the repository or
the app bundle. `src/lib/world-db.ts` reads it and these routes serve it,
cached at the edge:

- `/api/world` — every published country with its counts of hospitals, site maps and indoor maps
- `/api/world/<CC>` — a country's directory
- `/api/world/<CC>/maps` — the site maps and indoor maps built for a country, richest first, without the venues themselves
- `/api/world/nearest?country=&lat=&lng=` — the hospitals nearest a position, which is what a visitor outside the UK opens on, without downloading the list
- `/api/world/hospitals/<id>` and `/api/world/venues/<id>` — one hospital, or its built map
- `/api/world/plans/<id>/<plan>.svg` — a floor plan

The website and the apps read the same routes (the apps through the API base
they are built with). A data refresh therefore reaches installed apps on the
next run, with no deploy and no store release. Without `DATABASE_URL` the
routes answer 404 and a country reads as having no hospitals listed yet. The
UK's NHS directory stays in the bundle.

The workflow needs `DATABASE_URL` as a repository secret (Railway → Postgres →
Connect → Public Network → Connection URL) to publish. The run's summary says
whether it did.

### Seeing everything that has been published

`/coverage` on the site (and in the apps) lists every country, its counts and
a card per site map and indoor map, with a thumbnail of the plan, that opens
it in the app. It starts on the visitor's own country and takes
`?country=US` to start on another, so a link to one country can be shared.
The UK's maps are listed from the bundle. The page is not linked from the
visitor's screens, which only ever show their own country.

## Licence

OpenStreetMap data is © OpenStreetMap contributors, ODbL 1.0. Every venue
carries `dataSource`, every plan carries the credit, and the map's attribution
control names OpenStreetMap.
