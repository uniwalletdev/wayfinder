import type { Venue } from "../types"
import {
  findHospitals,
  findPlace,
  listPlaces,
  PLACE_KINDS,
  type FindPlaceAnswer,
  type HospitalResult,
  type ListPlacesAnswer,
  type PlaceKind,
} from "./hospital-tools"

// Findway as an MCP server: the Findway app in ChatGPT's app directory, and any
// other MCP client (Claude's connectors, for one). Served by /api/mcp over
// MCP's Streamable HTTP transport, statelessly: every POST carries a JSON-RPC
// message (or a batch, as the 2025-03-26 revision allowed) and is answered with
// plain JSON. There are no sessions, no server-sent events and no sign-in: the
// tools only read the same public map data the website shows.
//
// Spec: https://modelcontextprotocol.io/specification

// Newest first. A client asking for one of these gets it; anything else gets
// the newest, and the client decides whether it can carry on.
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const

export const SERVER_INFO = { name: "findway", title: "Findway", version: "1.0.0" }

export const INSTRUCTIONS =
  "Findway maps UK (NHS) hospitals inside: where wards, clinics, departments, entrances and facilities are, " +
  "with links to step-by-step walking directions from the entrance. Use find_place for 'where is X at Y hospital', " +
  "find_hospital to identify a hospital or get directions to it, and list_places to see what a hospital's map holds. " +
  "Give the location and the directions link. Findway's maps come from the hospitals' published maps and do not cover " +
  "every hospital; suggest following the hospital's signs and asking staff on the day. Findway gives directions only, " +
  "never medical advice."

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const HOSPITAL_ARG = {
  type: "string",
  description: "The hospital's name, e.g. 'Great Ormond Street Hospital' or 'St George's Hospital, Tooting'. A town helps when names are shared.",
  minLength: 2,
  maxLength: 120,
}

export const TOOLS = [
  {
    name: "find_place",
    title: "Find a place in a hospital",
    description:
      "Find where a ward, clinic, department, entrance or facility (pharmacy, café, toilets, reception) is inside a UK hospital " +
      "that Findway has mapped. Returns where it is (building and floor, as the hospital's map records it) and a link that opens " +
      "step-by-step walking directions from the entrance. For questions like 'where is Kangaroo Ward at Great Ormond Street?'.",
    inputSchema: {
      type: "object",
      properties: {
        hospital: HOSPITAL_ARG,
        place: {
          type: "string",
          description: "The ward, clinic, department or facility, e.g. 'Kangaroo Ward', 'ENT', 'X-ray', 'pharmacy', 'main entrance'.",
          minLength: 2,
          maxLength: 120,
        },
      },
      required: ["hospital", "place"],
      additionalProperties: false,
    },
    annotations: { title: "Find a place in a hospital", ...READ_ONLY },
    _meta: { "openai/toolInvocation/invoking": "Looking at the hospital map", "openai/toolInvocation/invoked": "Found it on the map" },
  },
  {
    name: "find_hospital",
    title: "Find a hospital",
    description:
      "Look up UK hospitals by name, town or postcode. Returns each one's address, whether Findway has a map of its inside " +
      "(and what it shows), its Findway page, and links to directions to the hospital in Apple Maps or Google Maps.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A hospital name, town or postcode.", minLength: 2, maxLength: 120 },
        limit: { type: "integer", description: "How many hospitals to return, 1 to 10 (default 5).", minimum: 1, maximum: 10 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { title: "Find a hospital", ...READ_ONLY },
    _meta: { "openai/toolInvocation/invoking": "Looking up hospitals", "openai/toolInvocation/invoked": "Found hospitals" },
  },
  {
    name: "list_places",
    title: "List a hospital's places",
    description:
      "List what a mapped UK hospital's map holds: its entrances, wards, departments and clinics, facilities (reception, pharmacy, " +
      "food, toilets) and other places, each with where it is and a directions link. Optionally only one kind.",
    inputSchema: {
      type: "object",
      properties: {
        hospital: HOSPITAL_ARG,
        kind: { type: "string", enum: [...PLACE_KINDS], description: "Only this kind of place." },
      },
      required: ["hospital"],
      additionalProperties: false,
    },
    annotations: { title: "List a hospital's places", ...READ_ONLY },
    _meta: { "openai/toolInvocation/invoking": "Reading the hospital map", "openai/toolInvocation/invoked": "Read the hospital map" },
  },
] as const

// ---- answers as text ------------------------------------------------------

const q = (s: string) => `“${s}”`

function hospitalLine(h: HospitalResult): string {
  const where = h.address ? `, ${h.address}` : ""
  if (h.mapped) return `**${h.name}**${where}. Findway map${h.mapSummary ? `: ${h.mapSummary}` : ""}. ${h.pageUrl ?? h.openInFindwayUrl}`
  return `**${h.name}**${where}. No inside map yet; directions there: ${h.directionsThere.googleMaps}`
}

export function hospitalsText(query: string, results: HospitalResult[]): string {
  if (!results.length) return `No UK hospital in Findway matched ${q(query)}. Try the hospital's full name, or its town.`
  return results.map((h, i) => `${i + 1}. ${hospitalLine(h)}`).join("\n")
}

export function findPlaceText(hospitalQuery: string, placeQuery: string, a: FindPlaceAnswer): string {
  switch (a.status) {
    case "no_hospital":
      return `Findway has no UK hospital matching ${q(hospitalQuery)}. It covers NHS hospitals in the UK; try the full name or the town.`
    case "no_map": {
      const h = a.hospital
      return (
        `Findway knows where ${h.name} is${h.address ? ` (${h.address})` : ""} but has no map of its inside yet, so it cannot say where ` +
        `${q(placeQuery)} is. Directions to the hospital: Google Maps ${h.directionsThere.googleMaps} or Apple Maps ${h.directionsThere.appleMaps}. ` +
        `On arrival, the hospital's signs and reception can help.`
      )
    }
    case "no_match": {
      const h = a.hospital
      const did = a.suggestions.length ? ` Did you mean ${a.suggestions.map(q).join(", ")}?` : ""
      return `Findway's map of ${h.name} has nothing called ${q(placeQuery)}.${did} Everything on the map: ${h.pageUrl ?? h.openInFindwayUrl}`
    }
    case "found": {
      const [first, ...rest] = a.places
      const lines = [
        `**${first.name}** (${first.kind.toLowerCase()}) at ${a.hospital.name}${first.where ? `: ${first.where}` : ""}.`,
        `Step-by-step directions from the entrance: ${first.directionsUrl}`,
      ]
      if (rest.length) {
        lines.push("", "Other matches:")
        for (const p of rest) lines.push(`- ${p.name}${p.where ? `: ${p.where}` : ""}. ${p.directionsUrl}`)
      }
      return lines.join("\n")
    }
  }
}

export function listPlacesText(hospitalQuery: string, a: ListPlacesAnswer): string {
  if (a.status === "no_hospital") return findPlaceText(hospitalQuery, "", a)
  if (a.status === "no_map") {
    const h = a.hospital
    return `Findway knows where ${h.name} is${h.address ? ` (${h.address})` : ""} but has no map of its inside yet. Directions to the hospital: ${h.directionsThere.googleMaps}`
  }
  const lines = [`${a.hospital.name}${a.hospital.pageUrl ? ` (${a.hospital.pageUrl})` : ""}`]
  for (const g of a.groups) {
    lines.push("", `${g.title} (${g.total}):`)
    for (const p of g.places) lines.push(`- ${p.name}${p.where ? `: ${p.where}` : ""}`)
    if (g.total > g.places.length) lines.push(`- …and ${g.total - g.places.length} more on the hospital's page`)
  }
  if (!a.groups.length) lines.push("", "Nothing of that kind on this hospital's map.")
  return lines.join("\n")
}

// ---- JSON-RPC ---------------------------------------------------------------

type Id = string | number | null

export interface RpcError {
  code: number
  message: string
}
export type RpcResponse = { jsonrpc: "2.0"; id: Id; result: unknown } | { jsonrpc: "2.0"; id: Id; error: RpcError }

export const ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
} as const

export interface Context {
  venues: Venue[]
  base: URL
}

const ok = (id: Id, result: unknown): RpcResponse => ({ jsonrpc: "2.0", id, result })
const fail = (id: Id, code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } })

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

function text(t: string, structuredContent: unknown, isError = false) {
  return { content: [{ type: "text", text: t }], structuredContent, ...(isError ? { isError: true } : {}) }
}

// A tool's arguments, checked: a wrong argument comes back as a tool error the
// model can read and correct, not as a protocol failure.
function stringArg(args: Record<string, unknown>, key: string, required: boolean): string | undefined | Error {
  const v = args[key]
  if (v === undefined || v === null) return required ? new Error(`${key} is required`) : undefined
  if (typeof v !== "string" || v.trim().length < 2) return new Error(`${key} must be text of at least 2 characters`)
  return v.trim().slice(0, 120)
}

export function callTool(name: string, rawArgs: unknown, ctx: Context): { result: unknown } | { error: RpcError } {
  const args = isObject(rawArgs) ? rawArgs : {}
  const bad = (e: Error) => ({ result: text(`Invalid arguments: ${e.message}.`, { error: e.message }, true) })
  switch (name) {
    case "find_place": {
      const hospital = stringArg(args, "hospital", true)
      if (hospital instanceof Error) return bad(hospital)
      const place = stringArg(args, "place", true)
      if (place instanceof Error) return bad(place)
      const a = findPlace(ctx.venues, hospital!, place!, ctx.base)
      return { result: text(findPlaceText(hospital!, place!, a), a) }
    }
    case "find_hospital": {
      const query = stringArg(args, "query", true)
      if (query instanceof Error) return bad(query)
      let limit = 5
      if (args.limit !== undefined) {
        if (typeof args.limit !== "number" || !Number.isInteger(args.limit) || args.limit < 1 || args.limit > 10) {
          return bad(new Error("limit must be a whole number from 1 to 10"))
        }
        limit = args.limit
      }
      const hospitals = findHospitals(ctx.venues, query!, ctx.base, limit)
      return { result: text(hospitalsText(query!, hospitals), { hospitals }) }
    }
    case "list_places": {
      const hospital = stringArg(args, "hospital", true)
      if (hospital instanceof Error) return bad(hospital)
      const kind = args.kind
      if (kind !== undefined && !(PLACE_KINDS as readonly unknown[]).includes(kind)) {
        return bad(new Error(`kind must be one of ${PLACE_KINDS.join(", ")}`))
      }
      const a = listPlaces(ctx.venues, hospital!, ctx.base, kind as PlaceKind | undefined)
      return { result: text(listPlacesText(hospital!, a), a) }
    }
    default:
      return { error: { code: ERRORS.invalidParams, message: `Unknown tool: ${name}` } }
  }
}

// One JSON-RPC message in, its response out; null for a notification (or a
// client's response), which gets no reply.
export function handleMessage(msg: unknown, ctx: Context): RpcResponse | null {
  if (!isObject(msg) || msg.jsonrpc !== "2.0") return fail(null, ERRORS.invalidRequest, "Invalid request")
  const hasId = "id" in msg && (typeof msg.id === "string" || typeof msg.id === "number")
  const id: Id = hasId ? (msg.id as string | number) : null
  if (typeof msg.method !== "string") {
    // A response to something the server asked: it never asks, so ignore it.
    return "result" in msg || "error" in msg ? null : fail(id, ERRORS.invalidRequest, "Invalid request")
  }
  if (!hasId) return null
  const params = isObject(msg.params) ? msg.params : {}

  switch (msg.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : ""
      const protocolVersion = (PROTOCOL_VERSIONS as readonly string[]).includes(asked) ? asked : PROTOCOL_VERSIONS[0]
      return ok(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS })
    }
    case "ping":
      return ok(id, {})
    case "tools/list":
      return ok(id, { tools: TOOLS })
    case "tools/call": {
      if (typeof params.name !== "string") return fail(id, ERRORS.invalidParams, "params.name is required")
      const r = callTool(params.name, params.arguments, ctx)
      return "error" in r ? fail(id, r.error.code, r.error.message) : ok(id, r.result)
    }
    // Not offered, but answered empty rather than refused: some clients list
    // everything after connecting whatever the capabilities say.
    case "resources/list":
      return ok(id, { resources: [] })
    case "resources/templates/list":
      return ok(id, { resourceTemplates: [] })
    case "prompts/list":
      return ok(id, { prompts: [] })
    case "logging/setLevel":
      return ok(id, {})
    default:
      return fail(id, ERRORS.methodNotFound, `Method not found: ${msg.method}`)
  }
}

// A POST body: one message or a batch. null when nothing needs a reply.
export function handleBody(body: unknown, ctx: Context): RpcResponse | RpcResponse[] | null {
  if (Array.isArray(body)) {
    if (!body.length) return fail(null, ERRORS.invalidRequest, "Empty batch")
    const out = body.map((m) => handleMessage(m, ctx)).filter((r): r is RpcResponse => r !== null)
    return out.length ? out : null
  }
  return handleMessage(body, ctx)
}

export const parseError = (): RpcResponse => fail(null, ERRORS.parse, "Parse error")
