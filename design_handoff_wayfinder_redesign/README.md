# Handoff: Wayfinder UI Redesign (desktop web)

## Overview
A visual + UX redesign of the **Wayfinder** indoor-navigation app (`uniwalletdev/wayfinder`, Next.js + Tailwind + lucide-react). It replaces the current NHS-blue mobile UI with a world-class mapping-product look (TomTom/Mapbox inspired) targeting **desktop web**, and adds three new features: shareable destination QR posters, accessibility-first (step-free) routing, and arrival-context destination cards.

## About the Design Files
The files in this bundle are **design references created in HTML** (`.dc.html` prototypes). They show intended look and behavior — they are **not production code to copy directly**. Recreate these designs inside the existing codebase: **Next.js App Router, Tailwind CSS v4, lucide-react icons, Leaflet (2D) / three.js (3D) maps**. Use Tailwind utilities and the existing component structure (`src/components/*`), not the inline styles from the prototypes. The stylized SVG street maps in the mocks are placeholders for the real Leaflet/three.js map layers.

Open the `.dc.html` files in a browser to view them. `Wayfinder Redesign.dc.html` contains all new designs on one pannable canvas; `Wayfinder Current UI.dc.html` is a faithful recreation of the current mobile UI for before/after comparison.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and copy are final. Recreate pixel-perfectly with Tailwind (values below map cleanly to Tailwind arbitrary values or a small theme extension).

## Design Tokens

Add to `globals.css` (keep the existing `--nhs-*` vars for legacy screens until fully migrated):

```css
:root {
  --wf-primary: #0A5DC2;      /* evolved from #005EB8 — buttons, active states, route (light map) */
  --wf-primary-deep: #06336B;
  --wf-ink: #0B1B2E;          /* headings, dark surfaces */
  --wf-ink-hero: #0A1626;     /* hero / dark map background */
  --wf-teal: #0FB5AE;         /* secondary accent, destination pins, toggles ON */
  --wf-teal-tint: #E9FBF6;    /* accessibility badge bg (text #0B7A75) */
  --wf-route-cyan: #22C9FF;   /* route line on dark map, glow */
  --wf-route-blue: #0A8CFF;   /* route line + position dot on light map */
  --wf-green: #0BA84A;        /* GPS-good dot, "Open now" (bg #E9F8EE, text #0A7C36) */
  --wf-body: #3D4E66;
  --wf-muted: #51627A;
  --wf-faint: #8494A9;
  --wf-surface: #F2F6FB;      /* input/stat tiles */
  --wf-surface-2: #F5F8FC;    /* feature cards */
  --wf-border: #E4EAF2;
  --wf-border-faint: #F0F4F9;
  --wf-map-light-bg: #EAEFF4;
}
```

Brand gradient (logo mark, "map a new place" FAB): `linear-gradient(135deg, #0A5DC2, #0FB5AE)`.

**Typography** (Google Fonts via `next/font`):
- Display / headings / numerals: **Space Grotesk** 400–700
- UI / body: **IBM Plex Sans** 400–700

Scale: hero h1 68/1.05 −2.2px; section h2 40–44/1.1 −1..−1.2px; card h3 21px; body 15–17px/1.6; UI labels 13–14.5px; overline 12–13px, 600, uppercase, tracking 0.08–0.1em; stat numerals Space Grotesk 700 17–18px.

**Radii:** pills/rails 999px; cards 18–20px; buttons/inputs/tiles 12–14px; map blocks 4–5px.
**Shadows:** floating cards `0 24px 60px rgba(11,27,46,0.25)`; map controls `0 8px 24px rgba(11,27,46,0.16)`; primary button `0 8–12px 20–30px rgba(10,93,194,0.3–0.45)`.
**Spacing:** page gutter 96px (landing), panel padding 24px, card padding 18–24px, grid gaps 24px, control gaps 10–14px.

**Motion:** position-dot sonar pulse 2.4s ease-out infinite (scale 0.5→3, fade out); route marching-dash `stroke-dasharray 3–4 / 22–24`, dashoffset −28 loop ~1s linear; destination pin bob ±5px 1.8s; toggles 0.2s. Respect `prefers-reduced-motion` (existing pattern in globals.css).

## Screens / Views

### 1a. Landing page (`src/app/page.tsx` replacement, 1440 design width)
Purpose: marketing-style entry replacing the current blue Navigate/Map chooser.
- **Nav** (over hero): logo mark 34px rounded-10 gradient square + Navigation icon; wordmark Space Grotesk 700 21px white. Links (Product, Venues, For teams, Help) white/85, 14.5px/500, gap 36px. CTA "Open the map" — white pill, ink text, 600 14px, 10×20px padding, arrow-right icon.
- **Hero**: 780px tall, `#0A1626` dark stylized map (real impl: dark Leaflet basemap or static render) with glowing cyan route (14px @16% opacity under 5px solid `#22C9FF` + animated white dash), pulsing cyan position dot (20px, white 3px border, cyan glow), bobbing teal map-pin. Left gradient scrim `rgba(7,15,27,.92) → transparent` at 70%. Badge pill: cyan-tinted border/bg, text `#8FDFFF` 13px "Indoor navigation, now on the web" with 7px cyan dot. H1: "Every building, mapped. Every step, guided." Sub 19px white/72 max-width 520px. CTAs: primary `#0A5DC2` 14px-radius 16×28 padding w/ Navigation icon + shadow; ghost bordered white/35 "Map a place" with Map icon.
- **Floating product cards** (right of hero): route card 320px white/97 r20 p20 — icon tile 42px `#E7F2FF` + MapPin, "Outpatients, Level 2" 600 15px + venue subtitle; two stat tiles (`#F2F6FB` r12): "6 min / on foot", "410 m / 2 floors up"; full-width primary button "Start guidance". Floor capsule: white pill column of 38px circles G/1/2/3, active = primary bg + shadow.
- **Trust strip**: 30px vertical padding, border-bottom `#E8EDF4`; "BUILT FOR" overline `#8494A9` + Space Grotesk 600 16px `#3D4E66` items: Hospitals, Shopping centres, Airports, Stations, Campuses, Offices.
- **Features**: overline "How it works" primary; h2 "From front door to final room, in three moves"; lead paragraph muted. 3-col grid, cards `#F5F8FC` border `#E8EDF4` r20 p32/28; icon tiles 48px r14 (primary / teal / ink) with Search, Navigation, ClipboardList icons; h3 + 15px body. Copy in prototype.
- **Dark band** ("One map that knows about floors"): `#0B1B2E`, 2-col. Left: cyan overline "2D · 3D · Every level", h2, body white/65, 2D/3D segmented pill (white/8 track, white active chip). Right: 3 stacked translucent floor planes (CSS 3D: `rotateX(58deg) rotateZ(-42deg)`, translateZ 0/56/112px; top plane teal-tinted with glow) + floor rail with "You are here" teal chip on 2.
- **CTA band**: gradient white→`#EFF5FB`, centered h2 "Put your place on the map", sub, primary + bordered secondary buttons.
- **Footer**: single row, small logo + wordmark left; Privacy / Accessibility / Status / © right, 13.5px muted.

### 1b. Map app home (`WayfinderApp.tsx` desktop layout, 1440×900)
Purpose: main navigate screen; replaces mobile top-bar + bottom-sheet with a left panel + floating map controls.
- **Left panel** 392px, white, shadow `8px 0 32px rgba(11,27,46,0.10)`, flex column:
  - Header: logo (30px) + wordmark 18px; 34px avatar circle `#F2F6FB` right.
  - Venue switcher row: `#F2F6FB` bordered r14 p12/14 — 38px `#E7F2FF` tile with Building icon, venue name 600 14.5 truncated, "Public · Verified" 12px + BadgeCheck; chevrons-up-down right. Opens venue picker.
  - Search field: 1.5px primary border r14, Search icon primary, placeholder "Search a room, place or address…" `#8494A9`, `/` keyboard-hint chip. Soft primary glow shadow.
  - Quick chips (wrap, gap 8): bordered white pills 7×13 padding 13px — venue `quickAccess` (A&E, Reception, Pharmacy, Café, Toilets, Lifts). Hover: primary border/text.
  - **Route preview card** (bordered r18, shadow): destination header (40px teal-tinted tile + MapPin-teal, name 600 15.5, "Ground Floor · Main pharmacy"), close circle; origin→destination step list (10px dots — primary w/ light ring for origin, teal for destination, 2px `#D8E2EE` connector); 3 stat tiles (3 min walking / 180 m same floor / ±4 m accuracy); actions row: primary **Start** (with Navigation icon, shadow) + bordered square share button.
  - "NEARBY ON THIS FLOOR" overline + rows: 36px r11 `#F2F6FB` emoji tile, name 600 14, meta 12 muted, distance right in Space Grotesk 600 12.5 primary. Border-bottom `#F0F4F9`.
  - Footer row (top border): 38px gradient circle + Plus icon, "Map a new place / Walk it or upload a floor plan", chevron. Replaces the separate /map entry FABs.
- **Map canvas** (flex-1): Leaflet light basemap (`#EAEFF4` land, white roads) with venue floorplan overlay; route `#0A8CFF` 5.5px (12px 14% underglow, animated light dash); position dot `#0A8CFF` 22px white-border with pulse; teal destination pin bobbing.
- **Floating controls**:
  - Top-right: **2D/3D segmented pill** (white/96, 4px padding; active chip primary bg white text shadow, inactive muted) — replaces the tiny 3D badge; circular 42px buttons: map-style (Moon icon, toggles light/dark basemap) and Layers.
  - Right-center **floor rail**: white pill column, 38px circles (3/2/1/G), active primary + shadow — replaces square FloorSelector.
  - Bottom-right: zoom +/− stacked card (42×40 each) and 42px primary circular **re-centre** FAB (Navigation icon).
  - Bottom-left **status pill**: white/96 — green dot "GPS ±4 m" · Layers-icon "Ground Floor" · "2D view", separated by 1px dividers. Replaces the three scattered badges (GPS accuracy, floor, view).
- Dark map style: land `#0C1928`, roads `#16283F`, blocks `#0F2036` stroke `#1B3252`, route `#22C9FF`. Panel and controls stay light.

### 2a. Shareable destination — QR poster + share dialog
- **Poster** (print, A-portrait, 480×640 ref): ink header bar (logo + wordmark left, venue name white/65 right); centered "SCAN TO NAVIGATE TO" overline primary, destination Space Grotesk 700 34px, QR in 2px `#E4EAF2` r20 frame, helper copy 14.5 muted, teal "Step-free route available" badge; footer row (top border): short URL left, "You are at: Main Entrance" right (poster encodes its own location as route origin — reuse the existing QR anchor format `floor:<n>:lat:<x>:lng:<y>` plus destination).
- **Share dialog** 420px r20: title "Share this destination" + close; destination summary tile with 64px QR thumbnail; LINK overline + bordered field `wayfinder.app/gosh/outpatients-l2` with **Copy** button (primary chip → teal-tinted "Copied ✓" for ~1.6s); toggle row "Link opens the step-free route" (42×24 switch, teal ON); buttons: primary "Download poster (PDF)" + bordered "QR only (PNG)".

### 2b. Accessibility-first routing (route options)
420px card: destination header; venue accessibility badges (teal-tinted pills, from existing `AccessibilityInfo`): ♿ Step-free access, 🚻 Accessible toilets, 🔊 Hearing loop; "CHOOSE A ROUTE" overline; two selectable route cards (r14, 1.5px border; selected = teal border, `#F2FBF9` bg, soft teal shadow): **Fastest** "Via Staircase 1 · includes 2 flights of stairs" 4 min/240 m, **Step-free** (teal RECOMMENDED chip) "Via Lift A · no stairs, wide corridors" 6 min/310 m; numbered step list in `#F7FAFD` r14 panel (22px `#E7F2FF` numeral circles) — steps swap with selection; "Always prefer step-free routes" switch (persist to localStorage/user profile); primary button "Start step-free route" (label follows selection). Routing impl: extend `buildRoute` in `src/lib/routing.ts` to avoid stair waypoints when step-free is on, preferring lift floor-changes.

### 2c. Arrival context on the destination card
420px card: header (teal tile, "Outpatients Clinic B", "Level 2 · via Lift A", close); status row: "Open now" pill (`#E9F8EE`/`#0A7C36`, green dot) + "Closes 17:00 · last check-in 16:30" 13px muted; **"WHEN YOU ARRIVE"** venue-authored callout (`#F2F8FF` bg, `#D9E9FB` border, r14, Info icon, 13.5px body) — check-in instructions text; practical rows in bordered r14 list (emoji, label, value in Space Grotesk 600 13): typical wait 10–20 min, nearest toilets 30 m · same floor, café Ground Floor · 2 min; actions: primary "Navigate · 6 min" + bordered share icon button. Data model: add optional `hours`, `arrivalNotes`, `typicalWait` to `Waypoint`/venue metadata; authored by venue owners.

## Interactions & Behavior
- 2D/3D segmented control and floor rail: single-click state change, active chip animates via bg/shadow (0.2s). Persist map view in localStorage (existing `wayfinder.mapView` key).
- Map style button toggles light/dark basemap; controls/panel unaffected.
- Copy button: writes URL to clipboard, 1.6s "Copied ✓" state.
- Route choice cards: radio behavior; step list and Start label update immediately; re-run route build on change (mirrors existing `handleTravelModeChange` pattern).
- Toggles: 42×24 track, 20px knob, translateX 18px, 0.2s; teal when on.
- Search field focuses on `/` keypress; opens results in-panel (desktop) rather than full-screen modal.
- Hover: chips get primary border/text; list rows bg `#F7FAFD`; buttons darken ~6%.
- Route line: animated marching dash; position dot: sonar pulse + breathe (reuse existing `wf-*` keyframes); destination pin bob. All gated by `prefers-reduced-motion`.

## State Management
Reuses existing state in `WayfinderApp.tsx`: `mapView` (2d/3d), `currentFloor`, `navState` (destination/route/isNavigating), venue store. New state: `mapStyle: "light" | "dark"` (persisted), `routePreference: "fastest" | "stepfree"` (persisted per user), `shareStepFree` (per-dialog), `copied` (transient). Arrival context and accessibility badges come from venue/waypoint metadata (extend `src/lib/types.ts`).

## Assets
- Icons: **lucide-react** (already a dependency) — Navigation, Map, Search, MapPin, ChevronsUpDown, ChevronRight, Layers, Plus, X, Share/Upload, Moon, Link, Download, Info, Accessibility, BadgeCheck.
- Fonts: Space Grotesk + IBM Plex Sans (Google Fonts / `next/font`).
- QR codes in mocks are **decorative placeholders** — generate real ones (e.g. `qrcode` npm package) encoding the share URL + origin anchor.
- Stylized SVG maps in mocks are placeholders for Leaflet/three.js layers; `public/floorplans/*.svg` are the repo's existing floorplan overlays (two copies included for reference).

## Files
- `Wayfinder Redesign.dc.html` — all redesigned screens on one canvas: 2a/2b/2c (top section), 1a landing, 1b app home. Interactive: 2D/3D toggle, floor rail, map style, copy, toggles, route choice.
- `Wayfinder Current UI.dc.html` — recreation of the current mobile UI (landing, navigate home, route preview, search, venue picker, map mode) for comparison.
- `public/floorplans/ground.svg`, `public/floorplans/floor1.svg` — copied from the repo, used by the mocks.

Implementation order suggestion: tokens + fonts → 1b app shell (panel + controls) → 1a landing → 2b routing → 2a share/QR → 2c arrival metadata.
