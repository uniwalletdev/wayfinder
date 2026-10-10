// Checks for the world map discovery: which sites get crawled, which hospital
// a document on a shared site belongs to, and that every map recorded by hand
// is one the classifier can read and names a hospital the list has.
//
// Run: node scripts/world/test/discover-plans.test.mjs
import { readFileSync, readdirSync, existsSync } from "fs"
import { group, check, report } from "../../nhs/test/harness.mjs"
import { websiteOf, sitesOf, distinctiveWords, attribute, candidateFrom, knownMapCandidates, sortCandidates } from "../lib/plans.mjs"
import { classifyDocument } from "../../nhs/lib/discovery-match.mjs"

group("the website a hospital records")
check("a page below the homepage is the seed", JSON.stringify(websiteOf({ website: "https://www.allinahealth.org/unity-hospital" })) === JSON.stringify({ origin: "https://www.allinahealth.org", page: "https://www.allinahealth.org/unity-hospital" }))
check("a homepage has no seed", websiteOf({ website: "https://www.sphealth.org/" })?.page === null)
check("a bare domain gets https", websiteOf({ website: "tanner.org" })?.origin === "https://tanner.org")
check("http stays http", websiteOf({ website: "http://hospital.example" })?.origin === "http://hospital.example")
check("the first of several is used", websiteOf({ website: "https://a.example; https://b.example" })?.origin === "https://a.example")
check("a fragment is dropped", websiteOf({ website: "https://a.example/maps#top" })?.page === "https://a.example/maps")
check("no website is null", websiteOf({ name: "x" }) === null)
check("junk is null", websiteOf({ website: "n/a" }) === null && websiteOf({ website: "-" }) === null)
check("a mail address is null", websiteOf({ website: "mailto:info@hospital.example" }) === null)

group("one site, many hospitals")
const rows = [
  { id: "a", name: "Mercy Hospital - Unity Campus", website: "https://www.allinahealth.org/unity-hospital" },
  { id: "b", name: "Abbott Northwestern Hospital", website: "https://www.allinahealth.org/abbott-northwestern-hospital" },
  { id: "c", name: "Mercy Hospital", website: "allinahealth.org" },
  { id: "d", name: "Somewhere Else", website: "https://elsewhere.example" },
  { id: "e", name: "No Website" },
]
const sites = sitesOf(rows)
check("hospitals sharing a site are grouped", sites.length === 2, `${sites.length} sites`)
const allina = sites.find((s) => s.origin === "https://www.allinahealth.org")
check("www and bare host are one site", allina?.hospitals.length === 3, JSON.stringify(allina?.hospitals.map((h) => h.id)))
check("the pages the tags pointed at become seeds", allina?.seeds.length === 2, JSON.stringify(allina?.seeds))
check("a hospital with no website is left out", !sites.some((s) => s.hospitals.some((h) => h.id === "e")))

group("which hospital a document names")
check("drops the words every hospital has", JSON.stringify(distinctiveWords("Mercy Hospital - Unity Campus")) === JSON.stringify(["mercy", "unity"]))
check("reads a possessive", JSON.stringify(distinctiveWords("St. Peter's Health")) === JSON.stringify(["peter"]))
check("splits a slash", JSON.stringify(distinctiveWords("Tanner Medical Center/Villa Rica")) === JSON.stringify(["tanner", "villa", "rica"]))
const shared = allina.hospitals
check("every distinctive word must appear", attribute(shared, "Unity Campus floor maps", "/x/Mercy-Hospital-Unity-Campus-floor-maps.pdf")?.id === "a")
check("the longest match wins over its prefix", attribute(shared, "", "/x/mercy-hospital-unity-campus-floor-maps.pdf")?.id === "a")
check("a shorter name matches on its own", attribute(shared, "", "/x/mercy-campus-map.pdf")?.id === "c")
check("a word inside another word does not count", attribute(shared, "", "/x/unityville-map.pdf") === null)
check("a document naming nobody on a shared site is unattributed", attribute(shared, "Floor maps", "/x/floor-maps.pdf") === null)
check("on a one-hospital site it is that hospital", attribute([rows[3]], "Floor maps", "/x/floor-maps.pdf")?.id === "d")

group("candidates")
const doc = { url: "https://www.allinahealth.org/x/floor-maps.pdf", linkText: "Floor maps", kind: "floor-plan", confidence: "high", format: "pdf" }
const unattributed = candidateFrom(doc, allina, "US")
check("an unattributed candidate lists the site's hospitals", unattributed.hospitalId === null && unattributed.siteHospitals?.length === 3, JSON.stringify(unattributed))
const owned = candidateFrom({ ...doc, url: "https://www.allinahealth.org/x/Mercy-Hospital-Unity-Campus-floor-maps.pdf" }, allina, "US")
check("an attributed one names the hospital and not the site", owned.hospitalId === "a" && owned.hospitalName === "Mercy Hospital - Unity Campus" && !("siteHospitals" in owned))
check("the country and site are recorded", owned.country === "US" && owned.website === "https://www.allinahealth.org")

group("maps recorded by hand")
const byId = new Map([["a", { id: "a", name: "Mercy Hospital - Unity Campus", country: "US", lat: 45.1, lng: -93.2 }]])
const warnings = []
const fromKnown = knownMapCandidates(
  [
    { country: "US", hospitalId: "a", url: "https://h.example/floor-maps.pdf", linkText: "Floor maps", note: "two levels" },
    { country: "US", hospitalId: "zz", hospitalName: "Typo Hospital", url: "https://h.example/site-map.pdf", linkText: "" },
    { country: "US", hospitalId: null, hospitalName: "Not Listed Hospital", url: "https://h.example/campus-map.pdf", linkText: "" },
    { country: "US", hospitalId: "a", url: "https://h.example/strategy.pdf", linkText: "Road map 2030" },
    { country: "US", hospitalId: "a", url: "https://h.example/maps-and-directions", linkText: "Maps" },
  ],
  byId,
  { warn: (m) => warnings.push(m) }
)
check("a map the classifier reads is kept, classified and marked", fromKnown[0]?.kind === "floor-plan" && fromKnown[0]?.addedByHand === true && fromKnown[0]?.note === "two levels")
check("the hospital's own name is used", fromKnown[0]?.hospitalName === "Mercy Hospital - Unity Campus")
check("an id the list does not have is kept and warned about", fromKnown[1]?.hospitalId === "zz" && warnings.some((w) => /zz/.test(w)), JSON.stringify(warnings))
check("a map for a hospital not yet listed is kept with a null id", fromKnown[2]?.hospitalId === null && fromKnown[2]?.hospitalName === "Not Listed Hospital")
check("a strategy document is refused", fromKnown.length === 3 && warnings.some((w) => /strategy\.pdf/.test(w)))
check("a web page is refused", warnings.some((w) => /maps-and-directions/.test(w)))

group("order of the queue")
const sorted = sortCandidates([
  { url: "https://h.example/site-map.pdf", kind: "site-map", confidence: "high", country: "US", hospitalName: "B" },
  { url: "https://h.example/floor-maps.pdf?t=1", kind: "floor-plan", confidence: "high", country: "US", hospitalName: "Z" },
  { url: "https://h.example/floor-maps.pdf?t=2", kind: "floor-plan", confidence: "high", country: "US", hospitalName: "Z" },
  { url: "https://h.example/maybe.pdf", kind: "floor-plan", confidence: "medium", country: "US", hospitalName: "A" },
  { url: "https://h.example/thing.pdf", kind: "unknown", confidence: "low", country: "US", hospitalName: "A" },
])
check("floor plans first, then confidence, then kind", sorted.map((c) => c.url.split("/").pop()).join(" ") === "floor-maps.pdf?t=1 maybe.pdf site-map.pdf thing.pdf", sorted.map((c) => c.url).join(" "))
check("a cache-busted copy is one document", sorted.length === 4)

group("data/world/known-maps.json")
// The file is read by every run, so a typo in it is a typo in the queue.
const known = JSON.parse(readFileSync("data/world/known-maps.json", "utf8")).maps
const lists = new Map()
const hospitalsIn = (cc) => {
  if (!lists.has(cc)) {
    const file = `data/world/hospitals/${cc}.json`
    lists.set(cc, existsSync(file) ? new Map(JSON.parse(readFileSync(file, "utf8")).hospitals.map((h) => [h.id, h])) : new Map())
  }
  return lists.get(cc)
}
check("has entries", known.length > 0)
for (const entry of known) {
  const label = entry.url.split("/").pop()
  check(`${label}: the classifier reads it as a map`, !!classifyDocument(entry.linkText ?? "", entry.url), `${entry.linkText} | ${entry.url}`)
  check(`${label}: says which country`, /^[A-Z]{2}$/.test(entry.country ?? ""))
  check(`${label}: says what it is`, typeof entry.note === "string" && entry.note.length > 20)
  if (entry.hospitalId) {
    const row = hospitalsIn(entry.country).get(entry.hospitalId)
    check(`${label}: ${entry.hospitalId} is in data/world/hospitals/${entry.country}.json`, !!row)
  } else {
    check(`${label}: a map without an id names its hospital`, typeof entry.hospitalName === "string" && entry.hospitalName.length > 3)
  }
}
check("no country file is in scope for the UK", !readdirSync("data/world/hospitals").includes("GB.json"))

report()
