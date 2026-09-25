# Hospital map review, September 2026

*Reviewed 25 September 2026 from commit `618561a`. Scope: the 67 venues the
app ships, taken one by one — which hospital each sheet draws, whose it is and
where it stands; every one of its 4,287 waypoint labels; and what could be
checked against the internet from this environment. The August review
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
| Venues on the wrong site | 4 | **0** |
| Venues under the wrong trust or a department's name | 10 | **0** |
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

Southport is a fifth, subtler case: `southport-hospital-site-map-a3-sept-2024`
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
| **Alexandra Hospital** `alex-map-a4` | Worcestershire Acute Hospitals NHS Trust | A | 43 → 40 | 1 | 32 | 0 | campus-only | ODS C2P9J | 4 labels out, 1 in |
| **Bishop Auckland CDC** `bishop-auckland-floor-plan-2023` | County Durham and Darlington NHS Foundation Trust | A | 65 → 63 | 1 | 98 | 1 | campus-only | ODS H8C7C | 4 labels out, 2 in |
| **Chelsea & Westminster Hospital** `chelsea-and-westminster-hospital-site-map` | Chelsea and Westminster Hospital NHS Foundation Trust | A | 85 → 82 | 1 | 192 | 0 | campus-only | ODS RQM01 | 6 labels out, 3 in |
| **Churchill Hospital** `ch-hospital-sitemap` | Oxford University Hospitals NHS Foundation Trust | A | 75 → 73 | 1 | 178 | 1 | campus-only | ODS RTH02 | 2 labels out, 0 in |
| **Great Ormond Street Hospital** `gosh` | Great Ormond Street Hospital for Children NHS Foundation Trust | A | 285 | 10 | 146 | 0 | — | hand-built, verified | — |
| **Lincoln County Hospital** `lincoln-county-hospital` | United Lincolnshire Teaching Hospitals NHS Trust | A | 100 → 97 | 3 | 88 | 5 → 4 | floor-without-corridors | ODS A3D1D | 4 labels out, 2 in |
| **Lister Hospital** `lister-map-2026` | East and North Hertfordshire Teaching NHS Trust | A | 140 → 136 | 1 | 4 | 3 → 1 | campus-only | ODS RWHDD | renamed from “The Lister Hospital Surgicentre”; trust/address corrected; 11 labels out, 7 in |
| **Maidstone Hospital** `maidstone-hospital-mappdf` | Maidstone and Tunbridge Wells NHS Trust | A | 19 | 1 | 50 | 0 | campus-only | ODS RWFXC | — |
| **Northampton General Hospital** `ngh-hospital-map` | Northampton General Hospital NHS Trust | A | 106 → 101 | 1 | 161 | 1 → 0 | campus-only | ODS RP1M4 | trust corrected; 5 labels out, 0 in |
| **Nuffield Orthopaedic Centre** `noc-site-map` | Oxford University Hospitals NHS Foundation Trust | B → **A** | 47 → 45 | 1 | 47 | 1 → 0 | campus-only | ODS RTH03 | 3 labels out, 1 in |
| **Pilgrim Hospital, Boston** `pilgrim-ground-floor` | United Lincolnshire Teaching Hospitals NHS Trust | A | 40 | 1 | 105 | 1 → 0 | campus-only | ODS RWD2A | renamed from “Pilgrim A&E”; trust/address corrected; 2 labels out, 2 in |
| **Princess Anne Hospital** `princess-anne-hospital` | University Hospital Southampton NHS Foundation Trust | A | 74 → 71 | 6 | 36 | 0 | no-exit | ODS R1C36 | trust corrected; 1 label out, 0 in |
| **The James Cook University Hospital** `james-cook-campus-map-jul25` | South Tees Hospitals NHS Foundation Trust | A | 200 → 195 | 1 | 31 | 2 → 0 | campus-only | ODS RTRAT | 7 labels out, 2 in |
| **The Tunbridge Wells Hospital** `tunbridge-wells-hospital-mappdf` | Maidstone and Tunbridge Wells NHS Trust | A | 77 → 72 | 1 | 98 | 2 → 1 | campus-only | ODS RWFTW | 5 labels out, 0 in |
| **University Hospital of Hartlepool** `internal-site-map-hartlepool-2018` | North Tees and Hartlepool NHS Foundation Trust | A | 78 → 71 | 1 | 190 | 5 → 2 | campus-only | ODS RVWHD | 7 labels out, 0 in |
| **University Hospital of North Tees** `internal-site-map-north-tees-2019` | North Tees and Hartlepool NHS Foundation Trust | A | 132 → 130 | 1 | 279 | 2 | campus-only | ODS RVWND | 2 labels out, 0 in |
| **University Hospital of North Tees — Grounds & Car Parks** `external-site-map-north-tees-2019` | North Tees and Hartlepool NHS Foundation Trust | A | 124 → 120 | 1 | 112 | 1 | campus-only | ODS RVWND | 4 labels out, 0 in |
| **Western Eye Hospital** `western-eye` | Imperial College Healthcare NHS Trust | A | 11 | 1 | 10 | 2 → 0 | campus-only | hand-anchored sheet | 2 labels out, 2 in |
| **Basildon & Thurrock University Hospital** `basildon-hospital` | Mid and South Essex NHS Foundation Trust | B | 37 | 4 | 212 | 0 | no-vertical-circulation | hand-built | — |
| **Birmingham Women's Hospital** `bwh` | Birmingham Women's and Children's NHS FT | B | 25 → 22 | 1 | 13 | 1 | campus-only | hand-anchored sheet | 3 labels out, 0 in |
| **Charing Cross Hospital** `charing-cross` | Imperial College Healthcare NHS Trust | B | 32 | 1 | 48 | 1 | campus-only | hand-anchored sheet | — |
| **Grantham & District Hospital** `grantham-and-district-hospital-map` | United Lincolnshire Teaching Hospitals NHS Trust | B | 43 | 1 | 249 | 1 | campus-only | ODS RWDLP | — |
| **Hammersmith Hospital** `hammersmith` | Imperial College Healthcare NHS Trust | B | 24 | 1 | 27 | 1 | campus-only | hand-anchored sheet | — |
| **Hull Royal Infirmary** `hull-royal-infirmary-site-map` | Hull University Teaching Hospitals NHS Trust | B | 27 → 26 | 1 | 42 | 0 | campus-only | ODS A7G4P | 1 label out, 0 in |
| **Newham University Hospital** `newham-university-hospital` | Barts Health NHS Trust | B | 122 | 4 | 172 | 5 | no-vertical-circulation | hand-built | — |
| **North Manchester General Hospital** `nmgh` | Manchester University NHS FT | B | 14 | 1 | 75 | 0 | campus-only | hand-anchored sheet | — |
| **Queen Charlotte's & Chelsea Hospital** `qcch` | Imperial College Healthcare NHS Trust | B | 18 | 1 | 28 | 0 | campus-only | hand-anchored sheet | — |
| **Queen Elizabeth Hospital Birmingham** `qehb` | University Hospitals Birmingham NHS FT | B | 30 | 1 | 84 | 2 | campus-only | hand-anchored sheet | — |
| **Stratford Hospital** `a5-site-map-of-stratford-hospital-july-2025-update` | South Warwickshire University NHS Foundation Trust | B | 29 → 25 | 1 | 82 | 2 → 0 | campus-only | ODS RJC03 | 5 labels out, 1 in |
| **Trafford General Hospital** `trafford` | Manchester University NHS FT | B | 22 | 1 | 112 | 0 | campus-only | hand-anchored sheet | — |
| **Wythenshawe Hospital** `wythenshawe` | Manchester University NHS FT | B | 22 | 1 | 83 | 0 | campus-only | hand-anchored sheet | — |
| **Addenbrooke's Hospital** `cuh` | Cambridge University Hospitals, Cambridge | C | 36 | 5 | 0 | 0 | no-corridors | hand-built | — |
| **Addenbrooke's Hospital — Level 3** `level-3-floorplan-cuh-map` | Cambridge University Hospitals NHS Foundation Trust | C | 15 → 13 | 1 | 0 | 0 | no-corridors | ODS B5D1I | renamed from “Cuh at Doddington Hospital”; moved to the right site; re-storeyed to Level 3; trust/address corrected; 4 labels out, 2 in |
| **Cannery Trails Wayfinder** `cannery-trails` | Mixed-use residential building, Williamson St | C | 47 | 3 | 0 | 4 | no-corridors | hand-built | — |
| **Fordcombe Hospital** `fordcombe-hospital-mappdf` | Maidstone and Tunbridge Wells NHS Trust | C | 17 → 15 | 1 | 0 | 0 | no-corridors | ODS O1Q2M | 2 labels out, 0 in |
| **Macclesfield District General Hospital** `macclesfield-district-general-hospital` | East Cheshire NHS Trust | C | 66 → 62 | 2 | 70 | 4 → 2 | no-vertical-circulation | ODS R0A73 | trust corrected; 3 labels out, 0 in |
| **Princess of Wales Hospital** `princess-of-wales-community-hospital-site-map` | Herefordshire and Worcestershire Health and Care NHS Trust | C | 17 → 15 | 1 | 0 | 1 | no-corridors | ODS R1ACG | 2 labels out, 0 in |
| **Wakefield Community Diagnostic Centre** `community-diagnostic-centre-site-map` | Mid Yorkshire Teaching NHS Trust | B → **C** | 18 → 9 | 1 | 5 | 1 → 0 | campus-only | ODS P6M3A | renamed from “Dewsbury & District Hospital-Combined Elective Surgical Hub”; moved to the right site; rescaled; trust/address corrected; 10 labels out, 1 in |
| **Whiston Hospital** `whiston-site-map-full-site` | Mersey and West Lancashire Teaching Hospitals NHS Trust | D → **C** | 35 → 30 | 1 | 0 | 1 → 0 | no-corridors | ODS M8D6F | 6 labels out, 1 in |
| **Castle Hill Hospital** `site-1253769-hull-teaching-castle-hill-map` | Hull University Teaching Hospitals NHS Trust | D | 118 → 116 | 1 | 0 | 0 | no-corridors | ODS G4V1I | 2 labels out, 0 in |
| **Derriford Hospital** `derriford-hospital-site-mappdf` | University Hospitals Plymouth NHS Trust | D | 66 → 62 | 1 | 0 | 10 → 1 | no-corridors | ODS RK9A9 | 10 labels out, 6 in |
| **Diana, Princess of Wales Hospital** `diana-princess-of-wales-hospital-internal-2d-2025` | Northern Lincolnshire and Goole NHS Foundation Trust | E → **D** | 47 | 1 | 0 | 1 | no-corridors | ODS RJL30 | — |
| **John Radcliffe Hospital** `jr-hospital-sitemap` | Oxford University Hospitals NHS Foundation Trust | D | 69 → 66 | 1 | 0 | 1 → 0 | no-corridors | ODS RBF34 | trust corrected; 4 labels out, 1 in |
| **Medway Maritime Hospital** `hospital-map-external-2025` | Medway NHS Foundation Trust | E → **D** | 49 → 46 | 1 | 0 | 5 → 0 | no-corridors | ODS RPAP1 | 5 labels out, 2 in |
| **Mile End Hospital** `mile-end-hospital` | Barts Health NHS Trust | D | 56 | 1 | 0 | 0 | no-corridors | hand-built | — |
| **Pinderfields Hospital** `pinderfields-hospital-map` | Mid Yorkshire Teaching NHS Trust | E → **D** | 24 → 15 | 1 | 0 | 0 | no-corridors | ODS P6M3A | renamed from “Pinderfields Hospital”; moved to the right site; trust/address corrected; 16 labels out, 7 in |
| **Queen's Hospital, Romford** `queens-hospital-romford` | Barking, Havering and Redbridge University Hospitals NHS Trust | D | 39 | 5 | 180 | 2 | no-vertical-circulation | hand-built | — |
| **Southport and Formby District General Hospital** `southport-hospital-site-map-a3-sept-2024` | Mersey and West Lancashire Teaching Hospitals NHS Trust | D | 73 → 67 | 1 | 0 | 0 | no-corridors | ODS RVY03 | renamed from “Southport General Infirmary”; moved to the right site; rescaled; trust/address corrected; 6 labels out, 0 in |
| **St Bartholomew's Hospital** `st-bartholomews` | Barts Health NHS Trust | D | 74 | 1 | 0 | 4 | no-corridors | hand-built | — |
| **St George's Hospital, Tooting** `st-georges` | St George's University Hospitals NHS Foundation Trust | E → **D** | 208 → 206 | 7 | 0 | 2 → 0 | no-corridors | hand-built, verified | 1 label out, 0 in |
| **St George's Hospital, Tooting — Grounds & Car Parks** `sgh-site-map` | St George's University Hospitals NHS Foundation Trust | D | 147 → 157 | 1 | 0 | 3 → 1 | no-corridors | ODS D3X3Z | renamed from “St Georges at Woking Hospital”; moved to the right site; rescaled; trust/address corrected; 8 labels out, 18 in |
| **The Queen Elizabeth Hospital, King's Lynn** `trust-map-june-2026` | The Queen Elizabeth Hospital King's Lynn NHS Foundation Trust | D | 90 → 89 | 1 | 0 | 2 → 0 | no-corridors | ODS RCX70 | renamed from “The Queen Elizabeth Hospital”; trust/address corrected; 5 labels out, 3 in |
| **The Royal London Hospital** `royal-london-hospital` | Barts Health NHS Trust | D | 36 | 1 | 0 | 0 | no-corridors | hand-built | — |
| **West Middlesex University Hospital** `west-middlesex-university-hospital-site-map` | Chelsea and Westminster Hospital NHS Foundation Trust | D | 201 → 197 | 1 | 0 | 1 → 0 | no-corridors | ODS RQMD3 | 6 labels out, 2 in |
| **Whipps Cross Hospital** `whipps-cross-hospital` | Barts Health NHS Trust | D | 65 | 1 | 0 | 0 | no-corridors | hand-built | — |
| **Broomfield Hospital** `broomfield-hospital` | Mid and South Essex NHS Foundation Trust | E | 54 | 5 | 0 | 1 | no-corridors | hand-built | — |
| **Ealing Hospital** `ealing-hospital-site-map` | London North West University Healthcare NHS Trust | E | 24 → 22 | 1 | 0 | 0 | no-corridors | ODS R1K04 | 2 labels out, 0 in |
| **Friarage Hospital** `friarage-site-map-july-2025` | South Tees Hospitals NHS Foundation Trust | E | 35 → 34 | 1 | 0 | 1 → 0 | no-corridors | ODS RTR45 | renamed from “Friarage Hospital Site”; trust/address corrected; 3 labels out, 2 in |
| **King George Hospital** `king-george-hospital` | Barking, Havering and Redbridge University Hospitals NHS Trust | E | 56 | 2 | 0 | 0 | no-corridors | hand-built | — |
| **Manchester Royal Infirmary — Oxford Road Campus** `oxford-road` | Manchester University NHS FT | E | 32 | 1 | 0 | 0 | no-corridors | hand-anchored sheet | — |
| **Northwick Park Hospital** `northwick-park-hospital-site-map` | London North West University Healthcare NHS Trust | E | 22 → 19 | 1 | 0 | 1 | no-corridors | ODS R1K01 | 3 labels out, 0 in |
| **Ormskirk & District General Hospital** `ormskirk-site-map-a3` | Mersey and West Lancashire Teaching Hospitals NHS Trust | E | 32 → 24 | 1 | 0 | 3 → 0 | no-corridors | ODS RVY38 | trust corrected; 8 labels out, 0 in |
| **Queen Elizabeth Hospital, Woolwich** `queen-elizabeth-hospital-woolwich` | Lewisham and Greenwich NHS Trust | E | 71 | 2 | 0 | 0 | no-corridors | hand-built | — |
| **St Mary's Hospital, Paddington** `st-marys-paddington` | Imperial College Healthcare NHS Trust | E | 20 | 1 | 0 | 0 | no-corridors | hand-built | — |
| **University Hospital Lewisham** `university-hospital-lewisham` | Lewisham and Greenwich NHS Trust | E | 99 | 7 | 0 | 0 | no-corridors | hand-built | — |
| **West Park Hospital** `site-6458-west-park-rehabilitation-hospital` | The Royal Wolverhampton NHS Trust | E | 27 → 26 | 1 | 0 | 1 → 0 | no-corridors | ODS RL4CD | 2 labels out, 1 in |
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
