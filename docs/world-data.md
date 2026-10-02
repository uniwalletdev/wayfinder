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
| 2b | `fetch-campus.mjs` | `data/world/campus-raw/<CC>.json` (not committed) — what is mapped on every hospital's grounds: buildings, entrances, car parks, facilities, footpaths. Countries with more than a thousand hospitals are fetched by state or Land |
| 3 | `build.mjs` | `public/world/<CC>.json` (what the app reads), `public/world/venues/<id>.json` and `public/floorplans/osm/<id>/*.svg` for the hospitals with indoor maps or site maps, `data/world/indoor-report.json`, `data/world/campus-report.json` |

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

## Where the apps get it

The per-country lists, venues and plans add up to tens of megabytes across the
world, so the Android and iOS apps do not carry them: `scripts/app-shell-build.mjs`
leaves `/world` and `/floorplans/osm` out of the bundle and
`src/lib/app-shell.ts`'s `worldUrl()` points the apps at the website for them
(`next.config.ts` lets any origin read those paths). The website serves its
own copy. The UK's NHS directory stays in the bundle.

## Licence

OpenStreetMap data is © OpenStreetMap contributors, ODbL 1.0. Every venue
carries `dataSource`, every plan carries the credit, and the map's attribution
control names OpenStreetMap.
