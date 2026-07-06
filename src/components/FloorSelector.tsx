"use client"

import { floorShortLabel } from "@/lib/waypoint-meta"

interface Props {
  floors: number[]
  currentFloor: number
  onChange: (floor: number) => void
}

export default function FloorSelector({ floors, currentFloor, onChange }: Props) {
  if (floors.length <= 1) return null

  return (
    <div className="absolute right-5 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-1 rounded-full bg-white/96 p-1.5 shadow-[0_8px_24px_rgba(11,27,46,0.16)]">
      {[...floors].sort((a, b) => b - a).map((floor) => (
        <button
          key={floor}
          onClick={() => onChange(floor)}
          className={`flex h-[38px] w-[38px] items-center justify-center rounded-full font-display text-[13px] font-bold transition-colors ${
            currentFloor === floor
              ? "bg-wf-primary text-white shadow-[0_4px_12px_rgba(10,93,194,0.4)]"
              : "text-wf-muted hover:bg-wf-surface"
          }`}
        >
          {floorShortLabel(floor)}
        </button>
      ))}
    </div>
  )
}
