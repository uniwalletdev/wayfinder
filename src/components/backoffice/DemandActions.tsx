"use client"

import { useState } from "react"
import { reopenDemandAction, resolveDemandAction } from "@/lib/backoffice/actions"
import { ActionForm, SubmitButton } from "./forms"
import { RESOLUTIONS } from "./labels"

// Closing a search off the list, with the reason recorded.
//
// The four reasons are not bureaucracy — they are the difference between "we
// mapped it" and "there is nothing to map", and only the first says anything
// about the venue's coverage. Without them the queue empties and nobody can tell
// afterwards whether the map got better or the list just got shorter.

const MENU = "rounded-lg border border-wf-border bg-white px-2 py-1.5 text-[12px] text-wf-ink outline-none focus:border-wf-primary"

export function ResolveDemand({ venueKey, query }: { venueKey: string; query: string }) {
  const [resolution, setResolution] = useState(RESOLUTIONS[0].value)
  return (
    <ActionForm
      action={resolveDemandAction}
      hidden={{ venueKey, query, resolution }}
      className="flex items-center justify-end gap-2"
    >
      <select
        value={resolution}
        onChange={(e) => setResolution(e.target.value as typeof resolution)}
        aria-label={`How was “${query}” dealt with?`}
        className={MENU}
      >
        {RESOLUTIONS.map((r) => (
          <option key={r.value} value={r.value} title={r.description}>
            {r.label}
          </option>
        ))}
      </select>
      <SubmitButton
        className="rounded-lg border border-[#BCE7CB] bg-wf-green-tint px-2.5 py-1.5 text-[12px] font-semibold text-wf-green-text transition-colors hover:bg-[#DDF3E4] disabled:opacity-60"
        pendingLabel="…"
      >
        Close
      </SubmitButton>
    </ActionForm>
  )
}

export function ReopenDemand({ venueKey, query }: { venueKey: string; query: string }) {
  return (
    <ActionForm action={reopenDemandAction} hidden={{ venueKey, query }} className="flex justify-end">
      <SubmitButton className="text-[12.5px] font-semibold text-wf-primary hover:underline" pendingLabel="…">
        Reopen
      </SubmitButton>
    </ActionForm>
  )
}
