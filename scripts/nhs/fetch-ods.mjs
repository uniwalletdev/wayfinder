// Stage 1 — get the NHS organisation register.
//
// This is the stage that replaces "where did nhs-hospitals-data.ts come from?"
// with an answer. It writes the register as CSV (data/raw/ods/) plus a manifest
// entry recording the source, the SHA-256 and the row count, so any later diff of
// the generated venue data can be traced back to a specific fetch.
//
// It tries three sources in order, because relying on one was a real failure:
//
//   1. NHS Digital's bulk download. The published extract, and the best source —
//      but it sits behind a CDN that answers 403 to non-browser clients on some
//      networks, which stopped the pipeline dead.
//   2. The ORD API. Same organisation data from the same publisher, reachable on
//      networks where the download host is not. The fallback writes a CSV in the
//      identical layout, so nothing downstream knows the difference.
//   3. A file already in data/raw/ods/. The manual escape hatch: download it in
//      a browser, drop it in, carry on. Last because it may be stale, and using
//      a stale register silently would be worse than failing.
//
// Run: node scripts/nhs/fetch-ods.mjs [--use-local]
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { fetchFile, sha256 } from "./lib/net.mjs"
import { readSingleCsv } from "./lib/zip.mjs"
import { parseCsv } from "./lib/csv.mjs"
import { parseOdsRows, recordsToCsv, ODS_SOURCES } from "./lib/ods.mjs"
import { fetchOdsViaOrd, ORD_ROLES } from "./lib/ord.mjs"
import { RAW_DIR, ensureDir, updateManifest, log } from "./lib/paths.mjs"

const STAGE = "fetch-ods"
const USE_LOCAL = process.argv.includes("--use-local")

const csvPathFor = (key) => join(ensureDir(join(RAW_DIR, "ods")), `${key}.csv`)

// A file the user placed there by hand, or one an earlier run wrote.
function readLocal(key) {
  const csv = csvPathFor(key)
  if (existsSync(csv)) return readFileSync(csv, "utf8")
  // Accept a browser-downloaded zip too — that's the form the site serves.
  const zip = join(RAW_DIR, "ods", `${key}.zip`)
  if (existsSync(zip)) return readSingleCsv(readFileSync(zip), key)
  return null
}

async function viaBulkDownload(key, source) {
  const { buf } = await fetchFile(source.url)
  return { csv: readSingleCsv(buf, key), via: "bulk download", url: source.url }
}

async function viaOrdApi(key) {
  if (!ORD_ROLES[key]) throw new Error(`no ORD equivalent for "${key}"`)
  const records = await fetchOdsViaOrd(key, {
    log: (m) => log(STAGE, m),
    // Sites need their parent trust, which only the per-organisation detail
    // records carry. Trusts have no parent, so they skip that entirely.
    withParents: key === "ets",
  })
  return {
    csv: recordsToCsv(records),
    via: "ORD API fallback",
    url: "https://directory.spineservices.nhs.uk/ORD/2-0-0/organisations",
  }
}

async function resolve(key, source) {
  if (USE_LOCAL) {
    const csv = readLocal(key)
    if (csv) return { csv, via: "local file", url: null }
    log(STAGE, `  --use-local given but no data/raw/ods/${key}.csv or .zip found; downloading instead`)
  }

  const problems = []
  try {
    return await viaBulkDownload(key, source)
  } catch (err) {
    problems.push(`bulk download: ${err.message}`)
    log(STAGE, `  bulk download refused (${err.message.split("->").pop()?.trim() ?? err.message}) — trying the ORD API`)
  }

  try {
    return await viaOrdApi(key)
  } catch (err) {
    problems.push(`ORD API: ${err.message}`)
    log(STAGE, `  ORD API failed: ${err.message}`)
  }

  const csv = readLocal(key)
  if (csv) {
    log(STAGE, `  falling back to the existing data/raw/ods/${key}.csv — it may be out of date`)
    return { csv, via: "local file (stale)", url: null }
  }

  throw new Error(problems.join("; "))
}

async function fetchSource(key, source) {
  log(STAGE, `fetching ${key} — ${source.description}`)
  const { csv, via, url } = await resolve(key, source)
  const rows = parseCsv(csv)

  // Parse now rather than in a later stage: a layout change should fail here,
  // while we still know which source caused it and before anything downstream
  // has written a half-correct dataset.
  const { records, skipped } = parseOdsRows(rows, { sourceName: key })

  writeFileSync(csvPathFor(key), csv)

  updateManifest(`ods.${key}`, {
    via,
    url,
    description: source.description,
    sha256: sha256(Buffer.from(csv)),
    rows: rows.length,
    usableRecords: records.length,
    skipped,
    licence: "Open Government Licence v3.0",
  })

  log(
    STAGE,
    `${key}: ${rows.length} rows via ${via} -> ${records.length} open, located records ` +
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
      console.warn(`[${STAGE}] WARNING: optional source ${key} unavailable: ${err.message}`)
      continue
    }
    console.error(`[${STAGE}] FAILED on required source ${key}: ${err.message}`)
    failures++
  }
}

if (failures) {
  console.error(
    `[${STAGE}] Every source for the register was refused. If a browser can download\n` +
      `        https://files.digital.nhs.uk/assets/ods/current/etr.zip, save it to\n` +
      `        data/raw/ods/etr.zip and re-run with:  node scripts/nhs/fetch-ods.mjs --use-local`
  )
  process.exit(1)
}
log(STAGE, "done")
