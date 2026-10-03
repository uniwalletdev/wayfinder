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
| 2b | `fetch-campus.mjs` | `data/world/campus-raw/<CC>.json` (not committed) — what is mapped on every hospital's grounds: buildings, entrances, car parks, facilities, footpaths. Countries with more than a thousand hospitals are fetched by state or Land. Each area that comes in whole is kept for a week (`data/world/campus-raw/areas/`, cached between runs by Actions), so a run that stops at its time margin (`stop_grounds_at`: 290 minutes after the job started, 40 under its 330-minute limit, whatever the earlier stages took) carries on where the last one left off; a country with areas still to fetch is held back from publishing until a run completes it. Every query first asks the server, in the same request, whether it knows Luxembourg's country area: a server without area data is refused and the next one asked — it would otherwise answer with nothing and no error — and an area fetched before that check is fetched again |
| 3 | `build.mjs` | `public/world/<CC>.json`, `public/world/venues/<id>.json` and `public/floorplans/osm/<id>/*.svg` for the hospitals with indoor maps or site maps (not committed), `data/world/indoor-report.json`, `data/world/campus-report.json` |
| 4 | `publish.mjs` | the same, written into the shared Postgres (`db/migrations/0005_world.sql`), country by country in one transaction each; `/api/world/*` serves it; a map the run did not rebuild stays as long as its hospital is still listed, and a country whose grounds are incomplete is held back whole — a complete answer late is preferred to a partial one on time |

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
