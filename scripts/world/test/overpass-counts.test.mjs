// Checks the count bookkeeping the grounds fetch relies on (scripts/world/lib/
// overpass.mjs): splitting `out count;` elements from an answer, and refusing
// an answer that an Overpass mirror without area data would give — hospitals
// found but no areas made of them, or no hospitals where some are known.
//
// Run: node scripts/world/test/overpass-counts.test.mjs
import { splitCounts, areaDataCheck } from "../lib/overpass.mjs"
import { group, check, throws, report } from "../../nhs/test/harness.mjs"

const count = (tags) => ({ type: "count", id: 0, tags })
const way = (id) => ({ type: "way", id, tags: { building: "yes", name: `Block ${id}` } })

group("splitCounts")
{
  const { counts, elements } = splitCounts([count({ nodes: "0", ways: "12", relations: "1", areas: "0", total: "13" }), count({ areas: "13", total: "13" }), way(1), way(2)])
  check("two count elements come out as counts", counts.length === 2)
  check("their numbers are numbers", counts[0].ways === 12 && counts[0].total === 13 && counts[1].areas === 13)
  check("the real elements are left, in order", elements.length === 2 && elements[0].id === 1 && elements[1].id === 2)
  check("an answer with no counts gives none", splitCounts([way(3)]).counts.length === 0)
  check("a count without tags does not throw", splitCounts([{ type: "count", id: 0 }]).counts.length === 1)
}

group("areaDataCheck")
{
  const healthy = [count({ total: "13" }), count({ areas: "13" }), way(1)]
  const noAreas = [count({ total: "13" }), count({ areas: "0" })]
  const emptyCell = [count({ total: "0" }), count({ areas: "0" })]
  const noHospitals = [count({ total: "0" }), count({ areas: "0" })]
  let ok = true
  try {
    areaDataCheck()(healthy, "overpass-api.de")
    areaDataCheck({ minHospitals: 1 })(healthy, "overpass-api.de")
  } catch {
    ok = false
  }
  check("hospitals with areas pass, with and without a known minimum", ok)
  throws("hospitals but no areas is refused", () => areaDataCheck()(noAreas, "mirror.example"), /no area data: 13 hospitals, 0 areas/)
  let emptyOk = true
  try {
    areaDataCheck()(emptyCell, "overpass-api.de")
  } catch {
    emptyOk = false
  }
  check("an empty cell passes when nothing is known to be there", emptyOk)
  throws("no hospitals where some are known is refused", () => areaDataCheck({ minHospitals: 1 })(noHospitals, "mirror.example"), /found 0 hospitals where at least 1 are known/)
  throws("an answer without counts is refused", () => areaDataCheck()([way(1)], "mirror.example"), /carries no counts/)
  throws("the refusal names the instance", () => areaDataCheck()(noAreas, "overpass.private.coffee"), /^overpass\.private\.coffee /)
}

report()
