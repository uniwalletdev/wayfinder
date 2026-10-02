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
| 3 | `build.mjs` | `public/world/<CC>.json` (what the app reads), `public/world/venues/<id>.json` and `public/floorplans/osm/<id>/*.svg` for the hospitals with indoor maps, `data/world/indoor-report.json` |

A push that touches `scripts/world/` runs a sample of countries and commits the
results back to the branch. The monthly schedule, or *Run workflow* with
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

Ids are `osm-<cc>-<w|n|r><osm id>`, so an id alone says which country file
lists it and a saved venue survives a data refresh.

## Licence

OpenStreetMap data is © OpenStreetMap contributors, ODbL 1.0. Every venue
carries `dataSource`, every plan carries the credit, and the map's attribution
control names OpenStreetMap.
