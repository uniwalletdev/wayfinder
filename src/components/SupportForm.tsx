"use client"

import { useState } from "react"
import { Send, Check, Loader2 } from "lucide-react"
import { SUPPORT_TOPICS, FEEDBACK_MESSAGE_MAX, isEmail } from "@/lib/feedback"
import { sendFeedback, feedbackErrorText } from "@/lib/send-feedback"

// The support page's contact form. Messages go to the back office Inbox
// (/api/feedback); an email address is optional, and the only way the team
// can write back. It sits inside the page's .wf-prose, which styles every <p>,
// so the form's own text uses divs and spans.

const field =
  "w-full rounded-xl border border-wf-border bg-white px-4 py-3 text-[15px] text-wf-ink outline-none placeholder:text-wf-muted focus:border-wf-primary"

export default function SupportForm({ email: supportEmail }: { email?: string }) {
  const [topic, setTopic] = useState<string>(SUPPORT_TOPICS[0].value)
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const emailBad = email.trim() !== "" && !isEmail(email.trim())
  const tooShort = message.trim().length < 5

  async function submit() {
    if (tooShort || emailBad || sending) return
    setSending(true)
    setError(null)
    const result = await sendFeedback({ kind: "support", topic, message: message.trim(), email: email.trim() || undefined, website })
    setSending(false)
    if (result.ok) {
      setSent(true)
      return
    }
    const text = feedbackErrorText(result.error)
    setError(supportEmail && (result.error === "unavailable" || result.error === "failed") ? `${text} You can email ${supportEmail} instead.` : text)
  }

  if (sent) {
    return (
      <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl border border-wf-border bg-wf-surface px-4 py-4">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-wf-green-tint text-wf-green-text">
          <Check size={18} aria-hidden="true" />
        </span>
        <div>
          <div className="font-semibold text-wf-ink">Message sent. Thank you.</div>
          <div className="mt-1 text-[14px] leading-relaxed text-wf-muted">
            {email.trim() ? `We’ll reply to ${email.trim()}.` : "You didn’t leave an email, so we can’t reply, but we read every message."}
          </div>
          <button
            type="button"
            onClick={() => {
              setSent(false)
              setMessage("")
            }}
            className="mt-2 text-[14px] font-semibold text-wf-primary"
          >
            Send another message
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      className="mt-4 flex flex-col gap-4 rounded-2xl border border-wf-border bg-white p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-[14px] font-semibold text-wf-ink">What is it about?</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
          {SUPPORT_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-semibold text-wf-ink">Your message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={FEEDBACK_MESSAGE_MAX}
          rows={6}
          required
          placeholder="Which hospital or page, what you were trying to do, and what happened"
          className={`${field} resize-y`}
        />
        <span className="mt-1 block text-right text-[12px] text-wf-faint">
          {message.length} / {FEEDBACK_MESSAGE_MAX}
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-semibold text-wf-ink">Your email (optional)</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="So we can reply"
          aria-invalid={emailBad}
          className={field}
        />
        {emailBad && <span className="mt-1 block text-[13px] text-red-600">That email address doesn’t look right.</span>}
        <span className="mt-1 block text-[12.5px] leading-snug text-wf-muted">
          Used only to answer you, and deleted with the message. Please don’t include medical details.
        </span>
      </label>

      {/* Hidden from people; a script that fills every field fills this. */}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[14px] text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={tooShort || emailBad || sending}
        className="flex items-center justify-center gap-2 self-start rounded-full bg-wf-primary px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)] disabled:opacity-50 disabled:shadow-none"
      >
        {sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
        Send message
      </button>
    </form>
  )
}
