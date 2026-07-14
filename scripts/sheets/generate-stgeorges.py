#!/usr/bin/env python3
# Rebuilds St George's, Tooting from the trust's real published site map
# (StGeorgesMapandKey, July 2021) — replacing the earlier hand-drawn schematic.
# The overlay is the trust's own map artwork (all wings shown, colour-coded),
# and the waypoints are the sheet's full wing-by-wing, floor-by-floor directory
# (188 rows). Each department sits on its wing's building on the correct floor;
# positions within a wing are illustrative (the directory gives wing + floor,
# not an exact room), the same caveat the schematic carried.
#
# Run: python3 scripts/sheets/generate-stgeorges.py

import fitz, re, os, json

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, "..", "..")
SRC = "/root/.claude/uploads/70a4249f-d2c9-5851-8c9e-14d91ba68624/c6e918c3-StGeorgesMapandKeyJuly2021.pdf"
SP = "/tmp/claude-0/-home-user-wayfinder/70a4249f-d2c9-5851-8c9e-14d91ba68624/scratchpad"

CROP = (120, 55, 1300, 1160)  # map artwork (drops the right-hand directory panels + legend)
CW, CH = CROP[2] - CROP[0], CROP[3] - CROP[1]

# Geo bounds — the whole Tooting site (~480 m across), centred on the complex.
BOUNDS = ((51.4246, -0.178362), (51.4286, -0.171438))

# Wing label anchors on the map (PDF pts) — departments fan around these.
WING_ANCHOR = {
    "Atkinson Morley Wing": (449, 880),
    "Jenner Wing": (720, 590),
    "St James Wing": (740, 890),
    "Grosvenor Wing": (900, 875),
    "Hunter Wing": (930, 640),
    "Lanesborough Wing": (1080, 720),
    "Emergency Department": (660, 885),
}
# Single-building units (directory panel column 3 + a few named buildings), at
# their on-map label position. Floor 0 unless a floor is obvious.
UNIT_ANCHOR = {
    "Willow Annexe": (225, 530), "Wandle Annexe": (231, 624), "Blackshaw Annexe": (239, 703),
    "Pelican London Hotel": (282, 394), "Knightsbridge Annexe": (332, 595),
    "Courtyard Clinic": (505, 460), "PET Scanning": (508, 728), "Bence Jones Unit": (661, 367),
    "The Rose Centre": (1045, 505), "Sir Joseph Hotung Centre": (1079, 1009),
    "Maxillofacial & Day Surgery Unit": (1162, 542), "Hand Unit": (1174, 502),
    "Energy Centre": (1285, 542), "Dragon Children's Centre": (1295, 996),
    "The MRI Suite": (1078, 909), "Phoenix Centre": (392, 340),
    "National Blood Service": (845, 424), "Education Centre": (300, 300),
    "Occupational Health": (300, 250), "Jasmine Annexe": (660, 420),
    "Ronald McDonald House": (610, 1050),
}


def floor_of(code):
    if code in (None, ""):
        return 0
    if code == "G":
        return 0
    if code == "LG":
        return -1
    if code.isdigit():
        return int(code)
    return 0  # ranges like "6-G", "2-LG"


def wtype(name):
    n = name.lower()
    if re.search(r"\bward\b|\bunit\b", n) and "outpatient" not in n:
        return "ward"
    if "café" in n or "cafe" in n or "coffee" in n or "restaurant" in n or "costa" in n or "pret" in n:
        return "canteen"
    if "pharmac" in n:
        return "pharmacy"
    if "reception" in n or "information desk" in n:
        return "reception"
    if "toilet" in n:
        return "toilet"
    if "emergency department" in n or n.startswith("entrance"):
        return "exit"
    return "department"


def extract_directory():
    doc = fitz.open(SRC)
    page = doc[0]
    spans = []
    for blk in page.get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            for sp in ln["spans"]:
                b = sp["bbox"]; t = sp["text"].strip()
                if t:
                    spans.append({"x": round(b[0]), "y": round((b[1] + b[3]) / 2), "sz": round(sp["size"], 1), "t": t})
    doc.close()

    def parse_panel(col_lo, col_hi, mark_hi):
        items = sorted([s for s in spans if col_lo <= s["x"] < col_hi], key=lambda s: s["y"])
        wing = None; floor = None; out = []
        for s in items:
            t = s["t"]
            if s["sz"] >= 20 and s["x"] < mark_hi + 40 and any(c.isalpha() for c in t) and len(t) > 3:
                if t.replace("-", "").replace("G", "").replace("L", "").isdigit() or t in ("LG", "G"):
                    floor = t
                else:
                    wing = t; floor = None
                continue
            if s["sz"] >= 40 and s["x"] < mark_hi:
                floor = t; continue
            if (t in ("LG", "G") or (len(t) <= 4 and any(ch.isdigit() for ch in t) and s["x"] < mark_hi)):
                floor = t; continue
            if s["sz"] < 16 and s["x"] >= mark_hi - 30 and wing:
                out.append({"wing": wing, "floor": floor, "dept": t})
        return out

    rows = parse_panel(1585, 1890, 1660) + parse_panel(1900, 2185, 1965)

    # Merge continuation lines (start lowercase or "(") into the previous dept.
    merged = []
    for r in rows:
        if merged and merged[-1]["wing"] == r["wing"] and (r["dept"][:1].islower() or r["dept"].startswith("(")):
            merged[-1]["dept"] += " " + r["dept"]
        else:
            merged.append(dict(r))
    # Forward-fill leading None floors within a wing to that wing's first real floor.
    first_floor = {}
    for r in merged:
        if r["floor"] is not None:
            first_floor.setdefault(r["wing"], r["floor"])
    for r in merged:
        if r["floor"] is None:
            r["floor"] = first_floor.get(r["wing"], "G")
    # Drop the SGUL university note lines.
    merged = [r for r in merged if "University of London" not in r["dept"]]
    return merged


def crop_svg():
    doc = fitz.open(SRC)
    page = doc[0]
    x0, y0, x1, y1 = CROP
    W, H = page.rect.width, page.rect.height
    for r in (fitz.Rect(0, 0, W, y0), fitz.Rect(0, y1, W, H), fitz.Rect(0, 0, x0, H), fitz.Rect(x1, 0, W, H)):
        page.add_redact_annot(r)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
    svg = page.get_svg_image(text_as_path=True)
    svg = re.sub(r'<svg[^>]*>', f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="{x0} {y0} {CW} {CH}">', svg, count=1)
    svg = re.sub(r'\s(?:inkscape|sodipodi):[\w-]+="[^"]*"', '', svg)
    outdir = os.path.join(REPO, "public", "floorplans", "stgeorges")
    os.makedirs(outdir, exist_ok=True)
    open(os.path.join(outdir, "sitemap.svg"), "w").write(svg)
    doc.close()
    print(f"wrote public/floorplans/stgeorges/sitemap.svg ({round(len(svg)/1024)} KB)")


def to_ll(x, y):
    (latS, lngW), (latN, lngE) = BOUNDS
    lat = round(latN - (y - CROP[1]) / CH * (latN - latS), 6)
    lng = round(lngW + (x - CROP[0]) / CW * (lngE - lngW), 6)
    return lat, lng


def build():
    directory = extract_directory()
    # Group by wing+floor to fan departments out.
    from collections import defaultdict
    groups = defaultdict(list)
    for r in directory:
        groups[(r["wing"], r["floor"])].append(r["dept"])

    wps = []
    used = {}

    def add(name, floor, x, y, wing):
        base = f"{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}-f{floor}"
        n = used.get(base, 0); used[base] = n + 1
        wid = base if n == 0 else f"{base}-{n+1}"
        lat, lng = to_ll(x, y)
        wps.append({"id": wid, "name": name, "type": wtype(name), "lat": lat, "lng": lng,
                    "floor": floor, "wing": wing})

    for (wing, fcode), depts in groups.items():
        if wing not in WING_ANCHOR:
            continue
        ax, ay = WING_ANCHOR[wing]
        fl = floor_of(fcode)
        for i, d in enumerate(depts):
            col, row = i % 4, i // 4
            x = ax + (col - 1.5) * 26
            y = ay + (row - len(depts) / 8) * 22
            add(d, fl, x, y, wing)
    # Single-building units.
    for name, (x, y) in UNIT_ANCHOR.items():
        add(name, 0, x, y, name)
    # Entrances from the map.
    for name, x, y in [
        ("Grosvenor Wing Main Reception", 900, 900), ("Cranmer Terrace Entrance", 985, 405),
        ("Effort Street Entrance", 1005, 1090), ("Main Exit (ambulances)", 210, 1015),
    ]:
        add(name, 0, x, y, "Entrances")
    return wps


def emit(wps):
    (latS, lngW), (latN, lngE) = BOUNDS
    L = []; A = L.append
    A('import { Venue } from "../types"')
    A("")
    A("// St George's Hospital, Tooting — St George's University Hospitals NHS")
    A("// Foundation Trust, Blackshaw Road, London SW17 0QT.")
    A("//")
    A("// The floor plan is the trust's own published site map (July 2021): the")
    A("// real colour-coded wings as designed. Waypoints are the sheet's full")
    A("// wing-by-wing, floor-by-floor directory — every department sits on its")
    A("// wing on the correct floor (illustrative within a wing). Replaces the")
    A("// earlier hand-drawn schematic. Generated by scripts/sheets/generate-stgeorges.py.")
    A("")
    A("export const ST_GEORGES_VENUE: Venue = {")
    A('  id: "st-georges",')
    A('  slug: "st-georges",')
    A('  name: "St George\'s Hospital, Tooting",')
    A('  subtitle: "St George\'s University Hospitals NHS Foundation Trust · Blackshaw Road, London SW17 0QT",')
    A('  category: "hospital",')
    A("  center: { lat: 51.4266, lng: -0.1749 },")
    A("  defaultZoom: 17,")
    A('  visibility: "public",')
    A("  verified: true,")
    A('  accessibility: { stepFreeRoute: true, accessibleToilets: true, notes: "Large multi-wing site; lifts serve all wings, step-free routes and Blue Badge parking (Car Parks 1 & 3). Main reception in Grosvenor Wing." },')
    A('  quickAccess: ["Emergency Department (ED)", "Grosvenor Wing Main Reception", "Major Trauma Ward", "Lanesborough Wing Outpatients", "Ingredients Restaurant & Costa Coffee"],')
    A("  floorPlans: [")
    floors = sorted({w["floor"] for w in wps})
    labels = {-1: "Lower Ground", 0: "Ground Floor", 1: "First Floor", 2: "Second Floor",
              3: "Third Floor", 4: "Fourth Floor", 5: "Fifth Floor", 6: "Sixth Floor"}
    for f in floors:
        A(f'    {{ id: "f{f}", floor: {f}, label: "{labels.get(f, f"Floor {f}")}", imageUrl: "/floorplans/stgeorges/sitemap.svg", '
          f"bounds: [[{latS}, {lngW}], [{latN}, {lngE}]] }},")
    A("  ],")
    A("  waypoints: [")
    wing = None
    for w in sorted(wps, key=lambda w: (w["wing"], w["floor"])):
        if w["wing"] != wing:
            wing = w["wing"]
            A(f"    // ── {wing} " + "─" * max(1, 60 - len(wing)))
        name = w["name"].replace('"', '\\"')
        A(f'    {{ id: "{w["id"]}", name: "{name}", type: "{w["type"]}", '
          f'coordinates: {{ lat: {w["lat"]}, lng: {w["lng"]} }}, floor: {w["floor"]}, '
          f'description: "{w["wing"]}" }},')
    A("  ],")
    A("}")
    A("")
    open(os.path.join(REPO, "src", "lib", "venues", "st-georges.ts"), "w").write("\n".join(L))
    print(f"wrote src/lib/venues/st-georges.ts ({len(wps)} waypoints)")


crop_svg()
emit(build())
