// Minimal ZIP reader — enough for the NHS ODS bulk downloads, which are single
// deflated CSVs.
//
// Written by hand rather than pulling in a zip dependency: this repo keeps its
// dependency list short, the pipeline runs in CI where every added package is
// another supply-chain surface, and the subset of ZIP that ODS uses (store +
// deflate, no encryption, no zip64) is about sixty lines. If ODS ever ships a
// zip64 archive this throws with a clear message instead of returning silent
// garbage.
import { inflateRawSync } from "zlib"

const EOCD_SIG = 0x06054b50 // end of central directory
const CEN_SIG = 0x02014b50 // central directory file header
const LOC_SIG = 0x04034b50 // local file header

function findEocd(buf) {
  // The EOCD sits at the end, after a comment of up to 64KB. Scan backwards.
  const min = Math.max(0, buf.length - 0xffff - 22)
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  throw new Error("not a zip file: no end-of-central-directory record")
}

// Returns [{ name, data }] with data already decompressed.
export function readZipEntries(buf) {
  const eocd = findEocd(buf)
  const count = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)
  if (offset === 0xffffffff) throw new Error("zip64 archives are not supported")

  const entries = []
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== CEN_SIG) {
      throw new Error(`corrupt zip: expected central directory header at ${offset}`)
    }
    const method = buf.readUInt16LE(offset + 10)
    const compressedSize = buf.readUInt32LE(offset + 20)
    const nameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)
    const localOffset = buf.readUInt32LE(offset + 42)
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen)

    if (buf.readUInt32LE(localOffset) !== LOC_SIG) {
      throw new Error(`corrupt zip: expected local header for ${name} at ${localOffset}`)
    }
    // The local header's extra field can differ in length from the central
    // one's, so re-read both lengths here rather than reusing the values above.
    const localNameLen = buf.readUInt16LE(localOffset + 26)
    const localExtraLen = buf.readUInt16LE(localOffset + 28)
    const start = localOffset + 30 + localNameLen + localExtraLen
    const raw = buf.subarray(start, start + compressedSize)

    let data
    if (method === 0) data = Buffer.from(raw)
    else if (method === 8) data = inflateRawSync(raw)
    else throw new Error(`unsupported zip compression method ${method} for ${name}`)

    entries.push({ name, data })
    offset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

// ODS archives contain exactly one CSV. Pull it out by extension so we don't
// depend on the inner filename matching the archive name (they don't always).
export function readSingleCsv(buf, archiveName) {
  const csvs = readZipEntries(buf).filter((e) => /\.csv$/i.test(e.name))
  if (csvs.length !== 1) {
    throw new Error(`${archiveName}: expected exactly 1 CSV in the archive, found ${csvs.length}`)
  }
  return csvs[0].data.toString("utf8")
}
