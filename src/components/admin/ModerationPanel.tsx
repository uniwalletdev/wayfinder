"use client"

import { BadgeCheck, ShieldOff } from "lucide-react"
import { setVenueStatusAction, setVenueVerifiedAction } from "@/lib/admin/actions"
import type { AdminVenue, VenueStatus } from "@/lib/admin/types"
import { ActionForm, SubmitButton } from "./forms"
import { STATUS_MEANING, statusBadge } from "./labels"
import { Badge, BTN_QUIET, INPUT, LABEL, formatDateTime } from "./ui"

// The listing decision, with somewhere to say why.
//
// The note is the point of this panel. A venue that disappears from the app with
// no explanation is indistinguishable from a bug — to the next operator, to the
// person who mapped it, and to whoever fields the complaint. Whatever is typed
// here is stored on the venue and copied into the audit entry, so the reason
// survives even if the venue is later deleted.

const CHOICES: VenueStatus[] = ["published", "pending", "suppressed"]

const CHOICE_LABEL: Record<VenueStatus, string> = {
  published: "List it",
  pending: "Hold for review",
  suppressed: "Hide it",
}

export default function ModerationPanel({ venue }: { venue: AdminVenue }) {
  const current = statusBadge(venue.status)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone={current.tone}>{current.label}</Badge>
        {venue.verified ? (
          <Badge tone="info">
            <BadgeCheck size={13} aria-hidden />
            Verified
          </Badge>
        ) : null}
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-wf-muted">{STATUS_MEANING[venue.status]}</p>

      {venue.reviewedAt ? (
        <p className="mt-2 text-[12px] text-wf-faint">
          Last reviewed {formatDateTime(venue.reviewedAt)}
          {venue.reviewedBy ? ` by ${venue.reviewedBy}` : ""}.
        </p>
      ) : null}
      {venue.reviewNote ? (
        <p className="mt-2.5 rounded-xl bg-wf-surface px-3.5 py-2.5 text-[12.5px] leading-relaxed text-wf-body">
          “{venue.reviewNote}”
        </p>
      ) : null}

      <ActionForm action={setVenueStatusAction} hidden={{ id: venue.id }} className="mt-5">
        <label className={LABEL} htmlFor={`note-${venue.id}`}>
          Reason <span className="font-normal text-wf-faint">— kept on the venue and in the audit log</span>
        </label>
        <input
          id={`note-${venue.id}`}
          name="note"
          defaultValue={venue.reviewNote ?? ""}
          maxLength={500}
          className={INPUT}
          placeholder="e.g. Confirmed with the trust's estates team"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {CHOICES.filter((c) => c !== venue.status).map((choice) => (
            <SubmitButton
              key={choice}
              name="status"
              value={choice}
              className={BTN_QUIET}
              pendingLabel="Saving…"
              confirm={
                choice === "suppressed"
                  ? "Hide this venue? Nobody using the app will be able to find it until it is listed again."
                  : undefined
              }
            >
              {CHOICE_LABEL[choice]}
            </SubmitButton>
          ))}
        </div>
      </ActionForm>

      <div className="mt-5 border-t border-wf-border-faint pt-5">
        <p className="text-[13px] font-semibold text-wf-ink">Verification</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-wf-muted">
          Mark a venue verified once you have confirmed with the organisation that owns the building that its map is
          theirs and is right. It is a claim to a patient that this is official.
        </p>
        <ActionForm
          action={setVenueVerifiedAction}
          hidden={{ id: venue.id, verified: venue.verified ? "false" : "true" }}
          className="mt-3"
        >
          <SubmitButton className={BTN_QUIET} pendingLabel="Saving…">
            {venue.verified ? (
              <>
                <ShieldOff size={15} aria-hidden />
                Remove verification
              </>
            ) : (
              <>
                <BadgeCheck size={15} aria-hidden />
                Mark as verified
              </>
            )}
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  )
}
