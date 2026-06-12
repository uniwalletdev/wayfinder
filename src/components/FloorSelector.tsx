"use client"

import { floorShortLabel } from "@/lib/gosh-data"

interface Props {
  floors: number[]
  currentFloor: number
  onChange: (floor: number) => void
}

// Apple Maps' indoor "level picker": a single rounded pill of stacked floor
// numbers, with the active floor highlighted in system blue.
export default function FloorSelector({ floors, currentFloor, onChange }: Props) {
  if (floors.length <= 1) return null

  const sorted = [...floors].sort((a, b) => b - a)

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden">
      {sorted.map((floor, i) => (
        <button
          key={floor}
          onClick={() => onChange(floor)}
          className={`w-11 h-11 flex items-center justify-center text-sm font-bold transition-colors ${
            currentFloor === floor ? "bg-[#007AFF] text-white" : "text-gray-700 active:bg-gray-100"
          } ${i !== 0 ? "border-t border-gray-100" : ""}`}
        >
          {floorShortLabel(floor)}
        </button>
      ))}
    </div>
  )
}
