// Read a site's own index of itself.
//
// Guessing at navigation was the crawler's biggest weakness: it fetched a
// homepage, picked links that looked promising, and hoped the map was one hop
// away. Salisbury publishes its hospital map two hops down, so it was never
// reachable that way.
//
// Nearly every NHS trust site — Umbraco, WordPress, Drupal — publishes
// /sitemap.xml, often as an index pointing at further sitemaps. That is the
// site telling us every URL it has, for one or two requests. Where it exists it
// replaces guesswork entirely; where it doesn't, the crawl falls back to
// following links.
import { fetchRetry, BROWSER_HEADERS } from "./net.mjs"
import { isAllowed } from "./robots.mjs"

// Trust sites are big but not unbounded. This is enough to hold every page of a
// large trust while refusing to load a runaway index into memory.
const MAX_URLS = 5000
// Sitemap indexes nest, in principle without limit. One level covers real NHS
// sites and stops a malformed index turning into an unbounded crawl.
const MAX_CHILD_SITEMAPS = 12

// Where sitemaps actually live, in the order worth trying. robots.txt is checked
// first because a site that declares its sitemap there is telling us precisely
// where to look.
const COMMON_PATHS = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml", "/sitemap.aspx"]

const LOC_RE = /<loc>\s*([^<\s]+)\s*<\/loc>/gi

function extractLocs(xml) {
  return [...xml.matchAll(LOC_RE)].map((m) =>
    m[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  )
}

// A sitemap index lists sitemaps; a urlset lists pages. Both use <loc>, so the
// wrapper element is what distinguishes them.
const isIndex = (xml) => /<sitemapindex[\s>]/i.test(xml)

async function fetchXml(url) {
  if (!(await isAllowed(url))) return null
  try {
    const res = await fetchRetry(
      url,
      { headers: { accept: "application/xml,text/xml,*/*" } },
      { retries: 1, timeoutMs: 30_000 }
    )
    const type = res.headers.get("content-type") ?? ""
    const body = await res.text()
    // Some servers answer 200 with an HTML "not found" page rather than a 404.
    if (!/xml/i.test(type) && !/<(urlset|sitemapindex)[\s>]/i.test(body)) return null
    return body
  } catch {
    return null
  }
}

// Sitemaps declared in robots.txt — the authoritative pointer when present.
async function sitemapsFromRobots(origin) {
  try {
    const res = await fetchRetry(`${origin}/robots.txt`, { headers: BROWSER_HEADERS }, { retries: 1, timeoutMs: 15_000 })
    const text = await res.text()
    return [...text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1].trim())
  } catch {
    return []
  }
}

// Every URL the site admits to having. Empty when there is no usable sitemap,
// which is the caller's signal to fall back to following links.
export async function fetchSitemapUrls(origin, { log } = {}) {
  const host = new URL(origin).host
  const declared = await sitemapsFromRobots(origin)
  const roots = [...new Set([...declared, ...COMMON_PATHS.map((p) => `${origin}${p}`)])]

  const urls = new Set()
  let usedRoot = null

  for (const root of roots) {
    const xml = await fetchXml(root)
    if (!xml) continue
    usedRoot = root

    if (isIndex(xml)) {
      // Follow the children, staying on this host so a cross-domain index can't
      // turn one trust into an unbounded crawl of the internet.
      const children = extractLocs(xml)
        .filter((u) => {
          try {
            return new URL(u).host === host
          } catch {
            return false
          }
        })
        .slice(0, MAX_CHILD_SITEMAPS)
      for (const child of children) {
        const childXml = await fetchXml(child)
        if (!childXml) continue
        for (const loc of extractLocs(childXml)) {
          urls.add(loc)
          if (urls.size >= MAX_URLS) break
        }
        if (urls.size >= MAX_URLS) break
      }
    } else {
      for (const loc of extractLocs(xml)) {
        urls.add(loc)
        if (urls.size >= MAX_URLS) break
      }
    }

    if (urls.size) break
  }

  if (urls.size) log?.(`  sitemap: ${urls.size} URL(s) from ${usedRoot}`)

  // Same-host only, and drop the fragment so the same page isn't counted twice.
  return [...urls]
    .map((u) => {
      try {
        const parsed = new URL(u)
        parsed.hash = ""
        return parsed.host === host ? parsed.href : null
      } catch {
        return null
      }
    })
    .filter(Boolean)
}
