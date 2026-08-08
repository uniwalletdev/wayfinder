// Checks for the site-identity helpers (scripts/nhs/lib/site-name.mjs).
//
// The case behind these: a Pinderfields Hospital site map was matched to the
// ODS record "Dewsbury & District Hospital-Combined Elective Surgical Hub" and
// shipped under that name, at Dewsbury's coordinates, ten miles from the
// building on the sheet. It passed the "do the labels echo the site name?"
// check because both names contain the word "hospital". A test that a match is
// carried by a word naming the *place* is the difference between a wrong map
// and no map.
//
// Run: node scripts/nhs/test/site-name.test.mjs
import { identifyingTokens, looksSpecialtyQualified } from "../lib/site-name.mjs"
import { group, check, report } from "./harness.mjs"

const has = (name, word) => identifyingTokens(name).has(word)
const size = (name) => identifyingTokens(name).size

group("identifying tokens")
{
  check("keeps the place", has("Pinderfields Hospital", "pinderfields"))
  check("drops the generic noun", !has("Pinderfields Hospital", "hospital"))
  check(
    "reduces an ODS mouthful to its place",
    [...identifyingTokens("Dewsbury & District Hospital-Combined Elective Surgical Hub")].join(",") === "dewsbury"
  )
  check("keeps both words of a two-word place", has("North Tees", "tees") && has("North Tees", "north"))
  check("drops NHS furniture", !has("University Hospitals Plymouth NHS Trust", "trust"))
  check("keeps the city", has("University Hospitals Plymouth NHS Trust", "plymouth"))

  // A name with nothing distinctive left must not collapse to an empty set —
  // an empty set would make the containment test vacuously true and accept any
  // sheet at all, which is the failure this helper exists to prevent.
  const generic = identifyingTokens("Community Diagnostic Centre")
  check("an all-generic name falls back to its full tokens", generic.size > 0)
  check("and keeps them all", generic.has("community") && generic.has("diagnostic"))
  check("an empty name yields nothing", size("") === 0)
}

group("the Pinderfields case")
{
  // The labels actually on the Pinderfields sheet.
  const labels = new Set(["pinderfields", "hospital", "main", "entrance", "gate", "accident", "emergency"])
  const wrong = identifyingTokens("Dewsbury & District Hospital-Combined Elective Surgical Hub")
  const right = identifyingTokens("Pinderfields Hospital")
  check("the wrong site shares no identifying word with the sheet", ![...wrong].some((t) => labels.has(t)))
  check("the right site does", [...right].some((t) => labels.has(t)))
}

group("specialty-qualified ODS names")
{
  const flagged = [
    "Immunology - Derriford Hospital",
    "Uh North Tees Dermatology",
    "Medway Maritime Hospital - Anaesthetics (Pain)",
    "The Maidstone Hospital - General Surgery",
    "Whiston Hospital Elective Surgical Hub",
  ]
  for (const n of flagged) check(`flags "${n}"`, looksSpecialtyQualified(n))

  // A genuinely specialist hospital reads the same way and must not be flagged
  // into a rename — losing "Eye" or "Orthopaedic" is the same error reversed.
  const clean = [
    "Pinderfields Hospital",
    "Western Eye Hospital",
    "Nuffield Orthopaedic Centre",
    "Great Ormond Street Hospital for Children",
    "Royal Berkshire Hospital",
  ]
  for (const n of clean) check(`leaves "${n}" alone`, !looksSpecialtyQualified(n))
}

report()
