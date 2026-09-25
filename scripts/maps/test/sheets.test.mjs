// Checks for the sheet-config reader (scripts/maps/sheets.mjs): that a
// person's identity corrections in data/venue-identity.json are laid over the
// drafted entries, and that the committed corrections all point at sheets
// that exist.
//
// Run: node scripts/maps/test/sheets.test.mjs
import { applyIdentity, readIdentity, readSheets } from "../sheets.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

const drafted = {
  slug: "sgh-site-map", id: "sgh-site-map-venue", name: "St Georges at Woking Hospital",
  subtitle: "St George's University Hospitals NHS Foundation Trust · GU22 7HS",
  file: "map/auto/sgh-site-map.pdf", page: 1, center: [51.315131, -0.556284], spanM: 256,
  plan: [0, 0, 1, 1], quick: ["Outpatients"], notes: "drafted",
}

group("identity corrections")
{
  check("no correction leaves the sheet as drafted", applyIdentity(drafted, undefined) === drafted)
  const fixed = applyIdentity(drafted, { name: "St George's Hospital, Tooting", center: [51.4266, -0.1749], spanM: 520 })
  check("the name is replaced", fixed.name === "St George's Hospital, Tooting")
  check("so is the position", fixed.center[0] === 51.4266 && fixed.center[1] === -0.1749)
  check("and the scale", fixed.spanM === 520)
  check("fields not corrected are kept", fixed.subtitle === drafted.subtitle && fixed.quick === drafted.quick)
  check("the drafted entry is not mutated", drafted.name === "St Georges at Woking Hospital")
  // An empty shortcut list is a correction too: a retail-park plan has no
  // hospital destinations to offer as chips.
  check("an empty quick list is honoured", applyIdentity(drafted, { quick: [] }).quick.length === 0)

  // Re-storeying: a single sheet that is one level of a building.
  const level = applyIdentity(drafted, { floor: { id: "f2", floor: 2, label: "Level 3" }, floorNaming: { word: "Level", groundLevel: 1 } })
  check("a floor correction gives the sheet one floor", level.floors?.length === 1)
  check("on the storey asked for", level.floors[0].floor === 2 && level.floors[0].label === "Level 3")
  check("drawn from the same file", level.floors[0].file === drafted.file && level.floors[0].page === 1)
  check("with the venue's floor naming", level.floorNaming?.groundLevel === 1)
}

group("the committed corrections")
{
  const identity = readIdentity()
  check("there are corrections on file", Object.keys(identity).length > 0)
  let sheets
  try { sheets = readSheets() } catch (err) { check(`readSheets: ${err.message}`, false) }
  if (sheets) {
    const bySlug = new Map(sheets.map((s) => [s.slug, s]))
    for (const [slug, fix] of Object.entries(identity)) {
      const sheet = bySlug.get(slug)
      check(`"${slug}" is a sheet that exists`, !!sheet)
      if (!sheet) continue
      if (fix.name) check(`"${slug}" reads with its corrected name`, sheet.name === fix.name)
      if (fix.center) check(`"${slug}" reads at its corrected position`, sheet.center[0] === fix.center[0] && sheet.center[1] === fix.center[1])
      check(`"${slug}" says what the correction rests on`, typeof fix.evidence === "string" && fix.evidence.length > 20 && /^\d{4}-\d{2}-\d{2}$/.test(fix.checked ?? ""))
      if (fix.floor) check(`"${slug}" reads as its one floor`, sheet.floors.length === 1 && sheet.floors[0].floor === fix.floor.floor && sheet.floors[0].image === fix.floor.id)
    }
  }
}

report()
