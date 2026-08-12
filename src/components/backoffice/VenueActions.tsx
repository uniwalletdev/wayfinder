"use client"

import { setVenueStatusAction } from "@/lib/backoffice/actions"
import type { VenueStatus } from "@/lib/backoffice/types"
import { ActionForm, SubmitButton } from "./forms"

// The one-click moderation decision, as it appears on a row in the queue.
//
// It is the same Server Action the venue's own page calls, with the same audit
// entry — the shortcut changes how many clicks a decision takes, never what a
// decision means or what gets recorded about it. Hiding a venue asks for
// confirmation first: it removes a map from everyone using the app, including
// the person who walked a hospital to build it.

const STYLES: Record<VenueStatus, { label: string; className: string; confirm?: string }> = {
  published: {
    label: "List it",
    className:
      "rounded-lg border border-[#BCE7CB] bg-wf-green-tint px-2.5 py-1.5 text-[12px] font-semibold text-wf-green-text transition-colors hover:bg-[#DDF3E4] disabled:opacity-60",
  },
  pending: {
    label: "Hold",
    className:
      "rounded-lg border border-[#F5DDAE] bg-[#FFF6E3] px-2.5 py-1.5 text-[12px] font-semibold text-[#8A5A00] transition-colors hover:bg-[#FDEFD3] disabled:opacity-60",
  },
  suppressed: {
    label: "Hide",
    className:
      "rounded-lg border border-[#F3C6C2] bg-[#FDEDEC] px-2.5 py-1.5 text-[12px] font-semibold text-[#B3261E] transition-colors hover:bg-[#FBE0DE] disabled:opacity-60",
    confirm: "Hide this venue? Nobody using the app will be able to find it until it is listed again.",
  },
}

export function QuickStatusButton({
  venueId,
  to,
  label,
}: {
  venueId: string
  to: VenueStatus
  label?: string
}) {
  const style = STYLES[to]
  return (
    <ActionForm action={setVenueStatusAction} hidden={{ id: venueId, status: to }} className="inline-block">
      <SubmitButton className={style.className} confirm={style.confirm} pendingLabel="…">
        {label ?? style.label}
      </SubmitButton>
    </ActionForm>
  )
}
