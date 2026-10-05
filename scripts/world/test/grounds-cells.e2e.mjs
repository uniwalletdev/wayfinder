// Three runs of the grounds fetch (scripts/world/fetch-campus.mjs) against a
// local stand-in for Overpass that cannot answer one country whole, nor the
// centre cell of it, under a short time limit: the first run must keep the
// cells that came in, the second carry on from them and complete the area,
// the third ask for nothing. Also that --first puts a country ahead of a
// smaller one, and what carry-on.mjs would make of each run's status.
//
// Run by hand: node scripts/world/test/grounds-cells.e2e.mjs
// Not in `npm run nhs:test`: it takes about a minute, as the fetch waits
// four seconds between cells.
import { createServer } from "http"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs"
import { spawn } from "child_process"
import { tmpdir } from "os"
import { join } from "path"
import { fileURLToPath } from "url"
import { nextRun } from "../carry-on.mjs"

const REPO = fileURLToPath(new URL("../../..", import.meta.url))
const centers = [6.15, 6.45, 6.75]
const lngs = [3.15, 3.45, 3.75]
const XX = centers.flatMap((lat, i) => lngs.map((lng, j) => ({ id: `osm-w${i * 3 + j + 1}`, name: `Hospital ${i},${j}`, lat, lng, bbox: [lat - 0.01, lng - 0.01, lat + 0.01, lng + 0.01] })))
const YY = [
  { id: "osm-w91", name: "Clinic A", lat: 50.1, lng: 8.1, bbox: [50.09, 8.09, 50.11, 8.11] },
  { id: "osm-w92", name: "Clinic B", lat: 50.3, lng: 8.3, bbox: [50.29, 8.29, 50.31, 8.31] },
]
const all = [...XX.map((h) => ({ ...h, country: "XX" })), ...YY.map((h) => ({ ...h, country: "YY" }))]
const areaHeight = (6.8 - 6.1) / 3 // XX's box is the hospitals' ±0.05, cut in three
const count = (tags) => ({ type: "count", id: 0, tags })
const answer = (hs) => ({
  elements: [count({ areas: "1", total: "1" }), count({ total: String(hs.length) }), count({ areas: String(hs.length) }), ...hs.map((h) => ({ type: "node", id: 1000 + all.indexOf(h), lat: h.lat, lon: h.lng, tags: { entrance: "main", name: h.name } }))],
})
let requests = []
const server = createServer((req, res) => {
  let body = ""
  req.on("data", (d) => (body += d))
  req.on("end", () => {
    const q = decodeURIComponent(body.replace(/^data=/, "").replace(/\+/g, " "))
    const send = (code, obj) => {
      res.writeHead(code, { "content-type": "application/json" })
      res.end(JSON.stringify(obj ?? { error: "gateway timeout" }))
    }
    if (/area\["ISO3166-1"="XX"\]/.test(q)) return requests.push("XX whole") && send(504)
    if (/area\["ISO3166-1"="YY"\]/.test(q)) return requests.push("YY whole") && send(200, answer(YY))
    const m = q.match(/way\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)\["amenity"="hospital"\]/)
    if (!m) return send(400, { error: "unexpected query" })
    const [s, w, n, e] = m.slice(1).map(Number)
    const centre = Math.abs(n - s - areaHeight) < 1e-6 && s < 6.45 && 6.45 < n && w < 3.45 && 3.45 < e
    requests.push(`cell ${s.toFixed(3)},${w.toFixed(3)}${centre ? " (centre: 504)" : ""}`)
    if (centre) return send(504)
    send(200, answer(all.filter((h) => h.lat >= s && h.lat <= n && h.lng >= w && h.lng <= e)))
  })
})
await new Promise((r) => server.listen(0, "127.0.0.1", r))
const url = `http://127.0.0.1:${server.address().port}/api/interpreter`

const dir = mkdtempSync(join(tmpdir(), "grounds-e2e-"))
mkdirSync(join(dir, "data/world/hospitals"), { recursive: true })
writeFileSync(join(dir, "data/world/hospitals/XX.json"), JSON.stringify({ country: "XX", hospitals: XX }))
writeFileSync(join(dir, "data/world/hospitals/YY.json"), JSON.stringify({ country: "YY", hospitals: YY }))

// Spawned asynchronously: the stand-in server lives in this process, and a
// synchronous spawn would freeze it.
const run = (budgetMin) =>
  new Promise((resolve) => {
    requests = []
    const t0 = Date.now()
    const child = spawn("node", [`${REPO}/scripts/world/fetch-campus.mjs`, "--countries", "XX,YY", "--first", "XX", "--reuse-days", "7", "--budget-min", String(budgetMin)], {
      cwd: dir,
      env: { ...process.env, OVERPASS_ENDPOINTS: url, OVERPASS_GAP_MS: "100" },
    })
    let log = ""
    child.stdout.on("data", (d) => (log += d))
    child.stderr.on("data", (d) => (log += d))
    child.on("close", (code) => {
      const status = JSON.parse(readFileSync(join(dir, "data/world/campus-raw/status.json"), "utf8"))
      resolve({ log, status, code, seconds: Math.round((Date.now() - t0) / 1000), requests: [...requests] })
    })
  })
const areaFile = () => JSON.parse(readFileSync(join(dir, "data/world/campus-raw/areas/XX.json"), "utf8"))
let failed = 0
const check = (name, ok, detail = "") => {
  failed += ok ? 0 : 1
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail && !ok ? ` — ${detail}` : ""}`)
}

console.log("run 1: 1.5 minutes, the server cannot answer XX whole nor its centre cell")
const r1 = await run(1.5)
console.log(r1.log.split("\n").filter((l) => /^(  )?(XX|YY)|Grounds/.test(l)).join("\n"))
const f1 = existsSync(join(dir, "data/world/campus-raw/areas/XX.json")) ? areaFile() : null
const kept1 = f1?.partial ? Object.keys(f1.cells).length : 0
check("the run exits cleanly", r1.code === 0, `exit ${r1.code}\n${r1.log.slice(-800)}`)
check("XX is taken before YY, though YY is smaller", r1.log.indexOf("XX") < r1.log.indexOf("YY"))
check("XX is incomplete, with cells left for the next run", r1.status.countries.XX?.complete === false && r1.status.countries.XX.left === 1)
check("a partial file holds the cells that came in", f1?.partial === true && f1.checked === 2 && kept1 >= 3 && kept1 <= 9, `kept ${kept1}`)
check("the log says how many were kept", new RegExp(`cells out of time; ${kept1} cells kept`).test(r1.log))
check("the centre cell was split and a quarter kept", Object.keys(f1?.cells ?? {}).some((k) => Math.abs(Number(k.split(",")[2]) - Number(k.split(",")[0]) - areaHeight / 2) < 1e-4), r1.requests.join("; "))
check("the kept cells count as progress", r1.status.fetchedNew === kept1, `fetchedNew ${r1.status.fetchedNew}`)
check("YY was out of time", r1.status.countries.YY?.complete === false)
const next1 = nextRun(r1.status, 0, 8)
check("carry-on would start another run for both", next1.countries.join() === "XX,YY", next1.why)

console.log("\nrun 2: ten minutes, carrying on")
const r2 = await run(10)
console.log(r2.log.split("\n").filter((l) => /^(  )?(XX|YY)|Grounds/.test(l)).join("\n"))
const f2 = areaFile()
check("the run exits cleanly", r2.code === 0, r2.log.slice(-800))
check("XX goes straight to its cells, the whole area is not asked for again", !r2.requests.includes("XX whole"))
check("the kept cells are reused, not asked for again", (r2.log.match(/kept from 20/g) ?? []).length === kept1)
check("the centre cell goes straight to its quarters", !/cell 1,1: failed/.test(r2.log) && !r2.requests.some((x) => x.includes("centre")))
check("the rest is fetched", (r2.log.match(/XX cell [\d,.]+: \d+ elements in/g) ?? []).length === 12 - kept1)
check("XX is complete, as a whole-area file", r2.status.countries.XX?.complete === true && !f2.partial && Array.isArray(f2.elements) && f2.checked === 2)
check("every hospital got its elements", f2.elements.length === 9 && new Set(f2.elements.map((e) => e.id)).size === 9)
check("YY came in whole", r2.status.countries.YY?.complete === true && r2.requests.includes("YY whole"))
check("each area that came in counts once as progress", r2.status.fetchedNew === 2, `fetchedNew ${r2.status.fetchedNew}`)
check("carry-on would stop: all complete", nextRun(r2.status, 1, 8).countries.length === 0)
const xx = JSON.parse(readFileSync(join(dir, "data/world/campus-raw/XX.json"), "utf8"))
check("the country file attributes an element to each of the nine hospitals", Object.keys(xx.hospitals).length === 9 && xx.complete === true)

console.log("\nrun 3: everything reused")
const r3 = await run(10)
console.log(r3.log.split("\n").filter((l) => /^(  )?(XX|YY)|Grounds/.test(l)).join("\n"))
check("no request is made", r3.requests.length === 0, r3.requests.join("; "))
check("both are complete and nothing is new", r3.status.complete === true && r3.status.fetchedNew === 0)
check("carry-on would stop: every country complete", /every country/.test(nextRun(r3.status, 2, 8).why))

server.close()
console.log(`\n${failed ? `${failed} FAILED` : "all passed"} (runs took ${r1.seconds}s, ${r2.seconds}s, ${r3.seconds}s)`)
process.exit(failed ? 1 : 0)
