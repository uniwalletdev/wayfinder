// Render the App Store and Google Play screenshots from the app itself.
//
// The Android and iOS apps carry the static export in out/ (see
// scripts/app-shell-build.mjs), so a browser showing out/ at a phone's size is
// showing the same interface the store build runs. This serves out/ the way
// Capacitor does (every extensionless path is index.html), opens a handful of
// real scenes at Great Ormond Street, and writes each one at every size the
// stores ask for, plus Play's 1024x500 feature graphic.
//
//   npm run mobile:build
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/store-screenshots.mjs        -> store/
//
// STORE_SHOTS_OFFLINE=1 answers every request that leaves this machine with an
// empty response, for sandboxes with no internet: the floor plans still draw,
// the street map behind them stays blank. CI runs it online
// (.github/workflows/store-screenshots.yml). CHROMIUM_PATH points at a browser
// other than Playwright's own.
import { chromium } from "playwright"
import http from "http"
import { mkdirSync, readdirSync, rmSync } from "fs"
import { readFile } from "fs/promises"
import { extname, join } from "path"

const ROOT = "out"
const OUT = "store"
const OFFLINE = process.env.STORE_SHOTS_OFFLINE === "1"

// Each store's required sizes, as CSS viewport x device pixel ratio.
const SIZES = [
  // App Store Connect "iPhone 6.5-inch Display": 1284 x 2778.
  { dir: "app-store-iphone-6.5", width: 428, height: 926, scale: 3, mobile: true },
  // App Store Connect "iPad 13-inch Display": 2048 x 2732 (required while the
  // app supports iPad).
  { dir: "app-store-ipad-13", width: 1024, height: 1366, scale: 2, mobile: true },
  // Google Play phone: 1080 x 1920. Play refuses a long side more than twice
  // the short one, which rules out reusing the 1284 x 2778 iPhone set.
  { dir: "google-play-phone", width: 360, height: 640, scale: 3, mobile: true },
]

// Great Ormond Street: ten levels across ten buildings, the richest venue.
const MAIN_ENTRANCE = { lat: 51.523137, lng: -0.120593 }
const NEAR_ENTRANCE = { latitude: 51.52305, longitude: -0.12052, accuracy: 5 }

const ROUTE_FROM_ENTRANCE = `floor=0&lat=${MAIN_ENTRANCE.lat}&lng=${MAIN_ENTRANCE.lng}`

const SCENES = [
  {
    name: "01-route",
    // What a poster's QR code carries: the venue, a destination, and where the
    // reader is standing.
    url: `/?venue=gosh&to=kangaroo-ward&${ROUTE_FROM_ENTRANCE}`,
  },
  {
    name: "02-search",
    url: "/?venue=gosh",
    async act(page) {
      // On a phone the search bar is a button that opens the search sheet.
      await page.getByText(/Search a room, place or address/i).first().click()
      await page.getByRole("combobox").first().pressSequentially("ward", { delay: 40 })
    },
  },
  {
    name: "03-guidance",
    url: `/?venue=gosh&to=kangaroo-ward&${ROUTE_FROM_ENTRANCE}`,
    async act(page) {
      await page.getByRole("button", { name: /^Start/ }).first().click()
      await page.waitForTimeout(1500)
    },
  },
  {
    name: "04-step-free",
    url: `/?venue=gosh&to=ear-nose-and-throat-ent-outpatients&stepfree=1&${ROUTE_FROM_ENTRANCE}`,
  },
  {
    name: "05-floors",
    url: "/?venue=gosh",
    async act(page) {
      await page.getByRole("button", { name: /Show floors/i }).first().click()
    },
  },
  {
    name: "06-hospitals",
    url: "/?venue=gosh",
    async act(page) {
      const expand = page.getByRole("button", { name: /Expand panel/i }).first()
      if (await expand.isVisible().catch(() => false)) await expand.click()
      await page.getByRole("button", { name: /Great Ormond Street Hospital/ }).first().click()
      // Filter to hospitals: the full list also holds a residential test venue.
      await page.getByPlaceholder(/Search hospitals/i).first().pressSequentially("hospital", { delay: 30 })
      await page.waitForTimeout(800)
    },
  },
]

// A scene that starts guidance would send its walk to the production database
// as a corridor trace; a typed search that matches nothing would be logged as a
// search miss. Neither is real data, so both are answered here and never reach
// the server.
const NEVER_SEND = /\/api\/(signals|search-misses)\b/

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".txt": "text/plain",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
}

function serve(port) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
      if (!extname(path)) path = "/index.html" // Capacitor's rule
      try {
        const body = await readFile(join(ROOT, path))
        // The feature graphic page is about:blank, so its @font-face requests
        // are cross-origin and need this header to be honoured.
        res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream", "access-control-allow-origin": "*" })
        res.end(body)
      } catch {
        res.writeHead(404)
        res.end()
      }
    })
    server.listen(port, () => resolve(server))
  })
}

// The export names its font files by content hash; find the app's two faces.
function fontUrl(origin, prefix) {
  const file = readdirSync(join(ROOT, "_next/static/media")).find((f) => f.startsWith(prefix) && f.endsWith(".woff2"))
  return file ? `${origin}/_next/static/media/${file}` : ""
}

async function featureGraphic(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Heading; font-weight: 400 700; src: url(${fontUrl(origin, "space_grotesk")}); }
    @font-face { font-family: Body; font-weight: 400 700; src: url(${fontUrl(origin, "ibm_plex_sans")}); }
    html, body { margin: 0; width: 1024px; height: 500px; }
    body { background: linear-gradient(135deg, #0A1626 0%, #0A2A4F 55%, #0A5DC2 100%); color: #fff;
           font-family: Body, system-ui, sans-serif; display: flex; align-items: center; }
    h1 { font-family: Heading, system-ui, sans-serif; }
    .wrap { display: flex; align-items: center; gap: 48px; padding: 0 84px; }
    img { width: 196px; height: 196px; border-radius: 44px; box-shadow: 0 18px 50px rgba(0,0,0,.35); }
    h1 { font-size: 76px; line-height: 1; margin: 0 0 18px; letter-spacing: -1.5px; font-weight: 700; }
    p { font-size: 30px; line-height: 1.3; margin: 0; color: rgba(255,255,255,.82); max-width: 560px; }
  </style></head><body><div class="wrap">
    <img src="${origin}/icon-512.png" alt="">
    <div><h1>Findway</h1><p>Find any ward, clinic or department, floor by floor, step-free.</p></div>
  </div></body></html>`)
  await page.waitForLoadState("networkidle")
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(OUT, "google-play-feature-graphic.png") })
  await page.close()
}

const port = 4173
const origin = `http://localhost:${port}`
const server = await serve(port)
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
rmSync(OUT, { recursive: true, force: true })

const problems = []
try {
  for (const size of SIZES) {
    mkdirSync(join(OUT, size.dir), { recursive: true })
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.scale,
      isMobile: size.mobile,
      hasTouch: true,
      geolocation: NEAR_ENTRANCE,
      permissions: ["geolocation"],
      locale: "en-GB",
      colorScheme: "light",
    })
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url())
      if (NEVER_SEND.test(url.pathname)) return route.fulfill({ status: 204, body: "" })
      if (OFFLINE && url.hostname !== "localhost") return route.fulfill({ status: 204, body: "" })
      return route.continue()
    })
    for (const scene of SCENES) {
      const page = await context.newPage()
      page.on("pageerror", (e) => problems.push(`${size.dir}/${scene.name}: ${e.message}`))
      await page.goto(origin + scene.url, { waitUntil: "networkidle" })
      await page.waitForTimeout(1500)
      try {
        if (scene.act) await scene.act(page)
      } catch (e) {
        problems.push(`${size.dir}/${scene.name}: ${e.message.split("\n")[0]}`)
      }
      await page.waitForTimeout(1200)
      await page.screenshot({ path: join(OUT, size.dir, `${scene.name}.png`) })
      await page.close()
    }
    await context.close()
  }
  await featureGraphic(browser, origin)
} finally {
  await browser.close()
  server.close()
}

for (const p of problems) console.warn("warning:", p)
console.log(`Screenshots written to ${OUT}/${OFFLINE ? " (offline: street map left blank)" : ""}`)
