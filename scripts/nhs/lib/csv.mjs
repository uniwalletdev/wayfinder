// RFC 4180 CSV reader.
//
// The ODS extracts are headerless and positional, so a split(",") would appear
// to work right up until a hospital name contains a comma ("Guy's and St
// Thomas', Lambeth") — at which point every field after it shifts by one and the
// postcode column silently becomes an address line. That failure is invisible in
// the output, so the parser handles quoting properly.
export function parseCsv(text) {
  // Strip a UTF-8 BOM; ODS files sometimes carry one and it would otherwise
  // become part of the first organisation code.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const rows = []
  let row = []
  let field = ""
  let quoted = false
  let started = false // distinguishes an empty line from a line holding ""

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } // escaped quote
        else quoted = false
      } else field += c
      continue
    }
    if (c === '"') { quoted = true; started = true; continue }
    if (c === ",") { row.push(field); field = ""; started = true; continue }
    if (c === "\r") continue
    if (c === "\n") {
      if (started || field.length || row.length) { row.push(field); rows.push(row) }
      row = []; field = ""; started = false
      continue
    }
    field += c
  }
  if (started || field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}
