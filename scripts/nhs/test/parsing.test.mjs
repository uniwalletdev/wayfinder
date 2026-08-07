// Checks for the pipeline's parsing layer: the ZIP reader, the CSV reader and
// the ODS record parser.
//
// These are the parts where a bug is invisible. A CSV parser that mishandles a
// quoted comma doesn't crash — it shifts every later column, so an address line
// becomes a postcode and a hospital lands in the wrong city. The ODS extracts
// are headerless, so nothing in the data itself would reveal it either.
//
// Run: node scripts/nhs/test/parsing.test.mjs
import { deflateRawSync } from "zlib"
import { readZipEntries, readSingleCsv } from "../lib/zip.mjs"
import { parseCsv } from "../lib/csv.mjs"
import { parseOdsRows, normalisePostcode, looksPublicFacing } from "../lib/ods.mjs"
import { group, check, throws, report } from "./harness.mjs"

// Build a real ZIP so the reader is tested against the actual byte format.
function makeZip(filename, content, { store = false } = {}) {
  const nameBuf = Buffer.from(filename, "utf8")
  const raw = Buffer.from(content, "utf8")
  const data = store ? raw : deflateRawSync(raw)
  const method = store ? 0 : 8

  let crc = ~0
  for (const b of raw) {
    crc ^= b
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  crc = ~crc >>> 0

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(method, 8)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(raw.length, 22)
  local.writeUInt16LE(nameBuf.length, 26)
  const localPart = Buffer.concat([local, nameBuf, data])

  const cen = Buffer.alloc(46)
  cen.writeUInt32LE(0x02014b50, 0)
  cen.writeUInt16LE(20, 6)
  cen.writeUInt16LE(method, 10)
  cen.writeUInt32LE(crc, 16)
  cen.writeUInt32LE(data.length, 20)
  cen.writeUInt32LE(raw.length, 24)
  cen.writeUInt16LE(nameBuf.length, 28)
  cen.writeUInt32LE(0, 42)
  const cenPart = Buffer.concat([cen, nameBuf])

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(cenPart.length, 12)
  eocd.writeUInt32LE(localPart.length, 16)

  return Buffer.concat([localPart, cenPart, eocd])
}

group("zip")
const deflated = makeZip("ets.csv", "A,B,C\n1,2,3\n")
check("reads a deflated entry", readZipEntries(deflated)[0].data.toString() === "A,B,C\n1,2,3\n")
check("readSingleCsv finds the CSV", readSingleCsv(deflated, "ets") === "A,B,C\n1,2,3\n")
check("reads a stored entry", readZipEntries(makeZip("a.csv", "stored", { store: true }))[0].data.toString() === "stored")
throws("rejects a non-zip", () => readZipEntries(Buffer.from("nowhere near a zip file")), /no end-of-central-directory/)

group("csv")
const tricky = parseCsv('A,"Guy\'s and St Thomas\', Lambeth",C\n"quoted ""inner"" quotes",2,3\n')
check("a quoted comma stays one field", tricky[0].length === 3 && tricky[0][1] === "Guy's and St Thomas', Lambeth", JSON.stringify(tricky[0]))
check("escaped quotes unescape", tricky[1][0] === 'quoted "inner" quotes', tricky[1][0])
check("strips a BOM", parseCsv("﻿RX1,Name")[0][0] === "RX1")
check("handles CRLF line endings", parseCsv("a,b\r\nc,d\r\n").length === 2)
check("ignores a trailing blank line", parseCsv("a,b\n\n").length === 1)

group("ods")
const FIELDS = 27
function odsRow({ code, name, postcode, close = "", status = "A", parent = "RJ1", addr = "1 Test Road" }) {
  const r = new Array(FIELDS).fill("")
  r[0] = code; r[1] = name; r[4] = addr; r[9] = postcode
  r[10] = "19910401"; r[11] = close; r[12] = status; r[14] = parent
  return r
}

const rows = [
  odsRow({ code: "RJ122", name: "ST THOMAS' HOSPITAL", postcode: "SE17EH" }),
  odsRow({ code: "RJ123", name: "CLOSED BY DATE", postcode: "SE1 7EH", close: "20200101" }),
  odsRow({ code: "RJ124", name: "CLOSED BY STATUS", postcode: "SE1 7EH", status: "C" }),
  odsRow({ code: "RJ125", name: "NO POSTCODE", postcode: "" }),
  odsRow({ code: "RJ126", name: "STOKE-ON-TRENT NHS TREATMENT CENTRE", postcode: "ST46QG" }),
  odsRow({ code: "RJ127", name: "ST MARY'S HOSPITAL (HQ ANNEXE)", postcode: "W2 1NY" }),
  odsRow({ code: "RJ128", name: "THE ROYAL FREE HOSPITAL", postcode: "NW3 2QG" }),
]
const { records, skipped } = parseOdsRows(rows, { sourceName: "test" })

check("keeps only open, located rows", records.length === 4, JSON.stringify(skipped))
check("drops sites closed by date and by status", skipped.closed === 2, JSON.stringify(skipped))
check("drops sites with no postcode", skipped.noPostcode === 1, JSON.stringify(skipped))
check("normalises postcode spacing", records[0].postcode === "SE1 7EH", records[0].postcode)
check("title-cases an upper-case name", records[0].name === "St Thomas' Hospital", records[0].name)
check("keeps NHS upper-case", records[1].name === "Stoke-on-Trent NHS Treatment Centre", records[1].name)
check("keeps 'on' lower inside a hyphenated place name", records[1].name.includes("Stoke-on-Trent"), records[1].name)
// The apostrophe case is the one that bites: treating it as a word break turns
// MARY'S into "Mary'S" on every St Mary's in the country.
check("an apostrophe is not a word break", records[2].name === "St Mary's Hospital (HQ Annexe)", records[2].name)
check("a leading 'The' stays capitalised", records[3].name === "The Royal Free Hospital", records[3].name)
check("carries the parent trust code", records[0].parentCode === "RJ1")

// The whole point of the width assertion: ODS files have no header row, so a
// column being inserted upstream must fail here rather than silently shifting
// every field after it.
throws("fails loudly if the ODS layout changes", () => parseOdsRows([new Array(24).fill("x")], { sourceName: "test" }), /layout has probably changed/)

check("normalisePostcode compacts then respaces", normalisePostcode("se1  7eh") === "SE1 7EH")
check("filters out administrative registrations", !looksPublicFacing("TRUST HEAD OFFICE") && !looksPublicFacing("FINANCE DEPARTMENT"))
check("keeps real hospitals", looksPublicFacing("St Thomas' Hospital") && looksPublicFacing("Royal Free Hospital"))

report()
