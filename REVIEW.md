# Wayfinder — Full Project Review & Recommendations

*Reviewed at commit `09abfa8` (July 2026). Scope: all app source, API routes, Supabase schema/RLS, configs, and deploy files.*

## What this project is

A mobile-first Next.js 16 App Router PWA for indoor + outdoor navigation. Users can
**navigate** a mapped venue (Leaflet map, floor plans, turn-by-turn, compass +
pedestrian dead-reckoning, QR re-fix, compass-overlay AR and WebXR SLAM AR) or
**map** a venue themselves (walk-survey with Claude vision reading signage,
floor-plan upload with AI room/corridor extraction, GeoJSON import). Backend is
optional: localStorage-only by default, Supabase (auth + RLS-enforced
public/unlisted/private venues) when configured. Mapbox proxies handle outdoor
routing and geocoding.

## Overall assessment

This is an unusually well-crafted prototype. The architecture is clean
(`lib/` pure logic vs `components/`, venue-as-data instead of hard-coded
constants), comments explain *why* rather than *what*, failure modes degrade
softly (no API key → feature quietly off, not an error), and the security model
is correctly placed in the database (RLS + a trigger preventing self-verification)
rather than the UI. The Anthropic integration uses a current model and structured
output correctly.

The gaps are the ones typical of a fast-moving prototype heading toward real
users: **no tests, no CI, a failing lint run, unauthenticated cost-bearing API
endpoints, a stored-XSS vector, and storage choices (base64 images in
localStorage/jsonb) that will fall over at small scale.** All are fixable without
architectural change.

Verified health:

| Check | Result |
| --- | --- |
| `npm run build` (Next 16.2.6 / Turbopack, incl. TS) | ✅ passes clean |
| `npm run lint` | ❌ **10 errors**, 2 warnings |
| Tests | ⚠️ none exist |
| CI | ⚠️ none (`.github/` absent) |

---

## High priority

### 1. Stored XSS through waypoint names in Leaflet HTML
`FloorPlanMap.tsx` interpolates user-controlled strings into raw HTML:

- `bindPopup(`<b>${w.name}</b>…${w.description}`)` — `FloorPlanMap.tsx:165`
- schematic room labels in a `divIcon` — `FloorPlanMap.tsx:206`

Waypoint names come from other users (shared/public cloud venues), from AI
output, and from imported GeoJSON files. A venue named
`<img src=x onerror="...">` executes script in every visitor's browser once
cloud sync is on — RLS doesn't help because reading public venues is the
intended behaviour. **Fix:** HTML-escape all interpolated strings (or build
popup content with DOM APIs / `L.DomUtil`). Audit every template-literal `html:`
in the codebase (`ArNavView` and `UploadPlanMode` handles are static — fine).

### 2. Unauthenticated, unmetered cost-bearing API routes
`/api/survey` and `/api/parse-plan` call **Claude Opus** with caller-supplied
images; `/api/directions` and `/api/geocode` proxy Mapbox. None require auth,
rate limits, or body-size caps. Anyone who finds the URL can drain the
Anthropic/Mapbox budget with a shell loop. **Fix (in order of value):**
- Cap request body size and reject >N frames *before* JSON parsing work.
- Per-IP rate limiting (middleware or an upstream layer; Vercel/Railway both
  have options).
- When Supabase is configured, require a valid session via
  `getSupabaseServerClient()` — it already exists (`supabase/server.ts`) and is
  currently dead code; this was even listed as a "next step" in
  `SUPABASE_SETUP.md`.

### 3. Base64 floor-plan images in localStorage and `venues.floor_plans` jsonb
An uploaded plan is stored as a full JPEG data URL (~0.5–1 MB at 1400px):
- **localStorage** has a ~5 MB quota and `venue-store.ts` swallows quota errors
  silently (`writeJSON` catch) — after 3–5 uploads, saves silently stop and the
  user loses work with no message.
- **Postgres jsonb** rows carrying megabytes of base64, combined with
  `fetchAccessibleVenues()` doing `select *` over *every* public venue, means
  the first app load downloads every image of every public venue.

**Fix:** store images in a Supabase Storage bucket, keep only URLs in
`floor_plans`; locally, use IndexedDB (or at minimum surface quota failures to
the user instead of swallowing them).

### 4. Survey trails never reach the cloud — schema gap
The corridor graph (`SurveyTrail`) is what makes indoor routing follow hallways
and generates the schematic, but there is **no trails table/column** in
`0001_init.sql`, and `handleSurveyComplete` always saves trails to
localStorage only. A cloud venue opened on a second device has waypoints but no
corridors: routes cut straight through walls and floors render blank. **Fix:**
add a `trails` table (or jsonb column) with the same RLS inheritance as
waypoints, and sync it wherever waypoints sync.

---

## Medium priority

5. **Sign-in swaps out local venues instead of merging.** On sign-in,
   `setUserVenues(remote)` replaces device-local venues (they reappear on
   sign-out — confusing "where did my place go?"). Worse, `handleDeleteVenue`
   sends *any* non-seed id to `deleteRemoteVenue` while signed in, so deleting a
   device-local venue (id `venue-...`, not a UUID) fails with a server error.
   Offer a one-time "upload your local places?" migration and route deletes by
   where the venue actually lives.

6. **`npm run lint` fails (10 errors).** Mostly the React-Compiler-era rules:
   `react-hooks/refs` (writing refs during render in `FloorPlanMap`,
   `use-pedestrian-position`, `SurveyMode`), `react-hooks/set-state-in-effect`
   (`WayfinderApp` hydration effect and others), `react/no-unescaped-entities`
   (`SearchModal:185`), an unused prop (`BottomSheet:196`). Either fix them
   (move ref mirrors into effects, use lazy init/`useSyncExternalStore` for the
   hydration read) or explicitly disable rules you disagree with — a failing
   lint script is worthless as a gate.

7. **No tests, no CI.** `lib/` is almost entirely pure functions begging for
   unit tests: `routing.ts` (graph stitch/Dijkstra/detour limits), `search.ts`
   (ranking bands), `schematic.ts` (ribbon/side placement), `plan-import.ts`
   (GeoJSON parsing), `geo-local.ts`. Add Vitest + a GitHub Actions workflow
   running `lint`, `build`, and tests on PRs — the repo already works by
   PR-merge flow, with nothing guarding it.

8. **QR payload isn't validated** (`WayfinderApp.tsx:343`). `parseInt`/
   `parseFloat` results go straight into state/anchor: a malformed QR yields
   `NaN` floor and `NaN` coordinates that poison the position pipeline (the
   try/catch won't catch NaN). Validate with `Number.isFinite` before applying.

9. **Routing GOSH-isms and gaps** (`routing.ts:246-314`): cross-floor prefers a
   lift whose *name* contains `"Lift A"`; the nearest lift on the current floor
   isn't matched to the same lift on the destination floor (you can enter Lift B
   and "exit" from Lift A across the building); no stairs fallback when a floor
   has no lift. Model lift banks (shared id/name across floors) and fall back to
   `stairs`.

10. **O(n²) trail stitching on the main thread.** `buildTrailGraph` pairwise-
    compares up to 4000 nodes (~8M haversine calls) and runs on every route
    build *and* every off-route rebuild while walking. Use a spatial hash for
    stitching (drops to ~O(n)) and/or memoise the graph per venue+trails.

11. **pdf.js worker loaded from unpkg at runtime** (`plan-import.ts:86`) — a
    supply-chain and availability dependency. Bundle it:
    `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`.

12. **Unbounded venue fetch.** `fetchAccessibleVenues` pulls all venues + all
    waypoints for all of them on startup. Fine today; won't be once "public"
    means dozens of venues (see also #3). Fetch venue summaries, then load
    waypoints/plans for the *active* venue only.

13. **DB rows cast, not validated.** `row.type as Waypoint["type"]` /
    `row.category as Venue["category"]`, and no CHECK constraints on
    `waypoints.type` or `venues.category`. An unexpected value renders
    `undefined` icons in injected HTML. Add CHECK constraints and normalize to
    `"other"` on read.

14. **Dead-reckoning accuracy never degrades.** Each step adds ~0.72 m of
    positional uncertainty, but `positionAccuracy` stays frozen at the anchor's
    accuracy, so the UI shows "±3 m" after 200 steps of compass-walking and the
    off-route trigger under-widens. Inflate accuracy per step since last anchor.

---

## Lower priority / polish

15. **Pinch-zoom is disabled** (`layout.tsx`: `userScalable: false,
    maximumScale: 1`) — a WCAG 1.4.4 failure, especially pointed for an app
    with an accessibility mission and hospital users. Prefer
    `touch-action`/gesture handling on the map instead of disabling zoom
    globally.
16. **`alert()` for survey/upload/venue results** — blocking, ugly on mobile,
    and swallows the map behind it. Replace with a toast/snackbar.
17. **README is the stock create-next-app template.** The project deserves a
    real one (what it is, screenshots, env setup, deploy targets);
    `SUPABASE_SETUP.md` is already good — link it.
18. **`.env.example` overstates local-mode privacy** ("never makes network
    calls") — map tiles come from cartocdn and the PDF worker from unpkg.
    Correct the claim (and #11 helps make it true-er).
19. **`addRemoteFloorPlan` read-modify-write race** — already flagged in its
    comment; a one-line Postgres RPC doing the jsonb append closes it.
20. **Dead/duplicated code:** `getSupabaseServerClient` unused (use it for #2),
    `slugify` duplicated in `venues/index.ts` and `venues-remote.ts`,
    `ANNOTATION_TYPES` duplicates `ALL_WAYPOINT_TYPES`, stock create-next-app
    SVGs still in `public/`.
21. **Editors can't persist floor plans** (only the venue owner passes
    `venues_update` RLS) — acknowledged in code; either a `floor_plans` child
    table with `can_write_venue` policies, or accept and document it.

---

## Suggested order of attack

1. **Safety/cost first (small diffs):** XSS escaping (#1), body caps + rate
   limiting on API routes (#2), QR validation (#8).
2. **Foundation:** fix lint, add Vitest for `lib/`, add GitHub Actions (#6, #7).
3. **Data model:** trails in Supabase (#4), floor plans to Storage (#3),
   CHECK constraints (#13), local↔cloud merge (#5).
4. **Quality of navigation:** lift banks + stairs fallback (#9), spatial-hash
   stitching (#10), accuracy drift (#14).
5. **Polish:** pinch zoom, toasts, README, dead code (#15–#21).
