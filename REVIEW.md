# Wayfinder — app review: content, function and design

*Reviewed at commit `f20ae94` (September 2026), on the `main` branch as
shipped. Scope: every screen, every API route, the routing and positioning
code, the PWA and native shells, the landing page and the written content.
The findings were implemented in three passes on the same branch; the "Status"
column says which, and the last section lists what is still open.*

The July 2026 review that this file replaced is summarised at the end: of its
21 findings, 15 had been fixed on `main` before this review began.

## What this is

A Next.js 16 App Router PWA for indoor navigation in NHS hospitals. A visitor
searches for a ward, clinic or department and follows a route from the front
door, floor by floor, with a step-free option, live re-routing, QR
re-positioning and an AR view. 67 hospitals ship with interior maps built from
trusts' own published site maps; every other NHS hospital is a located pin.
Trusts can map their own site by walking it with the camera (signs are read
by a vision model) or by uploading a plan. Everything runs with zero backend
configuration; Postgres, Anthropic, Mapbox and Clerk each switch on one
feature when configured. Android and iOS are Capacitor shells around the
deployed site.

## Health at the start of the review

| Check | Result |
| --- | --- |
| `npm run lint` | ✅ clean |
| `npm run typecheck` | ✅ clean |
| `npm run nhs:test` (15 suites) | ✅ 672 passing |
| `npm run build` (Next 16.2.6 / Turbopack) | ✅ clean |
| CI | ✅ runs all of the above on every PR |

This is a well-built codebase: pure logic in `src/lib` with tests that run
against the shipped modules, comments that explain decisions rather than
syntax, failure modes that degrade quietly, and a security posture (rate
limits, body caps, escaped HTML, frame protection) that is already ahead of
most prototypes. The findings below are about finishing the product, not
rescuing it.

---

## Findings

### Content

| # | Finding | Status |
| --- | --- | --- |
| C1 | **The share link was fake.** "Share this destination" copied `wayfinder.app/gosh/pharmacy`, a domain the app does not own and a path it never handled. The poster's QR code held a bare `floor:…:lat:…:lng:…` string under a caption telling people to point their phone's camera at it; a camera app gets a text string and does nothing. | ✅ Fixed. Links and QR codes are real URLs on this deployment (`/navigate?venue=&to=&floor=&lat=&lng=&stepfree=1`). A phone camera opens the app at the destination, placed at the poster's entrance; the in-app scanner reads the same URL and still accepts the old format. The address bar keeps `venue` and `to` current, so any screen is shareable by copying it. `src/lib/share-link.ts`, 23 tests. |
| C2 | **The route preview claimed "±4 m accuracy"** whatever the positioning was doing — a number typed into the design, shown to people deciding whether to trust the dot. | ✅ Fixed. The tile shows the real reported accuracy, "virtual" for the demo fix, or "no fix". |
| C3 | **The default venue was called "GOSH Wayfinder"** in the venue switcher, the places list, the poster header and the "you're 3 km from GOSH Wayfinder" card. It is a hospital, not an app. | ✅ Renamed to "Great Ormond Street Hospital", subtitle in the same "Trust · Address" form the other venues use. The pipeline's alias list already covers the ODS name, so directory reconciliation is unaffected. |
| C4 | **Landing page links went nowhere.** Product / Hospitals / For trusts / Help were `<span>`s, the footer's Privacy / Accessibility / Status were too, and the hero card's "Start guidance" was a `<button>` with no handler. On a landing page this reads as unfinished. | ✅ Fixed. Nav links go to the sections and pages they name; the footer links to new `/accessibility` and `/privacy` pages; "Status" (which had no page) is gone. |
| C5 | **The hero card's "6 min · 410 m · 2 floors up" was invented.** | ✅ The card is now a real route from the router: main entrance to Kangaroo Ward at GOSH, computed at build time, linking straight into the app with that destination chosen. If the data moves, the card disappears rather than going stale. |
| C6 | **No accessibility statement and no privacy summary**, for a healthcare app that asks for camera, location and motion permissions. | ✅ Both pages written from the code they describe, in the site's own design, and clearly framed as technical summaries — the deploying organisation remains the data controller and publishes its own notice. |
| C7 | **The coverage claim was a static number.** "67 mapped hospital venues" appeared in prose; the app ships 67 mapped and 2,278 located. | ✅ The landing strip now computes both counts from the shipped data. |
| C8 | **Blocking `alert()` dialogs** announced survey results, uploads, venue creation and delete failures: a system sheet over the map, with the multi-sentence messages unreadable on a phone. | ✅ Replaced with an in-app toast system (`Toast.tsx`): non-blocking, styled, auto-dismissing, announced to assistive tech. |
| C9 | **"All locations" in search was 285 rows in array order.** A visitor who cannot spell the ward had no way to browse. | ✅ Grouped by floor with sticky headings, alphabetical within each. |
| C10 | **Search returned noise for fuzzy queries**: "pharm" listed "Ramp to Southwood" and "Lullaby Factory Cycle Parking" because the letters appeared in order somewhere in a long description. | ✅ Subsequence matching is now for names only. `search.test.mjs` added (the ranking had no tests). |
| C11 | Camera screens said "QR Code detected! Locating you..." and "Point camera at a QR code on the wall"; a visitor does not know what a Wayfinder poster looks like. | ✅ Copy now says what to look for. |
| C12 | `.env.example` said the device-only mode "never makes network calls"; it fetches map tiles from a CDN. | ✅ Corrected. |
| C13 | **Searching for a hospital you are not in gave "no results."** Search is scoped to the open venue, so someone at the wrong hospital, or planning from home, typed "Addenbrooke" and got nothing. | ✅ Search now also matches other hospitals by name and offers to switch to them ("Other hospitals"), mapped ones first. |
| C14 | Descriptions repeated the floor already shown beside them: "Level 2 (ground floor) · Variety Club Building, Level 2". | ✅ `waypointDetail` drops a trailing ", Level N" that only repeats the label; anything carrying more ("Levels 0-1", "(4 lifts)") stays. |
| C15 | Survey Mode, plan upload and the camera guide used generic floor names ("Floor 3") at venues with their own numbering ("Level 5"). | ✅ All three take the venue's floor naming. |
| C16 | The places list's "Mapped hospitals" heading covered a residential building (the CAD-import demonstration venue). | ✅ Heading reads "Mapped places" when a non-hospital is among them. |
| C17 | "Bishop Auckland Cdc" — an acronym title-cased by the pipeline. | ✅ Renamed to CDC; "CDC" added to the pipeline's kept-acronym list so it stays that way. |
| C18 | A "?" circle in the panel that did nothing when sign-in was not configured; a sign-in tooltip promising things sign-in does not yet do. | ✅ Without sign-in it is a Help button (the accessibility and how-to page); with it, the tooltip says what sign-in now does (F18). |
| C19 | **A directory hospital had nothing to route to.** 2,278 of the venues are located pins; opening one showed an outline and a search that found nothing. | ✅ Every such hospital offers "Directions to the hospital": a destination at the site's address, honestly described as the address rather than a door, routed along real streets where Mapbox is configured. |
| C20 | **A ward at a hospital that is not open could not be found.** | ✅ `/api/search` ranks every seed venue's waypoints on the server (the data the client deliberately no longer downloads) and the search offers hits "At other hospitals"; choosing one opens that hospital and routes to the ward. `cross-venue-search.test.mjs`. |

### Function

| # | Finding | Status |
| --- | --- | --- |
| F1 | **A malformed QR payload put `NaN` into the position.** `parseInt`/`parseFloat` results went straight into state; the `try/catch` around them cannot catch `NaN`. | ✅ The link parser validates every number (`Number.isFinite`, integer floor, lat/lng range) and drops an anchor that fails; a non-Wayfinder code says so in a toast. Tested. |
| F2 | **Corridor routing was O(n²) on the main thread**: every pair of the up-to-4,000 breadcrumbs was compared to stitch junctions (8 M haversines), and Dijkstra scanned every node per round — on every route build, every off-route rebuild while walking, and twice per position tick for the fastest/step-free comparison. | ✅ Grid-hash stitching (each node looks at nine cells), heap Dijkstra, and per-floor graphs cached against the trails array's identity so a walk never rebuilds the network. 10 full builds over 4,000 breadcrumbs: ~100 ms total; 200 route builds on a cached 3,000-node graph: ~260 ms. `trail-graph.test.mjs` checks 240 random journeys give the same distance as a brute-force reference. The route-options comparison is also switched off while navigating, where it was never shown. |
| F3 | **Dead-reckoning accuracy never degraded.** Each step adds uncertainty, but the reported accuracy stayed at the anchor's ±1 m after two hundred steps, so the UI over-claimed and the off-route trigger (widened by accuracy) under-widened. | ✅ Each step adds 0.25 m, capped at 40 m, cleared by a fresh fix. Demo fixes are exempt so "demo mode" still reads as such. |
| F4 | **No deep links.** `/navigate` always opened the last venue; a trust could not link to "Ward 5", a search result could not land inside a hospital. | ✅ `?venue=&to=` (plus the poster fields) on mount, including venues that only arrive with the server's list; the URL mirrors the venue and destination via `replaceState` as you go. The sitemap lists a deep link per mapped hospital. |
| F5 | **Guidance was silent.** A navigation app used with the phone lowered gave nothing to hear or feel, and a screen-reader user got no announcement when the step changed. | ✅ `use-guidance-announcer.ts`: every step change is written to a polite live region; *Spoken directions* (Web Speech API, remembered on the device) reads it aloud; a short vibration marks each turn and a longer one arrival, where supported. |
| F6 | **The step icon was guessed from the instruction text** ("Head north-east" contains "north", so it showed a plain up arrow). | ✅ With a compass fix the arrow rotates to point the way relative to the phone's heading; without one it uses the eight compass points properly; floor changes show up or down. |
| F7 | **Opening floor was a storey below the entrance.** GOSH opened on Level 1 because the "lowest planned floor" rule chose its basement plan, so the demo position started underground and every preview began with a lift ride. | ✅ The ground floor opens when it has a plan; otherwise the lowest planned floor (Princess Anne's case). Mirror test updated. |
| F8 | **No offline page.** The service worker fell back to whatever was cached, then to a browser error — the one page a person in a basement with no signal would see was the browser's. | ✅ `public/offline.html` is precached on install and is the last resort for navigations; SW cache version bumped. |
| F9 | **No error boundaries or 404 page.** A crash under the map showed Next's default screen. | ✅ `error.tsx`, `global-error.tsx`, `not-found.tsx` in the app's design, each with a way back to the map. |
| F10 | **The map chunk loaded into a blank grey area** on first visit (Leaflet is ~64 KB gzipped, three.js more). | ✅ A quiet "Loading the map…" placeholder via `next/dynamic`'s `loading`. |
| F11 | The pdf.js worker for plan uploads was fetched from unpkg.com at runtime — a CDN and a supply-chain dependency, and a silent failure on hospital Wi-Fi that blocks it. | ✅ Bundled by the build (`new URL(..., import.meta.url)`), verified in the output. |
| F12 | `DELETE /api/venues/[id]` was the one write route with no rate limit and an unbounded `request.json()`. | ✅ Same limiter and body cap as the other writes. |
| F13 | PWA manifest: `start_url` was the marketing page, no `id`, no shortcuts. Metadata had no `metadataBase`, Open Graph or Twitter card, so a shared ward link unfurled as a bare URL. No robots or sitemap. | ✅ Manifest starts in the app with "Find a ward" and "Map a place" shortcuts; Open Graph/Twitter metadata; `robots.ts`, `sitemap.ts`; `NEXT_PUBLIC_SITE_URL` documented; `X-Powered-By` removed. |
| F14 | Dead code: `LeafletFix.tsx` (unused, and it pulled marker images from cdnjs), five stock create-next-app SVGs, a duplicated `slugify`, a hand-copied `ANNOTATION_TYPES` list. | ✅ Removed or deduplicated. |
| F15 | **Every hospital shipped to every visitor.** The map imported the venue registry, and with it all 67 mapped hospitals' floor plans, waypoints and corridors plus the 2,278-row directory: 13,354 coordinate literals, about 60% of the largest client chunk. | ✅ The client now imports a generated catalog of venue summaries (`venues/catalog-data.ts`, a few KB) and the default venue; a hospital's module is fetched the first time it is opened, the directory the first time the places list or search needs it. `venue-catalog.test.mjs` fails CI if the catalog drifts from the modules; `npm run nhs:catalog` regenerates it and the ingest pipeline runs it. |
| F16 | No Content-Security-Policy beyond frame protection. | ✅ A full policy ships in **report-only** mode with `/api/csp-report` logging what browsers would have blocked, so it can be tightened against a real deployment and then enforced. `next.config.ts` says what to add first (a deployment's own Clerk domain). |
| F17 | **Location traces were kept for ever, at full precision, to the door, with no way to delete them** (`docs/location-data-and-gdpr.md`, gaps 2, 3 and 6). | ✅ The analysis's options A, B, C and F: the last 25 m of every trail is cut before storage and positions rounded to ~1 m, rows expire after 30 days (search misses after 90) via a sweep the ingest routes run hourly, `DELETE /api/signals` erases a device's rows and the privacy page has the button, and both ingest routes are rate-limited. The consent gate (option D) remains a decision for the deploying trust, as the analysis says. |
| F18 | **Sign-in did nothing.** Venues were owned only by a per-device token; clear the browser and the venue was orphaned. | ✅ A venue created while signed in is owned by the account; on sign-in, venues this device created are claimed for the account (`POST /api/venues/<id>/claim`); either the token or the account authorises writes, and the owner sees their own unlisted venues on every device. Schema: `owner_id` (migration 0004, applied automatically). **Not exercised against a live Postgres or Clerk in this environment** — typechecked and reasoned through; test on a staging deployment before relying on it. |

### Design and accessibility

| # | Finding | Status |
| --- | --- | --- |
| D1 | **Half the app was still on the pre-redesign look.** The panel, map controls, floor rail and share sheet followed the design handoff (Space Grotesk, IBM Plex Sans, the `wf-*` tokens). Search, the places list, plan upload, Survey Mode and the camera views still had the old NHS-blue header bar and generic grey Tailwind. Tapping Search from the polished panel opened a different product. | ✅ Every overlay now uses one shared `Overlay` frame (white header, ink title, surface close button) and the design tokens. No `#005EB8` or `gray-*` remains outside the map canvas. |
| D2 | **Map markers were still NHS blue and red** while the landing page and panel used route-blue and teal for the same meanings. | ✅ Position dot and route are route-blue, destination and selected pin are teal, in 2D and 3D alike. |
| D3 | **Overlays were not dialogs.** No `role="dialog"`, no `aria-modal`, no focus trap, no focus restore: a keyboard or screen-reader user opening search was dropped at the top of the document on closing it and could tab into the map behind it. | ✅ `use-dialog.ts`: role, modal, labelled heading, Tab cycling, focus moved in on open and returned on close, Escape. Applied to every overlay and the share sheet. |
| D4 | **No visible keyboard focus anywhere.** Tailwind v4 ships no default ring and none was added. | ✅ A global `:focus-visible` ring in the brand colour. |
| D5 | **Search had no keyboard operation** beyond typing; "/" opens it on desktop, then the mouse was needed. | ✅ Combobox semantics: Up/Down/Home/End move, Enter selects, the active row scrolls into view and is announced. |
| D6 | Icon-only buttons without names (clear search, close camera, close survey, delete place); decorative emoji read aloud; no `<h1>` on the app screen. | ✅ Labelled, hidden, added. |
| D7 | The bottom sheet's collapsed state showed the destination header and Start with nothing to tell a phone user the route options existed. | Kept: the grab handle and the collapse-on-select behaviour are a deliberate choice; the route card now reads better with the honest accuracy tile. |
| D8 | The AR view's floor chevrons and beacon kept the old NHS blue and green. | ✅ Route-blue and teal, matching the maps. |
| D9 | The 3D view's labels were grey Arial pills with a red highlight. | ✅ The same pill as the 2D markers: white with a route-blue edge, teal for the destination, the app's typeface. |

### Performance

| Measure | Before | After pass 1 | After pass 2 |
| --- | --- | --- | --- |
| `/navigate` client JS, all chunks, gzipped | ≈ 497 KB (top six chunks) | ≈ 567 KB | **≈ 361 KB** |
| Largest chunk, gzipped | 308 KB (all venue data + app) | 313 KB | **96 KB** (app + the default venue) |
| Opening another hospital | already downloaded | already downloaded | two chunks, a few KB to ~30 KB |
| 4,000-breadcrumb corridor network, 10 route builds | seconds (O(n²)) | ~100 ms | ~100 ms |
| 200 route rebuilds on a cached graph | rebuilt each time | ~260 ms | ~260 ms |
| Landing page client JS, gzipped | — | ≈ 245 KB | ≈ 245 KB |

The first pass added code to the route (share links, QR, toasts, the
announcer); the second removed the venue data that dwarfed it.

### Security

Already in good shape: HTML escaping on every interpolated string, per-route
rate limits and body caps, frame-ancestors/X-Frame-Options, a strict
Permissions-Policy, owner tokens on venue writes, no secrets on the client.
This review added the DELETE route's cap and limiter, removed the runtime CDN
dependency for pdf.js, removed `X-Powered-By`, and shipped a full
Content-Security-Policy in report-only mode with a logging endpoint (F16).
One thing it did not change, deliberately: the in-memory rate limiter resets
per instance; the file says so and points at provider spend caps as the real
backstop. Still true.

---

## Still open

The hospital map data itself was reviewed venue by venue on 25 September 2026
— identity, position and every label of all 67 venues — in
[docs/venue-review-2026-09.md](docs/venue-review-2026-09.md): four venues sat
at the wrong hospital and ten under the wrong trust or a department's name, all
corrected; label problems 89 → 42. What that pass could not do is listed there.

Ordered by value. None blocks a deployment.

1. **Enforce the CSP.** It is report-only (F16). Run a deployment through
   sign-in, the map, plan upload and the camera tools, read the log from
   `/api/csp-report`, add the deployment's own Clerk domain, then move the
   value to the enforced header.
2. **Exercise account ownership on a staging deployment** (F18): create a
   venue signed in, claim one created anonymously, edit from a second device,
   delete. It could not be run against Postgres or Clerk here.
3. **Consent for location traces** (`docs/location-data-and-gdpr.md`, option
   D). The traces are now bounded, blurred, deletable and rate-limited; whether
   they should be opt-in is the deploying trust's call, and a DPIA is a
   precondition of any NHS deployment.
4. **Entrances for directory hospitals.** "Directions to the hospital" goes
   to the site's address. OpenStreetMap footprints carry entrance nodes for
   many sites; the pipeline's footprint file is not checked in and was not
   available here.
5. **Let the map pipeline reach the internet.** The environment's network
   policy refused the ODS register, postcodes.io, OpenStreetMap and every
   trust website, so no records or republished maps could be fetched and the
   relocated sheets could not be rebuilt from their PDFs. Allow those hosts
   in the cloud environment's Network access settings and run
   `npm run nhs:refresh`, `nhs:discover`, `nhs:plans` and
   `node scripts/maps/build-venues.mjs`.

## The July 2026 review

Of the 21 findings in the previous review of commit `09abfa8`: XSS escaping,
API rate limits and body caps, tests and CI, lint, pinch-zoom, the README,
the routing "GOSH-isms", dead-reckoning's lift matching, the Supabase→Postgres
move and the stock template files had all been fixed on `main` before this
review. This pass closed the remainder: `alert()` dialogs (#16), QR payload
validation (#8), trail-stitching cost (#10), accuracy drift (#14), the pdf.js
CDN worker (#11), the `.env.example` privacy claim (#18), and the duplicated
constants (#20).
