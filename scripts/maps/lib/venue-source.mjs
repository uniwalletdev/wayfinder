// Read venue modules as data, without a TypeScript toolchain.
//
// The venue modules are static object literals with a handful of type
// annotations. Strip the annotations and the file is valid JavaScript, which is
// cheaper and far more predictable than standing up a TS compile just to read
// data. Anything that fails to parse throws rather than being silently skipped —
// a venue this cannot read is a venue nothing here can vouch for.
//
// Shared by audit-venues.mjs and audit-placement.mjs: two audits reading the
// same files with two slightly different parsers would eventually disagree
// about which venues exist.

export function loadVenues(source) {
  const js = source
    .replace(/^\s*import\s[^\n]*\n/gm, "")
    .replace(/:\s*Venue\[\]\s*=/g, " =")
    .replace(/:\s*Venue\s*=/g, " =")
    .replace(/:\s*\[\[number,\s*number\],\s*\[number,\s*number\]\]\s*=/g, " =")
    .replace(/\bas\s+const\b/g, "")
    .replace(/\bas\s+"[^"]*"/g, "")
    .replace(/^\s*export\s+const\s+/gm, "const ")

  const names = [...source.matchAll(/^export const (\w+)\s*:\s*Venue\s*=/gm)].map((m) => m[1])
  if (names.length === 0) return []

  const body = `${js}\nreturn [${names.join(",")}]`
  try {
    return new Function(body)()
  } catch (err) {
    throw new Error(`could not parse venue module: ${err.message}`)
  }
}
