"use client"

import { useEffect } from "react"
import { ArrowDown, ArrowUp, Check, X } from "lucide-react"
import { floorLabel } from "@/lib/waypoint-meta"
import type { FloorNaming } from "@/lib/types"

// What the app says when the accelerometer thinks the walker has changed floor.
//
// Guessing the floor silently is the wrong default even when the guess is
// usually right. The floor decides which plan is drawn, which waypoints are
// listed and where the route goes, so a wrong one leaves someone standing in a
// corridor that does not match their screen with no idea why — and no obvious
// way back. So the prompt always shows what happened and always offers the way
// out, in one of two shapes depending on how sure the detector is:
//
//   applied — confident (or the route said so): the floor has already changed,
//             and this is a notification with an Undo.
//   ask     — plausible but unproven, which is most stair climbs: nothing has
//             changed yet, and the walker decides.
//
// Either way it sits at the top of the map, clear of the right-hand rail and
// the bottom sheet, and never blocks the map itself.

export type FloorChangePromptState =
  | {
      kind: "applied"
      floor: number
      previousFloor: number
      via: "lift" | "stairs"
      direction: "up" | "down"
    }
  | {
      kind: "ask"
      floor: number
      via: "lift" | "stairs"
      direction: "up" | "down"
    }

// A notification that has been read is clutter, and one nobody reacts to was
// probably right. Questions stay until answered.
const AUTO_DISMISS_MS = 9000

export default function FloorChangePrompt({
  state,
  floorNaming,
  onConfirm,
  onUndo,
  onDismiss,
}: {
  state: FloorChangePromptState
  floorNaming?: FloorNaming
  onConfirm: () => void
  onUndo: () => void
  onDismiss: () => void
}) {
  const applied = state.kind === "applied"

  // Keyed on `state` itself, not on its kind: a second floor change arriving
  // while the first notice is still up must start its own countdown, not
  // inherit whatever was left of the previous one.
  useEffect(() => {
    if (state.kind !== "applied") return
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [state, onDismiss])

  const Arrow = state.direction === "up" ? ArrowUp : ArrowDown
  const label = floorLabel(state.floor, floorNaming)
  const how = state.via === "stairs" ? "stairs" : "lift"

  return (
    <div
      // Polite, not assertive: this interrupts nothing, and a walker following
      // spoken guidance should hear it after the instruction they are acting on.
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute left-1/2 top-4 z-40 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 rounded-[16px] border border-wf-border bg-white/97 px-4 py-3 shadow-[0_10px_30px_rgba(11,27,46,0.18)] backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#E7F2FF] text-wf-primary">
          <Arrow size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-wf-ink">
            {applied ? `Now on ${label}` : `Did you go ${state.direction} to ${label}?`}
          </p>
          <p className="truncate text-[12px] text-wf-muted">
            {applied ? `Detected via the ${how}` : `It looks like you took the ${how}`}
          </p>
        </div>

        {applied ? (
          <button
            onClick={onUndo}
            className="flex-shrink-0 rounded-full border border-wf-border px-3 py-1.5 text-[12.5px] font-semibold text-wf-ink"
          >
            Undo
          </button>
        ) : (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={onDismiss}
              aria-label="No, I did not change floor"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-wf-border text-wf-muted"
            >
              <X size={15} />
            </button>
            <button
              onClick={onConfirm}
              aria-label={`Yes, I am on ${label}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-wf-primary text-white"
            >
              <Check size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
