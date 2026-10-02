# Findway

Indoor navigation for NHS hospitals. Search for a ward, clinic or department
and follow the route from the front door, floor by floor, with step-free
options, live re-routing, QR re-positioning and an AR view.

- **Web / PWA:** Next.js 16 App Router, Leaflet (2D) and three.js (3D).
  Works offline for any hospital opened once while online, with an offline
  page for everything else.
- **Android and iOS:** Capacitor apps that carry the pages and floor plans
  inside them and call this site's `/api`. Built in CI; see
  [`docs/mobile.md`](docs/mobile.md).
- **Maps:** 67 mapped hospital venues built from trusts' published site maps,
  plus every NHS hospital from the ODS register as a located directory entry.
  See [`data/README.md`](data/README.md) for the pipeline and
  [`docs/mapping-review.md`](docs/mapping-review.md) for how good they are.
  Outside the UK the app shows the hospitals of the country the visitor is
  in, from OpenStreetMap, with indoor maps where OSM has them; see
  [`docs/world-data.md`](docs/world-data.md).
- **Links and posters:** `/navigate?venue=<id>&to=<waypointId>` opens a
  hospital with a destination chosen; add `&stepfree=1` to ask for the
  step-free route, and `&floor=&lat=&lng=` (what a printed poster's QR code
  carries) to place the reader where the poster is. The address bar keeps
  `venue` and `to` up to date, so any screen is shareable by copying the URL.
  See `src/lib/share-link.ts`.
- **Guidance you can hear:** while navigating, *Spoken directions* reads each
  step aloud; every step is also announced to screen readers and marked with a
  short vibration where the device supports it.
- **Pages:** `/` (landing), `/navigate` (the map), `/map` (mapping tools),
  `/accessibility`, `/privacy`.

## Run it

```bash
npm ci
npm run dev          # http://localhost:3000
```

Every environment variable is optional. With none set the app runs
device-only. `.env.example` lists what each one turns on: Postgres for shared
venues and signals, Anthropic for sign-reading in Survey Mode, Mapbox for
outdoor routing, Clerk for optional accounts, and `NEXT_PUBLIC_SITE_URL` for
absolute URLs in link previews and the sitemap.

## Checks

```bash
npm run lint
npm run typecheck
npm run nhs:test     # pipeline, placement, routing, links and floor-naming tests
npm run maps:audit   # grades every shipped venue; --full for every finding
npm run build
```

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.

## Map quality

Maps come from PDFs that trusts publish, and not every PDF titled "site map"
is a map. A page judged by eye not to be one (a directory table, a travel
leaflet, a duplicate) goes in [`data/not-maps.json`](data/not-maps.json) with
the reason, and the pipeline refuses it from then on. A venue whose plan is a
stand-in rather than the real building is marked `illustrative`, and the app
says so.

## Review

[`REVIEW.md`](REVIEW.md) is the current review of the app — content, function
and design — with what has been done about each finding and what is still open.

## Deploy

Railway (`railway.json`) or Vercel (`vercel.json`), both running
`npm run build && npm run start`.
