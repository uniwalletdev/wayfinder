#!/usr/bin/env python3
# Generates src/lib/venues/qeh.ts and src/lib/venues/uhl.ts — the two Lewisham
# and Greenwich NHS Trust hospitals — from the trust's own printed site maps.
#
# Unlike GOSH/St George's (schematic interiors drawn from scratch), these two
# venues reproduce each hospital's OWN designed map sheet: the floor-plan
# overlay (public/floorplans/{qeh,uhl}/sitemap.svg) is the vector artwork
# extracted from the trust's official wayfinding PDF (zones, buildings, roads,
# corridors, key — the sheet as designed), and every waypoint comes from the
# sheet's "Floor / Zone" directory tables.
#
# Inputs (checked in alongside this script, extracted from the PDFs):
#   {qeh,uhl}-directory.json  — every directory row: name, floor, zone colour,
#                               group (Outpatients / Wards / Services / External)
#   {qeh,uhl}-zonecells.json  — sampled points (PDF pts) lying on each zone's
#                               coloured building footprint in the map artwork
#
# Waypoint placement: entries labelled on the map sheet get their label's real
# position (ANCHORS below); the rest are spread evenly across their zone's
# actual footprint. Positions within a zone are therefore illustrative (same
# caveat as St George's) but always land on the right building in the right
# colour zone, on the correct floor.
#
# Run with: python3 scripts/lgt/generate-lgt-venues.py

import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, "..", "..")

FLOOR_WORDS = ["Ground floor", "First floor", "Second floor", "Third floor",
               "Fourth floor", "Fifth floor", "Sixth floor"]
FLOOR_LABELS = ["Ground Floor", "First Floor", "Second Floor", "Third Floor",
                "Fourth Floor", "Fifth Floor", "Sixth Floor"]

# ── Per-hospital configuration ────────────────────────────────────────────────
# crop: the PDF-point box of the map artwork (matches the sitemap.svg viewBox).
# bounds: geographic box the artwork is overlaid onto. Both sheets are drawn
# with North pointing RIGHT (their compasses agree; for UHL, Lewisham High
# Street along the sheet's bottom edge is indeed the site's eastern boundary),
# and Leaflet overlays are axis-aligned, so the overlay keeps the trust's
# designed orientation and the bounds simply cover the real site's extent.
QEH = {
    "id": "qeh-woolwich",
    "slug": "queen-elizabeth-hospital-woolwich",
    "name": "Queen Elizabeth Hospital, Woolwich",
    "subtitle": "Lewisham and Greenwich NHS Trust · Stadium Road, London SE18 4QH",
    "tel": "020 8836 6000",
    "center": (51.478191, 0.050057),
    "crop": (28, 148, 814, 566),
    "bounds": ((51.476925, 0.046235), (51.479457, 0.053879)),
    "floors": [0, 1],
    "plan": "/floorplans/qeh/sitemap.svg",
    "directory": "qeh-directory.json",
    "zonecells": "qeh-zonecells.json",
    # Directory entries with a label on the sheet -> its position (PDF pts)
    "anchors": {
        "Blood Tests": (455, 294),
        "Ambulatory Care Unit": (447, 318),
        "Physiotherapy (Outpatients)": (273, 226),
        "Oxleas Mental Health Unit": (86, 277),
        "Education Centre": (242, 280),
        "Medical Records (Education Centre)": (253, 323),
        "Health Care Library": (241, 306),
        "Conference Centre": (273, 208),
        "Brook House": (182, 220),
        "Medical Photography (Ranken House)": (246, 372),
        "Outpatients Departments A - G": (387, 291),
        "A&E (Children’s and Adults)": (560, 340),
    },
    # Entrances and sheet-labelled extras that aren't directory rows
    "extras": [
        {"name": "Main Entrance & Emergency Department", "type": "exit", "pos": (498, 415), "floor": 0,
         "desc": "Main entrance and Emergency Department entrance, off Stadium Road"},
        {"name": "West Entrance", "type": "exit", "pos": (302, 254), "floor": 0,
         "desc": "West entrance, serving the outpatient areas"},
        {"name": "Childrens Unit & Macmillan Brook Unit Entrance", "type": "exit", "pos": (316, 390), "floor": 0,
         "desc": "Entrance for the Childrens Unit and Macmillan Brook Unit"},
    ],
    "quick": ["Main Entrance & Emergency Department", "A&E (Children’s and Adults)",
              "Outpatients Departments A - G", "Blood Tests", "Pharmacy", "Restaurant"],
    "accessibility": {
        "stepFreeRoute": True, "accessibleToilets": True,
        "notes": "Accessible (Blue Badge) parking by the main entrance and west car parks; help desks in Main Reception. Lifts serve the first floor.",
    },
}

UHL = {
    "id": "uhl-lewisham",
    "slug": "university-hospital-lewisham",
    "name": "University Hospital Lewisham",
    "subtitle": "Lewisham and Greenwich NHS Trust · Lewisham High Street, London SE13 6LH",
    "tel": "020 8333 3000",
    "center": (51.45433, -0.017036),
    "crop": (28, 138, 814, 618),
    "bounds": ((51.453096, -0.020279), (51.455564, -0.013793)),
    "floors": [0, 1, 2, 3, 4, 5, 6],
    "plan": "/floorplans/uhl/sitemap.svg",
    "directory": "uhl-directory.json",
    "zonecells": "uhl-zonecells.json",
    "anchors": {
        "Emergency Department": (381, 461),
        "Children’s Emergency": (356, 520),
        "Urgent Treatment Centre": (447, 443),
        "Riverside Treatment Centre": (457, 336),
        "Lewisham Surgical Centre": (375, 372),
        "Birth Centre": (277, 388),
        "Children’s Outpatients": (278, 408),
        "Dermatology (External entrance)": (299, 469),
        "Same Day Emergency Care": (282, 550),
        "Blood Tests (Suite 1)": (571, 354),
        "Suite 1 (Blood Tests)": (569, 348),
        "Chest Clinic (Suite 5 - External entrance)": (471, 488),
        "Suite 5 (Chest Clinic - external entrance)": (473, 493),
        "Woman’s Health Centre": (271, 280),
        "Physiotherapy (Therapies)": (551, 446),
        "Chapel - (Waterloo Block)": (188, 496),
        "General Office": (239, 512),
        "Security": (232, 520),
        "Patient Photography (Owen Centre)": (722, 352),
        "Patient Transport": (466, 478),
        "Main Reception": (435, 480),
    },
    "extras": [
        {"name": "Green Zone Entrance", "type": "exit", "pos": (166, 317), "floor": 0,
         "desc": "Entrance to the Green zone (Women’s Health, Children’s Wards)"},
        {"name": "Purple Zone Entrance", "type": "exit", "pos": (616, 391), "floor": 0,
         "desc": "Entrance to the Purple zone (Suite 1 — Blood Tests and Foot Health)"},
        {"name": "Blue Zone Entrance", "type": "exit", "pos": (558, 484), "floor": 0,
         "desc": "Entrance to the Blue zone (Therapies)"},
        {"name": "Pink and Green Zones Entrance", "type": "exit", "pos": (289, 496), "floor": 0,
         "desc": "Entrance to the Pink and Green zones"},
        {"name": "Orange and Green Zone Entrance", "type": "exit", "pos": (477, 380), "floor": 0,
         "desc": "Entrance to the Orange and Green zones (Riverside)"},
        {"name": "Entrance to Adult A&E, UTC and Yellow Zone", "type": "exit", "pos": (467, 554), "floor": 0,
         "desc": "Entrance to Adult A&E, the Urgent Treatment Centre and the Yellow zone"},
        {"name": "Children’s A&E Entrance", "type": "exit", "pos": (353, 527), "floor": 0,
         "desc": "Dedicated Children’s A&E entrance"},
        {"name": "Dialysis Centre", "type": "department", "pos": (191, 368), "floor": 0, "desc": None},
        {"name": "Ladywell Unit", "type": "other", "pos": (637, 354), "floor": 0,
         "desc": "Ladywell Unit (mental health services)"},
        {"name": "Education Centre (Lessof Auditorium)", "type": "department", "pos": (623, 496), "floor": 0, "desc": None},
        {"name": "Nursery Block (Pre-admission checks)", "type": "department", "pos": (682, 442), "floor": 0, "desc": None},
        {"name": "Mortuary", "type": "other", "pos": (115, 402), "floor": 0, "desc": None},
    ],
    "quick": ["Main Reception", "Emergency Department", "Urgent Treatment Centre",
              "Blood Tests (Suite 1)", "Riverside Treatment Centre", "Pharmacies"],
    "accessibility": {
        "stepFreeRoute": True, "accessibleToilets": True,
        "notes": "Colour-coded zone entrances with step-free access; accessible parking near the Blue and Purple zone entrances. Help desks near the Urgent Treatment Centre entrance and the Main Riverside entrance.",
    },
}


def slugify(s):
    s = s.lower()
    s = re.sub(r"[’']", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "wp"


def wtype(name, group):
    n = name.lower()
    if "entrance" in n:
        return "exit"
    if "pharmac" in n:
        return "pharmacy"
    if "restaurant" in n or "café" in n or "cafe" in n:
        return "canteen"
    if "reception" in n or n.startswith("pals"):
        return "reception"
    if group == "Wards":
        if "a&e" in n or "urgent care" in n or "therapy" in n:
            return "department"
        return "ward"
    if group in ("Outpatients", "External"):
        return "department"
    if any(k in n for k in ("shop", "prayer", "chapel", "mortuary", "gallery",
                            "facilities", "security", "general office",
                            "overseas", "voluntary")):
        return "other"
    return "department"


def gen(cfg):
    directory = json.load(open(os.path.join(HERE, cfg["directory"])))
    zonecells = json.load(open(os.path.join(HERE, cfg["zonecells"])))
    x0, y0, x1, y1 = cfg["crop"]
    (latS, lngW), (latN, lngE) = cfg["bounds"]

    def to_ll(x, y):
        lat = latN - (y - y0) / (y1 - y0) * (latN - latS)
        lng = lngW + (x - x0) / (x1 - x0) * (lngE - lngW)
        return round(lat, 6), round(lng, 6)

    # Spread un-anchored entries of each zone evenly across that zone's
    # sampled footprint cells (ordered row-band by x for an even scatter).
    by_zone = {}
    for row in directory:
        if row["name"] in cfg["anchors"] or row["zone"] in ("None", "?"):
            continue
        by_zone.setdefault(row["zone"], []).append(row)
    zone_pos = {}
    for zone, rows in by_zone.items():
        cells = sorted(zonecells.get(zone, []), key=lambda c: (round(c[1] / 24), c[0]))
        if not cells:
            continue
        n = len(rows)
        for i, row in enumerate(rows):
            idx = int((i + 0.5) * len(cells) / n)
            zone_pos[id(row)] = cells[min(idx, len(cells) - 1)]

    # "None"-zone rows (grey buildings — UHL services) fall back near the
    # General Office label unless anchored.
    grey_fallback = cfg["anchors"].get("General Office", ((x0 + x1) / 2, (y0 + y1) / 2))

    used = {}
    def wid(name, floor):
        base = slugify(name)
        key = f"{base}-f{floor}"
        n = used.get(key, 0)
        used[key] = n + 1
        return key if n == 0 else f"{key}-{n + 1}"

    wps = []
    grey_i = 0
    for row in directory:
        name, floor, zone, group = row["name"], row["floor"], row["zone"], row["group"]
        if name in cfg["anchors"]:
            x, y = cfg["anchors"][name]
        elif id(row) in zone_pos:
            x, y = zone_pos[id(row)]
        else:
            x, y = grey_fallback
            x += 14 * (grey_i % 3) - 14
            y += 10 * (grey_i // 3) - 10
            grey_i += 1
        lat, lng = to_ll(x, y)
        # The app already labels each waypoint with its floor, so the
        # description carries only what the sheet adds: the colour zone.
        parts = []
        if zone not in ("None", "?"):
            parts.append(f"{zone} zone")
        if row.get("desc"):
            parts.append(row["desc"])
        wps.append({
            "id": wid(name, floor), "name": name, "type": wtype(name, group),
            "lat": lat, "lng": lng, "floor": floor, "desc": " · ".join(parts),
            "group": group,
        })
    for ex in cfg["extras"]:
        lat, lng = to_ll(*ex["pos"])
        wps.append({
            "id": wid(ex["name"], ex["floor"]), "name": ex["name"], "type": ex["type"],
            "lat": lat, "lng": lng, "floor": ex["floor"],
            "desc": ex["desc"] or "", "group": "Entrances & buildings",
        })
    return wps


def emit(cfg, wps, const, outfile):
    (latS, lngW), (latN, lngE) = cfg["bounds"]
    lines = []
    A = lines.append
    A('import { Venue } from "../types"')
    A("")
    A(f"// {cfg['name']} — Lewisham and Greenwich NHS Trust. Tel: {cfg['tel']}.")
    A("//")
    A("// This venue reproduces the trust's own designed wayfinding map: the floor")
    A(f"// plan ({cfg['plan']}) is the vector artwork of the trust's official")
    A("// site map sheet (colour-coded zones, buildings, roads, corridors and key,")
    A("// exactly as designed), and the waypoints are the sheet's full Floor/Zone")
    A("// directory. The sheet is drawn with North pointing right; the overlay keeps")
    A("// the designed orientation. Entries labelled on the sheet sit at their true")
    A("// position; the rest are placed within their colour zone's footprint on the")
    A("// correct floor (illustrative within the zone, like St George's).")
    A("//")
    A("// Generated by scripts/lgt/generate-lgt-venues.py — edit that, not this.")
    A("")
    A(f"export const {const}: Venue = {{")
    A(f'  id: "{cfg["id"]}",')
    A(f'  slug: "{cfg["slug"]}",')
    A(f'  name: "{cfg["name"]}",')
    A(f'  subtitle: "{cfg["subtitle"]}",')
    A('  category: "hospital",')
    A(f"  center: {{ lat: {cfg['center'][0]}, lng: {cfg['center'][1]} }},")
    A("  defaultZoom: 17,")
    A('  visibility: "public",')
    A("  // Real trust map data, but not owner-confirmed in-app — left unverified.")
    A("  verified: false,")
    acc = cfg["accessibility"]
    A("  accessibility: {")
    A(f"    stepFreeRoute: {str(acc['stepFreeRoute']).lower()},")
    A(f"    accessibleToilets: {str(acc['accessibleToilets']).lower()},")
    A(f'    notes: "{acc["notes"]}",')
    A("  },")
    A("  quickAccess: [" + ", ".join(f'"{q}"' for q in cfg["quick"]) + "],")
    A("  // The same designed site-map sheet serves every floor: wards above ground")
    A("  // are found by zone colour + floor, exactly how the trust's sheet works.")
    A("  floorPlans: [")
    for f in cfg["floors"]:
        A(f'    {{ id: "f{f}", floor: {f}, label: "{FLOOR_LABELS[f]}", imageUrl: "{cfg["plan"]}", '
          f"bounds: [[{latS}, {lngW}], [{latN}, {lngE}]] }},")
    A("  ],")
    A("  waypoints: [")
    group = None
    for w in wps:
        if w["group"] != group:
            group = w["group"]
            A(f"    // ── {group} " + "─" * max(1, 68 - len(group)))
        name = w["name"].replace('"', '\\"')
        desc = w["desc"].replace('"', '\\"')
        desc_part = f', description: "{desc}"' if desc else ""
        A(f'    {{ id: "{w["id"]}", name: "{name}", type: "{w["type"]}", '
          f'coordinates: {{ lat: {w["lat"]}, lng: {w["lng"]} }}, floor: {w["floor"]}'
          f'{desc_part} }},')
    A("  ],")
    A("}")
    A("")
    open(outfile, "w").write("\n".join(lines))
    print(f"wrote {os.path.relpath(outfile, REPO)} ({len(wps)} waypoints)")


for cfg, const, fname in ((QEH, "QEH_VENUE", "qeh.ts"), (UHL, "UHL_VENUE", "uhl.ts")):
    wps = gen(cfg)
    emit(cfg, wps, const, os.path.join(REPO, "src", "lib", "venues", fname))
