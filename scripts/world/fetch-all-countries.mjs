// One-off: fetch (or load from cache) the OSM hospital list for every country
// not already covered, so we know the real scale before crawling any of them
// for floor-plan PDFs. Paced politely — one Overpass query at a time with a
// pause between — since this is 211 sequential queries against a shared
// public service.
import { loadOrFetchHospitals } from "./lib/osm.mjs"

process.on("uncaughtException", (err) => {
  console.error(`[fetch-all-countries] uncaught exception, continuing: ${err.stack || err}`)
})

const codes = process.argv[2].split(",")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let total = 0
for (const cc of codes) {
  try {
    const hospitals = await loadOrFetchHospitals(cc)
    total += hospitals.length
    console.log(`${cc}: ${hospitals.length} (running total: ${total})`)
  } catch (err) {
    console.error(`${cc}: FAILED — ${err.message}`)
  }
  await sleep(2000)
}
console.log(`done — ${total} hospitals across ${codes.length} countries`)
