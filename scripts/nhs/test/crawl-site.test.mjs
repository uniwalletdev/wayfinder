// The crawl of one site, end to end against local servers: the two-hop path to
// a map that a person found by hand and six crawler revisions missed, the page
// a hospital's own listing points at, and the ways a site can say no.
//
// Run: node scripts/nhs/test/crawl-site.test.mjs
import { createServer } from "http"
import { crawlSite } from "../lib/crawl-site.mjs"
import { group, check, report } from "./harness.mjs"

const PAUSE = 10
const listen = (handler) =>
  new Promise((resolve) => {
    const server = createServer(handler)
    server.listen(0, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }))
  })
const close = (server) => new Promise((resolve) => server.close(resolve))
const html = (res, body) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
  res.end(body)
}
const notFound = (res) => {
  res.writeHead(404, { "content-type": "text/plain" })
  res.end("not found")
}

// A site shaped like South Tyneside and Sunderland's: the map is two hops down,
// behind a link that just says "Download", and a page nothing links to carries
// a second map.
const PDF = "/application/files/6417/7382/2879/SRH_Map_update.pdf"
const SEEDED_PDF = "/docs/Unity-Hospital-floor-maps.pdf"
const pages = {
  "/": `<html><body>
      <a href="/contact-us">Contact us</a>
      <a href="/privacy">Privacy</a>
      <a href="/news">News</a>
      <a href="/about-us">About us</a>
      <a href="/our-locations">Our locations</a>
      <a href="/strategy/road-map-2030.pdf">Road map 2030</a>
    </body></html>`,
  "/our-locations": `<html><body><a href="/our-locations/our-locations">Our locations</a></body></html>`,
  "/our-locations/our-locations": `<html><body>
      <a href="${PDF}">Download</a>
      <a href="${PDF}?t=73036.95">Download again</a>
    </body></html>`,
  "/contact-us": `<html><body>contact</body></html>`,
  "/about-us": `<html><body>about</body></html>`,
  "/news": `<html><body>news</body></html>`,
  "/privacy": `<html><body>privacy</body></html>`,
  "/unity-hospital": `<html><body><a href="${SEEDED_PDF}">Floor maps</a></body></html>`,
}
const hits = []
const site = await listen((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
  hits.push(path)
  if (path === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" })
    return res.end("User-agent: *\nDisallow: /private/\n")
  }
  if (path in pages) return html(res, pages[path])
  notFound(res)
})

try {
  group("a map two hops from the homepage")
  const result = await crawlSite(site.origin, { minPauseMs: PAUSE })
  check("the crawl completes", result.outcome === "ok", JSON.stringify(result))
  check("without a sitemap it follows links", result.via === "links")
  const urls = result.documents.map((d) => d.url)
  check("finds the map behind a 'Download' link", urls.includes(`${site.origin}${PDF}`), JSON.stringify(urls))
  check("a cache-busted copy is one document", urls.filter((u) => u.includes("SRH_Map_update")).length === 1)
  check("a strategy road map is not a map", !urls.some((u) => u.includes("road-map")))
  check("does not visit the page nobody links to", !hits.includes("/unity-hospital"))
  check("the map is classified", result.documents.find((d) => d.url.endsWith(PDF))?.kind === "unknown")
  check("records how it was linked", result.documents.find((d) => d.url.endsWith(PDF))?.linkText === "Download")

  group("the page a listing points at")
  hits.length = 0
  const seeded = await crawlSite(site.origin, { minPauseMs: PAUSE, seeds: [`${site.origin}/unity-hospital`] })
  check("is read first", hits.indexOf("/unity-hospital") < hits.indexOf("/our-locations"), hits.join(" "))
  check("and its map is found", seeded.documents.some((d) => d.url.endsWith(SEEDED_PDF) && d.kind === "floor-plan"), JSON.stringify(seeded.documents))
  check("everything else is still found", seeded.documents.some((d) => d.url.endsWith(PDF)))

  group("pacing")
  // One request at a time per site, and a pause before every page after the
  // homepage, never shorter than the minimum.
  hits.length = 0
  const started = Date.now()
  await crawlSite(site.origin, { minPauseMs: 40 })
  const elapsed = Date.now() - started
  const pagesFetched = hits.filter((p) => p in pages).length
  check("the crawl visits more than the homepage", pagesFetched > 1, `${pagesFetched} pages`)
  check("the crawl waits between pages", elapsed >= 40 * (pagesFetched - 1), `${elapsed}ms for ${pagesFetched} pages`)
} finally {
  await close(site.server)
}

group("a site that says no")
const closed = await listen((req, res) => {
  if (req.url === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" })
    return res.end("User-agent: *\nDisallow: /\n")
  }
  html(res, `<html><body><a href="/site-map.pdf">Site map</a></body></html>`)
})
try {
  const result = await crawlSite(closed.origin, { minPauseMs: PAUSE })
  check("robots.txt is honoured", result.outcome === "robots-blocked" && result.documents.length === 0, JSON.stringify(result))
} finally {
  await close(closed.server)
}

group("a site that is down")
const down = await listen((req, res) => notFound(res))
try {
  const result = await crawlSite(down.origin, { minPauseMs: PAUSE })
  check("is an outcome, not an exception", result.outcome === "failed", JSON.stringify(result))
  check("with the reason", /404/.test(result.error ?? ""), result.error)
} finally {
  await close(down.server)
}

group("a site behind a bot challenge")
const challenge = await listen((req, res) => {
  if (req.url === "/robots.txt") return notFound(res)
  res.writeHead(403, { "content-type": "text/html" })
  res.end("<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>")
})
try {
  const result = await crawlSite(challenge.origin, { minPauseMs: PAUSE })
  check("is recorded as one", result.outcome === "bot-challenge", JSON.stringify(result))
} finally {
  await close(challenge.server)
}

group("a site with a sitemap")
let mapped
mapped = await listen((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname
  if (path === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" })
    return res.end("User-agent: *\nAllow: /\n")
  }
  if (path === "/sitemap.xml") {
    res.writeHead(200, { "content-type": "application/xml" })
    return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>${mapped.origin}/</loc></url><url><loc>${mapped.origin}/visiting/hospital-map</loc></url><url><loc>${mapped.origin}/media/ground-floor-map.pdf</loc></url></urlset>`)
  }
  if (path === "/") return html(res, `<html><body><a href="/jobs">Jobs</a></body></html>`)
  if (path === "/visiting/hospital-map") return html(res, `<html><body><a href="/media/site-map.pdf">Site map</a></body></html>`)
  if (path === "/jobs") return html(res, `<html><body>jobs</body></html>`)
  notFound(res)
})
try {
  const result = await crawlSite(mapped.origin, { minPauseMs: PAUSE })
  check("is read through its sitemap", result.via === "sitemap", JSON.stringify(result))
  const urls = result.documents.map((d) => d.url)
  check("a document the sitemap lists is found without a page", urls.includes(`${mapped.origin}/media/ground-floor-map.pdf`), JSON.stringify(urls))
  check("a page the sitemap lists is visited", urls.includes(`${mapped.origin}/media/site-map.pdf`), JSON.stringify(urls))
} finally {
  await close(mapped.server)
}

report()
