// The grounds fetch's bookkeeping that needs no network (scripts/world/
// fetch-campus.mjs): the order countries are taken in, and the cells an area
// is pieced together from when the server cannot answer for it whole. Cells
// are keyed by their bounds and kept between runs, so a run carries on with
// the cells still missing rather than asking for the whole area again.

// Countries named in `first` come first, in that order; the rest smallest
// list first, so that under a time limit the many quick ones finish and the
// United States gets what is left.
export function orderCountries(codes, sizeOf, first = []) {
  const head = [...new Set(first)].filter((c) => codes.includes(c))
  const rest = codes.filter((c) => !head.includes(c)).sort((a, b) => sizeOf(a) - sizeOf(b) || a.localeCompare(b))
  return [...head, ...rest]
}

// A cell's key: its bounds to five decimals (a metre), the same from run to
// run as long as the area's bounds are.
export const cellKey = (bbox) => bbox.map((x) => x.toFixed(5)).join(",")

// The grid×grid cells over an area's bounding box, row by row.
export function gridCells([s, w, n, e], grid) {
  const cells = []
  for (let i = 0; i < grid; i++)
    for (let j = 0; j < grid; j++)
      cells.push({ i, j, bbox: [s + ((n - s) * i) / grid, w + ((e - w) * j) / grid, s + ((n - s) * (i + 1)) / grid, w + ((e - w) * (j + 1)) / grid] })
  return cells
}

// A cell split in four.
export function quarters([s, w, n, e]) {
  const ms = (s + n) / 2
  const me = (w + e) / 2
  return [
    [s, w, ms, me],
    [s, me, ms, e],
    [ms, w, n, me],
    [ms, me, n, e],
  ]
}

// The cells of an area's file worth keeping: from a partial file written
// with the area-data probe (`checked`), each fetched since `freshSince`.
// Anything else — no file, a whole-area file, one from before the probe, a
// stale cell — gives nothing to reuse.
export function freshCells(file, freshSince, checked) {
  if (!file?.partial || file.checked !== checked) return {}
  return Object.fromEntries(Object.entries(file.cells ?? {}).filter(([, c]) => Array.isArray(c?.elements) && Date.parse(c.fetchedAt) >= freshSince))
}
