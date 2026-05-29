#!/usr/bin/env python3
"""
Import the GOSH directory + site map into the app's data model.

Reads:
  scripts/data/gosh-wards-and-departments.xlsx   (the directory: building / floor / side / type / access)
  scripts/data/gosh-site-map.pdf                 (the official patient site map)

Writes:
  src/lib/sites/gosh.ts        (Site + Building[] + MapLocation[])
  public/map/gosh-site.png     (rendered, georeferenced site map)

Building coordinates are derived by georeferencing the site map: each building's
normalised position on the map (read off the artwork, see CENTROIDS) is projected
onto a real-world bounding box around the campus. The source data has no
room-level coordinates, so a location resolves to its building + floor + side.

Deps: pip install pymupdf
Usage: python3 scripts/import-gosh.py
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "scripts/data/gosh-wards-and-departments.xlsx")
PDF = os.path.join(ROOT, "scripts/data/gosh-site-map.pdf")
OUT_TS = os.path.join(ROOT, "src/lib/sites/gosh.ts")
OUT_PNG = os.path.join(ROOT, "public/map/gosh-site.png")

# --- georeferencing -------------------------------------------------------
# The site-map artwork is a schematic, rotated ~90deg from true north: Great
# Ormond Street / Guilford Street are drawn vertically but really run roughly
# E-W along the tilted Bloomsbury grid. We georeference in local metres so the
# artwork (and every building derived from the same transform) sits over the
# real street grid. Tune these four constants if the overlay needs nudging.
import math

CENTER_LAT, CENTER_LNG = 51.52240, -0.12030     # campus centre (artwork u=v=0.5)
ART_BEARING_DOWN = 75.0                          # compass bearing of artwork "down" (along Great Ormond St, eastward)
SPAN_DOWN_M = 270.0                              # real length of the artwork's vertical (v) span, metres
IMG_W, IMG_H = 2382, 3368                        # rendered artwork pixels (keeps scale isotropic)
SPAN_RIGHT_M = SPAN_DOWN_M * IMG_W / IMG_H       # real length of the horizontal (u) span, metres

_M_PER_DEG_LAT = 111320.0
_M_PER_DEG_LNG = 111320.0 * math.cos(math.radians(CENTER_LAT))
_PHI_V = math.radians(ART_BEARING_DOWN)
_PHI_U = math.radians(ART_BEARING_DOWN - 90.0)

def to_latlng(x, y):  # x: 0..1 left->right (u), y: 0..1 top->bottom (v)
    du, dv = x - 0.5, y - 0.5
    east = du * SPAN_RIGHT_M * math.sin(_PHI_U) + dv * SPAN_DOWN_M * math.sin(_PHI_V)
    north = du * SPAN_RIGHT_M * math.cos(_PHI_U) + dv * SPAN_DOWN_M * math.cos(_PHI_V)
    return round(CENTER_LAT + north / _M_PER_DEG_LAT, 6), round(CENTER_LNG + east / _M_PER_DEG_LNG, 6)

# Normalised building centroids read off the artwork (x, y, precise?).
CENTROIDS = {
    "Southwood Building": (0.74, 0.34, True),
    "Variety Club Building": (0.49, 0.49, True),
    "Nurses Home": (0.86, 0.36, True),
    "Barclay (formerly York) House": (0.19, 0.16, True),
    "Paul O'Gorman Building": (0.60, 0.56, False),
    "Frontage Building": (0.34, 0.40, False),   # the hatched "Construction" frontage on Great Ormond St
    "Morgan Stanley Clinical Building\nMittal Children's Medical Centre": (0.62, 0.51, True),
    "Camelia Botnar Laboratories": (0.55, 0.73, True),
    "Octav Botnar Wing": (0.38, 0.73, True),
    "Italian Building": (0.46, 0.43, False),
    "Weston House": (0.21, 0.23, True),
    "West Link": (0.34, 0.42, False),
    "Boiler House": (0.29, 0.62, False),
    "The Royal London Hospital for Integrated Medicine": (0.39, 0.23, True),
    "55 Great Ormond Street": (0.12, 0.46, False),
    "Cardiac Wing": (0.50, 0.62, False),
    "Ormond House": (0.12, 0.38, False),
    "40 Bernard Street": (0.05, 0.04, False),
    "45 Great Ormond Street": (0.12, 0.54, False),
    "51 Great Ormond Street": (0.12, 0.60, False),
    "Nurses Home Porta Cabins": (0.92, 0.42, False),
    "Orangery": (0.66, 0.41, False),
    "Southwood Courtyard": (0.80, 0.41, False),
}
SHORT = {
    "Morgan Stanley Clinical Building\nMittal Children's Medical Centre": "Morgan Stanley Clinical Building",
    "Barclay (formerly York) House": "Barclay House",
}
ALIASES = {
    "Morgan Stanley Clinical Building\nMittal Children's Medical Centre":
        ["Mittal Children's Medical Centre", "Morgan Stanley", "Mittal", "MSCB"],
    "Variety Club Building": ["VCB"],
    "Octav Botnar Wing": ["OBW"],
    "Barclay (formerly York) House": ["York House"],
    "The Royal London Hospital for Integrated Medicine": ["RLHIM", "Maple, Rabbit & Zebra Outpatients"],
}

SIDE_LABEL = {"E": "East side", "W": "West side", "N": "North side", "S": "South side",
              "B": "Block B", "C": "Block C", "D": "Block D", "-": "", "": ""}
TYPE_MAP = {
    "Ward": "ward", "Clinical": "clinical", "Clinical support": "clinical-support",
    "Non-clinical support": "non-clinical-support", "Office": "office", "Storage": "storage",
    "Residential": "residential", "Teaching and Research": "teaching-research",
    "Changing Facilities": "changing", "Theatres": "theatres", "Workshop": "workshop", "-": "other",
}


def slug(s):
    s = s.lower().replace("'", "").replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def norm_floor(f):
    f = f.strip()
    m = {"Ground Floor": (0, "Ground"), "Ground Floor & Basement": (0, "Ground & Basement"),
         "1st Floor": (1, "Level 1"), "2nd Floor": (2, "Level 2"), "0": (0, "Ground"), "-": (None, "")}
    if f in m:
        return m[f]
    if f.isdigit():
        return (int(f), "Level " + f)
    return (None, f)


def icon_for(name, typ):
    n = name.lower()
    rules = [
        (["pharmacy"], "💊"),
        (["restaurant", "lagoon", "cafe", "café", "coffee", "kitchen", "diet"], "🍽️"),
        (["chapel", "faith", "shabbat", "prayer"], "⛪"),
        (["toilet", "wc"], "🚻"),
        (["x ray", "x-ray", "mri", "imaging", "radiology", "nuclear", "dexa", "angio"], "🩻"),
        (["school"], "🎓"),
        (["reception", "pals", "patient advice"], "💁"),
        (["theatre"], "🔪"),
        (["security"], "🛡️"),
        (["laundry", "linen"], "🧺"),
        (["entrance"], "🚪"),
    ]
    if any(k in n for k in ["shop"]) and "storage" not in n:
        return "🛍️"
    for keys, ic in rules:
        if any(k in n for k in keys):
            return ic
    base = {"ward": "🛏️", "clinical": "🩺", "clinical-support": "🔬", "non-clinical-support": "🛎️",
            "office": "🏢", "storage": "📦", "residential": "🏨", "teaching-research": "📚",
            "changing": "🚿", "theatres": "🔪", "workshop": "🛠️", "other": "📍"}
    return base.get(typ, "📍")


def read_xlsx(path):
    """Minimal xlsx reader (no third-party deps) for the single directory sheet."""
    import zipfile
    with zipfile.ZipFile(path) as z:
        # Normalise CRLF -> LF so multi-line cell values match our keys.
        ss_xml = z.read("xl/sharedStrings.xml").decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
        sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
    ss = [html.unescape(s) for s in re.findall(r"<t[^>]*>(.*?)</t>", ss_xml, re.S)]
    rows = re.findall(r'<row[^>]*r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S)
    recs = []
    for rn, body in rows:
        if int(rn) < 6:  # rows 1-5 are title + header
            continue
        cells = re.findall(
            r'<c r="([A-Z]+)\d+"(?:[^>]*t="(\w+)")?[^>]*>(?:<v>(.*?)</v>|<is><t[^>]*>(.*?)</t></is>)?</c>', body)
        rm = {}
        for col, t, v, inline in cells:
            val = ss[int(v)] if t == "s" and v != "" else (html.unescape(inline) if inline else v)
            if val not in (None, ""):
                rm[col] = val.strip()
        if "A" in rm and "D" in rm:
            recs.append({"building": rm.get("A", ""), "floor": rm.get("B", ""), "side": rm.get("C", ""),
                         "name": rm.get("D", ""), "status": rm.get("E", ""), "type": rm.get("F", ""),
                         "access": rm.get("G", "")})
    return recs


def render_map(pdf_path, out_png):
    try:
        import fitz  # pymupdf
    except ImportError:
        print("! pymupdf not installed — skipping map render (pip install pymupdf)", file=sys.stderr)
        return
    doc = fitz.open(pdf_path)
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(4, 4))
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    # Knock out the near-white page background so the campus artwork floats over
    # the live street map instead of reading as an opaque paper sheet.
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA")
        try:
            import numpy as np
            arr = np.array(img)
            white = (arr[:, :, 0] > 243) & (arr[:, :, 1] > 243) & (arr[:, :, 2] > 243)
            arr[white, 3] = 0
            img = Image.fromarray(arr)
        except ImportError:
            px = img.load()
            for y in range(img.height):
                for x in range(img.width):
                    r, g, b, a = px[x, y]
                    if r > 243 and g > 243 and b > 243:
                        px[x, y] = (r, g, b, 0)
        img.save(out_png)
    except ImportError:
        pix.save(out_png)
    print(f"  wrote {out_png} ({pix.width}x{pix.height}, transparent background)")


def main():
    recs = read_xlsx(XLSX)

    buildings = {}
    for b in sorted({r["building"] for r in recs}):
        cx = CENTROIDS.get(b)
        lat, lng = to_latlng(cx[0], cx[1]) if cx else (51.5225, -0.1199)
        buildings[b] = {
            "id": slug(SHORT.get(b, b).split("\n")[0]),
            "name": SHORT.get(b, b.split("\n")[0]),
            "fullName": b.replace("\n", " — "),
            "aliases": ALIASES.get(b, []),
            "coordinates": {"lat": lat, "lng": lng},
            "precise": cx[2] if cx else False,
        }

    locations, seen = [], set()
    for r in recs:
        b = buildings[r["building"]]
        fl, fllabel = norm_floor(r["floor"])
        typ = TYPE_MAP.get(r["type"], "other")
        base = slug(r["name"])[:40] + "-" + b["id"]
        if r["floor"] and r["floor"] != "-":
            base += "-" + slug(r["floor"])
        lid, n = base, 2
        while lid in seen:
            lid = f"{base}-{n}"; n += 1
        seen.add(lid)
        side = r["side"] if r["side"] != "-" else ""
        access = r["access"].lower()
        locations.append({
            "id": lid, "name": r["name"].strip(), "type": typ, "icon": icon_for(r["name"], typ),
            "buildingId": b["id"], "building": b["name"], "floor": fl, "floorLabel": fllabel,
            "side": side, "sideLabel": SIDE_LABEL.get(side, ""),
            "access": "staff" if access.startswith("staff") else ("public" if access.startswith("public") else "other"),
            "status": r["status"], "coordinates": b["coordinates"],
        })

    for name, desc, xy in [
        ("Main Entrance", "Main hospital entrance (off Guilford Street)", (0.95, 0.42)),
        ("Ambulance Entrance", "Emergency / ambulance access only", (0.55, 0.32)),
    ]:
        lat, lng = to_latlng(*xy)
        locations.append({
            "id": slug(name) + "-entrance", "name": name, "type": "entrance", "icon": "🚪",
            "buildingId": "", "building": "Site entrance", "floor": 0, "floorLabel": "Ground",
            "side": "", "sideLabel": "", "access": "public", "status": "Occupied",
            "description": desc, "coordinates": {"lat": lat, "lng": lng},
        })

    # Rotated overlay corners (image pixel corners -> real lat/lng) + bbox.
    top_left, top_right, bottom_left = to_latlng(0, 0), to_latlng(1, 0), to_latlng(0, 1)
    bottom_right = to_latlng(1, 1)
    all_lat = [c[0] for c in (top_left, top_right, bottom_left, bottom_right)]
    all_lng = [c[1] for c in (top_left, top_right, bottom_left, bottom_right)]

    site = {
        "id": "gosh", "name": "Great Ormond Street Hospital", "shortName": "GOSH",
        "description": "NHS children’s hospital, Bloomsbury, London",
        "center": {"lat": CENTER_LAT, "lng": CENTER_LNG},
        "defaultZoom": 18, "brandColor": "#005EB8",
        "map": {
            "imageUrl": "/map/gosh-site.png",
            "corners": {"topLeft": list(top_left), "topRight": list(top_right), "bottomLeft": list(bottom_left)},
            "bounds": [[min(all_lat), min(all_lng)], [max(all_lat), max(all_lng)]],
        },
    }

    header = (
        "// AUTO-GENERATED from the GOSH directory spreadsheet + the official site map.\n"
        "// Source files: scripts/data/gosh-wards-and-departments.xlsx and gosh-site-map.pdf.\n"
        "// Regenerate via: python3 scripts/import-gosh.py — do not hand-edit.\n"
        'import { Site, Building, MapLocation } from "../types"\n\n'
    )
    body = (
        f"export const GOSH_SITE: Site = {json.dumps(site, ensure_ascii=False)}\n\n"
        f"export const GOSH_BUILDINGS: Building[] = {json.dumps(list(buildings.values()), ensure_ascii=False, indent=2)}\n\n"
        f"export const GOSH_LOCATIONS: MapLocation[] = {json.dumps(locations, ensure_ascii=False, indent=2)}\n"
    )
    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write(header + body)
    print(f"  wrote {OUT_TS}: {len(buildings)} buildings, {len(locations)} locations")

    render_map(PDF, OUT_PNG)


if __name__ == "__main__":
    main()
