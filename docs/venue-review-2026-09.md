# Hospital map review, September 2026

*Reviewed 25 September 2026 from commit `618561a`. Scope: the 67 venues the
app ships, taken one by one — which hospital each sheet draws, whose it is and
where it stands; every one of its 4,287 waypoint labels; and, in a second pass
the same day, each venue's name, trust, address, position and published maps
checked against the live web (see [Web verification](#web-verification)). The August review
([mapping-review.md](mapping-review.md)) measured the venues as a population;
this one reads them individually.*

Measurements come from `node scripts/maps/audit-venues.mjs --full --json`,
run before and after. Corrections are applied by two idempotent tools so
they can be re-run, reviewed in a diff, and survive a rebuild:

- `scripts/maps/normalise-venues.mjs` applies the label rules in
  `scripts/maps/lib/labels.mjs` to the committed venue modules (the source
  PDFs are not in the repo, so a rebuild was not possible).
- `scripts/maps/apply-identity.mjs` applies `data/venue-identity.json` —
  the name, trust, position and storey corrections a person has checked —
  to the modules and to `data/mapped-sites.json`. `scripts/maps/sheets.mjs`
  lays the same file over the sheet config on every read, so a `--force`
  re-draft of the sheets cannot put a wrong name back.

## Summary

| | before | after |
| --- | ---: | ---: |
| Grades | A:17 B:15 C:6 D:13 E:15 F:1 | **A:18** B:13 C:8 D:16 **E:11** F:1 |
| Label problems (audit) | 89 | **42** |
| Waypoints | 4,287 | 4,166 |
| Venues on the wrong site | 5 | **0** |
| Venues under the wrong trust or a department's name | 14 | **0** |
| Venues checked against the live web | 0 | **54 of 66** |
| Label tests | 55 | 167 |

The grade shifts are honest rather than large: the audit grades structure
(corridors, floors, vertical circulation), and this pass changed what the
venues *say* and where they *are*, not how they are modelled. Seven venues
moved grade — six up, and one down (the Wakefield diagnostic-centre plan,
which lost the CAD title block it had been counting as destinations).

## Venues that were the wrong hospital

Four sheets shipped under another site's name, at another site's position,
because the ingestion pipeline names a sheet after the NHS ODS record it
matched and ODS files departments, closed sites and community services as
sites. Each was checked against the sheet's own labels, the ODS register copy
in the repo and the trust's website (web search), and moved.

| Venue | Was | Is now | How it was decided |
| --- | --- | --- | --- |
| `sgh-site-map` | "St Georges at Woking Hospital", Woking GU22 7HS, 256 m wide | **St George's Hospital, Tooting — Grounds & Car Parks**, Blackshaw Road SW17 0QT, 520 m wide | The labels are Tooting's (Atkinson Morley Wing, St James Wing, Cavell and Gunning wards); the trust has no hospital in Woking. Centre and scale taken from the verified hand-built `st-georges` venue of the same site, which this 2013 sheet now complements with grounds and car parks, on the North Tees "Grounds & Car Parks" convention. |
| `pinderfields-hospital-map` | Pinderfields Hospital at Dewsbury's coordinates (10.7 km west) | **Pinderfields Hospital**, Aberford Road, Wakefield WF1 4DG | The sheet is titled Pinderfields; the ODS site RR864 for it geocodes 140 m from the centre used, inside the site. |
| `community-diagnostic-centre-site-map` | "Dewsbury & District Hospital-Combined Elective Surgical Hub" at Dewsbury | **Wakefield Community Diagnostic Centre**, Westgate Retail Park, Ings Road WF2 9SD | The sheet is the trust's plan of Westgate Retail Park (Wickes, Currys, Next, Smyths are its tenants) with the CDC in Unit 9B; the trust's page gives the address. Centre is the postcode centroid; the unit itself is not labelled on the drawing. |
| `level-3-floorplan-cuh-map` | "Cuh at Doddington Hospital", Doddington PE15 (36.6 km away), ground floor | **Addenbrooke's Hospital — Level 3**, Hills Road, Cambridge CB2 0QQ, floor index 2 under the trust's Level numbering | The trust publishes the file as a floor of Addenbrooke's and its labels (Clinic 4a, Clinic 12, ward A3, fluoroscopy, DXA) are Addenbrooke's Level 3. Centre and level numbering from the hand-built `cuh` venue; the floor-plan image is now `f2.svg`, the multi-floor convention. |

Hull Royal Infirmary was the fifth, found in the web pass: its sheet was
drafted against an ODS record in HU4 and sat 2.4 km west of the infirmary on
Anlaby Road (HU3 2JZ); it is now on the ODS site record for the infirmary,
25 m from the Google Maps pin.

Southport is a subtler case: `southport-hospital-site-map-a3-sept-2024`
was matched to **Southport General Infirmary**, a closed town-centre site
(PR8 6PH), and scaled to that building's footprint (192 m). The sheet draws
the District General Hospital at Town Lane (PR8 6PN), 0.8 km away and much
larger. It is now centred on the ODS record for the DGH and scaled to an
estimated 520 m; the estimate is flagged in the venue's own notes.

## Venues under the wrong trust or a department's name

| Venue | Was | Is now |
| --- | --- | --- |
| `jr-hospital-sitemap` | Nuffield Orthopaedic Centre NHS Trust (the ODS site's legacy parent) | Oxford University Hospitals NHS Foundation Trust · Headley Way, Headington, Oxford OX3 9DU |
| `ngh-hospital-map` | Northamptonshire Healthcare NHS Foundation Trust (the mental-health trust, which has a unit on site) | Northampton General Hospital NHS Trust · Cliftonville, Northampton NN1 5BD |
| `princess-anne-hospital` | Solent NHS Trust (a community service on site) | University Hospital Southampton NHS Foundation Trust · Coxford Road, Southampton SO16 5YA |
| `macclesfield-district-general-hospital` | Manchester University NHS Foundation Trust (a service it runs there) | East Cheshire NHS Trust · Victoria Road, Macclesfield SK10 3BL |
| `southport-hospital-site-map-a3-sept-2024`, `ormskirk-site-map-a3` | Southport and Ormskirk Hospital NHS Trust (merged 1 July 2023) | Mersey and West Lancashire Teaching Hospitals NHS Trust |
| `pilgrim-ground-floor` | "Pilgrim A&E" (one of the trust's department records) | Pilgrim Hospital, Boston · Sibsey Road PE21 9QS |
| `lister-map-2026` | "The Lister Hospital Surgicentre" (the former treatment centre's record) | Lister Hospital · Coreys Mill Lane, Stevenage SG1 4AB |
| `friarage-site-map-july-2025` | "Friarage Hospital Site" | Friarage Hospital · Bullamoor Road, Northallerton DL6 1JG |
| `trust-map-june-2026` | "The Queen Elizabeth Hospital" (one of three Queen Elizabeths the app carries) | The Queen Elizabeth Hospital, King's Lynn · Gayton Road PE30 4ET |

Every entry in `data/venue-identity.json` records what it rests on and when
it was checked. The `plan-sources.json` record of who *published* each sheet
was already right for all of these; it was the ODS site's parent that was
wrong, and the drafter took that.

## Labels

Every waypoint label in the sheet-derived venues was read. The rules added
to `scripts/maps/lib/labels.mjs` (each with a test on the string that
shipped) and applied by `normalise-venues.mjs`:

- **The sheet's own title read as a place** — "Ormskirk Hospital", "John
  Radcliffe Hospital site map", "Hospital Site Map" — in 24 venues. Routing
  to it sent people to the corner of the page where the title block sits;
  the hospital itself is reachable as the venue's site destination. Campus
  venues keep the names of the hospitals on them.
- **Directory-table headings**: "Level", "Floor", "Zone", "Department /
  Ward", "1st Floor", "Entrances", "Facilities", "Wards" (18 headings, some in
  several venues), and the **CAD title block** of the Wakefield plan ("Rev
  Description", "Date/Sig", "NTS", "A1 Plan", "Wf-Cdc-GF").
- **Garbage from the extractor**: Ormskirk's five columns of "Mh Mh Mh…"
  markers, Hartlepool's "Ward Ward Ward" and "9 (1st floor) 10 (2nd floor)
  11 (3rd floor)", Tunbridge Wells' three units welded into one string.
- **Route notes and traffic signs**: "Exit Only", "Closed", "Drop off route
  to A&E", "Ramp access to all Levels and exit to car park (P2)", "Pay here
  for parking".
- **Off-site orientation**: "A386 to Tavistock", "Leeds Via M1", "The George
  Park & Ride", "Derriford Roundabout", bus stops.
- **Bracketed fragments** of a neighbouring caption — "(Adult)", "(via
  YELLOW ROUTE)", "(New Building)", "(Bwh)" — dropped; "(PALS)", "(SAU)",
  "(Seau, SAU)", "(Maternity Triage)" kept as the places they name.
- **Merged ward captions split** into one waypoint per ward, 4 m apart:
  St George's "Cavell Ward Gunning Ward Keate Ward Major Trauma Ward" and
  "Allingham Ward Amyand Ward Marnham Ward Rodney Smith Ward", Lister's
  "Ward 6b Renal Ward 7a Vascular Ward 7b", Bishop Auckland's "Ward 16
  (Rehabilitation) Ward 17 (Day Surgery)" — 8 labels, 20 waypoints. "Gray
  Ward Vascular Laboratory Vernon Ward" is deliberately left: nothing can
  tell where "Vascular Laboratory Vernon" divides.
- **Storeys lifted out of names** in six more forms: "2nd Fl. Pharmacy &
  Pathology", "Main Entrance Level 6", "Emergency Department Entrance (Level
  2)", "Wards 5, 6, 7 & 8 — First Floor", "GF A&E", "Ground Floor Theatres".
  A level *number* is kept as a description and never used as a floor index
  (Derriford's Level 6 is its main entrance); "Stairs to level 1" keeps its
  storey, because that is where the stairs go.
- **Lost letters restored** on the Pinderfields sheet, whose embedded font has
  no "g": "Emerency", "Dermatoloy", "Buildin", "parkin", "blue bade".
- **Acronyms re-capitalised** where an earlier title-casing had lowercased
  them: "(Acu)", "(Amu)", "Kfc", "Dxa", "Pgme", "Gum Clinic", "Whsmith"; and
  a title-casing bug that wrote "a&E" for A&E after the first word
  ("Emergency a&E Entrance", "GF a&E").
- **Amenities retyped** so the filters find them: baby changing and Changing
  Places → toilet (12), shops and coffee chains → canteen (24), a bare
  "Information" → reception, "Exit" and "Main Gate" → exit, "Escalator" →
  stairs.
- **quickAccess chips** that pointed at dropped furniture are gone rather
  than fuzzy-matched — the old repair had sent "Birmingham Women's Hospital"
  to the Queen Elizabeth next door.

Two waypoints named `)` in the hand-built St George's venue were deleted.
Hand-built venues were otherwise not touched.

## Per-venue table

Grade, waypoints and label problems are the audit's, before → after where
they changed. *Top finding* is the most severe audit code (`campus-only` = a
site map with no interior; `no-corridors` = no corridor network, so indoor
legs route as straight lines). *Identity* is what the venue's position rests
on: the ODS site code the drafter matched, or a hand-built plan.

| Venue | Trust | Grade | Waypoints | Floors | Corridors | Label problems | Top finding | Identity | This pass |
| --- | --- | :-: | --: | --: | --: | --: | --- | --- | --- |
| **Alexandra Hospital** `alex-map-a4` | Worcestershire Acute Hospitals NHS Trust | A | 40 | 1 | 32 | 0 | campus-only | ODS C2P9J | trust corrected |
| **Bishop Auckland Hospital** `bishop-auckland-floor-plan-2023` | County Durham and Darlington NHS Foundation Trust | A | 63 | 1 | 98 | 1 | campus-only | ODS H8C7C | renamed from “Bishop Auckland CDC”; trust/address corrected |
| **Chelsea & Westminster Hospital** `chelsea-and-westminster-hospital-site-map` | Chelsea and Westminster Hospital NHS Foundation Trust | A | 82 | 1 | 192 | 0 | campus-only | ODS RQM01 | trust corrected |
| **Churchill Hospital** `ch-hospital-sitemap` | Oxford University Hospitals NHS Foundation Trust | A | 73 | 1 | 178 | 1 | campus-only | ODS RTH02 | — |
| **Great Ormond Street Hospital** `gosh` | Great Ormond Street Hospital for Children NHS Foundation Trust | A | 285 | 10 | 146 | 0 | — | hand-built, verified | — |
| **Lincoln County Hospital** `lincoln-county-hospital` | United Lincolnshire Teaching Hospitals NHS Trust | A | 97 | 3 | 88 | 5 → 4 | floor-without-corridors | ODS A3D1D | — |
| **Lister Hospital** `lister-map-2026` | East and North Hertfordshire Teaching NHS Trust | A | 136 | 1 | 4 | 3 → 1 | campus-only | ODS RWHDD | renamed from “Lister Hospital”; trust/address corrected |
| **Maidstone Hospital** `maidstone-hospital-mappdf` | Maidstone and Tunbridge Wells NHS Trust | A | 19 | 1 | 50 | 0 | campus-only | ODS RWFXC | trust corrected |
| **Northampton General Hospital** `ngh-hospital-map` | Northampton General Hospital NHS Trust | A | 101 | 1 | 161 | 1 → 0 | campus-only | ODS RP1M4 | trust corrected |
| **Nuffield Orthopaedic Centre** `noc-site-map` | Oxford University Hospitals NHS Foundation Trust | B → **A** | 45 | 1 | 47 | 1 → 0 | campus-only | ODS RTH03 | trust corrected |
| **Pilgrim Hospital, Boston** `pilgrim-ground-floor` | United Lincolnshire Teaching Hospitals NHS Trust | A | 40 | 1 | 105 | 1 → 0 | campus-only | ODS RWD2A | renamed from “Pilgrim Hospital, Boston”; trust/address corrected |
| **Princess Anne Hospital** `princess-anne-hospital` | University Hospital Southampton NHS Foundation Trust | A | 71 | 6 | 36 | 0 | no-exit | ODS R1C36 | trust corrected |
| **The James Cook University Hospital** `james-cook-campus-map-jul25` | South Tees Hospitals NHS Foundation Trust | A | 195 | 1 | 31 | 2 → 0 | campus-only | ODS RTRAT | trust corrected |
| **Tunbridge Wells Hospital** `tunbridge-wells-hospital-mappdf` | Maidstone and Tunbridge Wells NHS Trust | A | 72 | 1 | 98 | 2 → 1 | campus-only | ODS RWFTW | renamed from “The Tunbridge Wells Hospital”; trust/address corrected |
| **University Hospital of Hartlepool** `internal-site-map-hartlepool-2018` | North Tees and Hartlepool NHS Foundation Trust | A | 71 | 1 | 190 | 5 → 2 | campus-only | ODS RVWHD | — |
| **University Hospital of North Tees** `internal-site-map-north-tees-2019` | North Tees and Hartlepool NHS Foundation Trust | A | 130 | 1 | 279 | 2 | campus-only | ODS RVWND | trust corrected |
| **University Hospital of North Tees — Grounds & Car Parks** `external-site-map-north-tees-2019` | North Tees and Hartlepool NHS Foundation Trust | A | 120 | 1 | 112 | 1 | campus-only | ODS RVWND | trust corrected |
| **Western Eye Hospital** `western-eye` | Imperial College Healthcare NHS Trust | A | 11 | 1 | 10 | 2 → 0 | campus-only | hand-anchored sheet | — |
| **Basildon University Hospital** `basildon-hospital` | Mid and South Essex NHS Foundation Trust | B | 37 | 4 | 212 | 0 | no-vertical-circulation | hand-built | renamed from “Basildon & Thurrock University Hospital”; moved to the right site; trust/address corrected |
| **Birmingham Women's Hospital** `bwh` | Birmingham Women's and Children's NHS FT | B | 22 | 1 | 13 | 1 | campus-only | hand-anchored sheet | — |
| **Charing Cross Hospital** `charing-cross` | Imperial College Healthcare NHS Trust | B | 32 | 1 | 48 | 1 | campus-only | hand-anchored sheet | — |
| **Grantham & District Hospital** `grantham-and-district-hospital-map` | United Lincolnshire Teaching Hospitals NHS Trust | B | 43 | 1 | 249 | 1 | campus-only | ODS RWDLP | trust corrected |
| **Hammersmith Hospital** `hammersmith` | Imperial College Healthcare NHS Trust | B | 24 | 1 | 27 | 1 | campus-only | hand-anchored sheet | — |
| **Hull Royal Infirmary** `hull-royal-infirmary-site-map` | Hull University Teaching Hospitals NHS Trust | B | 26 | 1 | 42 | 0 | campus-only | ODS A7G4P | moved to the right site; trust/address corrected |
| **Newham Hospital** `newham-university-hospital` | Barts Health NHS Trust | B | 122 | 4 | 172 | 5 | no-vertical-circulation | hand-built | renamed from “Newham University Hospital”; trust/address corrected |
| **North Manchester General Hospital** `nmgh` | Manchester University NHS FT | B | 14 | 1 | 75 | 0 | campus-only | hand-anchored sheet | — |
| **Queen Charlotte's & Chelsea Hospital** `qcch` | Imperial College Healthcare NHS Trust | B | 18 | 1 | 28 | 0 | campus-only | hand-anchored sheet | — |
| **Queen Elizabeth Hospital Birmingham** `qehb` | University Hospitals Birmingham NHS FT | B | 30 | 1 | 84 | 2 | campus-only | hand-anchored sheet | — |
| **Stratford Hospital** `a5-site-map-of-stratford-hospital-july-2025-update` | South Warwickshire University NHS Foundation Trust | B | 25 | 1 | 82 | 2 → 0 | campus-only | ODS RJC03 | trust corrected |
| **Trafford General Hospital** `trafford` | Manchester University NHS FT | B | 22 | 1 | 112 | 0 | campus-only | hand-anchored sheet | — |
| **Wythenshawe Hospital** `wythenshawe` | Manchester University NHS FT | B | 22 | 1 | 83 | 0 | campus-only | hand-anchored sheet | — |
| **Addenbrooke's Hospital** `cuh` | Cambridge University Hospitals NHS Foundation Trust | C | 36 | 5 | 0 | 0 | no-corridors | hand-built | trust corrected |
| **Addenbrooke's Hospital — Level 3** `level-3-floorplan-cuh-map` | Cambridge University Hospitals NHS Foundation Trust | C | 13 | 1 | 0 | 0 | no-corridors | ODS B5D1I | renamed from “Addenbrooke's Hospital — Level 3”; moved to the right site; re-storeyed to Level 3; trust/address corrected |
| **Cannery Trails Findway** `cannery-trails` | Mixed-use residential building, Williamson St | C | 47 | 3 | 0 | 4 | no-corridors | hand-built | — |
| **Fordcombe Hospital** `fordcombe-hospital-mappdf` | Maidstone and Tunbridge Wells NHS Trust | C | 15 | 1 | 0 | 0 | no-corridors | ODS O1Q2M | trust corrected |
| **Macclesfield District General Hospital** `macclesfield-district-general-hospital` | East Cheshire NHS Trust | C | 62 | 2 | 70 | 4 → 2 | no-vertical-circulation | ODS R0A73 | trust corrected |
| **Princess of Wales Community Hospital** `princess-of-wales-community-hospital-site-map` | Herefordshire and Worcestershire Health and Care NHS Trust | C | 15 | 1 | 0 | 1 | no-corridors | ODS R1ACG | renamed from “Princess of Wales Hospital”; trust/address corrected |
| **Wakefield Community Diagnostic Centre** `community-diagnostic-centre-site-map` | Mid Yorkshire Teaching NHS Trust | B → **C** | 9 | 1 | 5 | 1 → 0 | campus-only | ODS P6M3A | renamed from “Wakefield Community Diagnostic Centre”; moved to the right site; rescaled; trust/address corrected |
| **Whiston Hospital** `whiston-site-map-full-site` | Mersey and West Lancashire Teaching Hospitals NHS Trust | D → **C** | 30 | 1 | 0 | 1 → 0 | no-corridors | ODS M8D6F | trust corrected |
| **Castle Hill Hospital** `site-1253769-hull-teaching-castle-hill-map` | Hull University Teaching Hospitals NHS Trust | D | 116 | 1 | 0 | 0 | no-corridors | ODS G4V1I | trust corrected |
| **Derriford Hospital** `derriford-hospital-site-mappdf` | University Hospitals Plymouth NHS Trust | D | 62 | 1 | 0 | 10 → 1 | no-corridors | ODS RK9A9 | trust corrected |
| **Diana, Princess of Wales Hospital** `diana-princess-of-wales-hospital-internal-2d-2025` | Northern Lincolnshire and Goole NHS Foundation Trust | E → **D** | 47 | 1 | 0 | 1 | no-corridors | ODS RJL30 | trust corrected |
| **John Radcliffe Hospital** `jr-hospital-sitemap` | Oxford University Hospitals NHS Foundation Trust | D | 66 | 1 | 0 | 1 → 0 | no-corridors | ODS RBF34 | trust corrected |
| **Medway Maritime Hospital** `hospital-map-external-2025` | Medway NHS Foundation Trust | E → **D** | 46 | 1 | 0 | 5 → 0 | no-corridors | ODS RPAP1 | trust corrected |
| **Mile End Hospital** `mile-end-hospital` | Barts Health NHS Trust | D | 56 | 1 | 0 | 0 | no-corridors | hand-built | — |
| **Pinderfields Hospital** `pinderfields-hospital-map` | Mid Yorkshire Teaching NHS Trust | E → **D** | 15 | 1 | 0 | 0 | no-corridors | ODS P6M3A | renamed from “Pinderfields Hospital”; moved to the right site; trust/address corrected |
| **Queen's Hospital, Romford** `queens-hospital-romford` | Barking, Havering and Redbridge University Hospitals NHS Trust | D | 39 | 5 | 180 | 2 | no-vertical-circulation | hand-built | — |
| **Southport and Formby District General Hospital** `southport-hospital-site-map-a3-sept-2024` | Mersey and West Lancashire Teaching Hospitals NHS Trust | D | 67 | 1 | 0 | 0 | no-corridors | ODS RVY03 | renamed from “Southport and Formby District General Hospital”; moved to the right site; rescaled; trust/address corrected |
| **St Bartholomew's Hospital** `st-bartholomews` | Barts Health NHS Trust | D | 74 | 1 | 0 | 4 | no-corridors | hand-built | — |
| **St George's Hospital, Tooting** `st-georges` | St George's University Hospitals NHS Foundation Trust | E → **D** | 206 | 7 | 0 | 2 → 0 | no-corridors | hand-built, verified | — |
| **St George's Hospital, Tooting — Grounds & Car Parks** `sgh-site-map` | St George's University Hospitals NHS Foundation Trust | D | 157 | 1 | 0 | 3 → 1 | no-corridors | ODS D3X3Z | renamed from “St George's Hospital, Tooting — Grounds & Car Parks”; moved to the right site; rescaled; trust/address corrected |
| **The Queen Elizabeth Hospital, King's Lynn** `trust-map-june-2026` | The Queen Elizabeth Hospital King's Lynn NHS Foundation Trust | D | 89 | 1 | 0 | 2 → 0 | no-corridors | ODS RCX70 | renamed from “The Queen Elizabeth Hospital, King's Lynn”; trust/address corrected |
| **The Royal London Hospital** `royal-london-hospital` | Barts Health NHS Trust | D | 36 | 1 | 0 | 0 | no-corridors | hand-built | — |
| **West Middlesex University Hospital** `west-middlesex-university-hospital-site-map` | Chelsea and Westminster Hospital NHS Foundation Trust | D | 197 | 1 | 0 | 1 → 0 | no-corridors | ODS RQMD3 | — |
| **Whipps Cross Hospital** `whipps-cross-hospital` | Barts Health NHS Trust | D | 65 | 1 | 0 | 0 | no-corridors | hand-built | — |
| **Broomfield Hospital** `broomfield-hospital` | Mid and South Essex NHS Foundation Trust | E | 54 | 5 | 0 | 1 | no-corridors | hand-built | — |
| **Ealing Hospital** `ealing-hospital-site-map` | London North West University Healthcare NHS Trust | E | 22 | 1 | 0 | 0 | no-corridors | ODS R1K04 | trust corrected |
| **Friarage Hospital** `friarage-site-map-july-2025` | South Tees Hospitals NHS Foundation Trust | E | 34 | 1 | 0 | 1 → 0 | no-corridors | ODS RTR45 | renamed from “Friarage Hospital”; trust/address corrected |
| **King George Hospital** `king-george-hospital` | Barking, Havering and Redbridge University Hospitals NHS Trust | E | 56 | 2 | 0 | 0 | no-corridors | hand-built | — |
| **Manchester Royal Infirmary — Oxford Road Campus** `oxford-road` | Manchester University NHS FT | E | 32 | 1 | 0 | 0 | no-corridors | hand-anchored sheet | — |
| **Northwick Park Hospital** `northwick-park-hospital-site-map` | London North West University Healthcare NHS Trust | E | 19 | 1 | 0 | 1 | no-corridors | ODS R1K01 | — |
| **Ormskirk & District General Hospital** `ormskirk-site-map-a3` | Mersey and West Lancashire Teaching Hospitals NHS Trust | E | 24 | 1 | 0 | 3 → 0 | no-corridors | ODS RVY38 | trust corrected |
| **Queen Elizabeth Hospital, Woolwich** `queen-elizabeth-hospital-woolwich` | Lewisham and Greenwich NHS Trust | E | 71 | 2 | 0 | 0 | no-corridors | hand-built | — |
| **St Mary's Hospital, Paddington** `st-marys-paddington` | Imperial College Healthcare NHS Trust | E | 20 | 1 | 0 | 0 | no-corridors | hand-built | — |
| **University Hospital Lewisham** `university-hospital-lewisham` | Lewisham and Greenwich NHS Trust | E | 99 | 7 | 0 | 0 | no-corridors | hand-built | — |
| **West Park Rehabilitation Hospital** `site-6458-west-park-rehabilitation-hospital` | The Royal Wolverhampton NHS Trust | E | 26 | 1 | 0 | 1 → 0 | no-corridors | ODS RL4CD | renamed from “West Park Hospital”; trust/address corrected |
| **Queen Mary's Hospital, Roehampton** `queen-marys-roehampton` | St George's University Hospitals NHS Foundation Trust | F | 56 | 1 | 0 | 0 | no-corridors | hand-built | — |

## What this pass could not do, and who can

- **No sheet was checked against the map by eye.** The four relocations put
  each drawing at the right site and (where the drafted scale came from the
  wrong building) at an estimated scale; whether the drawing sits square on
  the buildings needs the source PDF and two control points
  ([map-placement.md](map-placement.md)). Southport's 520 m and St
  George's 520 m are estimates and say so in their notes.
- **The Wakefield CDC plan is a retail-park plan.** After its title block
  went, nine retail units and five corridor stubs remain; the centre's own
  unit is unlabelled. It is honest at grade C now, but the trust's own floor
  plan of the unit would replace it outright — or it could be withdrawn.
- **Level 3 is the only Addenbrooke's level the pipeline has**; the trust
  publishes the others, and the hand-built `cuh` venue (illustrative plans)
  would be replaced by them.
- **42 label problems remain**, all judged unsafe to fix by rule: captions
  that merge two or three real destinations without a separator ("Radiology
  Reception and X-Ray", "Toilet Stairs Lift", "Emergency Dept, Urgent Care
  Centre & GP Services Entrance"), long car-park captions in the hand-built
  Barts, Newham and QEHB venues, and the audit's own heuristics
  ("Oxford Ambulance Station" is a real building; "AEC / SDEC" is not
  shouting — the audit rule was tightened for that).
- **The ingestion pipeline could not run.** This environment's network policy
  refused every host it needs — `directory.spineservices.nhs.uk` (the ODS
  register), `files.digital.nhs.uk` (bulk extracts), `api.postcodes.io`,
  `overpass-api.de` (OpenStreetMap footprints), `www.nhs.uk` and the trusts'
  own `*.nhs.uk` sites — so no records or PDFs could be fetched and nothing
  could be rebuilt; only web search worked, which is how the identities above
  were confirmed. To fetch records and republished maps, allow those hosts
  (or raise the access level) in the cloud environment's **Network access**
  settings, then run `npm run nhs:refresh` (register, geocoding, footprints,
  directory), `npm run nhs:discover` and `npm run nhs:plans` (find and fetch
  the trusts' maps into `map/`), and `node scripts/maps/build-venues.mjs`
  to rebuild the sheet venues with these corrections applied at source.

## Newer or additional source maps seen on the web

Found by web search while confirming identities; none could be fetched from
here, so each is a lead to confirm, not a checked source.

| Venue | What was found |
| --- | --- |
| `sgh-site-map` (2013 sheet) | The trust's *Map and Key* (July 2021), the sheet the hand-built `st-georges` venue was built from — the same site eight years newer. |
| `southport-hospital-site-map-a3-sept-2024` | An external site map on the merged trust's own domain (merseywestlancs.nhs.uk), post-dating the old-domain September 2024 sheet. |
| `level-3-floorplan-cuh-map` | A `Level_3_floor_plan_1.pdf` on cuh.nhs.uk alongside the other levels of Addenbrooke's. |
| `lister-map-2026` | A `Lister-Maps.pdf` on the trust site in addition to the 2026 map in use. |
| `qmh` (Queen Mary's, Roehampton — hand-built, F, no corridors) | The trust publishes a site map (November 2023); the venue has never had a sheet. |
| `ngh-hospital-map`, `jr-hospital-sitemap`, `pilgrim-ground-floor`, `macclesfield-district-general-hospital` | The maps in use are still the ones the trusts publish. |

## Web verification

A second pass the same day checked every venue against the live web: the
trust's own site, NHS.uk, CQC, Wikipedia and postcode geocoders, for the
hospital's current name, trust, street address, a printed coordinate, and
the maps the trust publishes today. The environment's egress proxy refuses
every direct fetch, so this ran on web search alone, through eight parallel
research agents, and the session's search allowance (200 searches) ran out
before the last batch: **54 of the 66 NHS venues were checked; 12 were not
reached** and are marked in the table. Nothing was filled in from memory
for those.

What the check found, and what was done about it:

| Finding | Venues | Action |
| --- | --- | --- |
| Venue 2.4 km from its hospital | Hull Royal Infirmary | moved to the ODS record for the infirmary; postcode corrected HU4 6BN → HU3 2JZ |
| Hand-built centre 670 m from where three sources put the hospital | Basildon | moved to the Wikipedia point; renamed **Basildon University Hospital** (the trust's name since the 2020 merger) |
| Sheet is the whole hospital, not the diagnostic centre it was named for | Bishop Auckland | renamed **Bishop Auckland Hospital** (the sheet's own title) |
| Name the trust no longer uses | Newham ("Newham Hospital"), Tunbridge Wells (no leading "The"), Princess of Wales **Community** Hospital, West Park **Rehabilitation** Hospital | renamed |
| Subtitle had no trust name or postcode | Addenbrooke's (`cuh`) | trust and Hills Road CB2 0QQ added |
| Street address missing from the subtitle | 18 sheet venues | added from the trust's page (Arden Street, Hardwick Road, Hermitage Lane, Woodrow Drive, 369 Fulham Road, Marton Road, …) |
| The sheet pre-dates a change to the site | see below | the change is recorded in the venue's notes, shown on its header |
| Postcode centroid ~1 km from the venue centre, no hospital point found | Trafford, Broomfield | **not moved**: a large-user postcode's centroid is often the delivery office, and the in-repo ODS geocode is the same centroid; needs a hospital point from Wikipedia or OpenStreetMap |
| Map in use superseded on the trust's site | Tunbridge Wells (Oct 2024 "Welcome to Tunbridge Wells Hospital" map), MRI Oxford Road (Feb 2025 campus map), Wythenshawe (Dec 2025), GOSH (Dec 2020 map pre-dates the entrance closure) | recorded below for the next ingest |

### Changes on the ground that the sheets do not show

Recorded in each venue's notes (`data/venue-identity.json` carries the
sources); the pins themselves still follow the sheet.

- **Manchester Royal Infirmary** — the Emergency Department and Urgent
  Treatment Centre entrances moved to a temporary building outside MRI
  Outpatients by Grafton Street car park for the Project RED rebuild (due
  summer 2026). The A&E pin now says so.
- **Great Ormond Street** — the Great Ormond Street entrance is closed for
  the Children's Cancer Centre build; the main entrance is the Morgan
  Stanley Clinical Building on Guilford Street, which is where this venue's
  Main Entrance already sits.
- **University Hospital of North Tees** — the 2019 sheet (still the one the
  trust links) pre-dates the Emergency Assessment Unit (October 2025) and
  the new urgent and emergency care entrance.
- **Pilgrim Hospital, Boston** — the Emergency Department is being rebuilt
  in phases (May 2025, October 2025, remodelling through 2026).
- **The Queen Elizabeth Hospital, King's Lynn** — helipad moved January
  2026; new bus stop by the entrance May 2026; multi-storey car park under
  construction from June 2026; hospital to be replaced by 2030.
- **St Mary's, Paddington** — main outpatients building due to close by
  March 2026; structural problems in the Mint building (late 2025); a new
  hospital planned on the east of the estate.
- **Whipps Cross** — 500-space multi-storey car park opened November 2025 by
  the main entrance; rebuild from 2027.
- **Stratford Hospital** and **Friarage Hospital** — a new diagnostic centre
  (July 2025) and a new surgical centre (June 2025) respectively, both
  already on the July 2025 sheets in use.

### Maps the trusts publish now

Leads for the ingestion pipeline once it can reach the internet: each is a
URL seen in search results, not a fetched file, and several venues here have
never had a sheet (hand-built from an isometric or schematic drawing).

| Venue | Lead |
| --- | --- |
| `basildon-hospital` (hand-built) | mse.nhs.uk `basildon-hospital-map-level-by-level.pdf` — level-by-level floor map |
| `broomfield-hospital` (hand-built) | mse.nhs.uk `broomfield-wayfinding-leaflet.pdf` |
| `king-george-hospital` (hand-built, 2 floors) | bhrhospitals.nhs.uk `king-george-hospital-map.pdf` — ground and first floor plans |
| `queens-hospital-romford` (hand-built) | bhrhospitals.nhs.uk "Maps of our hospitals" — Queen's Hospital Map PDF |
| `newham-university-hospital` (hand-built) | bartshealth.nhs.uk `newham-ext-map.pdf` (zones 1–12) and the "Know your way around" leaflet |
| `royal-london-hospital` (hand-built) | bartshealth.nhs.uk `the-royal-london-hospital-lift-map.pdf` |
| `queen-marys-roehampton` (hand-built, grade F) | stgeorges.nhs.uk `Queen-Marys-Hospital-map.pdf` (November 2023) |
| `st-marys-paddington` (hand-built) | imperial.nhs.uk `smh-map.pdf` (February 2024) |
| `charing-cross`, `hammersmith`, `qcch`, `western-eye` | imperial.nhs.uk site-map pages (Charing Cross `charing-cross.pdf`; Hammersmith map updated November 2024) |
| `oxford-road` | mft.nhs.uk `ORC-map-with-directory-Feb-25.pdf` (February 2025) — supersedes the 2019 sheet |
| `wythenshawe` | mft.nhs.uk `wythenshawe-hospital-sitemap-updated-logo.pdf` (December 2025) |
| `trafford` | mft.nhs.uk `Trafford-General-Hospital-map.pdf` (June 2025) |
| `nmgh` | mft.nhs.uk `NMGH-hosptial-map.pdf` (2021; the misspelling is the trust's) |
| `tunbridge-wells-hospital-mappdf` | mtw.nhs.uk `787_Tunbridge_Wells_Hospital_Map_V1.pdf` (October 2024) and a March 2026 car-park map |
| `cuh` / `level-3-floorplan-cuh-map` | cuh.nhs.uk Level 2 (`Level-2-Floor-Plan-Tagged.pdf`) and Level 3 plans, and an A0 outpatients map of five levels |
| `princess-anne-hospital` | uhs.nhs.uk "Site maps and accessibility guides to Princess Anne Hospital" — per-level maps (the C-level file in use was not found) |
| `lincoln-county-hospital` | ulh.nhs.uk labelled level 1 and level 2 maps (October 2024); the level-2 sheet in use is the *blank* variant |
| `derriford-hospital-site-mappdf` | plymouthhospitals.nhs.uk "Finding your way around Derriford" — per-level floor maps, levels 2–9 |
| `gosh` | gosh.nhs.uk "Finding your way around GOSH" (the December 2020 main map pre-dates the entrance closure) |
| `st-georges` | stgeorges.nhs.uk "Find your way around our hospitals" — the trust's own digital wayfinding, launched 2026 |
| `trust-map-june-2026` | the June 2026 file in use was not indexed; qehkl.nhs.uk `QEH-Trust-Map-June-2025.pdf` is the latest search could see |
| `university-hospital-lewisham`, `queen-elizabeth-hospital-woolwich` | lewishamandgreenwich.nhs.uk "Maps of our hospitals" |
| `bwh` | no PDF: the trust's Getting here page is an interactive map |

### Every venue

*Position* is the distance between the venue's centre and the coordinate a
source printed: a hospital point (Wikipedia, Google) or the postcode's
centroid. Under 100 m is agreement; a large-user postcode's centroid can sit
hundreds of metres from the buildings, so a ⚠ on a centroid is a question,
not a verdict. *Map in use* is whether the sheet's source URL is still what
the trust links (current), replaced (superseded) or not confirmed (unknown).

| Venue | Checked | Position | Trust and address | Map in use | Current maps found | Acted on |
| --- | --- | --- | --- | --- | --- | --- |
| `a5-site-map-of-stratford-hospital-july-2025-update` | yes (medium) | 0 m from postcode centroid | as recorded | unknown | — | address |
| `alex-map-a4` | yes (medium) | 2 m from postcode centroid | name 'Alexandra Hospital' vs web 'Alexandra Hospital, Redditch' | unknown | [site map, upload path dated 2016/07; n](https://www.worcsacute.nhs.uk/devuret/2016/07/Alex_Map_A4.pdf)<br>[site map](https://www.worcsacute.nhs.uk/documents/maps/2148-alexandra-hospital-map/)<br>[floor plan](https://www.worcsacute.nhs.uk/images/pdf/alex-floor.pdf) | address |
| `basildon-hospital` | yes (medium) | 668 m from hospital point ⚠ | name 'Basildon & Thurrock University Hospital' vs web 'Basildon University Hospital' | unknown | [floor plan, ver=42880](https://www.mse.nhs.uk/download/basildon-hospital-map-level-by-level.pdf?ver=42880&doc=docm93jijm4n4732.pdf) | renamed, moved, address |
| `bishop-auckland-floor-plan-2023` | yes (low) | 0 m from postcode centroid | name 'Bishop Auckland CDC' vs web 'Bishop Auckland Hospital' | unknown | — | renamed, address, notes |
| `broomfield-hospital` | yes (medium) | 938 m from postcode centroid ⚠ | as recorded | unknown | [site map, URL version param ver=23291;](https://www.mse.nhs.uk/download/broomfield-wayfinding-leaflet.pdf?ver=23291&doc=docm93jijm4n1495.pdf) | — |
| `bwh` | yes (medium) | 63 m from postcode centroid | as recorded | unknown | [interactive map](https://bwc.nhs.uk/getting-here/) | — |
| `charing-cross` | yes (high) | 1 m from postcode centroid | as recorded | unknown | [site map, page last updated 3 May 2024](https://www.imperial.nhs.uk/our-locations/charing-cross-hospital/site-map)<br>[site map](https://www.imperial.nhs.uk/-/media/website/locations/charing-cross-hospital/charing-cross.pdf?rev=98fcc3ac5b974077ba92dd8bfa1dbebe&hash=F7DCD11149C6B1CCB8ABED599F72E03C) | — |
| `chelsea-and-westminster-hospital-site-map` | yes (high) | 2 m from postcode centroid | as recorded | current | [site map](https://www.chelwest.nhs.uk/your-visit/getting-here/links/Chelsea-and-Westminster-Hospital-Site-Map.pdf)<br>[floor plan](https://www.chelwest.nhs.uk/your-visit/links/CW-Ground-Floor-Map.pdf)<br>[site map](https://www.chelwest.nhs.uk/your-visit/getting-here/links/map.svg) | address |
| `community-diagnostic-centre-site-map` | yes (medium) | 4 m from postcode centroid | as recorded | current | [site map, ver=4688](https://www.midyorks.nhs.uk/download/community-diagnostic-centre-site-map-.pdf?ver=4688&doc=docm93jijm4n3417) | renamed, moved, address, notes |
| `cuh` | yes (medium) | 119 m from hospital point | postcode missing (web: CB20QQ); trust 'Cambridge University Hospitals, Cambridge' vs web 'Cambridge University Hospitals NHS Foundation Trust' | unknown | [floor plan](https://www.cuh.nhs.uk/documents/1199/Level-2-Floor-Plan-Tagged.pdf)<br>[floor plan](https://media.cuh.nhs.uk/documents/Level-2-Floor-Plan-Tagged.pdf)<br>[floor plan](https://www.cuh.nhs.uk/documents/2773/Level_3_Floorplan_-_CUH_Map.pdf) | address |
| `derriford-hospital-site-mappdf` | yes (medium) | 1 m from postcode centroid | as recorded | unknown | [floor plan](https://www.plymouthhospitals.nhs.uk/finding-your-way-at-derriford-hospital/)<br>[site map](https://www.plymouthhospitals.nhs.uk/getting-here/) | address |
| `diana-princess-of-wales-hospital-internal-2d-2025` | yes (medium) | 0 m from postcode centroid | as recorded | unknown | [3D map](https://www.nlg.nhs.uk/resources/hospital-maps/)<br>[floor plan, 2025 (filename)](https://www.nlg.nhs.uk/wp-content/uploads/2023/03/Diana-Princess-of-Wales-Hospital-internal-2D-2025.pdf) | address |
| `ealing-hospital-site-map` | yes (medium) | 2 m from postcode centroid | as recorded | current | [site map, ?ver=39311 (no year printed ](https://www.lnwh.nhs.uk/download/ealing-hospital-site-map.pdf?ver=39311) | address |
| `fordcombe-hospital-mappdf` | yes (medium) | 0 m from postcode centroid | as recorded | unknown | [floor plan](https://www.mtw.nhs.uk/fordcombe-hospital/) | address |
| `friarage-site-map-july-2025` | yes (high) | 26 m from hospital point | as recorded | current | [site map, July 2025 (resource page las](https://www.southtees.nhs.uk/wp-content/uploads/2025/07/Friarage-Site-Map-July-2025.pdf)<br>[site map](https://www.southtees.nhs.uk/hospitals/friarage/friarage-surgical-hub/map-and-directions/) | renamed, address, notes |
| `gosh` | yes (high) | 44 m from postcode centroid | as recorded | unknown | [site map](https://www.gosh.nhs.uk/patients-and-families/your-hospital-visit/finding-your-way-around-gosh/)<br>[floor plan, December 2020](https://www.gosh.nhs.uk/documents/8567/GOSH_Main_Map_December_2020_2Pages.pdf)<br>[3D map](https://www.gosh.nhs.uk/wayfinder-hospital/) | — |
| `grantham-and-district-hospital-map` | yes (high) | 1 m from postcode centroid | trust 'United Lincolnshire Teaching Hospitals NHS Trust' vs web 'United Lincolnshire Teaching Hospitals NHS Trust (part of Lincolnshire Community and Hospitals  | current | [site map, uploaded March 2026](https://www.ulh.nhs.uk/wp-content/uploads/2026/03/Grantham-and-District-Hospital-map.pdf)<br>[site map](https://www.ulh.nhs.uk/hospitals/grantham-district/map/grantham-and-district-hospital-map/)<br>[floor plan](https://www.ulh.nhs.uk/hospitals/grantham-district/map/grantham-2d_new/) | address |
| `hammersmith` | yes (high) | 1 m from postcode centroid | as recorded | unknown | [site map, Page last updated 20 Novembe](https://www.imperial.nhs.uk/our-locations/hammersmith-hospital/site-map)<br>[site map](https://www.imperial.nhs.uk/~/media/website/locations/hammersmith-hospital/hammersmith-hospital-location-map.pdf?la=en) | — |
| `hospital-map-external-2025` | yes (medium) | 0 m from postcode centroid | as recorded | unknown | — | address |
| `hull-royal-infirmary-site-map` | yes (medium) | 2511 m from hospital point ⚠ | postcode HU46BN → HU32JZ | current | [site map, uploaded 2024/04 (from URL p](https://www.hey.nhs.uk/wp/wp-content/uploads/2024/04/Hull-Royal-Infirmary-Site-Map.pdf)<br>[site map](https://www.hey.nhs.uk/downloads/pathology-location-map/) | moved, address, notes |
| `internal-site-map-north-tees-2019` | yes (high) | 0 m from postcode centroid | trust 'North Tees and Hartlepool NHS Foundation Trust' vs web 'North Tees and Hartlepool NHS Foundation Trust (part of the University Hospitals Tees hospital gr | current | [site map](https://www.nth.nhs.uk/locations/north-tees/hospital-map/)<br>[floor plan, 2019 (uploaded July 2022)](https://www.nth.nhs.uk/wp-content/uploads/2022/07/Internal-site-map-north-tees-2019.pdf)<br>[site map, 2019 (uploaded July 2022)](https://www.nth.nhs.uk/wp-content/uploads/2022/07/External-site-map-north-tees-2019.pdf) | address, notes |
| `james-cook-campus-map-jul25` | yes (high) | 4 m from postcode centroid | as recorded | current | [site map, July 2025 (resource page las](https://www.southtees.nhs.uk/wp-content/uploads/2025/07/James-Cook-campus-map-Jul25.pdf) | address |
| `jr-hospital-sitemap` | yes (high) | 2 m from postcode centroid | as recorded | current | [site map](https://www.ouh.nhs.uk/media/1xbo2yli/jr-hospital-sitemap.pdf)<br>[site map, July 2024](https://www.ouh.nhs.uk/hospitals/jr/documents/jr-hospital-sitemap.pdf) | address, notes |
| `king-george-hospital` | yes (medium) | 61 m from hospital point | trust 'Barking, Havering and Redbridge University Hospitals NHS Trust' vs web 'Barking, Havering and Redbridge University Hospitals NHS Trust (BHRUT; since 2023 | unknown | [floor plan, ver=16595](https://www.bhrhospitals.nhs.uk/download/king-george-hospital-map.pdf?ver=16595&doc=docm93jijm4n6775.pdf)<br>[site map](https://www.bhrhospitals.nhs.uk/maps-of-our-hospitals-/)<br>[site map](https://www.bhrhospitals.nhs.uk/king-george-hospital/) | — |
| `level-3-floorplan-cuh-map` | yes (medium) | 195 m from postcode centroid | name 'Addenbrooke's Hospital — Level 3' vs web 'Addenbrooke's Hospital' | unknown | [interactive map](https://www.cuh.nhs.uk/visiting-our-hospitals/finding-your-way-around/)<br>[floor plan](https://www.cuh.nhs.uk/documents/1199/Level-2-Floor-Plan-Tagged.pdf)<br>[floor plan](https://media.cuh.nhs.uk/documents/Level-2-Floor-Plan-Tagged.pdf) | renamed, moved, address, notes |
| `lincoln-county-hospital` | yes (medium) | 0 m from postcode centroid | trust 'United Lincolnshire Teaching Hospitals NHS Trust' vs web 'United Lincolnshire Teaching Hospitals NHS Trust (site branded 'United Lincolnshire Hospitals'  | current | [site map](https://www.ulh.nhs.uk/hospitals/lincoln-county/map/)<br>[floor plan, uploaded 2024/10](https://www.ulh.nhs.uk/wp-content/uploads/2024/10/Lincoln-hospital-map-level-1.pdf)<br>[floor plan](https://www.ulh.nhs.uk/hospitals/lincoln-county/map/lincoln-hospital-map-level-1/) | — |
| `lister-map-2026` | yes (medium) | 54 m from hospital point | as recorded | current | [site map, 2026 V1 (uploaded 2026/07)](https://www.enherts-tr.nhs.uk/wp-content/uploads/2026/07/Lister-Map-2026.pdf)<br>[site map, 2019/09 upload (older editio](https://www.enherts-tr.nhs.uk/wp-content/uploads/2019/09/Lister-Maps.pdf) | renamed, address, notes |
| `maidstone-hospital-mappdf` | yes (medium) | 0 m from postcode centroid | as recorded | unknown | [floor plan](https://www.mtw.nhs.uk/maidstone-hospital/)<br>[site map, 2021](https://www.mtw.nhs.uk/wp-content/uploads/2022/01/OHD-LOCATION-MAP-MS-2021.pdf) | address |
| `mile-end-hospital` | yes (medium) | 1 m from postcode centroid | as recorded | unknown | — | — |
| `newham-university-hospital` | yes (high) | 1 m from postcode centroid | as recorded | unknown | [site map, ver=958](https://www.bartshealth.nhs.uk/download/newham-ext-map.pdf?ver=958)<br>[floor plan, ver=59748](https://www.bartshealth.nhs.uk/download/1316-know-your-way-around-newham-university-hospital.pdf?ver=59748) | renamed, address |
| `ngh-hospital-map` | yes (medium) | 2 m from postcode centroid | trust 'Northampton General Hospital NHS Trust' vs web 'Northampton General Hospital NHS Trust (part of University Hospitals of Northamptonshire NHS Group with K | current | [site map](https://www.northamptongeneral.nhs.uk/Downloads/NGH-Hospital-Map.pdf)<br>[site map, Jan 2019](https://www.northamptongeneral.nhs.uk/Find-Your-Way-Around/Downloads/Hospital-Map-Updated-Jan-2019.pdf) | address, notes |
| `nmgh` | yes (medium) | 2 m from postcode centroid | as recorded | unknown | [site map](https://mft.nhs.uk/north-manchester-general-hospital/patients-visitors/getting-here/hospital-map/)<br>[site map, Uploaded March 2021 (from UR](https://mft.nhs.uk/app/uploads/sites/15/2021/03/NMGH-hosptial-map.pdf) | — |
| `noc-site-map` | yes (medium) | 0 m from postcode centroid | as recorded | current | [site map](https://www.ouh.nhs.uk/hospitals/noc/find-us/)<br>[site map](https://www.ouh.nhs.uk/media/j11mwraw/noc-site-map.pdf)<br>[site map](https://www.ouh.nhs.uk/hospitals/noc/documents/noc-site-map.pdf) | address |
| `oxford-road` | yes (high) | 149 m from postcode centroid | name 'Manchester Royal Infirmary — Oxford Road Campus' vs web 'Manchester Royal Infirmary (MFT Oxford Road Campus)' | unknown | [site map, February 2025](https://mft.nhs.uk/app/uploads/2025/03/ORC-map-with-directory-Feb-25.pdf)<br>[site map, 2019 update, V2](https://mft.nhs.uk/app/uploads/2018/11/MFTMap_Flat_Update2019_External_V2.pdf) | notes |
| `pilgrim-ground-floor` | yes (medium) | 6 m from postcode centroid | as recorded | unknown | [floor plan](https://www.ulh.nhs.uk/hospitals/pilgrim-hospital-boston/map/pilgrim-ground-floor/)<br>[site map](https://www.ulh.nhs.uk/hospitals/pilgrim-hospital-boston/map/) | renamed, address, notes |
| `pinderfields-hospital-map` | yes (high) | 152 m from postcode centroid | as recorded | current | [site map, ver=6094](https://www.midyorks.nhs.uk/download/pinderfields-hospital-map.pdf?ver=6094&doc=docm93jijm4n3551.pdf) | renamed, moved, address, notes |
| `princess-anne-hospital` | yes (medium) | 6 m from hospital point | as recorded | unknown | [floor plan](https://www.uhs.nhs.uk/for-visitors/princess-anne-hospital/site-maps-and-accessible-guides-to-princess-anne-hospital)<br>[floor plan](https://www.uhs.nhs.uk/Media/SUHTInternet/HowToFindUs/PAHfloorlevelmaps/PAH-DlevelFloorPlanNew.pdf)<br>[interactive map](https://www.accessable.co.uk/university-hospital-southampton-nhs-foundation-trust/access-guides/princess-anne-hospital) | address, notes |
| `princess-of-wales-community-hospital-site-map` | yes (high) | 0 m from postcode centroid | name 'Princess of Wales Hospital' vs web 'Princess of Wales Community Hospital' | current | [site map, URL version param ver=39099;](https://www.hacw.nhs.uk/download/princess-of-wales-community-hospital-site-map.pdf?ver=39099&doc=docm93jijm4n21462.pdf) | renamed, address |
| `qcch` | yes (medium) | 71 m from postcode centroid | as recorded | unknown | [site map](https://www.imperial.nhs.uk/our-locations/queen-charlottes-and-chelsea-hospital/site-map)<br>[site map](https://www.imperial.nhs.uk/our-locations/queen-charlottes-and-chelsea-hospital/find-us) | — |
| `queen-marys-roehampton` | yes (high) | 1 m from postcode centroid | as recorded | unknown | [floor plan, uploaded November 2023](https://www.stgeorges.nhs.uk/wp-content/uploads/2023/11/Queen-Marys-Hospital-map.pdf)<br>[site map, uploaded November 2013](https://www.stgeorges.nhs.uk/wp-content/uploads/2013/11/QMH_public_transport.pdf) | — |
| `queens-hospital-romford` | yes (medium) | 110 m from hospital point | name 'Queen's Hospital, Romford' vs web 'Queen's Hospital' | unknown | [site map](https://www.bhrhospitals.nhs.uk/maps-of-our-hospitals-/) | — |
| `royal-london-hospital` | yes (medium) | 111 m from hospital point | as recorded | unknown | [floor plan, ver=29539](https://www.bartshealth.nhs.uk/download/the-royal-london-hospital-lift-map.pdf?ver=29539) | — |
| `sgh-site-map` | yes (medium) | 56 m from postcode centroid | trust 'St George's University Hospitals NHS Foundation Trust' vs web 'St George's University Hospitals NHS Foundation Trust (part of St George's, Epsom and St H | current | [site map, wp upload path 2013/11](https://www.stgeorges.nhs.uk/wp-content/uploads/2013/11/sgh-site-map.pdf)<br>[site map, wp upload path 2013/11](https://www.stgeorges.nhs.uk/wp-content/uploads/2013/11/sgh-map-landscape.pdf)<br>[site map](https://www.sgkpa.org.uk/main/hospital-site-map-download-or-print) | renamed, moved, address, notes |
| `site-1253769-hull-teaching-castle-hill-map` | yes (medium) | 6 m from postcode centroid | as recorded | unknown | [site map](https://www.hey.nhs.uk/getting-to-our-hospitals/) | address |
| `site-6458-west-park-rehabilitation-hospital` | yes (high) | 0 m from postcode centroid | name 'West Park Hospital' vs web 'West Park Rehabilitation Hospital' | current | [site map, artwork dated 10.04.17 V2; u](https://royalwolverhampton.nhs.uk/wp-content/uploads/2024/11/6458_West_Park_Rehabilitation_Hospital.pdf)<br>[site map](https://www.royalwolverhampton.nhs.uk/contact-us/travel-to-west-park-rehabilitation-hospital.html) | renamed, address |
| `st-georges` | yes (high) | 56 m from postcode centroid | name 'St George's Hospital, Tooting' vs web 'St George's Hospital' | unknown | [interactive map, launched 2026 (news July 202](https://www.stgeorges.nhs.uk/contact-and-find-us/find-your-way/)<br>[site map, uploaded November 2013; cont](https://www.stgeorges.nhs.uk/wp-content/uploads/2013/11/sgh-site-map.pdf) | — |
| `st-marys-paddington` | yes (medium) | 1 m from postcode centroid | name 'St Mary's Hospital, Paddington' vs web 'St Mary's Hospital' | unknown | [site map, Update: February 2024](https://www.imperial.nhs.uk/~/media/website/locations/st-marys-hospital/smh-map.pdf)<br>[site map, page last updated November 2](https://www.imperial.nhs.uk/our-locations/st-marys-hospital/site-map)<br>[site map](https://www.imperial.nhs.uk/~/media/website/locations/st-marys-hospital/st-marys-site-map.pdf) | notes |
| `trafford` | yes (medium) | 1024 m from postcode centroid ⚠ | as recorded | unknown | [site map](https://mft.nhs.uk/trafford/patients-visitors/getting-here/hospital-map/)<br>[site map, uploaded June 2025](https://mft.nhs.uk/app/uploads/2025/06/Trafford-General-Hospital-map.pdf)<br>[site map, November 2024 (uploaded Marc](https://mft.nhs.uk/app/uploads/2025/03/TGHMap_Update_Nov2024_730x990mm-A.pdf) | — |
| `trust-map-june-2026` | yes (medium) | 28 m from hospital point | as recorded | unknown | [site map, June 2025](https://www.qehkl.nhs.uk/Document/QEH-Trust-Map-June-2025.pdf)<br>[site map, July 2022](http://www.qehkl.nhs.uk/Document/QEH_TRUST_MAP_FIRST_JULY%202022.pdf)<br>[site map](https://www.qehkl.nhs.uk/your-visit/finding-your-way-around/) | renamed, address, notes |
| `tunbridge-wells-hospital-mappdf` | yes (medium) | 5 m from postcode centroid | as recorded | superseded | [floor plan, V1, uploaded October 2024 (f](https://www.mtw.nhs.uk/wp-content/uploads/2024/10/787_Tunbridge_Wells_Hospital_Map_V1.pdf)<br>[site map, Uploaded March 2026 (from UR](https://www.mtw.nhs.uk/wp-content/uploads/2026/03/Tunbridge-Wells-Hospital-care-park-map.pdf)<br>[site map, Uploaded September 2022 (fro](https://www.mtw.nhs.uk/wp-content/uploads/2022/09/Tunbridge-Wells-Hospital-car-parking-map.pdf) | renamed, address |
| `university-hospital-lewisham` | yes (medium) | 158 m from postcode centroid | as recorded | unknown | [site map](https://www.lewishamandgreenwich.nhs.uk/map-of-the-hospital/) | — |
| `whipps-cross-hospital` | yes (medium) | 5 m from postcode centroid | name 'Whipps Cross Hospital' vs web 'Whipps Cross Hospital (CQC/NHS.uk location name: Whipps Cross University Hospital)' | unknown | — | notes |
| `whiston-site-map-full-site` | yes (medium) | 4 m from postcode centroid | as recorded | current | [site map](https://sthk.merseywestlancs.nhs.uk/media/PDFs/Maps/Whiston%20Site%20Map%20(Full%20Site).pdf)<br>[floor plan](https://sthk.merseywestlancs.nhs.uk/media/PDFs/Maps/Whiston-Floor-Map.pdf) | address |
| `wythenshawe` | yes (high) | 104 m from postcode centroid | as recorded | unknown | [site map, uploaded December 2025](https://mft.nhs.uk/app/uploads/sites/10/2025/12/wythenshawe-hospital-sitemap-updated-logo.pdf)<br>[site map, uploaded December 2025](https://mft.nhs.uk/app/uploads/2025/12/Map-Wythenshawe-endoscopy.pdf)<br>[site map, 2015 (uploaded January 2023)](https://mft.nhs.uk/app/uploads/sites/11/2023/01/1Wythenshawe-Map-2015.pdf) | — |
| `ch-hospital-sitemap` | **not reached** (search cap) | — | — | — | — | — |
| `external-site-map-north-tees-2019` | **not reached** (search cap) | — | — | — | — | address |
| `internal-site-map-hartlepool-2018` | **not reached** (search cap) | — | — | — | — | — |
| `macclesfield-district-general-hospital` | **not reached** (search cap) | — | — | — | — | address, notes |
| `northwick-park-hospital-site-map` | **not reached** (search cap) | — | — | — | — | — |
| `ormskirk-site-map-a3` | **not reached** (search cap) | — | — | — | — | address, notes |
| `qehb` | **not reached** (search cap) | — | — | — | — | — |
| `queen-elizabeth-hospital-woolwich` | **not reached** (search cap) | — | — | — | — | — |
| `southport-hospital-site-map-a3-sept-2024` | **not reached** (search cap) | — | — | — | — | renamed, moved, address, notes |
| `st-bartholomews` | **not reached** (search cap) | — | — | — | — | — |
| `west-middlesex-university-hospital-site-map` | **not reached** (search cap) | — | — | — | — | — |
| `western-eye` | **not reached** (search cap) | — | — | — | — | — |
