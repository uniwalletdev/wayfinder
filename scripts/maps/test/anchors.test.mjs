// Checks for reading a sheet's own statements about the world
// (scripts/maps/lib/anchors.mjs).
//
// Every case here is a string that actually appears on a trust's site map. The
// job is narrow and the failure mode is specific: a phrase wrongly read as a
// street name becomes a control point pinned to a place that does not exist,
// and a placement solved from it is confidently wrong — which is worse than the
// north-up guess it replaces, because it comes with a residual that looks fine.
//
// "Way" is where this lives or dies. It ends real street names and it ends half
// the prose a hospital prints on its map.
//
// Run: node scripts/maps/test/anchors.test.mjs
import { readTextItems, normaliseStreetName, readAnchors } from "../lib/anchors.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

const sheet = (texts, { W = 1000, H = 700, quote = '"' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">` +
  texts
    .map(([t, x = 100, y = 100]) => `<text x=${quote}${x}${quote} y=${quote}${y}${quote} font-size=${quote}9${quote}>${t}</text>`)
    .join("") +
  `</svg>`

const namesOf = (svg) => readAnchors(svg).streetNames

group("reading text off a plan")
{
  const doc = readTextItems(sheet([["Derriford Road", 250, 140]]))
  check("the page size comes from the viewBox", doc.W === 1000 && doc.H === 700)
  check("the text is read", doc.items[0].text === "Derriford Road")
  check("and normalised to the page", doc.items[0].nx === 0.25 && doc.items[0].ny === 0.2)

  // pdf2svg writes double quotes and the hand-built venues write single. Reading
  // only one style silently drops every plan written in the other — which is how
  // all ten GOSH levels, the best-drawn plans in the repo, read as blank.
  const single = readTextItems(sheet([["Guilford Street", 500, 70]], { quote: "'" }))
  check("single-quoted attributes are read too", single.items.length === 1)
  check("with their positions", single.items[0].nx === 0.5)

  check("an SVG with no viewBox is refused", readTextItems("<svg></svg>") === null)
  check("empty text is skipped", readTextItems(sheet([["   ", 10, 10]])).items.length === 0)
  check("entities are decoded", readTextItems(sheet([["A&amp;E Road"]])).items[0].text === "A&E Road")
}

group("tidying a street name")
{
  check("ALL-CAPS is title-cased", normaliseStreetName("GREAT ORMOND STREET") === "Great Ormond Street")
  check("mixed case is left alone", normaliseStreetName("Du Cane Lane") === "Du Cane Lane")
  // The sheets append the road's classification; a gazetteer wants the name.
  check("a road number is dropped", normaliseStreetName("Bristol Road A38") === "Bristol Road")
  check("a bracketed aside is dropped", normaliseStreetName("Uxbridge Road (main)") === "Uxbridge Road")
  check("spacing is tidied", normaliseStreetName("  Old   Road  ") === "Old Road")
}

group("what counts as a street")
{
  check("a plain name", namesOf(sheet([["Blackshaw Road"]])).length === 1)
  check("a drive", namesOf(sheet([["Morlaix Drive"]])).length === 1)
  check("a real Way", namesOf(sheet([["Headley Way"]])).length === 1)
  // Addresses are better than bare names, not worse — they geocode exactly.
  check("an address keeps its tail", namesOf(sheet([["London Road, Reading RG1 5AN"]]))[0].startsWith("London Road"))

  check("a bare suffix names nothing", namesOf(sheet([["Road"]])).length === 0)
  check("nor does a bare Close", namesOf(sheet([["Close"]])).length === 0)

  // The prose. Every one of these was read as a street before the rules below
  // existed, on sheets that ship today.
  for (const prose of [
    "Ambulance access only this way",
    "Two way section",
    "Finding your way around",
    "To Headley Way",
    "Vehicle One Way Road",
    "is often the easiest way to get to us.",
    "Main Entrance Road closed",
    "Staff car park off Old Road",
  ]) {
    check(`"${prose.slice(0, 34)}" is not a street`, namesOf(sheet([[prose]])).length === 0)
  }
}

group("north and scale")
{
  const a = readAnchors(sheet([["N", 900, 80], ["Guilford Street", 300, 60], ["20 m", 880, 640]]))
  check("a lone N is the compass", a.north.length === 1)
  check("and it keeps its place on the page", a.north[0].nx === 0.9)
  check("a scale bar is read with its distance", a.scaleBars.length === 1 && a.scaleBars[0].metres === 20)
  check("the compass is not counted as a street", a.streetNames.length === 1)

  check("a bare number is not a scale", readAnchors(sheet([["20"]])).scaleBars.length === 0)
  check("nor is a room number", readAnchors(sheet([["Ward 20"]])).scaleBars.length === 0)
  check("'North' spelled out still counts", readAnchors(sheet([["North"]])).north.length === 1)
  // "North Road" is a street, not a compass rose.
  check("but North Road is a street", (() => {
    const r = readAnchors(sheet([["North Road"]]))
    return r.north.length === 0 && r.streetNames.length === 1
  })())
}

group("one street named twice")
{
  // A long road labelled at both ends of the sheet. Two anchors on one line do
  // not fix a position, but the line's direction does constrain the angle — so
  // they are worth reporting rather than collapsing away.
  const a = readAnchors(sheet([["Derriford Road", 100, 100], ["Derriford Road", 800, 300], ["Brest Road", 400, 600]]))
  check("the name appears once in the list", a.streetNames.length === 2)
  check("both labels are kept", a.streets.length === 3)
  check("and the repeat is reported", a.repeated.length === 1 && a.repeated[0].times === 2)
}

report()
