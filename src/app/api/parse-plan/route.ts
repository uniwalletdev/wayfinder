import Anthropic from "@anthropic-ai/sdk"
import { WaypointType } from "@/lib/types"
import { ALL_WAYPOINT_TYPES } from "@/lib/waypoint-meta"

// A mapper can upload an existing floor plan (photo, scan, exported diagram)
// instead of walking it with Survey Mode. We read the flattened image with
// Claude's vision model to find labelled rooms and trace the corridors
// connecting them, in coordinates normalised to the image — the client then
// georeferences those onto the real map once the mapper positions the plan.

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

const MAX_ROOMS = 60
const MAX_CORRIDORS = 20

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  return { mediaType: match[1], base64: match[2] }
}

const clamp01 = (n: unknown): number => (typeof n === "number" && isFinite(n) ? Math.max(0, Math.min(1, n)) : 0)

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Not an error from the user's perspective — the feature just isn't wired up.
    return Response.json(
      { rooms: [], corridors: [], error: "not_configured", message: "AI plan-reading is not configured on the server." },
      { status: 200 }
    )
  }

  let body: { imageData?: string; venueName?: string; floor?: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ rooms: [], corridors: [], error: "bad_request" }, { status: 400 })
  }

  const parsed = typeof body.imageData === "string" ? parseDataUrl(body.imageData) : null
  if (!parsed) {
    return Response.json({ rooms: [], corridors: [], error: "bad_image" }, { status: 400 })
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
    },
    required: ["rooms", "corridors"],
  }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 3000,
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
                `This is an uploaded floor plan / map diagram for floor ${floor} of ${venueName}. ` +
                "Identify every distinct, clearly labelled room or space — e.g. a named ward, department, lift, staircase, " +
                "toilets, pharmacy, café/restaurant, reception, or an entrance/exit — and classify each into the closest type. " +
                "Only include a room if you can actually read its name or an unambiguous label/icon on the plan; do not guess " +
                "or invent names, and do not include walls, furniture or generic corridors as rooms. " +
                "For each room, give the normalised position of its label or centre as x, y, where (0,0) is the top-left corner " +
                "of the image and (1,1) is the bottom-right corner (x increases rightward, y increases downward). " +
                "Also trace the walkable corridor/hallway centreline(s) actually drawn on the plan as one or more polylines " +
                "connecting the rooms — each an ordered list of normalised {x,y} points running along the middle of a hallway — " +
                "so a connected walking path can be drawn between rooms instead of a straight line through walls. Skip this if " +
                "no corridors are clearly drawn.",
            },
          ],
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ rooms: [], corridors: [] }, { status: 200 })
    }

    const data = JSON.parse(textBlock.text) as { rooms?: DetectedRoom[]; corridors?: DetectedCorridor[] }

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

    return Response.json({ rooms, corridors }, { status: 200 })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return Response.json({ rooms: [], corridors: [], error: "api_error", message: err.message }, { status: 200 })
    }
    return Response.json({ rooms: [], corridors: [], error: "unknown" }, { status: 200 })
  }
}
