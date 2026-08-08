// Checks for what the crawl follows and what it keeps.
//
// The crawl found 1 candidate across 15 trusts while a person found a real
// hospital map by hand in seconds:
//
//   page: https://www.stsft.nhs.uk/our-locations/our-locations
//   PDF:  https://www.stsft.nhs.uk/application/files/6417/7382/2879/SRH_Map_update.pdf
//
// Every reason it was missed is reproduced below against a local server shaped
// like that site, so the fix is proven rather than asserted — and stays proven.
//
// Run: node scripts/nhs/test/discovery.test.mjs
import { createServer } from "http"
import { readFileSync, existsSync } from "fs"
import { classifyDocument, normaliseForMatching, scorePage, rankPages, decodeEntities, canonicalUrl, sameHost, onTrustDomain, formatOf } from "../lib/discovery-match.mjs"
import { group, check, report } from "./harness.mjs"

group("filename matching")
// `\bmap\b` never matched "SRH_Map_update.pdf": `_` is a word character, so
// there is no boundary either side of "Map". Maps whose link text is unhelpful —
// and plenty are just an icon or "Download" — were therefore invisible.
const sunderlandPdf = "https://www.stsft.nhs.uk/application/files/6417/7382/2879/SRH_Map_update.pdf"
check(
  "flattens separators so words are visible",
  normaliseForMatching(sunderlandPdf) === "application files 6417 7382 2879 SRH Map update pdf",
  normaliseForMatching(sunderlandPdf)
)
check("finds a map from the filename alone", classifyDocument("", sunderlandPdf)?.kind === "unknown", JSON.stringify(classifyDocument("", sunderlandPdf)))
check(
  "rates it highly when the link text agrees",
  classifyDocument("Sunderland Royal Hospital site map", sunderlandPdf)?.confidence === "high"
)
check("reads camelCase filenames", !!classifyDocument("", "/docs/siteMap.pdf"))
check("reads percent-encoded names", !!classifyDocument("", "/docs/Hospital%20Map%202024.pdf"))
check("still finds floor plans", classifyDocument("", "/x/ward-floor-plan.pdf")?.kind === "floor-plan")

group("formats other than PDF")
// Not every trust publishes a PDF. The crawl used to filter on /\.pdf$/ before
// classifying anything, so a hospital whose only map is a PNG looked exactly
// like a hospital with no map — the link was dropped before it was ever read.
check("still reads a PDF", classifyDocument("Site map", "/visiting/site-map.pdf")?.format === "pdf")
check("finds a PNG map", classifyDocument("Hospital map", "/media/hospital-map.png")?.format === "image")
check("finds a JPEG map", classifyDocument("", "/media/site-map.jpg")?.format === "image")
check("finds an SVG map", classifyDocument("", "/media/ward-floor-plan.svg")?.format === "vector")
check("classifies format-independently", classifyDocument("", "/x/ground-floor-map.png")?.kind === "floor-plan")
// The page a map is linked from is not itself a map, and treating every HTML
// link that says "map" as a candidate would bury the queue in navigation.
check("ignores a web page", classifyDocument("Maps and directions", "/visiting/maps-and-directions") === null)
check("ignores an HTML page that says map", classifyDocument("Site map", "/about/site-map.html") === null)
// Several NHS CMSs leave the path generic and put the real filename in a query
// parameter, so the extension has to be read from there too.
check(
  "reads the format out of a doc= parameter",
  formatOf("https://x.nhs.uk/download/index.aspx?doc=hospital-map.png") === "image",
  String(formatOf("https://x.nhs.uk/download/index.aspx?doc=hospital-map.png"))
)
check(
  "prefers the doc= filename over the path",
  formatOf("https://x.nhs.uk/download/a.pdf?doc=docm93jijm4n1240.pdf") === "pdf"
)
check("no extension is not a document", formatOf("https://x.nhs.uk/our-locations") === null)

group("false positives")
// A national crawl over 247 trusts turns any loose pattern into a pile of
// strategy documents to wade through.
check("rejects a strategy roadmap", classifyDocument("Our five year roadmap", "/about/roadmap.pdf") === null)
check("rejects a career map", classifyDocument("Career map", "/jobs/career_map.pdf") === null)
check("rejects a process map", classifyDocument("Process map", "/quality/process-map.pdf") === null)
check("keeps a real site map", classifyDocument("Site map", "/visiting/site_map.pdf")?.confidence === "high")

group("page ranking")
// Six slots used to be filled in document order, so large nav and footer menus
// spent them on "Contact us" before anything about locations appeared.
check("ranks locations above contact", scorePage("Our locations", "/our-locations") > scorePage("Contact us", "/contact-us"))
check("ranks getting here above about", scorePage("Getting here", "/getting-here") > scorePage("About us", "/about-us"))
check("ignores a privacy page", scorePage("Privacy policy", "/privacy-policy") === 0)
check("ignores a news article", scorePage("Trust wins award", "/news/2024/award") === 0)

const menu = [
  { text: "Contact us", url: "https://x.nhs.uk/contact-us", host: "x.nhs.uk" },
  { text: "Privacy", url: "https://x.nhs.uk/privacy", host: "x.nhs.uk" },
  { text: "About us", url: "https://x.nhs.uk/about-us", host: "x.nhs.uk" },
  { text: "News", url: "https://x.nhs.uk/news", host: "x.nhs.uk" },
  { text: "Jobs", url: "https://x.nhs.uk/jobs", host: "x.nhs.uk" },
  { text: "Visiting", url: "https://x.nhs.uk/visiting", host: "x.nhs.uk" },
  { text: "Our locations", url: "https://x.nhs.uk/our-locations", host: "x.nhs.uk" },
  { text: "Elsewhere", url: "https://other.example/locations", host: "other.example" },
]
const ranked = rankPages(menu, { host: "x.nhs.uk", limit: 3 })
check("puts locations first despite being last in the menu", ranked[0]?.url.endsWith("/our-locations"), JSON.stringify(ranked.map((r) => r.url)))
check("keeps the crawl on the trust's own host", !ranked.some((r) => r.host !== "x.nhs.uk"))
check("respects the page budget", ranked.length === 3, String(ranked.length))

group("end-to-end: two hops to the map")
// A stand-in for stsft.nhs.uk. The PDF is two hops from the homepage, which is
// exactly what the old one-hop crawl could not reach.
const PDF_PATH = "/application/files/6417/7382/2879/SRH_Map_update.pdf"
const pages = {
  "/": `<html><body>
      <a href="/contact-us">Contact us</a>
      <a href="/privacy">Privacy</a>
      <a href="/news">News</a>
      <a href="/jobs">Jobs</a>
      <a href="/about-us">About us</a>
      <a href="/our-locations">Our locations</a>
    </body></html>`,
  // The section landing page. It holds no PDF itself — only a link onward.
  "/our-locations": `<html><body><a href="/our-locations/our-locations">Our locations</a></body></html>`,
  // The page that actually carries the map, with deliberately useless link text.
  "/our-locations/our-locations": `<html><body><a href="${PDF_PATH}">Download</a></body></html>`,
  "/contact-us": `<html><body>contact</body></html>`,
}

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
  if (path === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" })
    return res.end("User-agent: *\nAllow: /\n")
  }
  if (path in pages) {
    res.writeHead(200, { "content-type": "text/html" })
    return res.end(pages[path])
  }
  res.writeHead(404, { "content-type": "text/plain" })
  res.end("not found")
})

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const origin = `http://127.0.0.1:${server.address().port}`

try {
  // Drive the same selection logic the crawler uses, one hop at a time.
  const fetchLinks = async (url) => {
    const html = await (await fetch(url)).text()
    return [...html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => {
      const parsed = new URL(m[1], url)
      return { url: parsed.href, text: m[2].trim(), host: parsed.host }
    })
  }
  const host = new URL(origin).host

  const homeLinks = await fetchLinks(origin)
  const firstHop = rankPages(homeLinks, { host, limit: 12 })
  check("reaches the locations section from the homepage", firstHop.some((p) => p.url.endsWith("/our-locations")), JSON.stringify(firstHop.map((p) => p.url)))

  const sectionLinks = await fetchLinks(`${origin}/our-locations`)
  const secondHop = rankPages(sectionLinks, { host, limit: 12 })
  check("follows the section page one hop further", secondHop.some((p) => p.url.endsWith("/our-locations/our-locations")), JSON.stringify(secondHop.map((p) => p.url)))

  const mapPageLinks = await fetchLinks(`${origin}/our-locations/our-locations`)
  const pdfs = mapPageLinks.filter((l) => /\.pdf$/i.test(l.url)).map((l) => ({ link: l, signal: classifyDocument(l.text, l.url) }))
  check("finds the PDF on the final page", pdfs.length === 1, String(pdfs.length))
  // The link text is "Download" — everything rests on reading the filename.
  check("classifies it despite useless link text", !!pdfs[0]?.signal, JSON.stringify(pdfs[0]))
  check("records the real URL", pdfs[0]?.link.url.endsWith("SRH_Map_update.pdf"), pdfs[0]?.link.url)
} finally {
  await new Promise((resolve) => server.close(resolve))
}


group("bugs found in real crawl results")
// Every case below is taken verbatim from a real 247-trust run. They are not
// hypothetical: each one either lost a map or corrupted a URL.

// Four candidate URLs carried a literal "&amp;". Downloading any of them would
// have 404'd on a corrupt query string, long after the crawl looked successful.
const entityUrl =
  "http://www.basildonandthurrock.nhs.uk/download/basildon-hospital-map-level-by-level.pdf?ver=42880&amp;doc=docm93jijm4n4732.pdf"
check("decodes entities in hrefs", !decodeEntities(entityUrl).includes("&amp;"), decodeEntities(entityUrl))
check("keeps the query usable", new URL(decodeEntities(entityUrl)).searchParams.get("doc") === "docm93jijm4n4732.pdf")

// The same map arrived twice under different cache-busting parameters.
check(
  "collapses cache-busted duplicates",
  canonicalUrl("https://www.ruh.nhs.uk/finding/documents/RUH_directory_map.pdf?t=73036.95") ===
    canonicalUrl("https://www.ruh.nhs.uk/finding/documents/RUH_directory_map.pdf?t=73040.52")
)
check(
  "keeps meaningful query parameters",
  canonicalUrl("https://x.nhs.uk/a.pdf?doc=abc123").includes("doc=abc123")
)

// The run reported "0 indoor floor plans" while holding these. Indoor plans are
// the rare, valuable find — mislabelling them defeats the purpose of the crawl.
const indoor = [
  ["Basildon Hospital map", "/download/basildon-hospital-map-level-by-level.pdf"],
  ["", "/download/316/general/5680/hospital-map-a-floor.pdf"],
  ["Hospital map &#8211; B Floor", "/download/hospital-map-b-floor.pdf"],
  ["Southend Hospital ground floor map,", "/download/southend-hospital-ground-floor-map-pdf.pdf"],
  ["Internal map of the hospital", "/uploads/DCH-Internal-Map-for-website-JUNE-2023.pdf"],
]
for (const [text, href] of indoor) {
  const signal = classifyDocument(decodeEntities(text), href)
  check(`recognises an indoor plan: ${href.split("/").pop()}`, signal?.kind === "floor-plan", JSON.stringify(signal))
}

// Outdoor maps must stay outdoor, or the distinction is worthless.
check("keeps an external map as a site map", classifyDocument("External map of the hospital", "/DCH-External-Map-2025.pdf")?.kind === "site-map")
check("keeps a plain site map as a site map", classifyDocument("Site Map & Directory", "/RUH_directory_map.pdf")?.kind === "site-map")


group("regressions the sitemap change introduced")
// Adding sitemap reading made two trusts that had previously yielded maps return
// nothing. Both causes are pinned here.

// A trust recorded in ODS as www.x.nhs.uk lists x.nhs.uk in its own sitemap.
// Requiring an exact host match discarded 424 URLs and silently fell back to
// following links.
check("treats www and the bare domain as one site", sameHost("solent.nhs.uk", "www.solent.nhs.uk"))
check("still separates genuinely different hosts", !sameHost("x.nhs.uk", "y.nhs.uk"))
check(
  "keeps bare-domain sitemap URLs for a www site",
  rankPages([{ text: "", url: "https://stsft.nhs.uk/our-locations", host: "stsft.nhs.uk" }], {
    host: "www.stsft.nhs.uk",
    limit: 5,
  }).length === 1
)

// On a site with 1,483 pages dozens tie at the top score, so which ones get
// fetched decides whether the map is found. A page naming "map" in its own URL
// is the strongest lead there is and must outrank generic section pages.
check(
  "a URL naming map outranks a generic section",
  scorePage("", "/our-hospitals/hospital-maps") > scorePage("", "/our-hospitals")
)
check(
  "a specific page outranks its own landing page",
  scorePage("", "/our-locations/our-locations") > scorePage("", "/our-locations")
)

// Pooling sitemap URLs with homepage links let hundreds of sitemap entries crowd
// out the navigation, so trusts whose maps had been found via links stopped
// returning anything. The budgets are separate for that reason.
const navOnly = [{ text: "Our locations", url: "https://www.x.nhs.uk/our-locations", host: "www.x.nhs.uk" }]
const flood = Array.from({ length: 400 }, (_, i) => ({ text: "", url: `https://x.nhs.uk/hospitals/w${i}`, host: "x.nhs.uk" }))
check(
  "navigation survives a large sitemap",
  rankPages(navOnly, { host: "www.x.nhs.uk", limit: 12 }).length === 1,
  "the homepage's own links were crowded out"
)
check("sitemap gets its own allowance", rankPages(flood, { host: "www.x.nhs.uk", limit: 14 }).length === 14)


group("the second hop must be reachable")
// The bug this pins: depth-1 seeds exactly filled the fetch budget, so a section
// page was fetched, its child queued — and the run ended with the child never
// visited. On every trust with a sitemap the second hop simply never happened,
// which is where South Tyneside and Sunderland keeps its map.
function simulateQueue({ seeds, reserved, budget, childBonus }) {
  const queue = seeds.map((s) => ({ ...s, depth: 1 }))
  const depthOneCap = Math.max(6, budget - reserved)
  const fetchedUrls = []
  let fetched = 0
  let atDepthOne = 0
  while (queue.length && fetched < budget) {
    let index = 0
    if (atDepthOne >= depthOneCap) {
      index = queue.findIndex((p) => p.depth > 1)
      if (index === -1) break
    }
    const [page] = queue.splice(index, 1)
    fetched++
    if (page.depth === 1) atDepthOne++
    fetchedUrls.push(page.url)
    // The section page yields the child that actually carries the map.
    if (page.url === "/our-locations" && page.depth < 2) {
      queue.push({ url: "/our-locations/our-locations", score: 11 + childBonus, depth: 2 })
      queue.sort((a, b) => b.score - a.score)
    }
  }
  return fetchedUrls
}

// 26 depth-1 seeds and a 26-page budget: exactly the real configuration.
const seeds = [
  { url: "/our-locations", score: 11 },
  ...Array.from({ length: 25 }, (_, i) => ({ url: `/other-${i}`, score: 11 })),
]

// The old behaviour: no reserve, and a child scored the same as an untried
// seed, so a stable sort left it behind 25 equals it could never overtake.
const withoutReserve = simulateQueue({ seeds, reserved: 0, budget: 26, childBonus: 0 })
check(
  "reproduces the bug with no reserve",
  !withoutReserve.includes("/our-locations/our-locations"),
  "expected the child to be starved without a reserve"
)

// Both mechanisms together: slots held back, and a child of a promising page
// outranking an untried seed.
const withReserve = simulateQueue({ seeds, reserved: 10, budget: 26, childBonus: 3 })
check(
  "reaches the child once slots are reserved",
  withReserve.includes("/our-locations/our-locations"),
  JSON.stringify(withReserve.slice(-4))
)
check("still spends most of the budget on the first hop", withReserve.filter((u) => u.startsWith("/other-")).length >= 10)


group("concurrency keeps every host polite")
// Tuning the page budget down to save wall-clock time was solving the wrong
// problem, and each downward tweak lost a trust the previous one had found.
// Politeness is per host, and these are 247 different hosts — so several trusts
// can run at once with no site seeing any extra load. This proves that: many
// "trusts" in flight together, each still spaced out on its own host.
const MIN_PAUSE = 60
const hits = new Map()

const polite = createServer((req, res) => {
  const host = req.headers["x-trust"] ?? "unknown"
  const at = Date.now()
  const list = hits.get(host) ?? []
  list.push(at)
  hits.set(host, list)
  res.writeHead(200, { "content-type": "text/html" })
  res.end("<html><body>ok</body></html>")
})
await new Promise((resolve) => polite.listen(0, "127.0.0.1", resolve))
const politeOrigin = `http://127.0.0.1:${polite.address().port}`

try {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  // Six pages per "trust", strictly sequential within a trust.
  const crawlOne = async (trustId) => {
    for (let i = 0; i < 6; i++) {
      await sleep(MIN_PAUSE)
      await fetch(`${politeOrigin}/p${i}`, { headers: { "x-trust": trustId } })
    }
  }

  const started = Date.now()
  await Promise.all(["a", "b", "c", "d", "e", "f"].map(crawlOne))
  const elapsed = Date.now() - started

  check("all trusts completed", hits.size === 6, `${hits.size} hosts recorded`)

  let minGap = Infinity
  for (const times of hits.values()) {
    for (let i = 1; i < times.length; i++) minGap = Math.min(minGap, times[i] - times[i - 1])
  }
  // The whole safety argument: no individual host is hit faster than its pause.
  check("no host is hit faster than its pause", minGap >= MIN_PAUSE * 0.8, `smallest gap ${minGap}ms`)

  // Six trusts of six paced pages finish in roughly the time of one, not six.
  check("six trusts cost about the time of one", elapsed < MIN_PAUSE * 6 * 3, `${elapsed}ms`)
} finally {
  await new Promise((resolve) => polite.close(resolve))
}


group("redirects and hand-added maps")
// Solent's sitemap listed 424 URLs that were all discarded, because ODS records
// one domain and the site serves another. Following the redirect first settles
// which host the trust actually is.
const redirectTarget = createServer((req, res) => {
  if (req.url === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" })
    return res.end("User-agent: *\nAllow: /\n")
  }
  res.writeHead(200, { "content-type": "text/html" })
  res.end('<html><body><a href="/our-locations">Our locations</a></body></html>')
})
await new Promise((r) => redirectTarget.listen(0, "127.0.0.1", r))
const targetPort = redirectTarget.address().port

const redirector = createServer((req, res) => {
  res.writeHead(302, { location: `http://127.0.0.1:${targetPort}${req.url}` })
  res.end()
})
await new Promise((r) => redirector.listen(0, "127.0.0.1", r))
const fromPort = redirector.address().port

try {
  const res = await fetch(`http://127.0.0.1:${fromPort}/`)
  const finalOrigin = new URL(res.url).origin
  check(
    "reads through a redirect to the real origin",
    finalOrigin === `http://127.0.0.1:${targetPort}`,
    finalOrigin
  )
  check(
    "the redirected host is what sitemap URLs are compared against",
    sameHost(new URL(res.url).host, `127.0.0.1:${targetPort}`)
  )
} finally {
  await new Promise((r) => redirectTarget.close(r))
  await new Promise((r) => redirector.close(r))
}

// Some maps no crawler will reach: bot challenges, script-built navigation, or a
// page that loses the ranking among thousands. Those go in by hand — but they
// must still look like maps, so the file cannot be used to smuggle anything past
// the classifier.
const known = JSON.parse(readFileSync(new URL("../../../data/known-maps.json", import.meta.url), "utf8"))
check("known-maps file is present and shaped right", Array.isArray(known.maps), typeof known.maps)
for (const entry of known.maps) {
  check(
    `hand-added entry still classifies as a map: ${entry.url.split("/").pop()}`,
    !!classifyDocument(entry.linkText ?? "", entry.url),
    entry.url
  )
  check(`hand-added entry records why the crawl missed it: ${entry.trustName}`, !!entry.note)
}

// The trust code is the entry's least visible field and its most consequential:
// approve-plans matches the URL's host against the website ODS records for that
// code, so a wrong code makes the entry off-domain and it is dropped without
// ever being looked at. The first hand-added entry shipped with exactly that
// mistake — stsft.nhs.uk labelled RNZ (Salisbury) when it is R0B (South Tyneside
// and Sunderland) — so the file is now checked against the register rather than
// trusted.
const registerPath = new URL("../../../data/trust-websites.json", import.meta.url)
const register = existsSync(registerPath) ? JSON.parse(readFileSync(registerPath, "utf8")) : null
// trust-websites.json is written by the crawl, so a checkout that has never run
// one legitimately lacks it. Skipping the check is right; passing silently is
// not, so the absence is asserted rather than assumed.
check(
  "trust register is available to validate hand-added codes against",
  !!register || known.maps.length === 0,
  "no data/trust-websites.json — run the crawl before adding to known-maps.json"
)
for (const entry of known.maps) {
  if (!register) break
  check(
    `hand-added entry sits on its own trust's domain: ${entry.trustCode}`,
    onTrustDomain(entry.url, register[entry.trustCode]),
    `${entry.trustCode} is recorded as ${register[entry.trustCode] ?? "unknown"}, URL is on ${entry.url}`
  )
}

// And the rule itself, so the check above means what it says.
check("subdomains of the trust count", onTrustDomain("https://documents.stsft.nhs.uk/a.pdf", "https://www.stsft.nhs.uk"))
check("www is not a difference", onTrustDomain("https://stsft.nhs.uk/a.pdf", "https://www.stsft.nhs.uk"))
check("another trust's domain does not", onTrustDomain("https://www.salisbury.nhs.uk/a.pdf", "https://www.stsft.nhs.uk") === false)
check("an unknown trust code refuses rather than waves through", onTrustDomain("https://www.stsft.nhs.uk/a.pdf", undefined) === false)

report()
