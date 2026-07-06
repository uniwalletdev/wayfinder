"use client"

import { floorShortLabel } from "@/lib/waypoint-meta"
import type { FloorNaming } from "@/lib/types"

interface Props {
  floors: number[]
  currentFloor: number
  naming?: FloorNaming
  onChange: (floor: number) => void
}

// Pill stack listing the venue's floors. Positioning is owned by the right
// rail in MapControls — this component only renders the list, and scrolls
// within the space the rail gives it when a venue has more floors than fit,
// so it can never collide with the controls above or below it.
export default function FloorSelector({ floors, currentFloor, naming, onChange }: Props) {
  if (floors.length <= 1) return null

  return (
    <div className="pointer-events-auto flex min-h-0 flex-col gap-1 overflow-y-auto rounded-full bg-white/96 p-1.5 shadow-[0_8px_24px_rgba(11,27,46,0.16)]">
      {[...floors].sort((a, b) => b - a).map((floor) => (
        <button
          key={floor}
          onClick={() => onChange(floor)}
          className={`flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold transition-colors ${
            currentFloor === floor
              ? "bg-wf-primary text-white shadow-[0_4px_12px_rgba(10,93,194,0.4)]"
              : "text-wf-muted hover:bg-wf-surface"
          }`}
        >
          {floorShortLabel(floor, naming)}
        </button>
      ))}
    </div>
  )
}
