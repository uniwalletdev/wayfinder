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
import { classifyPdf, normaliseForMatching, scorePage, rankPages, decodeEntities, canonicalUrl } from "../lib/discovery-match.mjs"
import { group, check, report } from "./harness.mjs"

group("filename matching")
// `\bmap\b` never matched "SRH_Map_update.pdf": `_` is a word character, so
// there is no boundary either side of "Map". Maps whose link text is unhelpful —
// and plenty are just an icon or "Download" — were therefore invisible.
const salisburyPdf = "https://www.stsft.nhs.uk/application/files/6417/7382/2879/SRH_Map_update.pdf"
check(
  "flattens separators so words are visible",
  normaliseForMatching(salisburyPdf) === "application files 6417 7382 2879 SRH Map update pdf",
  normaliseForMatching(salisburyPdf)
)
check("finds a map from the filename alone", classifyPdf("", salisburyPdf)?.kind === "unknown", JSON.stringify(classifyPdf("", salisburyPdf)))
check(
  "rates it highly when the link text agrees",
  classifyPdf("Salisbury District Hospital site map", salisburyPdf)?.confidence === "high"
)
check("reads camelCase filenames", !!classifyPdf("", "/docs/siteMap.pdf"))
check("reads percent-encoded names", !!classifyPdf("", "/docs/Hospital%20Map%202024.pdf"))
check("still finds floor plans", classifyPdf("", "/x/ward-floor-plan.pdf")?.kind === "floor-plan")

group("false positives")
// A national crawl over 247 trusts turns any loose pattern into a pile of
// strategy documents to wade through.
check("rejects a strategy roadmap", classifyPdf("Our five year roadmap", "/about/roadmap.pdf") === null)
check("rejects a career map", classifyPdf("Career map", "/jobs/career_map.pdf") === null)
check("rejects a process map", classifyPdf("Process map", "/quality/process-map.pdf") === null)
check("keeps a real site map", classifyPdf("Site map", "/visiting/site_map.pdf")?.confidence === "high")

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
  const pdfs = mapPageLinks.filter((l) => /\.pdf$/i.test(l.url)).map((l) => ({ link: l, signal: classifyPdf(l.text, l.url) }))
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
  const signal = classifyPdf(decodeEntities(text), href)
  check(`recognises an indoor plan: ${href.split("/").pop()}`, signal?.kind === "floor-plan", JSON.stringify(signal))
}

// Outdoor maps must stay outdoor, or the distinction is worthless.
check("keeps an external map as a site map", classifyPdf("External map of the hospital", "/DCH-External-Map-2025.pdf")?.kind === "site-map")
check("keeps a plain site map as a site map", classifyPdf("Site Map & Directory", "/RUH_directory_map.pdf")?.kind === "site-map")

report()
