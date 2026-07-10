---
name: verify
description: Build, run and drive the Wayfinder app to verify changes end-to-end.
---

# Verifying Wayfinder changes

## Build & run

```bash
npm install
npm run build
PORT=3111 npm start   # production server; run in background
```

## Drive it (headless Playwright)

- The app UI lives at **`/navigate`** (and `/map` for mapping tools) — `/` is a
  static marketing landing page.
- Install Playwright in a scratch dir (`npm i playwright`) and launch with the
  pre-installed browser: `chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })`.
  The sandbox blocks the pinned headless-shell download.
- Use `waitUntil: "domcontentloaded"`, not `networkidle` — map tile fetches to
  external hosts fail in the sandbox (harmless console errors) and never go idle.
- The venue picker opens from the venue-switcher button in the left panel; match
  it with `getByRole("button").filter({ hasText: /Public|Private|Unlisted/ })`.
  Venue rows are `div.w-full.flex.items-center.gap-3.px-4.py-3` ("Map a new
  place" uses `py-4`, so this selects rows only).
- Per-venue mapped data lives in localStorage: `wayfinder.venue.<id>.waypoints`
  / `.floorPlans`. To simulate a mapped venue, seed those keys — waypoints must
  match the real `Waypoint` shape (`coordinates: {lat,lng}`, valid `type`), or
  selecting the venue crashes the page.
- NHS directory venue ids are `nhs-<slugified name>` (e.g. `nhs-addenbrooke-s`).

## Gotchas

- GPS is denied headlessly; the app handles it (falls back to map centre).
- Lint has pre-existing errors in FloorPlanMap/Map3DView/ShareDialog/
  WayfinderApp/use-pedestrian-position — not a regression signal on its own.
