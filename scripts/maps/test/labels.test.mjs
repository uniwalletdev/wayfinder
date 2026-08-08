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
  cleanLabel, isUndecodable, splitStorey, titleCaseLabel, wtype,
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

report()
