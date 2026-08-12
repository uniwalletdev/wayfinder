"use client"

import { eraseDeviceAction, purgeMissesAction, purgeSignalsAction } from "@/lib/backoffice/actions"
import { ActionForm, SubmitButton } from "./forms"
import { BTN_DANGER, INPUT, LABEL } from "./ui"

// Deleting pooled data on purpose.
//
// Both forms below destroy rows with no undo, which is the point — a retention
// promise you cannot execute is not a promise. What makes them safe enough to
// put on a page is that they are specific: a cut-off in days, or a single device
// identifier, both stated before the confirm dialog quotes them back.

export function PurgeForm({
  kind,
  defaultDays,
  affected,
}: {
  kind: "signals" | "searches"
  defaultDays: number
  affected: number
}) {
  const action = kind === "signals" ? purgeSignalsAction : purgeMissesAction
  const noun = kind === "signals" ? "trail" : "recorded search"

  return (
    <ActionForm action={action}>
      <label className={LABEL} htmlFor={`days-${kind}`}>
        Delete {noun}s older than
      </label>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <input
            id={`days-${kind}`}
            name="days"
            type="number"
            min={7}
            max={3650}
            step={1}
            defaultValue={defaultDays}
            required
            className={`${INPUT} w-28`}
          />
          <span className="text-[13px] text-wf-muted">days</span>
        </div>
        <SubmitButton
          className={BTN_DANGER}
          pendingLabel="Deleting…"
          confirm={`Permanently delete every ${noun} older than the number of days shown? This cannot be undone.`}
        >
          Delete them
        </SubmitButton>
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-wf-faint">
        {affected > 0
          ? `About ${affected.toLocaleString("en-GB")} ${noun}(s) are currently older than ${defaultDays} days.`
          : `Nothing is currently older than ${defaultDays} days.`}
      </p>
    </ActionForm>
  )
}

export function EraseDeviceForm({ deviceId }: { deviceId: string }) {
  return (
    <ActionForm action={eraseDeviceAction} hidden={{ deviceId }}>
      <SubmitButton
        className={BTN_DANGER}
        pendingLabel="Erasing…"
        confirm="Permanently delete every trail held for this device identifier? This cannot be undone."
      >
        Erase everything held for this device
      </SubmitButton>
    </ActionForm>
  )
}
