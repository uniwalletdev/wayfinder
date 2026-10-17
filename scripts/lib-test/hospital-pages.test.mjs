// Checks the website's hospital pages (src/lib/hospital-pages.ts), their
// structured data (src/lib/structured-data.ts), /llms.txt (src/lib/llms-txt.ts)
// and the IndexNow sender (scripts/indexnow.mjs): which hospitals get a page
// and at what address, that what a page says about a place matches the map,
// and that nothing claims more than the data holds.
//
// Run: node scripts/lib-test/hospital-pages.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const H = await import(fileURLToPath(new URL("hospital-pages.ts", SRC)))
const S = await import(fileURLToPath(new URL("structured-data.ts", SRC)))
const { llmsTxt } = await import(fileURLToPath(new URL("llms-txt.ts", SRC)))
const { appAvailability, PLAY_STORE_URL } = await import(fileURLToPath(new URL("store-links.ts", SRC)))
const { SEED_VENUES } = await import(fileURLToPath(new URL("venues/index.ts", SRC)))
const N = await import("../indexnow.mjs")
const { group, check, report } = await import("../nhs/test/harness.mjs")

const BASE = new URL("https://findway.ai")
const PAGES = H.hospitalPages(SEED_VENUES)
const page = (id) => PAGES.find((p) => p.venue.id === id)
const venue = (id) => SEED_VENUES.find((v) => v.id === id)
const GOSH = venue("gosh")
const wp = (over) => ({ id: over.name.toLowerCase().replace(/\W+/g, "-"), type: "department", coordinates: { lat: 51.5, lng: -0.1 }, floor: 0, ...over })
const fake = (over) => ({
  id: "fake",
  slug: "fake",
  name: "Fake Hospital",
  subtitle: "Fake NHS Trust · 1 High Street, Townton AB1 2CD",
  category: "hospital",
  center: { lat: 51.5, lng: -0.1 },
  defaultZoom: 18,
  floorPlans: [],
  waypoints: [wp({ name: "Ward 10", type: "ward" }), wp({ name: "Ward 2", type: "ward" })],
  visibility: "public",
  verified: false,
  ...over,
})

group("which hospitals get a page, and its address")
{
  check("names become addresses", H.slugify("St George's Hospital, Tooting") === "st-georges-hospital-tooting")
  check("an ampersand reads as 'and'", H.slugify("Queen Charlotte's & Chelsea Hospital") === "queen-charlottes-and-chelsea-hospital")
  check("dashes and accents are tidied", H.slugify("Manchester Royal Infirmary — Oxford Road Campus") === "manchester-royal-infirmary-oxford-road-campus" && H.slugify("Hôpital Évian") === "hopital-evian")
  check("every page has its own address", new Set(PAGES.map((p) => p.slug)).size === PAGES.length)
  check("addresses are clean", PAGES.every((p) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)))
  check("Great Ormond Street is at /hospitals/great-ormond-street-hospital", page("gosh")?.slug === "great-ormond-street-hospital")
  check("a generated map is named after the hospital, not its PDF", page("hospital-map-external-2025-venue")?.slug === "medway-maritime-hospital")
  check("the grounds map and the hospital map are two pages", page("sgh-site-map-venue")?.slug === "st-georges-hospital-tooting-grounds-and-car-parks" && page("st-georges")?.slug === "st-georges-hospital-tooting")
  check("a placeholder drawing gets no page", !page("cuh") && venue("cuh")?.illustrative === true)
  check("a building that is not a hospital gets no page", !page("cannery-trails"))
  check("a directory pin with nothing inside gets no page", PAGES.every((p) => p.venue.waypoints.length > 0))
  check("dozens of hospitals do", PAGES.length >= 50)
  const twins = H.hospitalPages([fake({ id: "a" }), fake({ id: "b" })])
  check("a second hospital of the same name adds its id", twins[0].slug === "fake-hospital" && twins[1].slug === "fake-hospital-b")
  check("paths", H.hospitalPath("x") === "/hospitals/x" && H.navigatePath(GOSH) === "/navigate?venue=gosh")
  check("a place's link opens directions to it", H.navigatePath(GOSH, { id: "kangaroo-ward" }) === "/navigate?venue=gosh&to=kangaroo-ward")
}

group("where the hospital is")
{
  const g = H.hospitalAddress(GOSH)
  check("the trust and the address come apart", g.trust === "Great Ormond Street Hospital for Children NHS Foundation Trust" && g.line === "London WC1N 3JH")
  check("the town and the postcode", g.locality === "London" && g.postcode === "WC1N 3JH" && g.street === undefined)
  const sg = H.hospitalAddress(venue("st-georges"))
  check("a street", sg.street === "Blackshaw Road" && sg.locality === "London" && sg.postcode === "SW17 0QT")
  check("a street with a district", H.hospitalAddress(venue("newham-university-hospital")).street === "Glen Road, Plaistow")
  const ch = H.hospitalAddress(venue("ch-hospital-sitemap-venue"))
  check("a bare postcode", ch.postcode === "OX3 7LE" && ch.locality === undefined && ch.street === undefined)
  const own = H.hospitalAddress(fake({ subtitle: "Own NHS Trust", address: ["2 Low Road", "Villeham"], postcode: "ZZ9 9ZZ" }))
  check("a venue's own address fields win", own.trust === "Own NHS Trust" && own.line === "2 Low Road, Villeham, ZZ9 9ZZ" && own.postcode === "ZZ9 9ZZ")
  check("no subtitle, no address", H.hospitalAddress(fake({ subtitle: undefined })).line === undefined)
}

group("what each place is said to be, and where")
{
  const named = (v, name) => v.waypoints.find((w) => w.name === name)
  check("a description that names the level is not repeated", H.placeWhere(named(GOSH, "Kangaroo Ward"), GOSH) === "Premier Inn Clinical Building, Level 2")
  check("otherwise the floor is added", H.placeWhere(named(GOSH, "Echo / ECG"), GOSH) === "Level 1 · Within the Walrus Clinical Investigations Centre")
  const medway = venue("hospital-map-external-2025-venue")
  check("a site map claims no floors", !H.hasFloors(medway) && medway.waypoints.every((w) => !/Ground Floor|Floor \d/.test(H.placeWhere(w, medway))))
  check("a building field is named", H.placeWhere(wp({ name: "X", building: "East Wing" }), fake({})) === "East Wing")
  const groups = H.placeGroups(GOSH)
  const listed = groups.flatMap((x) => x.places)
  check("lifts and stairs are not listed", listed.every((w) => w.type !== "lift" && w.type !== "stairs"))
  check("entrances first, then wards, then departments", groups.map((x) => x.key).slice(0, 3).join() === "entrances,wards,departments")
  check("no empty groups", groups.every((x) => x.places.length > 0))
  check("everything a visitor looks for is listed", GOSH.waypoints.filter((w) => w.type === "ward").every((w) => listed.includes(w)))
  const f = H.placeGroups(fake({ waypoints: [wp({ name: "Ward 10", type: "ward" }), wp({ name: "Ward 2", type: "ward" }), wp({ name: "ward 2", type: "ward", id: "dup" })] }))
  check("numbers sort as numbers, and a place is listed once", f[0].places.map((w) => w.name).join() === "Ward 2,Ward 10")
  const b = H.buildingSummaries(GOSH)
  check("each building and its storeys", b.length > 2 && b.every((x) => /^Level -?\d+( to Level -?\d+)?$/.test(x.floors)))
}

group("what the page says about the hospital")
{
  check("counts read as English", H.countsPhrase({ wards: 29, departments: 68, entrances: 4 }) === "29 wards, 68 departments and clinics, and 4 entrances")
  check("one of each", H.countsPhrase({ wards: 1, departments: 1, entrances: 0 }) === "1 ward and 1 department or clinic")
  check("nothing to count, nothing said", H.countsPhrase({ wards: 0, departments: 0, entrances: 0 }) === "")
  const c = H.placeCounts(GOSH)
  check("counts match the lists", c.wards === H.placeGroups(GOSH).find((x) => x.key === "wards").places.length)
  const d = H.hospitalDescription(GOSH)
  check("the description names the hospital, where it is, and what is mapped", d.startsWith("Find your way around Great Ormond Street Hospital, London WC1N 3JH: ") && d.includes(`${c.wards} wards`))
  const qs = H.hospitalQuestions(GOSH, "on the web and Android")
  check("is there a map", qs[0].question === "Is there a map of Great Ormond Street Hospital?" && qs[0].answer.includes("free on the web and Android"))
  check("how to get there", qs[1].question === "How do I get to Great Ormond Street Hospital?" && qs[1].answer.startsWith("Great Ormond Street Hospital is at London WC1N 3JH. Apple Maps or Google Maps"))
  check("no button the app lacks is promised", qs.every((q) => !q.answer.includes("Directions to the hospital")))
  const dl = H.directionsLinks(GOSH)
  check("directions there by name and address", dl.google === "https://www.google.com/maps/dir/?api=1&destination=Great%20Ormond%20Street%20Hospital%2C%20London%20WC1N%203JH" && dl.apple === "https://maps.apple.com/?daddr=Great%20Ormond%20Street%20Hospital%2C%20London%20WC1N%203JH")
  check("or by position when there is no address", H.directionsLinks(fake({ subtitle: undefined })).google.endsWith("destination=51.500000%2C-0.100000"))
  check("where its popular places are, entrances aside", qs.some((q) => q.question === "Where is Pharmacy at Great Ormond Street Hospital?") && !qs.some((q) => q.question.startsWith("Where is Main Entrance")))
  check("four of them at most", qs.filter((q) => q.question.startsWith("Where is")).length === 4)
  const pq = qs.find((q) => q.question.startsWith("Where is Pharmacy"))
  check("an answer says where", pq?.answer.startsWith("Pharmacy: Variety Club Building, Level 2. "))
  check("no address, no directions question", H.hospitalQuestions(fake({ subtitle: undefined }), "x").every((q) => !q.question.startsWith("How do I get")))
  const barts = page("st-bartholomews")
  const siblings = H.sameTrust(barts, PAGES)
  check("other hospitals of the same trust, not itself", siblings.length >= 3 && !siblings.includes(barts) && siblings.every((p) => H.hospitalAddress(p.venue).trust === "Barts Health NHS Trust"))
  check("availability follows the App Store link", appAvailability(null) === "on the web and Android" && appAvailability("https://apps.apple.com/app/id1") === "on the web, iPhone and Android")
}

group("structured data")
{
  const gp = page("gosh")
  const node = S.hospitalNode(BASE, gp)
  check("a Hospital", node["@type"] === "Hospital" && node["@id"] === "https://findway.ai/hospitals/great-ormond-street-hospital#hospital")
  check("with its postal address", node.address.postalCode === "WC1N 3JH" && node.address.addressLocality === "London" && node.address.addressCountry === "GB")
  check("and where it is", node.geo.latitude === GOSH.center.lat && node.geo.longitude === GOSH.center.lng)
  check("run by its trust", node.parentOrganization.name === "Great Ormond Street Hospital for Children NHS Foundation Trust")
  check("not claiming this site as its website", !("url" in node))
  const listed = H.placeGroups(GOSH).reduce((n, x) => n + x.places.length, 0)
  check("every listed place, each with directions", node.containsPlace.length === listed && node.containsPlace.every((p) => p.hasMap.startsWith("https://findway.ai/navigate?venue=gosh&to=")))
  const pageNode = S.hospitalPageNode(BASE, gp, "t", "d")
  check("the page is about the hospital", pageNode.about["@id"] === node["@id"] && pageNode.url === "https://findway.ai/hospitals/great-ormond-street-hospital")
  const crumbs = S.breadcrumbNode(BASE, [{ name: "Findway", path: "/" }, { name: "Hospital maps", path: "/hospitals" }])
  check("breadcrumbs are absolute and numbered", crumbs.itemListElement[1].item === "https://findway.ai/hospitals" && crumbs.itemListElement[1].position === 2)
  const faq = S.faqNode([{ question: "Q?", answer: "A." }])
  check("questions and answers", faq.mainEntity[0].name === "Q?" && faq.mainEntity[0].acceptedAnswer.text === "A.")
  check("the app without the App Store", S.appNode(BASE, null).operatingSystem === "Web, Android" && S.appNode(BASE, null).installUrl.join() === PLAY_STORE_URL)
  check("the app with it", S.appNode(BASE, "https://apps.apple.com/app/id1").operatingSystem === "Web, Android, iOS")
  check("free", S.appNode(BASE).offers.price === "0")
  const all = JSON.stringify(S.graph(S.organizationNode(BASE), S.websiteNode(BASE), S.appNode(BASE), node, S.hospitalListNode(BASE, PAGES)))
  check("everything serialises, with nothing left undefined", JSON.parse(all)["@graph"].length === 5 && !all.includes("undefined"))
  check("the list holds every page", S.hospitalListNode(BASE, PAGES).numberOfItems === PAGES.length)
}

group("llms.txt")
{
  const txt = llmsTxt(SEED_VENUES, BASE)
  check("a title, then a one-paragraph summary", txt.startsWith("# Findway\n\n> Findway is a free hospital wayfinding app"))
  check("every hospital page is listed", PAGES.every((p) => txt.includes(`(https://findway.ai/hospitals/${p.slug})`)))
  check("each with its address", txt.includes("[Great Ormond Street Hospital](https://findway.ai/hospitals/great-ormond-street-hospital): London WC1N 3JH. 29 wards, "))
  check("the sections", ["## Hospital maps", "## Using Findway", "## Optional"].every((s) => txt.includes(`\n${s}\n`)))
  check("no list is broken by a blank line", !/^- .*\n\n- /m.test(txt))
  check("the Android app", txt.includes(PLAY_STORE_URL))
}

group("IndexNow")
{
  const files = { "ab12.txt": "ab12", "0123456789abcdef0123456789abcdef.txt": "0123456789abcdef0123456789abcdef\n", "robots.txt": "x" }
  check("the key is the file holding its own name", N.findKey(Object.keys(files), (n) => files[n]) === "0123456789abcdef0123456789abcdef")
  check("a file not holding its name is no key", N.findKey(["ffffffffffffffffffffffffffffffff.txt"], () => "nope") === null)
  const xml = `<urlset><url><loc>https://findway.ai/</loc></url><url><loc>https://findway.ai/a?x=1&amp;y=2</loc></url><url><loc>https://findway.ai/</loc></url><url><loc>https://www.findway.ai/b</loc></url></urlset>`
  const urls = N.sitemapUrls(xml)
  check("the sitemap's URLs, entities decoded", urls.length === 4 && urls[1] === "https://findway.ai/a?x=1&y=2")
  const { body, elsewhere } = N.submission("https://findway.ai", "k", urls)
  check("only the site's own host, each once", body.urlList.join() === "https://findway.ai/,https://findway.ai/a?x=1&y=2" && elsewhere.join() === "https://www.findway.ai/b")
  check("the key file's address", body.host === "findway.ai" && body.keyLocation === "https://findway.ai/k.txt")
}

report()
