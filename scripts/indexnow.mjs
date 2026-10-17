// Tell Bing and the other IndexNow search engines (https://www.indexnow.org)
// about every page in the live sitemap, so new and changed hospital pages are
// crawled within hours instead of whenever a crawler next calls. Bing's index
// is what ChatGPT search and Copilot answer from; Google does not take IndexNow
// and reads the sitemap instead.
//
// The key is public/<key>.txt, a file holding its own name: serving it from
// the site is how IndexNow knows the site sent the list. It is not a secret.
//
//   node scripts/indexnow.mjs [site]    site defaults to FINDWAY_SITE_URL, then https://findway.ai
//
// Run by .github/workflows/indexnow.yml after each production deployment.
import { readdirSync, readFileSync } from "fs"
import { fileURLToPath, pathToFileURL } from "url"

export const ENDPOINT = "https://api.indexnow.org/indexnow"
// One submission takes at most this many URLs.
export const MAX_URLS = 10_000
const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url))

// The key among public/'s file names: a <hex>.txt whose content is that hex.
export function findKey(names, read) {
  for (const name of names) {
    const m = /^([a-f0-9]{32})\.txt$/.exec(name)
    if (m && read(name).trim() === m[1]) return m[1]
  }
  return null
}

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&(amp|lt|gt|quot|apos);/g, (e) => ENTITIES[e]))
}

// What to send: the sitemap's URLs on the site's own host, each once. URLs on
// any other host are returned separately; IndexNow refuses a list with any.
export function submission(site, key, urls) {
  const { host, origin } = new URL(site)
  const onHost = []
  const elsewhere = []
  for (const u of new Set(urls)) {
    let h
    try {
      h = new URL(u).host
    } catch {
      h = null
    }
    ;(h === host ? onHost : elsewhere).push(u)
  }
  return { body: { host, key, keyLocation: `${origin}/${key}.txt`, urlList: onHost.slice(0, MAX_URLS) }, elsewhere }
}

async function get(url, init) {
  try {
    return await fetch(url, init)
  } catch (e) {
    throw new Error(`could not reach ${url}: ${e?.cause?.code ?? e?.message ?? e}`)
  }
}

async function main() {
  const site = (process.argv[2] || process.env.FINDWAY_SITE_URL || "https://findway.ai").trim().replace(/\/+$/, "")
  const key = findKey(readdirSync(PUBLIC), (name) => readFileSync(PUBLIC + name, "utf8"))
  if (!key) throw new Error("no IndexNow key in public/: add <32 hex characters>.txt holding those characters")

  // IndexNow fetches the key file itself; a deployment that does not serve it
  // yet would have every URL refused.
  const keyRes = await get(`${site}/${key}.txt`)
  if (!keyRes.ok || (await keyRes.text()).trim() !== key) {
    throw new Error(`${site}/${key}.txt does not answer with the key (HTTP ${keyRes.status}). Is this deployment live on ${site}?`)
  }
  const mapRes = await get(`${site}/sitemap.xml`)
  if (!mapRes.ok) throw new Error(`${site}/sitemap.xml answered HTTP ${mapRes.status}`)
  const { body, elsewhere } = submission(site, key, sitemapUrls(await mapRes.text()))
  if (elsewhere.length > 0) {
    console.warn(`${elsewhere.length} sitemap URLs are not on ${body.host} and are left out, e.g. ${elsewhere[0]}.`)
    console.warn(`Set NEXT_PUBLIC_SITE_URL=${site} on the deployment so the sitemap uses this address.`)
  }
  if (body.urlList.length === 0) throw new Error(`the sitemap lists no URLs on ${body.host}`)

  const res = await get(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  })
  // 200: taken. 202: taken, key still being checked. Anything else is a refusal.
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`IndexNow refused the list: HTTP ${res.status} ${await res.text().catch(() => "")}`)
  }
  console.log(`IndexNow took ${body.urlList.length} URLs on ${body.host} (HTTP ${res.status}).`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
