#!/usr/bin/env python3
# Queen Mary's Hospital, Roehampton (St George's University Hospitals NHS
# Foundation Trust) from the trust's 4-floor plan booklet. Only the Ground
# floor carries a drawn plan in the source PDF (the other floors are blank in
# the file), so the Ground plan is the map overlay and its 29 numbered rooms
# are placed at their markers; the Lower Ground, First and Second floor
# departments (from each floor's key) are still added as searchable, floor-
# tagged waypoints at the lift core.
#
# Run: python3 scripts/sheets/generate-qmh.py

import fitz, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, "..", "..")
SRC = "/root/.claude/uploads/70a4249f-d2c9-5851-8c9e-14d91ba68624/2ee241fd-QueenMarysHospitalmap.pdf"

CROP = (40, 378, 565, 560)  # Ground plan artwork
CW, CH = CROP[2] - CROP[0], CROP[3] - CROP[1]
BOUNDS = ((51.454051, -0.243715), (51.457051, -0.239715))  # ~ site box, Roehampton

# Ground floor: number -> (names sharing that room number).
G_KEY = {
    1: ["Suite 1"], 2: ["Audiology"], 3: ["Opthalmology"], 4: ["Assisted conception unit"],
    5: ["Nutrition & dietetics", "Podiatry", "Speech & language therapy"], 6: ["Beta cell"],
    7: ["Medical photography"], 8: ["Suite 4"], 9: ["Children's services"], 10: ["League of Friends"],
    11: ["Clinical nurse specialist"], 12: ["Pathology"], 13: ["Suite 2"], 14: ["Suite 3"],
    15: ["Dermatology suite"], 16: ["Children's play area"], 17: ["Patient Advice & Liaison Service (PALS)"],
    18: ["Cashier & patient affairs"], 19: ["Pharmacy"], 20: ["Rapid Diagnostic Centre (RDC) reception"],
    21: ["Suite 5"], 22: ["Suite 6"], 23: ["Burns dressing clinic"], 24: ["Addiction treatment centre"],
    25: ["Information desk"], 26: ["Minor injuries unit"], 27: ["Radiology"], 28: ["Cardiology"],
    29: ["Endoscopy & minor operations"],
}
# Number -> position on the plan (PDF pts), from text extraction + reading the render.
G_POS = {
    1: (391, 415), 2: (330, 408), 3: (388, 406), 4: (455, 406), 5: (406, 415), 6: (250, 437),
    7: (556, 414), 8: (348, 415), 9: (185, 435), 10: (219, 386), 11: (249, 386), 12: (299, 396),
    13: (377, 411), 14: (362, 411), 15: (200, 516), 16: (249, 412), 17: (132, 459), 18: (152, 459),
    19: (174, 459), 20: (220, 458), 21: (312, 447), 22: (431, 437), 23: (64, 484), 24: (187, 495),
    25: (226, 482), 26: (268, 521), 27: (354, 500), 28: (425, 492), 29: (506, 466),
}
LIFT = (340, 430)  # main lift core on the ground plan — used for upper-floor waypoints

LG = ["Bader gymnasium", "Brysson Whyte rehabilitation unit", "Paediatric prosthetic occupational therapy",
      "Douglas Bader rehabilitation unit reception", "Gait laboratory", "Gwynne Holford ward",
      "Limbless Association / Douglas Bader offices", "Mary Seacole ward", "Patient transport waiting area",
      "Physiotherapy outpatients", "Prosthetics & orthotics departments", "Rehabilitation gymnasium",
      "The Sanctuary", "Wheelchair & special seating services", "Vitali unit (formerly Wilson unit)",
      "Courtyard Restaurant"]
FIRST = ["Laurel ward", "Lavender ward", "Rose ward", "Sandalwood suite"]
SECOND = ["Education suite", "Putney & Roehampton sexual health / GUM",
          "Community Mental Health Teams", "Roehampton Clinic"]


def wtype(name):
    n = name.lower()
    if "restaurant" in n or "café" in n:
        return "canteen"
    if "pharmacy" in n:
        return "pharmacy"
    if "information desk" in n or "reception" in n:
        return "reception"
    if "ward" in n:
        return "ward"
    if re.search(r"\bsuite\b|unit|gymnasium|laboratory|clinic|centre|therapy|sanctuary|prosthetic", n):
        return "department"
    return "department"


def to_ll(x, y):
    (latS, lngW), (latN, lngE) = BOUNDS
    lat = round(latN - (y - CROP[1]) / CH * (latN - latS), 6)
    lng = round(lngW + (x - CROP[0]) / CW * (lngE - lngW), 6)
    return lat, lng


def crop_png():
    doc = fitz.open(SRC); page = doc[1]
    pix = page.get_pixmap(matrix=fitz.Matrix(3.5, 3.5), clip=fitz.Rect(*CROP))
    outdir = os.path.join(REPO, "public", "floorplans", "qmh"); os.makedirs(outdir, exist_ok=True)
    pix.save(os.path.join(outdir, "ground.png"))
    doc.close(); print(f"wrote public/floorplans/qmh/ground.png ({pix.width}x{pix.height})")


def build():
    wps = []; used = {}
    def add(name, floor, x, y, group, desc=""):
        base = f"{re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')}-f{floor}"
        n = used.get(base, 0); used[base] = n + 1
        wid = base if n == 0 else f"{base}-{n+1}"
        lat, lng = to_ll(x, y)
        wps.append((wid, name, wtype(name), lat, lng, floor, group, desc))
    for num, names in sorted(G_KEY.items()):
        x, y = G_POS[num]
        for j, nm in enumerate(names):
            add(nm, 0, x + j * 6, y + j * 5, "Ground Floor", f"Room {num}")
    for i, nm in enumerate(LG):
        add(nm, -1, LIFT[0] + (i % 4) * 26 - 39, LIFT[1] + (i // 4) * 20 - 30, "Lower Ground Floor", "Lower Ground — via main lifts")
    for i, nm in enumerate(FIRST):
        add(nm, 1, LIFT[0] + (i % 4) * 26 - 39, LIFT[1] - 10, "First Floor", "First Floor — via main lifts")
    for i, nm in enumerate(SECOND):
        add(nm, 2, LIFT[0] + (i % 4) * 26 - 39, LIFT[1] - 10, "Second Floor", "Second Floor — via main lifts")
    add("Main Entrance", 0, 300, 555, "Ground Floor", "Ground floor main entrance")
    return wps


def emit(wps):
    (latS, lngW), (latN, lngE) = BOUNDS
    L = []; A = L.append
    A('import { Venue } from "../types"')
    A("")
    A("// Queen Mary's Hospital, Roehampton — St George's University Hospitals NHS")
    A("// Foundation Trust, Roehampton Lane, London SW15 5PN. The Ground floor plan")
    A("// is the trust's own map; its numbered rooms are placed at their markers.")
    A("// Lower Ground/First/Second floor departments are searchable and floor-")
    A("// tagged (those floors have no drawn plan in the source booklet).")
    A("// Generated by scripts/sheets/generate-qmh.py.")
    A("")
    A("export const QMH_VENUE: Venue = {")
    A('  id: "queen-marys-roehampton",')
    A('  slug: "queen-marys-roehampton",')
    A('  name: "Queen Mary\'s Hospital, Roehampton",')
    A('  subtitle: "St George\'s University Hospitals NHS Foundation Trust · Roehampton Lane, London SW15 5PN",')
    A('  category: "hospital",')
    A("  center: { lat: 51.455551, lng: -0.241715 },")
    A("  defaultZoom: 18,")
    A('  visibility: "public",')
    A("  verified: false,")
    A('  accessibility: { stepFreeRoute: true, accessibleToilets: true, notes: "Main lifts and stairs serve all floors from the ground-floor main entrance; accessible toilets on every floor; drop-off/pick-up point at the main entrance." },')
    A('  quickAccess: ["Information desk", "Minor injuries unit", "Pharmacy", "Radiology", "Courtyard Restaurant"],')
    A("  floorPlans: [")
    A(f'    {{ id: "f0", floor: 0, label: "Ground Floor", imageUrl: "/floorplans/qmh/ground.png", bounds: [[{latS}, {lngW}], [{latN}, {lngE}]] }},')
    A("  ],")
    A("  waypoints: [")
    grp = None
    for wid, name, typ, lat, lng, floor, group, desc in wps:
        if group != grp:
            grp = group
            A(f"    // ── {group} " + "─" * max(1, 60 - len(group)))
        nm = name.replace('"', '\\"')
        dpart = f', description: "{desc}"' if desc else ""
        A(f'    {{ id: "{wid}", name: "{nm}", type: "{typ}", coordinates: {{ lat: {lat}, lng: {lng} }}, floor: {floor}{dpart} }},')
    A("  ],")
    A("}")
    A("")
    open(os.path.join(REPO, "src", "lib", "venues", "qmh.ts"), "w").write("\n".join(L))
    print(f"wrote src/lib/venues/qmh.ts ({len(wps)} waypoints)")


crop_png()
emit(build())
