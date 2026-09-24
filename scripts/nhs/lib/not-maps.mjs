// Sheets a person has looked at and found are not maps at all — a directory
// table, a travel leaflet, a duplicate of another sheet. See data/not-maps.json.
//
// The automatic gates in draft-sheets.mjs judge a sheet by its labels and its
// shape, and a dense table of department names passes both. This list is where
// a human's "that is not a map" is recorded, so the next --force run does not
// quietly publish it again.
import { dataPath, readJson } from "./paths.mjs"

export function readNotMaps(path = dataPath("not-maps.json")) {
  const doc = readJson(path, { entries: [] })
  return new Map((doc.entries ?? []).map((e) => [e.slug, e]))
}

// Should a register entry be withdrawn this run? `keep: true` overrules the
// matcher's judgement about WHICH hospital a sheet shows, but not a person's
// judgement that it shows no hospital at all.
export function shouldWithdraw(sheet, rejectedSlugs, notMaps) {
  if (!sheet.auto) return false
  if (notMaps.has(sheet.slug)) return true
  return rejectedSlugs.has(sheet.slug) && !sheet.keep
}
