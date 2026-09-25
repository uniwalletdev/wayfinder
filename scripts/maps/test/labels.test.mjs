// Checks for the sheet label cleaner (scripts/maps/lib/labels.mjs).
//
// Every one of these cases is a real string that shipped as a navigable
// waypoint in src/lib/venues. A hospital site map's text layer holds its title
// block, its key and its directory table alongside the destinations, and none
// of them announce which they are — so the only thing standing between a
// drawing and a venue is this filter. When it lets something through, a patient
// is offered "ICONS KEY:" as somewhere to walk to.
//
// Run: node scripts/maps/test/labels.test.mjs
import {
  cleanLabel, fixAcronyms, fixSpelling, isRepetitive, isUndecodable, splitStorey, splitWards,
  titleCaseLabel, wtype,
} from "../lib/labels.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

group("waypoint typing")
{
  // Twelve STAIRWELL labels across the estate were typed "other", so
  // buildRoute() with preference "fastest" could never offer stairs — while the
  // LIFT and WC labels drawn beside them were typed correctly, which is why
  // nobody noticed.
  check("a stairwell is stairs, not other", wtype("STAIRWELL") === "stairs")
  check("so is a staircase", wtype("Staircase 4") === "stairs")
  check("and stairs themselves", wtype("Stairs to Level 3") === "stairs")
  check("lifts still win over the generic sweep", wtype("Lift Lobby") === "lift")
  check("a WC is a toilet", wtype("MALE WC") === "toilet")
  check("a ward is a ward", wtype("Ward 16 Rehabilitation") === "ward")
  // "Stairwell" must not be swallowed by the department sweep, which matches
  // "building", "wing" and "block" — a stairwell in a named block would have
  // become a department.
  check("a stairwell in a named block is still stairs", wtype("Hart Building Stairwell") === "stairs")
}

group("title case")
{
  check("plain caps", titleCaseLabel("BISHOP AUCKLAND HOSPITAL") === "Bishop Auckland Hospital")
  check("slash-separated parts each cap", titleCaseLabel("REHABILITATION/PHYSIO ENTRANCE") === "Rehabilitation/Physio Entrance")
  check("ampersands survive", titleCaseLabel("ORAL & MAXILLO FACIAL SURGERY") === "Oral & Maxillo Facial Surgery")
  check("digits survive", titleCaseLabel("WARD 17 DAY SURGERY") === "Ward 17 Day Surgery")
  check("acronyms stay upper", titleCaseLabel("MALE WC") === "Male WC")
  check("so does A&E", titleCaseLabel("A&E RECEPTION") === "A&E Reception")
  check("and A&E after the first word", titleCaseLabel("EMERGENCY A&E ENTRANCE") === "Emergency A&E Entrance")
  check("a lowercased A&E is repaired", fixAcronyms("Emergency a&E Entrance") === "Emergency A&E Entrance")
  check("small words lowercase mid-name", titleCaseLabel("CENTRE FOR FETAL CARE") === "Centre for Fetal Care")
  check("but never as the first word", titleCaseLabel("THE NIGHTINGALE CENTRE") === "The Nightingale Centre")
  // The trust chose the casing on a mixed-case label; only shouting is fixed.
  check("mixed case is left alone", titleCaseLabel("Alex Cross ward") === "Alex Cross ward")
}

group("undecodable text")
{
  // Northampton shipped this as a waypoint name: a subsetted font with no
  // ToUnicode map, decoded to 49 characters of noise, under the 58-char ceiling.
  check(
    "a font-decoding failure is rejected",
    isUndecodable("KDXCLKHHCRERLKLKUMJKKJDBKYBDSGACQBQJNALMFRJKHKJEQ")
  )
  check("a long real name is not", !isUndecodable("Ophthalmology"))
  check("nor is a long hyphenated one", !isUndecodable("Maxillo-Facial"))
  check("short tokens are never judged", !isUndecodable("CCU"))
  check("multi-word text is never judged", !isUndecodable("MRI CT XR SCAN"))
}

group("storey in the label")
{
  // Northampton's 109 waypoints all sit on floor 0 while naming their real
  // storey in the label — the building's vertical structure was printed on the
  // sheet, extracted into the string, and thrown away.
  const a = splitStorey("Allebone (Second Floor)")
  check("a bracketed storey comes out of the name", a.name === "Allebone")
  check("and is reported as a floor index", a.floor === 2)
  check("with the label a person would read", a.storeyLabel === "Second Floor")

  const b = splitStorey("FIRST FLOOR: Coronary Care Unit (CCU)")
  check("a leading storey comes out too", b.name === "Coronary Care Unit (CCU)")
  check("with its index", b.floor === 1)

  const c = splitStorey("Balmoral - Birth Centre (First Floor)")
  check("a hyphenated name survives the split", c.name === "Balmoral - Birth Centre")

  check("ground is floor 0", splitStorey("Abington (Ground Floor)").floor === 0)
  check("lower ground is below it", splitStorey("Imaging (Lower Ground Floor)").floor === -1)
  check("a name with no storey is untouched", splitStorey("Pharmacy").floor === null)
  // "(Ground Floor)" on its own would leave nothing behind; the NOISE list
  // drops it, and the splitter must not turn it into an empty name first.
  check("a bare storey is left for the noise filter", splitStorey("(Ground Floor)").name === "(Ground Floor)")
}

group("sheet furniture is not a destination")
{
  const rejected = [
    "ICONS KEY:", "(IN ALPHABETICAL ORDER)", "LOCATION", "FLOOR & ROUTE",
    "Site Map - September 2025", "LEGEND", "Contents", "Disclaimer",
    "CAR PARK 5 STAFF ONLY PARKING", "NON-TRUST PARKING",
    "Marylebone Station", "Bus Station", "KDXCLKHHCRERLKLKUMJKKJDBKYBDSGACQBQJNALMFRJKHKJEQ",
  ]
  for (const s of rejected) check(`rejects "${s}"`, cleanLabel(s) === null)

  // "Disabled parking" and "Visitor car park" are deliberately dropped by rules
  // that predate this module — the bare generic forms are map-key entries, not
  // located places. A numbered car park is a real destination and stays.
  const kept = [
    "MAIN ENTRANCE", "Ward 16 Rehabilitation", "Nightingale Centre",
    "Nurses Station", "Car Park 3", "Eye A&E department",
  ]
  for (const s of kept) check(`keeps "${s}"`, cleanLabel(s) !== null)
}

group("cleanLabel end to end")
{
  const l = cleanLabel("WARD 16 REHABILITATION")
  check("shouting is calmed", l.text === "Ward 16 Rehabilitation")
  check("and typed", l.type === "ward")

  const s = cleanLabel("Allebone (Second Floor)")
  check("the storey is lifted off the name", s.text === "Allebone")
  check("and carried alongside it", s.floorFromLabel === 2 && s.storeyLabel === "Second Floor")

  // A label that only becomes furniture after its storey is removed must not
  // survive as an empty-ish waypoint.
  check("a storey-only label is dropped", cleanLabel("(Ground Floor)") === null)
}


// --- September 2026: the per-hospital review ---------------------------------
// Every string below shipped as a waypoint in a generated venue module and was
// found by reading the 67 venues one by one (docs/venue-review-2026-09.md).

group("directory headings and title blocks")
{
  // North Tees shipped its directory's column headings as three destinations;
  // Wakefield's diagnostic-centre plan shipped a CAD title block line by line.
  const headings = [
    "Level", "Floor", "Zone", "Area", "Department / Ward", "Ward/Department",
    "Clinic/ Ward/Department", "1st Floor", "2nd Floor", "All Ground Floor",
    "First Floor:", "Level -1", "Patient Areas", "Staff areas",
    "Wf-Cdc-GF", "Nts", "Rev Description", "Date/Sig", "A1 Plan", "MiCAD LINK",
    "The Mid Yorkshire Teaching", "NHS Trust", "Unit 9B",
  ]
  for (const s of headings) check(`rejects "${s}"`, cleanLabel(s) === null)
  check("a caption cut off at a preposition is dropped", cleanLabel("Wards / on") === null)
  check("so is one cut off at 'to'", cleanLabel("Lifts to") === null)
  // A storey heading that leads a real name is a storey, not furniture.
  check("a level prefix comes off a real name", cleanLabel("Level 3 Reception")?.text === "Reception")
  check("and is kept as the storey", cleanLabel("Level 3 Reception")?.storeyLabel === "Level 3")
}

group("route notes and off-site landmarks")
{
  const notes = [
    "Closed", "Exit Only", "No Vehicle Entry Exit Only", "Vehicle entry only. No exit.",
    "Limited Access/Delivery", "Ramp access to all Levels and exit to car park (P2)",
    "Access via Level 2", "Drop off route to A&E", "Pay here for parking", "Eye Centre footpath",
    "Outdoor pathway Level 3 corridor Level 2 corridor",
    "The George Park & Ride", "A386 to Tavistock", "A1086", "Leeds Via M1", "Pontefract Via M62",
    "Bus Station (5, 128, 175, 193, 365, 496, 498, 499)", "& bus stop",
  ]
  for (const s of notes) check(`rejects "${s}"`, cleanLabel(s) === null)
  // A road number is only a road when it stands alone or leads somewhere; a
  // clinic can be called A12.
  check("a clinic numbered like a road survives", cleanLabel("A12 Clinic")?.text === "A12 Clinic")
  check("a numbered car park survives", cleanLabel("Car Park 3") !== null)
}

group("repeated tokens")
{
  check("a column of markers read as one string", isRepetitive("8 3 4 Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh Mh"))
  check("a word three times over", isRepetitive("Ward Ward Ward"))
  check("three captions welded on a shared word", isRepetitive("Rheumatology OPD Chemotherap OPD Chemotherapy OPD"))
  check("numbers are not tokens", !isRepetitive("Wards 5, 6, 7 & 8"))
  check("a plain name is not repetitive", !isRepetitive("Coronary Care Unit"))
  check("cleanLabel drops the marker column", cleanLabel("5 Mh Mh Mh Mh Mh") === null)
  // A directory row with nothing left once the storeys are set aside.
  check("a row of storey numbers is dropped", cleanLabel("9 (1st floor) 10 (2nd floor ) 11 (3rd floor )") === null)
  // Punctuation and digits are not letter-spacing: this label is four
  // one-character tokens out of seven and used to be dropped for it.
  check("digits and symbols do not read as letter-spaced text", cleanLabel("Wards 3 & 4 — Green zone")?.text === "Wards 3 & 4 — Green zone")
}

group("bracketed fragments")
{
  // The tail of a neighbouring caption, read on its own. An acronym is a
  // destination people ask for by name; a stray word is not.
  check("(PALS) is kept as PALS", cleanLabel("(PALS)")?.text === "PALS")
  check("(SAU) is kept", cleanLabel("(SAU)")?.text === "SAU")
  check("an acronym list is kept and re-capitalised", cleanLabel("(Seau, SAU)")?.text === "SEAU, SAU")
  check("so is one joined with and", cleanLabel("(AEC and SDEC)")?.text === "AEC and SDEC")
  for (const s of ["(Adult)", "(via YELLOW ROUTE)", "(Level 2)", "(New Building)", "(Bwh)",
    "(Primary Percutaneous Coronary Intervention)", "(Including Emergency Gynaecology)"]) {
    check(`drops "${s}"`, cleanLabel(s) === null)
  }
}

group("more storey forms")
{
  const a = cleanLabel("2nd Fl. Pharmacy & Pathology")
  check("an ordinal prefix comes off", a?.text === "Pharmacy & Pathology")
  check("and is a floor index", a?.floorFromLabel === 2 && a?.storeyLabel === "Second Floor")
  const b = cleanLabel("Wards 5, 6, 7 & 8 — First Floor")
  check("an em-dashed storey comes off", b?.text === "Wards 5, 6, 7 & 8" && b?.floorFromLabel === 1)
  const c = cleanLabel("Emergency Department Entrance (Level 2)")
  check("a bracketed level comes off", c?.text === "Emergency Department Entrance")
  check("a level number is a label, not an index", c?.floorFromLabel === null && c?.storeyLabel === "Level 2")
  check("a trailing level comes off", cleanLabel("Main Entrance Level 6")?.text === "Main Entrance")
  check("a bracketed ordinal comes off", cleanLabel("Clinic 4 (1st Floor)")?.text === "Clinic 4")
  const g = cleanLabel("GF A&E")
  check("a GF prefix is the ground floor", g?.text === "A&E" && g?.floorFromLabel === 0)
  const t = cleanLabel("Ground Floor Theatres")
  check("a leading storey without a colon comes off", t?.text === "Theatres" && t?.storeyLabel === "Ground Floor")
  const u = cleanLabel("Bone Infection Unit First Floor")
  check("a trailing storey without a dash comes off", u?.text === "Bone Infection Unit" && u?.floorFromLabel === 1)
  check("a bus-stop letter leading a caption goes", cleanLabel("Stop N Main entrance Ground floor")?.text === "Main entrance")
  check("a floor key is furniture", cleanLabel("First Floor Key:") === null)
  check("a roundabout is off-site", cleanLabel("Derriford Roundabout") === null)
  // Where the stairs go is part of the name.
  check("a storey after 'to' stays", cleanLabel("Stairs to level 1")?.text === "Stairs to level 1")
  check("a bare level is still dropped", cleanLabel("Level 2") === null)
}

group("acronyms and spelling")
{
  check("a lowercased acronym goes back to capitals", fixAcronyms("Acute Cardiology Unit (Acu)") === "Acute Cardiology Unit (ACU)")
  check("a brand keeps its own casing", fixAcronyms("Whsmith") === "WHSmith")
  check("a two-letter word is left alone", fixAcronyms("It Department") === "It Department")
  check("but a two-letter scan is not", fixAcronyms("Ct Scanner") === "CT Scanner")
  check("GUM clinic", cleanLabel("Gum Clinic")?.text === "GUM Clinic")
  // Pinderfields' PDF font has no "g".
  check("a lost g is restored", fixSpelling("Accident and Emerency Entrance (A&E)") === "Accident and Emergency Entrance (A&E)")
  check("in the case it was written", fixSpelling("Visitors blue bade parkin") === "Visitors blue badge parking")
  check("a trailing price marker goes", cleanLabel("Wrvs Shop £")?.text === "WRVS Shop")
  check("a ward clipped at the page edge", cleanLabel("A3 war")?.text === "A3 ward" && cleanLabel("A3 war")?.type === "ward")
}

group("typing the amenities")
{
  check("baby changing is a toilet", wtype("Baby Changing") === "toilet")
  check("changing places is a toilet", wtype("Changing Places") === "toilet")
  check("a bare Information is a desk", wtype("Information") === "reception")
  check("an information centre is a department", wtype("Macmillan Information Centre") === "department")
  check("an exit is an exit", wtype("Exit") === "exit")
  check("the main gate is an exit", wtype("Main Gate") === "exit")
  check("an escalator is stairs", wtype("Escalator") === "stairs")
  check("a shop is filed under canteen", wtype("Shop") === "canteen")
  check("so is a coffee chain", wtype("Costa") === "canteen")
  check("a workshop is not a shop", wtype("Path Labs & Workshop") === "other")
}

group("merged ward captions")
{
  check("four wards, name first",
    JSON.stringify(splitWards("Cavell Ward Gunning Ward Keate Ward Major Trauma Ward")) ===
      JSON.stringify(["Cavell Ward", "Gunning Ward", "Keate Ward", "Major Trauma Ward"]))
  check("three wards, code first",
    JSON.stringify(splitWards("Ward 6b Renal Ward 7a Vascular Ward 7b")) ===
      JSON.stringify(["Ward 6b Renal", "Ward 7a Vascular", "Ward 7b"]))
  check("two wards", JSON.stringify(splitWards("Cheselden Ward Florence Nightingale Ward")) === JSON.stringify(["Cheselden Ward", "Florence Nightingale Ward"]))
  check("a ward and a unit", JSON.stringify(splitWards("McEntee Ward Ruth Myles Ward Haematology Day Unit")) === JSON.stringify(["McEntee Ward", "Ruth Myles Ward", "Haematology Day Unit"]))
  // Nothing here can tell where "Vascular Laboratory Vernon" divides.
  check("an ambiguous merge is left alone", splitWards("Gray Ward Vascular Laboratory Vernon Ward") === null)
  check("one ward is one ward", splitWards("Major Trauma Ward") === null)
  check("a numbered ward is one ward", splitWards("Ward 16 Rehabilitation") === null)
  check("a ward range is one label", splitWards("Wards 19 & 21") === null)
  check("a ward with its specialties is one label", splitWards("Ward 22/23 (Ante natal / Post Natal / Neonatal)") === null)
}

report()
