# Wayfinder

Indoor navigation for NHS hospitals. Search for a ward, clinic or department
and follow the route from the front door, floor by floor, with step-free
options, live re-routing, QR re-positioning and an AR view.

- **Web / PWA:** Next.js 16 App Router, Leaflet (2D) and three.js (3D).
- **Android and iOS:** Capacitor shells around the deployed site. See
  [`docs/mobile.md`](docs/mobile.md).
- **Maps:** 67 mapped hospital venues built from trusts' published site maps,
  plus every NHS hospital from the ODS register as a located directory entry.
  See [`data/README.md`](data/README.md) for the pipeline and
  [`docs/mapping-review.md`](docs/mapping-review.md) for how good they are.

## Run it

```bash
npm ci
npm run dev          # http://localhost:3000
```

Every environment variable is optional. With none set the app runs
device-only. `.env.example` lists what each one turns on: Postgres for shared
venues and signals, Anthropic for sign-reading in Survey Mode, Mapbox for
outdoor routing, and Clerk for optional accounts.

## Checks

```bash
npm run lint
npm run typecheck
npm run nhs:test     # pipeline, placement, routing and floor-naming tests
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

## Deploy

Railway (`railway.json`) or Vercel (`vercel.json`), both running
`npm run build && npm run start`.
