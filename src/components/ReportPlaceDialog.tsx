"use client"

import { useState } from "react"
import Link from "next/link"
import { Flag, Check, Loader2, EyeOff } from "lucide-react"
import Overlay from "@/components/Overlay"
import { REPORT_REASONS, FEEDBACK_MESSAGE_MAX, isEmail } from "@/lib/feedback"
import { sendFeedback, feedbackErrorText } from "@/lib/send-feedback"

// Report a place someone else published: why, optionally more detail and an
// email for a reply. It goes to the back office Inbox, where staff remove a
// place that breaks the rules and can block whoever published it. Hiding the
// place from this person's own list happens at once, whatever the team decides.

const inputClass =
  "w-full rounded-xl border border-wf-border bg-white px-4 py-3 text-sm text-wf-ink outline-none placeholder:text-wf-muted focus:border-wf-primary"

export default function ReportPlaceDialog({
  place,
  onHide,
  onClose,
}: {
  place: { id: string; name: string }
  onHide: (id: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState<string>("")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [hide, setHide] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const emailBad = email.trim() !== "" && !isEmail(email.trim())

  async function submit() {
    if (!reason || emailBad || sending) return
    setSending(true)
    setError(null)
    // Hiding is this person's own choice, so it does not wait on the report.
    if (hide) onHide(place.id)
    const result = await sendFeedback({
      kind: "report",
      topic: reason,
      message: message.trim(),
      email: email.trim() || undefined,
      venueId: place.id,
      venueName: place.name,
      website,
    })
    setSending(false)
    if (result.ok) setSent(true)
    else setError(feedbackErrorText(result.error))
  }

  if (sent) {
    return (
      <Overlay title="Report sent" onClose={onClose}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-safe-bar text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-wf-green-tint text-wf-green-text">
            <Check size={26} aria-hidden="true" />
          </span>
          <p className="font-display text-lg font-semibold text-wf-ink">Thank you</p>
          <p className="max-w-sm text-sm leading-relaxed text-wf-muted">
            The Findway team will look at “{place.name}” within a day and remove it if it breaks the rules.
            {hide && " It is hidden from your places list already."}
          </p>
          <button onClick={onClose} className="mt-3 rounded-xl bg-wf-primary px-6 py-3 text-sm font-semibold text-white">
            Done
          </button>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay title="Report this place" onClose={onClose} dismissLabel="Close report">
      <form
        className="flex-1 overflow-y-auto px-4 py-4 pb-safe-bar lg:px-6"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-wf-surface px-3.5 py-3">
            <Flag size={16} className="mt-0.5 flex-shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-[13px] leading-snug text-wf-body">
              <span className="font-semibold text-wf-ink">{place.name}</span> was published by someone using Findway. Tell us what is wrong and
              the team will review it within a day.{" "}
              <Link href="/support#place-rules" className="font-semibold text-wf-primary underline-offset-2 hover:underline">
                Rules for shared places
              </Link>
            </p>
          </div>

          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-semibold text-wf-ink">What’s wrong with it?</legend>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm ${
                    reason === r.value ? "border-wf-primary bg-[#F2F8FF] text-wf-ink" : "border-wf-border text-wf-body"
                  }`}
                >
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="h-4 w-4 accent-wf-primary" />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-wf-ink">Anything else we should know? (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={FEEDBACK_MESSAGE_MAX}
              rows={4}
              placeholder="What you saw, and where"
              className={`${inputClass} resize-y`}
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-wf-ink">Your email (optional)</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Only if you’d like to hear back"
              aria-invalid={emailBad}
              className={inputClass}
            />
            {emailBad && <span className="mt-1 block text-xs text-red-600">That email address doesn’t look right.</span>}
          </label>

          {/* Hidden from people; a script that fills every field fills this. */}
          <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

          <label className="mb-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-wf-border bg-wf-surface px-3 py-3">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="mt-0.5 h-4 w-4 accent-wf-primary" />
            <span className="text-[13px] leading-snug text-wf-body">
              <EyeOff size={13} className="mb-0.5 mr-1 inline text-wf-primary" aria-hidden="true" />
              Hide this place from my places list
            </span>
          </label>

          {error && (
            <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!reason || emailBad || sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-wf-primary py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)] disabled:opacity-50 disabled:shadow-none"
          >
            {sending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Flag size={18} aria-hidden="true" />}
            Send report
          </button>
          {!reason && <p className="mt-2 text-center text-xs text-wf-muted">Choose what’s wrong to send the report.</p>}
        </div>
      </form>
    </Overlay>
  )
}
