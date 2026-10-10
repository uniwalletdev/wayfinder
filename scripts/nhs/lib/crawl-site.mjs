// Crawl one website for the hospital maps it publishes.
//
// This is the part of the NHS discovery crawl that has nothing to do with the
// NHS: given a website, visit the pages most likely to carry a map, and return
// every document that looks like one. scripts/nhs/discover-plans.mjs runs it
// once per trust website; scripts/world/discover-plans.mjs runs it once per
// hospital website elsewhere in the world, where there is no national register
// to say which site belongs to whom and OpenStreetMap's `website` tag has to do.
//
// What it does, in order:
//   1. robots.txt — a site that disallows crawling is left alone.
//   2. the homepage, read through any redirect so the crawl knows which host
//      the site really is.
//   3. the sitemap, where there is one: the site's own index of itself, which
//      finds pages (and often PDFs) that following navigation never reaches.
//   4. the pages that score highest as somewhere a map would live
//      (lib/discovery-match.mjs), two hops deep, with a share of the page
//      budget held back for the second hop because hospital maps routinely sit
//      under a section page rather than on it.
// Every link seen on the way is classified, and the maps are returned.
//
// It is polite by construction: one request at a time per site, never faster
// than the site's crawl delay or MIN_PAUSE_MS, whichever is longer.
import { fetchRetry, BROWSER_HEADERS } from "./net.mjs"
import { isAllowed, crawlDelayFor } from "./robots.mjs"
import { classifyDocument, rankPages, decodeEntities, canonicalUrl } from "./discovery-match.mjs"
import { fetchSitemapUrls } from "./sitemap.mjs"

export const MIN_PAUSE_MS = 1500
// Pages fetched per site, across both hops. Six was too few and, worse, was
// spent on whichever nav links happened to come first in the markup.
export const MAX_PAGES_PER_SITE = 20
// Hospital maps are routinely two hops from the homepage — Sunderland Royal's
// sits at /our-locations/our-locations, under a section landing page. One hop
// could never reach it.
export const MAX_DEPTH = 2
// A separate allowance for pages the sitemap pointed at, so they never compete
// with the homepage's own navigation for slots.
export const MAX_SITEMAP_PAGES = 40
// Fetches held back for the second hop. The maps that matter sit under a section
// page rather than on it, so the deeper pass must be guaranteed a share.
export const RESERVED_FOR_DEEPER = 15

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Deliberately regex-based rather than a DOM parser: this repo has no HTML
// parsing dependency, and all we need is href plus link text. Malformed markup
// costs us a missed candidate, which a human reviewing the queue can live with.
const LINK_RE = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

export function extractLinks(html, baseUrl) {
  const links = []
  for (const m of html.matchAll(LINK_RE)) {
    const text = decodeEntities(m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
    try {
      // Decode entities before parsing. An href written as
      // "…?ver=42880&amp;doc=…" is a corrupt query string once taken literally,
      // and a real run produced four such URLs — every one of which would have
      // 404'd at download time, long after the crawl looked successful.
      const url = new URL(decodeEntities(m[1]), baseUrl)
      url.hash = ""
      links.push({ url: url.href, text, host: url.host })
    } catch {
      // Relative junk, mailto:, javascript: — not a page we can fetch.
    }
  }
  return links
}

export async function fetchHtml(url) {
  if (!(await isAllowed(url))) return null
  let res
  try {
    res = await fetchRetry(url, { headers: { accept: "text/html" } }, { retries: 1, timeoutMs: 30_000 })
  } catch (err) {
    // Several sites refuse or reset a request that doesn't look like a browser
    // — the same filtering that blocked the ODS download host. Worth one more
    // attempt before writing the whole site off.
    res = await fetchRetry(
      url,
      { headers: { ...BROWSER_HEADERS, accept: "text/html,application/xhtml+xml" } },
      { retries: 1, timeoutMs: 30_000 }
    ).catch(() => {
      throw err
    })
  }
  const type = res.headers.get("content-type") ?? ""
  if (!/text\/html/i.test(type)) return null
  // The final URL matters as much as the body: a site recorded under one
  // domain may redirect to another, and its sitemap will list the new one. Read
  // through the redirect and everything downstream agrees on which host this is.
  return { html: await res.text(), finalUrl: res.url || url }
}

// A Cloudflare interstitial ("Just a moment…") is a JavaScript challenge, not
// a refusal headers can talk past — it needs a real browser. Recording it
// separately keeps the failure count honest.
export const isBotChallenge = (message) =>
  /just a moment|cf-browser-verification|challenge-platform|attention required/i.test(message ?? "")

// Crawl one site. Resolves to
//   { outcome, via, note?, error?, documents: [{ url, linkText, kind, confidence, format }] }
// where outcome is "ok", "robots-blocked", "failed" or "bot-challenge". It
// never throws: a site that is down is an outcome to record, not a reason to
// stop a run of hundreds.
//
// `seeds` are pages to visit first, before anything the homepage links to: the
// page a hospital's own listing points at (OpenStreetMap often records
// https://system.org/our-hospital rather than the system's homepage) is the
// best lead there is, and it may not be reachable from the homepage at all.
// `label` names the site in log lines; `log` receives them.
export async function crawlSite(origin, { seeds = [], label = origin, log = () => {}, minPauseMs = MIN_PAUSE_MS } = {}) {
  const found = new Map()
  const visited = new Set()
  let via = "links"

  const collect = (links) => {
    for (const link of links) {
      // classifyDocument decides what counts as a downloadable map, formats
      // included — the filter here used to be a bare /\.pdf$/ test, which threw
      // away every site that publishes a PNG or a JPEG before it was looked at.
      const signal = classifyDocument(link.text, link.url)
      if (!signal) continue
      // Key on the canonical URL so a cache-busting parameter can't present the
      // same document twice.
      const key = canonicalUrl(link.url)
      if (!found.has(key)) {
        found.set(key, {
          url: link.url,
          linkText: link.text.slice(0, 200),
          kind: signal.kind,
          confidence: signal.confidence,
          format: signal.format,
        })
      }
    }
  }

  try {
    if (!(await isAllowed(origin))) {
      return { outcome: "robots-blocked", via: "-", note: "robots.txt disallows crawling", documents: [] }
    }
    const pause = Math.max(minPauseMs, await crawlDelayFor(origin))

    // Load the homepage first, because it settles which host this site really
    // is. Solent is recorded in ODS under one domain and serves its sitemap
    // listing another; comparing against the recorded host discarded all 424 of
    // its URLs and the crawl quietly fell back to following links.
    const home = await fetchHtml(origin)
    const effectiveOrigin = home ? new URL(home.finalUrl).origin : origin
    const host = new URL(effectiveOrigin).host
    if (effectiveOrigin !== origin) log(`  ${label}: redirects to ${host}`)

    // Ask the site for its own index. Where a sitemap exists it finds pages —
    // and often PDFs — that no amount of following navigation reaches.
    const sitemapUrls = await fetchSitemapUrls(effectiveOrigin, { log })
    if (sitemapUrls.length) {
      via = "sitemap"
      collect(sitemapUrls.map((url) => ({ url, text: "", host })))
    }

    if (!home && !sitemapUrls.length && !seeds.length) {
      return { outcome: "failed", via: "-", note: "homepage unreadable", documents: [] }
    }
    visited.add(origin)
    visited.add(effectiveOrigin)

    const homeLinks = home ? extractLinks(home.html, home.finalUrl) : []
    collect(homeLinks)

    // Two separate budgets. Pooling them let hundreds of sitemap entries crowd
    // out the homepage's own navigation, and sites whose maps had been found
    // via links started returning nothing.
    const fromLinks = rankPages(homeLinks, { host, limit: MAX_PAGES_PER_SITE })
    const fromSitemap = rankPages(
      sitemapUrls.map((url) => ({ url, text: "", host })),
      { host, limit: MAX_SITEMAP_PAGES }
    )
    // A seed outranks everything: it was pointed at by name.
    const seeded = seeds
      .map((url) => {
        try {
          const parsed = new URL(url, effectiveOrigin)
          parsed.hash = ""
          return { url: parsed.href, text: "", host: parsed.host, score: 100 }
        } catch {
          return null
        }
      })
      .filter((s) => s && !visited.has(s.url))
    const queue = [...seeded, ...fromLinks, ...fromSitemap]
      .filter((p, idx, all) => all.findIndex((o) => o.url === p.url) === idx)
      .map((p) => ({ ...p, depth: 1 }))

    const budget = MAX_PAGES_PER_SITE + (sitemapUrls.length ? MAX_SITEMAP_PAGES : 0)
    // Slots the first hop may not touch, so the second hop can happen at all.
    const depthOneCap = Math.max(6, budget - RESERVED_FOR_DEEPER)

    let fetched = 0
    let fetchedAtDepthOne = 0
    while (queue.length && fetched < budget) {
      let index = 0
      if (fetchedAtDepthOne >= depthOneCap) {
        index = queue.findIndex((p) => p.depth > 1)
        if (index === -1) break
      }
      const [page] = queue.splice(index, 1)
      if (visited.has(page.url)) continue
      visited.add(page.url)
      await sleep(pause)
      fetched++
      if (page.depth === 1) fetchedAtDepthOne++
      try {
        const page_ = await fetchHtml(page.url)
        if (!page_) continue
        const links = extractLinks(page_.html, page_.finalUrl)
        collect(links)

        if (page.depth < MAX_DEPTH) {
          const next = rankPages(links, { host, limit: budget })
            .filter((l) => !visited.has(l.url) && l.score >= 8)
            // A child of a page we already rated highly is a more targeted lead
            // than an untried seed, so it outranks one of equal raw score.
            .map((l) => ({ ...l, score: l.score + 3, depth: page.depth + 1 }))
          queue.push(...next)
          queue.sort((a, b) => b.score - a.score)
        }
      } catch {
        // A single dead sub-page is not worth failing the site over.
      }
    }
  } catch (err) {
    const message = err?.message ?? String(err)
    return {
      outcome: isBotChallenge(message) ? "bot-challenge" : "failed",
      via,
      error: message,
      documents: [...found.values()],
    }
  }

  return { outcome: "ok", via, documents: [...found.values()] }
}
