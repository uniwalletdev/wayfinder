// Checks the grounds fetch's bookkeeping (scripts/world/lib/grounds-cells.mjs):
// the order countries are taken in, the cells an area is cut into, and which
// of an area's cached cells a run may reuse.
//
// Run: node scripts/world/test/grounds-cells.test.mjs
import { cellKey, freshCells, gridCells, orderCountries, quarters } from "../lib/grounds-cells.mjs"
import { group, check, report } from "../../nhs/test/harness.mjs"

const sizes = { LU: 15, KE: 1033, DE: 2342, NG: 3697, US: 7376 }
const sizeOf = (c) => sizes[c]
const codes = Object.keys(sizes)

group("orderCountries")
{
  check("smallest first when none are asked for first", orderCountries(codes, sizeOf).join() === "LU,KE,DE,NG,US")
  check("a country asked for first comes first, the rest smallest-first", orderCountries(codes, sizeOf, ["NG"]).join() === "NG,LU,KE,DE,US")
  check("several come in the order given", orderCountries(codes, sizeOf, ["US", "NG"]).join() === "US,NG,LU,KE,DE")
  check("one not in the run is ignored", orderCountries(codes, sizeOf, ["GH", "NG"]).join() === "NG,LU,KE,DE,US")
  check("a repeat is taken once", orderCountries(codes, sizeOf, ["NG", "NG"]).join() === "NG,LU,KE,DE,US")
  check("equal sizes fall back to the code", orderCountries(["B", "A"], () => 1).join() === "A,B")
  const given = [...codes]
  orderCountries(given, sizeOf, ["US"])
  check("the input is left as it was", given.join() === codes.join())
}

group("cells")
{
  const cells = gridCells([0, 10, 3, 16], 3)
  check("a 3×3 grid has nine cells", cells.length === 9)
  check("the first is the south-west corner", cellKey(cells[0].bbox) === "0.00000,10.00000,1.00000,12.00000" && cells[0].i === 0 && cells[0].j === 0)
  check("the last is the north-east corner", cellKey(cells[8].bbox) === "2.00000,14.00000,3.00000,16.00000" && cells[8].i === 2 && cells[8].j === 2)
  check("the cells tile the box", cells.every(({ bbox: [s, w, n, e] }) => n - s === 1 && e - w === 2) && new Set(cells.map((c) => cellKey(c.bbox))).size === 9)
  const q = quarters([0, 10, 1, 12])
  check("a quarter split gives four", q.length === 4)
  check(
    "the quarters tile the cell",
    q.map(cellKey).join(" ") === "0.00000,10.00000,0.50000,11.00000 0.00000,11.00000,0.50000,12.00000 0.50000,10.00000,1.00000,11.00000 0.50000,11.00000,1.00000,12.00000"
  )
  check("the key is the same for the same bounds computed another way", cellKey([0.1 + 0.2, 1, 2, 3]) === cellKey([0.3, 1, 2, 3]))
  check("keys of neighbouring cells differ", cellKey(cells[0].bbox) !== cellKey(cells[1].bbox))
}

group("freshCells")
{
  const now = Date.now()
  const day = 86_400_000
  const at = (daysAgo) => new Date(now - daysAgo * day).toISOString()
  const file = {
    name: "KE-21",
    checked: 2,
    partial: true,
    fetchedAt: at(1),
    cells: {
      a: { fetchedAt: at(1), elements: [{ type: "way", id: 1 }] },
      b: { fetchedAt: at(9), elements: [] },
      c: { fetchedAt: at(2), elements: [] },
      d: { fetchedAt: at(0), elements: null },
    },
  }
  const fresh = freshCells(file, now - 7 * day, 2)
  check("fresh cells are kept, by key", Object.keys(fresh).sort().join() === "a,c")
  check("their elements come with them", fresh.a.elements.length === 1)
  check("a stale cell is dropped", !fresh.b)
  check("a cell without elements is dropped", !fresh.d)
  check("no file gives nothing", Object.keys(freshCells(null, 0, 2)).length === 0)
  check("a whole-area file gives no cells", Object.keys(freshCells({ checked: 2, fetchedAt: at(0), elements: [] }, 0, 2)).length === 0)
  check("a partial file from before the probe gives nothing", Object.keys(freshCells({ ...file, checked: 1 }, 0, 2)).length === 0)
  check("a partial file without cells gives nothing", Object.keys(freshCells({ checked: 2, partial: true, fetchedAt: at(0) }, 0, 2)).length === 0)
}

report()
