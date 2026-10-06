import { Capacitor } from "@capacitor/core"
import { apiUrl } from "./app-shell"
import type { FeedbackKind, FeedbackSource } from "./feedback"

// Posts a report or support message to /api/feedback, from the website or the
// apps alike, and says plainly whether it arrived: someone is waiting on it.

export interface FeedbackInput {
  kind: FeedbackKind
  topic: string
  message: string
  email?: string
  venueId?: string
  venueName?: string
  // The form's hidden field; only a script fills it in.
  website?: string
}

export type FeedbackResult = { ok: true } | { ok: false; error: "unavailable" | "rate_limited" | "bad_email" | "message_required" | "failed" | "offline" }

function source(): FeedbackSource {
  const p = Capacitor.getPlatform()
  return p === "ios" || p === "android" ? p : "web"
}

export async function sendFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  let res: Response
  try {
    res = await fetch(apiUrl("/api/feedback"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, source: source() }),
    })
  } catch {
    return { ok: false, error: "offline" }
  }
  if (res.status === 429) return { ok: false, error: "rate_limited" }
  let data: { ok?: boolean; error?: string } = {}
  try {
    data = await res.json()
  } catch {}
  if (res.ok && data.ok) return { ok: true }
  if (data.error === "unavailable" || data.error === "bad_email" || data.error === "message_required") return { ok: false, error: data.error }
  return { ok: false, error: "failed" }
}

export function feedbackErrorText(error: Exclude<FeedbackResult, { ok: true }>["error"]): string {
  switch (error) {
    case "offline":
      return "You seem to be offline. Check your connection and try again."
    case "rate_limited":
      return "That’s a lot of messages in a short time. Please try again in an hour."
    case "bad_email":
      return "That email address doesn’t look right."
    case "message_required":
      return "Please say a little about what you need."
    case "unavailable":
      return "Messages can’t be received on this copy of Findway right now."
    default:
      return "Something went wrong sending it. Please try again."
  }
}
