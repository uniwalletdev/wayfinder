// Checks the count bookkeeping the grounds fetch relies on (scripts/world/lib/
// overpass.mjs): splitting `out count;` elements from an answer, and refusing
// an answer from a server without area data — one that does not know
// Luxembourg's country area, asked in the same request — while taking a
// hospital with no area on a server that has area data as real.
//
// Run: node scripts/world/test/overpass-counts.test.mjs
import { AREA_PROBE, splitCounts, areaDataCheck } from "../lib/overpass.mjs"
import { group, check, throws, report } from "../../nhs/test/harness.mjs"

const count = (tags) => ({ type: "count", id: 0, tags })
const way = (id) => ({ type: "way", id, tags: { building: "yes", name: `Block ${id}` } })
const passes = (fn) => {
  try {
    fn()
    return true
  } catch {
    return false
  }
}

group("splitCounts")
{
  const { counts, elements } = splitCounts([count({ nodes: "0", ways: "12", relations: "1", areas: "0", total: "13" }), count({ areas: "13", total: "13" }), way(1), way(2)])
  check("two count elements come out as counts", counts.length === 2)
  check("their numbers are numbers", counts[0].ways === 12 && counts[0].total === 13 && counts[1].areas === 13)
  check("the real elements are left, in order", elements.length === 2 && elements[0].id === 1 && elements[1].id === 2)
  check("an answer with no counts gives none", splitCounts([way(3)]).counts.length === 0)
  check("a count without tags does not throw", splitCounts([{ type: "count", id: 0 }]).counts.length === 1)
}

group("the probe")
{
  check("asks for Luxembourg's country area and counts it", /area\["ISO3166-1"="LU"\]\["admin_level"="2"\]->\.probe;/.test(AREA_PROBE) && /\.probe out count;/.test(AREA_PROBE))
}

group("areaDataCheck")
{
  const knows = count({ areas: "1", total: "1" })
  const blank = count({ areas: "0", total: "0" })
  check("hospitals with areas pass", passes(() => areaDataCheck()([knows, count({ total: "13" }), count({ areas: "13" }), way(1)], "overpass-api.de")))
  check(
    "a hospital with no area passes on a server that has area data",
    passes(() => areaDataCheck()([knows, count({ total: "1" }), count({ areas: "0" })], "overpass-api.de"))
  )
  check("an empty cell passes on a server that has area data", passes(() => areaDataCheck()([knows, count({ total: "0" }), count({ areas: "0" })], "overpass-api.de")))
  throws("a server that does not know Luxembourg is refused", () => areaDataCheck()([blank, count({ total: "40" }), count({ areas: "0" })], "mirror.example"), /has no area data/)
  throws("even when it found no hospitals", () => areaDataCheck()([blank, count({ total: "0" }), count({ areas: "0" })], "mirror.example"), /has no area data/)
  check("a probe that reports only a total counts", passes(() => areaDataCheck()([count({ total: "1" }), count({ total: "2" }), count({ areas: "0" })], "overpass-api.de")))
  throws(
    "no hospitals where some are known is refused",
    () => areaDataCheck({ minHospitals: 1 })([knows, count({ total: "0" }), count({ areas: "0" })], "overpass-api.de"),
    /found 0 hospitals where at least 1 are known/
  )
  throws("an answer without the three counts is refused", () => areaDataCheck()([count({ total: "3" }), count({ areas: "3" }), way(1)], "mirror.example"), /carries no counts/)
  throws("the refusal names the server", () => areaDataCheck()([blank, count({ total: "4" }), count({ areas: "0" })], "overpass.private.coffee"), /^overpass\.private\.coffee /)
}

report()
