import Anthropic from "@anthropic-ai/sdk"
import { WaypointType } from "@/lib/types"

// Survey Mode posts the frames it captured here. We run them through Claude's
// vision model to read on-camera signage (ward names, "Lift", "Toilets", door
// plates, etc.) and turn each detected place into a proposed waypoint. The
// client confirms/persists them — we never write to storage server-side.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const WAYPOINT_TYPES: WaypointType[] = [
  "ward", "department", "lift", "stairs", "toilet",
  "exit", "reception", "canteen", "pharmacy", "other",
]

// Cap how many frames we send to bound latency/cost. Sample evenly across the walk.
const MAX_FRAMES = 8

interface IncomingFrame {
  imageData: string // data URL: data:image/jpeg;base64,....
  coordinates: { lat: number; lng: number }
  floor: number
}

interface DetectedLocation {
  name: string
  type: WaypointType
  frameIndex: number
  // Floor read from a visible indicator in the frame (lift display, level sign,
  // stairwell marker). null when no floor is legible — we then fall back to the
  // floor the surveyor set on the in-camera stepper for that frame.
  floor: number | null
  // Which side of the walking direction the place's door/sign sits on, as seen
  // from the camera. Lets navigation say "on your right". null when unclear.
  side: "left" | "right" | "ahead" | null
  // A short, recognisable visual cue at the spot ("blue double doors",
  // "yellow reception desk") so a walker can confirm they've found it. null when
  // there's nothing distinctive to call out.
  landmark: string | null
}

function sampleEvenly<T>(items: T[], max: number): { item: T; originalIndex: number }[] {
  if (items.length <= max) return items.map((item, i) => ({ item, originalIndex: i }))
  const step = items.length / max
  const out: { item: T; originalIndex: number }[] = []
  for (let i = 0; i < max; i++) {
    const idx = Math.floor(i * step)
    out.push({ item: items[idx], originalIndex: idx })
  }
  return out
}

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  return { mediaType: match[1], base64: match[2] }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Not an error from the user's perspective — the feature just isn't wired up.
    return Response.json(
      { waypoints: [], error: "not_configured", message: "AI mapping is not configured on the server." },
      { status: 200 }
    )
  }

  let body: { frames?: IncomingFrame[]; venueName?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ waypoints: [], error: "bad_request" }, { status: 400 })
  }

  const frames = Array.isArray(body.frames) ? body.frames : []
  // Grounds the model in the place being surveyed. Generic fallback so the route
  // works for any venue, not just the one the app shipped with.
  const venueName = typeof body.venueName === "string" && body.venueName.trim() ? body.venueName.trim() : "a building"
  if (frames.length === 0) {
    return Response.json({ waypoints: [] }, { status: 200 })
  }

  const sampled = sampleEvenly(frames, MAX_FRAMES)

  // Build the multimodal user turn: each image, labelled with its frame index.
  const content: Anthropic.ContentBlockParam[] = []
  sampled.forEach(({ item, originalIndex }) => {
    const parsed = parseDataUrl(item.imageData)
    if (!parsed) return
    content.push({
      type: "image",
      source: { type: "base64", media_type: parsed.mediaType as "image/jpeg", data: parsed.base64 },
    })
    content.push({
      type: "text",
      text: `Frame ${originalIndex} (floor ${item.floor}).`,
    })
  })

  if (content.length === 0) {
    return Response.json({ waypoints: [] }, { status: 200 })
  }

  content.push({
    type: "text",
    text:
      `These frames were captured while walking through ${venueName} with a phone camera. ` +
      "Identify distinct, navigable places that are clearly indicated by on-camera signage or door plates — " +
      "e.g. a named ward, a department, a lift, a staircase, toilets, a pharmacy, a café/restaurant, a reception, " +
      "or an entrance/exit. Only include a location if you can actually read its name or an unambiguous label in a frame. " +
      "Do not guess, do not invent names, and do not include generic corridors or people. " +
      "For each location, return the frame index it is most clearly visible in. " +
      "Also set `floor` ONLY if the floor is legible from something in that frame — a lift floor display, a stairwell or " +
      "corridor level sign, or signage that states the level (e.g. 'Level 2', '2nd floor'). Map the ground floor to 0, " +
      "'Level N'/'Floor N' to N, and a basement to a negative number. If no floor indicator is readable in the frame, set `floor` to null — do not guess it. " +
      "Set `side` to whether the place's door or sign is on the left, right, or straight ahead from the camera's point of view as it walks past; " +
      "use null if it isn't clear. " +
      "Set `landmark` to a short, concrete visual cue someone could use to recognise the spot (e.g. 'blue double doors', 'yellow reception desk', 'large red sign'); " +
      "keep it under about 6 words, and use null if there's nothing distinctive.",
  })

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      locations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            type: { type: "string", enum: WAYPOINT_TYPES },
            frameIndex: { type: "integer" },
            floor: { anyOf: [{ type: "integer" }, { type: "null" }] },
            side: { anyOf: [{ type: "string", enum: ["left", "right", "ahead"] }, { type: "null" }] },
            landmark: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
          required: ["name", "type", "frameIndex", "floor", "side", "landmark"],
        },
      },
    },
    required: ["locations"],
  }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content }],
    })

    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ waypoints: [] }, { status: 200 })
    }

    const parsed = JSON.parse(textBlock.text) as { locations?: DetectedLocation[] }
    const locations = Array.isArray(parsed.locations) ? parsed.locations : []

    // Map each detection back to the coordinates/floor of the frame it came from.
    const waypoints = locations
      .filter((loc) => loc.name?.trim() && frames[loc.frameIndex])
      .map((loc, i) => {
        const frame = frames[loc.frameIndex]
        const type: WaypointType = WAYPOINT_TYPES.includes(loc.type) ? loc.type : "other"
        // Prefer a floor read from a sign in the footage; otherwise use the floor
        // the surveyor set on the stepper for that frame.
        const floor = typeof loc.floor === "number" ? loc.floor : frame.floor
        // Surface the extra cues read from the footage as the waypoint's
        // description, so they show up in search, the route preview and the
        // navigating sheet — helping the walker confirm they've arrived.
        const cues: string[] = []
        if (loc.side === "left" || loc.side === "right") cues.push(`On your ${loc.side}`)
        if (typeof loc.landmark === "string" && loc.landmark.trim()) cues.push(`Look for ${loc.landmark.trim()}`)
        const description = cues.length > 0 ? cues.join(" · ") : "Detected by Survey Mode"
        return {
          id: `survey-ai-${Date.now()}-${i}`,
          name: loc.name.trim(),
          type,
          coordinates: frame.coordinates,
          floor,
          description,
        }
      })

    return Response.json({ waypoints }, { status: 200 })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return Response.json(
        { waypoints: [], error: "api_error", message: err.message },
        { status: 200 }
      )
    }
    return Response.json({ waypoints: [], error: "unknown" }, { status: 200 })
  }
}
