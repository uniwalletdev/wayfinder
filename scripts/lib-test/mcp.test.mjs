// Checks Findway's MCP server (src/lib/mcp/), the Findway app in ChatGPT: that
// it speaks the protocol a client expects, finds the right hospital and place
// from how people actually type them, and says so plainly when Findway has no
// map, rather than guessing.
//
// Run: node scripts/lib-test/mcp.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const T = await import(fileURLToPath(new URL("mcp/hospital-tools.ts", SRC)))
const S = await import(fileURLToPath(new URL("mcp/server.ts", SRC)))
const { SEED_VENUES } = await import(fileURLToPath(new URL("venues/index.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

const BASE = new URL("https://findway.ai")
const ctx = { venues: SEED_VENUES, base: BASE }
const rpc = (method, params, id = 1) => S.handleMessage({ jsonrpc: "2.0", id, method, params }, ctx)
const call = (name, args) => rpc("tools/call", { name, arguments: args }).result

group("the protocol")
{
  const init = rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } })
  check("initialize agrees the client's version", init.result.protocolVersion === "2025-06-18")
  check("an unknown version gets the newest", rpc("initialize", { protocolVersion: "1999-01-01" }).result.protocolVersion === S.PROTOCOL_VERSIONS[0])
  check("it offers tools, and says who it is", init.result.capabilities.tools && init.result.serverInfo.name === "findway" && init.result.instructions.includes("never medical advice"))
  check("a notification gets no reply", S.handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx) === null)
  check("ping", JSON.stringify(rpc("ping").result) === "{}")
  const tools = rpc("tools/list").result.tools
  check("three tools", tools.map((t) => t.name).join() === "find_place,find_hospital,list_places")
  check("every tool is marked read-only and has a schema", tools.every((t) => t.annotations.readOnlyHint === true && t.annotations.destructiveHint === false && t.inputSchema.type === "object"))
  check("no description advertises", tools.every((t) => !/best|#1|leading|amazing/i.test(t.description)))
  check("an unknown method is refused", rpc("tools/delete").error.code === S.ERRORS.methodNotFound)
  check("an unknown tool is refused", rpc("tools/call", { name: "nope", arguments: {} }).error.code === S.ERRORS.invalidParams)
  check("a message that is not JSON-RPC 2.0 is refused", S.handleMessage({ id: 1, method: "ping" }, ctx).error.code === S.ERRORS.invalidRequest)
  check("a batch gets a batch back, notifications left out", (() => {
    const r = S.handleBody([{ jsonrpc: "2.0", id: 1, method: "ping" }, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "tools/list" }], ctx)
    return Array.isArray(r) && r.length === 2 && r[0].id === 1 && r[1].id === 2
  })())
  check("a batch of notifications needs no reply", S.handleBody([{ jsonrpc: "2.0", method: "notifications/initialized" }], ctx) === null)
  check("empty lists for what is not offered", rpc("resources/list").result.resources.length === 0 && rpc("prompts/list").result.prompts.length === 0)
  check("a parse error has the right code", S.parseError().error.code === -32700)
}

group("bad arguments come back as tool errors the model can correct")
{
  const r = call("find_place", { hospital: "Great Ormond Street" })
  check("a missing place", r.isError === true && r.content[0].text.includes("place is required"))
  check("a too-short hospital", call("find_place", { hospital: "x", place: "ward" }).isError === true)
  check("a bad limit", call("find_hospital", { query: "london", limit: 50 }).isError === true)
  check("a bad kind", call("list_places", { hospital: "Great Ormond Street", kind: "lifts" }).isError === true)
}

group("finding the hospital")
{
  const h = T.findHospitals(SEED_VENUES, "great ormond street", BASE)
  check("by name, the mapped one first", h[0].name === "Great Ormond Street Hospital" && h[0].mapped)
  check("with its page and address", h[0].pageUrl === "https://findway.ai/hospitals/great-ormond-street-hospital" && h[0].address === "London WC1N 3JH")
  check("and directions there", h[0].directionsThere.googleMaps.startsWith("https://www.google.com/maps/dir/?api=1&destination=Great%20Ormond%20Street"))
  check("without the apostrophe", T.resolveHospital(SEED_VENUES, "St Georges Hospital Tooting").id === "st-georges")
  check("by its short name", T.resolveHospital(SEED_VENUES, "gosh").id === "gosh")
  check("by its Findway page address", T.resolveHospital(SEED_VENUES, "https://findway.ai/hospitals/medway-maritime-hospital").name === "Medway Maritime Hospital")
  check("a placeholder drawing is passed over for the real map", T.resolveHospital(SEED_VENUES, "Addenbrooke's Hospital").illustrative !== true)
  check("a leading 'The' does not push a hospital down", T.findHospitals(SEED_VENUES, "royal london", BASE)[0].name === "The Royal London Hospital")
  check("letters merely in order are not a hospital", T.resolveHospital(SEED_VENUES, "Mars General Hospital") === null)
  check("a misspelt name close enough still is", T.resolveHospital(SEED_VENUES, "Great Ormand Street Hospital")?.id === "gosh")
  const none = T.findHospitals(SEED_VENUES, "zzqqxx hospital nowhere", BASE)
  check("nonsense finds nothing mapped", none.every((x) => !x.mapped))
  check("the limit holds", T.findHospitals(SEED_VENUES, "hospital", BASE, 3).length === 3)
}

group("finding a place")
{
  const a = T.findPlace(SEED_VENUES, "Great Ormond Street Hospital", "Kangaroo Ward", BASE)
  check("found", a.status === "found" && a.places[0].name === "Kangaroo Ward")
  check("with where it is", a.places[0].where === "Premier Inn Clinical Building, Level 2")
  check("and a directions link", a.places[0].directionsUrl === "https://findway.ai/navigate?venue=gosh&to=kangaroo-ward")
  const text = call("find_place", { hospital: "Great Ormond Street Hospital", place: "Kangaroo Ward" }).content[0].text
  check("the answer reads plainly", text.startsWith("**Kangaroo Ward** (ward) at Great Ormond Street Hospital: Premier Inn Clinical Building, Level 2.") && text.includes("https://findway.ai/navigate?venue=gosh&to=kangaroo-ward"))
  check("by a facility's kind", T.findPlace(SEED_VENUES, "Great Ormond Street", "pharmacy", BASE).places?.[0].name === "Pharmacy")
  const ae = T.findPlace(SEED_VENUES, "St Georges", "A&E", BASE)
  check("A&E is the Emergency Department", ae.status === "found" && /Emergency Department/.test(ae.places[0].name))
  check("and nothing that merely has the letters", ae.places.every((p) => !/Neuro Theatres|Marks & Spencer/.test(p.name)))
  check("a blood test is phlebotomy or blood testing", /Blood|Phlebotomy/i.test(T.findPlace(SEED_VENUES, "St Georges", "blood test", BASE).places?.[0].name ?? ""))
  check("a café by any name", T.findPlace(SEED_VENUES, "Great Ormond Street", "coffee", BASE).places?.[0].name === "The Lagoon")
  const typo = T.findPlace(SEED_VENUES, "Great Ormond Street", "Kangeroo Wrd", BASE)
  check("a typo is suggested, not guessed", typo.status === "no_match" && typo.suggestions.includes("Kangaroo Ward"))
  check("no match says where to see everything", call("find_place", { hospital: "Great Ormond Street", place: "Kangeroo Wrd" }).content[0].text.includes("https://findway.ai/hospitals/great-ormond-street-hospital"))
  const pin = SEED_VENUES.find((v) => v.visibility === "public" && v.category === "hospital" && v.waypoints.length === 0 && v.floorPlans.length === 0)
  const nm = T.findPlace(SEED_VENUES, pin.name, "x-ray", BASE)
  check("a hospital with no inside map says so, with directions there", nm.status === "no_map" && call("find_place", { hospital: pin.name, place: "x-ray" }).content[0].text.includes("has no map of its inside yet"))
  check("no hospital at all says so", T.findPlace(SEED_VENUES, "qq", "ward", BASE).status !== "found")
  check("results are capped", T.findPlace(SEED_VENUES, "St George's Hospital, Tooting", "ward", BASE).places.length <= 5)
}

group("listing a hospital's places")
{
  const a = T.listPlaces(SEED_VENUES, "Great Ormond Street", BASE, "wards")
  check("only the kind asked for", a.status === "listed" && a.groups.length === 1 && a.groups[0].kind === "wards")
  check("every ward, with directions", a.groups[0].total === 29 && a.groups[0].places.every((p) => p.directionsUrl.startsWith("https://findway.ai/navigate?venue=gosh&to=")))
  const all = T.listPlaces(SEED_VENUES, "St George's Hospital, Tooting", BASE, undefined, 10)
  check("long lists are cut and say how many in all", all.groups.some((g) => g.total > 10 && g.places.length === 10) && call("list_places", { hospital: "St George's Hospital, Tooting" }).content[0].text.includes("more on the hospital's page"))
  check("lifts and stairs are not listed", all.groups.every((g) => g.places.every((p) => p.kind !== "Lift" && p.kind !== "Stairs")))
}

report()
