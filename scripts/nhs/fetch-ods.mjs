// Stage 1 — download the NHS ODS bulk extracts.
//
// This is the stage that replaces "where did nhs-hospitals-data.ts come from?"
// with an answer. It writes the CSVs exactly as published (data/raw/ods/) plus a
// manifest entry recording the URL, the SHA-256 and the row count, so any later
// diff of the generated venue data can be traced back to a specific upstream
// file on a specific day.
//
// Run: node scripts/nhs/fetch-ods.mjs
import { writeFileSync } from "fs"
import { fetchBuffer } from "./lib/net.mjs"
import { readSingleCsv } from "./lib/zip.mjs"
import { parseCsv } from "./lib/csv.mjs"
import { parseOdsRows, ODS_SOURCES } from "./lib/ods.mjs"
import { RAW_DIR, ensureDir, updateManifest, log } from "./lib/paths.mjs"
import { join } from "path"

const STAGE = "fetch-ods"

async function fetchSource(key, source) {
  log(STAGE, `fetching ${key} — ${source.description}`)
  const { buf, sha256 } = await fetchBuffer(source.url)
  const csv = readSingleCsv(buf, key)
  const rows = parseCsv(csv)

  // Parse now rather than in a later stage: a layout change should fail here,
  // while we still know which file caused it and before anything downstream has
  // written a half-correct dataset.
  const { records, skipped } = parseOdsRows(rows, { sourceName: key })

  const outDir = ensureDir(join(RAW_DIR, "ods"))
  writeFileSync(join(outDir, `${key}.csv`), csv)

  updateManifest(`ods.${key}`, {
    url: source.url,
    description: source.description,
    sha256,
    zipBytes: buf.length,
    rows: rows.length,
    usableRecords: records.length,
    skipped,
    licence: "Open Government Licence v3.0",
  })

  log(
    STAGE,
    `${key}: ${rows.length} rows -> ${records.length} open, located records ` +
      `(skipped ${skipped.closed} closed, ${skipped.noPostcode} without a postcode, ${skipped.short} malformed)`
  )
  return records.length
}

let failures = 0
for (const [key, source] of Object.entries(ODS_SOURCES)) {
  try {
    await fetchSource(key, source)
  } catch (err) {
    // An optional source (GP practices) shouldn't sink a run that is really
    // about hospital sites — but it must be loud, not swallowed.
    if (source.optional) {
      console.warn(`[${STAGE}] WARNING: optional source ${key} failed: ${err.message}`)
      continue
    }
    console.error(`[${STAGE}] FAILED on required source ${key}: ${err.message}`)
    failures++
  }
}

if (failures) process.exit(1)
log(STAGE, "done")
