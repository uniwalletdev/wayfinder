import Anthropic from "@anthropic-ai/sdk"
import { WaypointType } from "@/lib/types"
import { ALL_WAYPOINT_TYPES } from "@/lib/waypoint-meta"
import { rateLimit, LIMITS } from "@/lib/rate-limit"

// A mapper can upload an existing floor plan (photo, scan, exported diagram)
// instead of walking it with Survey Mode. We read the flattened image with
// Claude's vision model to find labelled rooms and trace the corridors
// connecting them, in coordinates normalised to the image — the client then
// georeferences those onto the real map once the mapper positions the plan.
//
// Beyond simple labelled plans, this also understands hospital-trust style
// "site map sheets": a designed map (often with colour-coded zones) plus a
// Floor/Zone directory table listing every ward and department — including
// ones that are NOT drawn on the map itself, only listed. For those sheets the
// response carries a `sheet` block: where the map artwork is on the page, the
// zone colour palette, and the full directory (name, floor, zone). The client
// crops the artwork, samples the zone footprints, and places every directory
// entry on its zone at the right floor — turning one uploaded sheet into a
// complete multi-floor venue.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface DetectedRoom {
  name: string
  type: WaypointType
  x: number
  y: number
}

interface DetectedCorridor {
  points: { x: number; y: number }[]
}

interface DetectedZone {
  name: string
  color: string
}

interface DetectedDirectoryEntry {
  name: string
  type: WaypointType
  floor: number
  zone: string
  section: string
}

interface DetectedSheet {
  isSheet: boolean
  mapRegion: { x0: number; y0: number; x1: number; y1: number }
  zones: DetectedZone[]
  directory: DetectedDirectoryEntry[]
}

const MAX_ROOMS = 60
const MAX_CORRIDORS = 20
const MAX_DIRECTORY = 200
const MAX_ZONES = 10

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  return { mediaType: match[1], base64: match[2] }
}

const clamp01 = (n: unknown): number => (typeof n === "number" && isFinite(n) ? Math.max(0, Math.min(1, n)) : 0)

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

// An uploaded plan is a base64 data URL, and the cost of reading it scales with
// its size. 8 MB is comfortably above a phone photo of a wall-mounted plan and
// well below anything that could be used to inflate a single call's cost.
const MAX_BODY_BYTES = 8 * 1024 * 1024

export async function POST(request: Request) {
  // Rate limit BEFORE the key check and before reading the body: the whole point
  // is to spend as little as possible on an abusive caller.
  const limited = rateLimit(request, "parse-plan", LIMITS.parsePlan.limit, LIMITS.parsePlan.windowMs)
  if (limited) return limited

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Not an error from the user's perspective — the feature just isn't wired up.
    return Response.json(
      { rooms: [], corridors: [], sheet: null, error: "not_configured", message: "AI plan-reading is not configured on the server." },
      { status: 200 }
    )
  }

  let body: { imageData?: string; venueName?: string; floor?: number }
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) {
      return Response.json(
        { rooms: [], corridors: [], sheet: null, error: "too_large", message: "That plan image is too large. Try a smaller photo." },
        { status: 413 }
      )
    }
    body = JSON.parse(text)
  } catch {
    return Response.json({ rooms: [], corridors: [], sheet: null, error: "bad_request" }, { status: 400 })
  }

  const parsed = typeof body.imageData === "string" ? parseDataUrl(body.imageData) : null
  if (!parsed) {
    return Response.json({ rooms: [], corridors: [], sheet: null, error: "bad_image" }, { status: 400 })
  }

  const venueName = typeof body.venueName === "string" && body.venueName.trim() ? body.venueName.trim() : "a building"
  const floor = typeof body.floor === "number" && isFinite(body.floor) ? body.floor : 0

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      rooms: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            type: { type: "string", enum: ALL_WAYPOINT_TYPES },
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["name", "type", "x", "y"],
        },
      },
      corridors: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            points: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: { x: { type: "number" }, y: { type: "number" } },
                required: ["x", "y"],
              },
            },
          },
          required: ["points"],
        },
      },
      sheet: {
        type: "object",
        additionalProperties: false,
        properties: {
          isSheet: { type: "boolean" },
          mapRegion: {
            type: "object",
            additionalProperties: false,
            properties: {
              x0: { type: "number" },
              y0: { type: "number" },
              x1: { type: "number" },
              y1: { type: "number" },
            },
            required: ["x0", "y0", "x1", "y1"],
          },
          zones: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                color: { type: "string" },
              },
              required: ["name", "color"],
            },
          },
          directory: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                type: { type: "string", enum: ALL_WAYPOINT_TYPES },
                floor: { type: "integer" },
                zone: { type: "string" },
                section: { type: "string" },
              },
              required: ["name", "type", "floor", "zone", "section"],
            },
          },
        },
        required: ["isSheet", "mapRegion", "zones", "directory"],
      },
    },
    required: ["rooms", "corridors", "sheet"],
  }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: parsed.mediaType as "image/jpeg", data: parsed.base64 } },
            {
              type: "text",
              text:
                `This is an uploaded floor plan / map sheet for ${venueName} (default floor if unstated: ${floor}). ` +
                "All coordinates you output are normalised to the FULL image: (0,0) is the top-left corner and (1,1) the " +
                "bottom-right (x increases rightward, y increases downward).\n\n" +
                "1) rooms: identify every distinct, clearly labelled room or space drawn ON THE MAP ARTWORK itself — e.g. a " +
                "named ward, department, lift, staircase, toilets, pharmacy, café/restaurant, reception, or an entrance/exit — " +
                "and classify each into the closest type. Only include a room if you can actually read its name or an " +
                "unambiguous label/icon on the drawing; do not guess or invent names, and do not include walls, furniture or " +
                "generic corridors as rooms. Give each room the normalised position of its label or centre. Do NOT include " +
                "entries that appear only in a directory/index table — those go in sheet.directory instead.\n\n" +
                "2) corridors: trace the walkable corridor/hallway centreline(s) actually drawn on the plan as one or more " +
                "polylines connecting the rooms — each an ordered list of normalised {x,y} points running along the middle of " +
                "a hallway. Skip if no corridors are clearly drawn.\n\n" +
                "3) sheet: many hospital/campus map sheets pair the map artwork with a directory table (often titled " +
                "'Outpatients', 'Wards', 'Services' with Floor and Zone columns, where each row has a colour swatch matching a " +
                "colour-coded zone on the map). If this image is such a sheet, set sheet.isSheet=true and fill in:\n" +
                "- sheet.mapRegion: the bounding box of the MAP ARTWORK ONLY (normalised x0,y0,x1,y1), excluding the page " +
                "title, directory tables and any footer — but including the map's own key/legend if it sits inside the " +
                "artwork area.\n" +
                "- sheet.zones: each colour zone used on the map, as a simple colour name (e.g. 'Red', 'Green', 'Purple') and " +
                "its approximate hex colour as seen in the map's building fills (e.g. '#ec1e26').\n" +
                "- sheet.directory: EVERY row of every directory/index table, with its exact name as printed, the closest " +
                "waypoint type, its floor as an integer (Ground/G = 0, First/1 = 1, Basement = -1, and so on), its zone " +
                "colour name matching sheet.zones (or '' if the row has no zone swatch), and the section heading it appears " +
                "under (e.g. 'Outpatients', 'Wards', 'Services'). Read carefully — do not skip rows, do not invent rows.\n" +
                "If the image is NOT such a sheet (a plain floor plan, a photo, a drawing without a directory table), set " +
                "sheet.isSheet=false, sheet.mapRegion to the full image (0,0,1,1) and leave sheet.zones and sheet.directory " +
                "empty.",
            },
          ],
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ rooms: [], corridors: [], sheet: null }, { status: 200 })
    }

    const data = JSON.parse(textBlock.text) as {
      rooms?: DetectedRoom[]
      corridors?: DetectedCorridor[]
      sheet?: DetectedSheet
    }

    const rooms = (Array.isArray(data.rooms) ? data.rooms : [])
      .filter((r) => typeof r.name === "string" && r.name.trim())
      .slice(0, MAX_ROOMS)
      .map((r) => ({
        name: r.name.trim(),
        type: (ALL_WAYPOINT_TYPES.includes(r.type) ? r.type : "other") as WaypointType,
        x: clamp01(r.x),
        y: clamp01(r.y),
      }))

    const corridors = (Array.isArray(data.corridors) ? data.corridors : [])
      .slice(0, MAX_CORRIDORS)
      .map((c) =>
        Array.isArray(c.points)
          ? c.points
              .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
              .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }))
          : []
      )
      .filter((points) => points.length >= 2)

    // The sheet block only survives when it's coherent: flagged as a sheet,
    // with a sane map region and at least one directory row to place.
    let sheet: DetectedSheet | null = null
    const rawSheet = data.sheet
    if (rawSheet && rawSheet.isSheet && rawSheet.mapRegion && Array.isArray(rawSheet.directory) && rawSheet.directory.length > 0) {
      const x0 = clamp01(rawSheet.mapRegion.x0)
      const y0 = clamp01(rawSheet.mapRegion.y0)
      const x1 = clamp01(rawSheet.mapRegion.x1)
      const y1 = clamp01(rawSheet.mapRegion.y1)
      if (x1 - x0 > 0.1 && y1 - y0 > 0.1) {
        const zones = (Array.isArray(rawSheet.zones) ? rawSheet.zones : [])
          .filter((z) => typeof z.name === "string" && z.name.trim() && HEX_COLOR.test(z.color ?? ""))
          .slice(0, MAX_ZONES)
          .map((z) => ({ name: z.name.trim(), color: z.color.toLowerCase() }))
        const zoneNames = new Set(zones.map((z) => z.name))
        const directory = rawSheet.directory
          .filter((d) => typeof d.name === "string" && d.name.trim())
          .slice(0, MAX_DIRECTORY)
          .map((d) => ({
            name: d.name.trim(),
            type: (ALL_WAYPOINT_TYPES.includes(d.type) ? d.type : "other") as WaypointType,
            floor: typeof d.floor === "number" && isFinite(d.floor) ? Math.max(-5, Math.min(30, Math.round(d.floor))) : 0,
            zone: typeof d.zone === "string" && zoneNames.has(d.zone.trim()) ? d.zone.trim() : "",
            section: typeof d.section === "string" ? d.section.trim() : "",
          }))
        if (directory.length > 0) {
          sheet = { isSheet: true, mapRegion: { x0, y0, x1, y1 }, zones, directory }
        }
      }
    }

    return Response.json({ rooms, corridors, sheet }, { status: 200 })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return Response.json({ rooms: [], corridors: [], sheet: null, error: "api_error", message: err.message }, { status: 200 })
    }
    return Response.json({ rooms: [], corridors: [], sheet: null, error: "unknown" }, { status: 200 })
  }
}
