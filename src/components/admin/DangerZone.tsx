"use client"

import { KeyRound, Trash2 } from "lucide-react"
import { deleteVenueAction, rotateVenueTokenAction } from "@/lib/admin/actions"
import type { AdminVenue } from "@/lib/admin/types"
import { ActionForm, SubmitButton } from "./forms"
import { BTN_DANGER, BTN_QUIET, INPUT, LABEL, formatNumber } from "./ui"

// The two actions that cannot be taken back, kept together and away from
// everything else so neither is ever a mis-click.
//
// Deleting asks for the venue's name to be typed, not because a confirm dialog
// is insufficient ceremony, but because typing the name is the only version of
// "are you sure" that requires the operator to look at *which* venue they are
// about to destroy. This row may be the only copy of a map somebody walked a
// hospital to build.

export default function DangerZone({ venue }: { venue: AdminVenue }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-wf-ink">
          <KeyRound size={15} className="text-wf-muted" aria-hidden />
          Reset ownership
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-wf-muted">
          This venue is owned by whichever device created it, through a secret edit token held in that browser. Rotating
          mints a new one: the old device can no longer add places or delete the venue, and the replacement is shown
          once, here, for you to hand on. Use it when a venue changes hands — or when its owner should no longer have it.
        </p>
        <ActionForm action={rotateVenueTokenAction} hidden={{ id: venue.id }} className="mt-3">
          <SubmitButton
            className={BTN_QUIET}
            pendingLabel="Rotating…"
            confirm="Rotate the edit token? The device that created this venue will immediately lose the ability to change it."
          >
            Rotate the edit token
          </SubmitButton>
        </ActionForm>
      </div>

      <div className="border-t border-[#F3C6C2] pt-6">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[#B3261E]">
          <Trash2 size={15} aria-hidden />
          Delete this venue
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-wf-muted">
          Removes the venue and all {formatNumber(venue.waypointCount)} place(s) inside it, permanently. If the venue is
          simply wrong or unwanted in the app, <span className="font-semibold">hide it</span> instead — that is
          reversible and keeps the work.
        </p>
        <ActionForm action={deleteVenueAction} hidden={{ id: venue.id }} className="mt-3 max-w-md">
          <label className={LABEL} htmlFor={`confirm-${venue.id}`}>
            Type <span className="font-semibold text-wf-ink">{venue.name}</span> to confirm
          </label>
          <input id={`confirm-${venue.id}`} name="confirm" className={INPUT} autoComplete="off" placeholder={venue.name} />
          <SubmitButton className={`${BTN_DANGER} mt-3`} pendingLabel="Deleting…">
            Delete permanently
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  )
}
