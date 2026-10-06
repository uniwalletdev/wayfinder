// What people tell the team: a report about a place someone published (from
// the app) or a message from the support page. Staff read it in the back
// office Inbox (/admin/inbox). Unlike the fire-and-forget telemetry routes, a
// message that was not stored must say so — someone is waiting for a reply —
// so a deployment without a database answers 503 and the form offers another
// way to get in touch.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { isDatabaseConfigured, query } from "@/lib/db"
import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"
import { sweepExpiredData } from "@/lib/retention"
import { FEEDBACK_MESSAGE_MAX, isEmail, isTopic, type FeedbackKind, type FeedbackSource } from "@/lib/feedback"

const SOURCES: FeedbackSource[] = ["web", "ios", "android"]

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "")

export async function POST(request: Request) {
  const limited = rateLimit(request, "feedback", LIMITS.feedback.limit, LIMITS.feedback.windowMs)
  if (limited) return limited

  const read = await readCappedJson<Record<string, unknown>>(request, BODY_LIMITS.feedback)
  if (!read.ok) return Response.json({ ok: false, error: read.reason }, { status: read.reason === "too_large" ? 413 : 400 })
  const b = read.body
  if (!b || typeof b !== "object" || Array.isArray(b)) return Response.json({ ok: false, error: "bad_request" }, { status: 400 })

  // A field no person can see, so only a script fills it in. Answer as if
  // the message went through, so the script learns nothing.
  if (text(b.website, 200)) return Response.json({ ok: true })

  const kind: FeedbackKind | null = b.kind === "report" || b.kind === "support" ? b.kind : null
  if (!kind || !isTopic(kind, b.topic)) return Response.json({ ok: false, error: "bad_request" }, { status: 400 })
  const message = text(b.message, FEEDBACK_MESSAGE_MAX)
  const email = text(b.email, 300)
  const venueId = text(b.venueId, 80)
  const venueName = text(b.venueName, 160)
  const source = SOURCES.includes(b.source as FeedbackSource) ? (b.source as FeedbackSource) : "web"
  // A support message is the message; a report is the place and the reason,
  // with anything more optional.
  if (kind === "support" && message.length < 5) return Response.json({ ok: false, error: "message_required" }, { status: 400 })
  if (kind === "report" && !venueId) return Response.json({ ok: false, error: "bad_request" }, { status: 400 })
  if (email && !isEmail(email)) return Response.json({ ok: false, error: "bad_email" }, { status: 400 })

  if (!isDatabaseConfigured()) return Response.json({ ok: false, error: "unavailable" }, { status: 503 })

  sweepExpiredData()
  try {
    await query(
      `insert into public.feedback (kind, topic, venue_id, venue_name, message, contact_email, source)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [kind, b.topic, venueId || null, venueName || null, message, email || null, source]
    )
  } catch (err) {
    console.warn("Could not store feedback:", err instanceof Error ? err.message : err)
    return Response.json({ ok: false, error: "store_failed" }, { status: 500 })
  }
  return Response.json({ ok: true })
}
