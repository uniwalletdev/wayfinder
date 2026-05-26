"use client"

import { FLOOR_PLANS } from "@/lib/gosh-data"

interface Props {
  currentFloor: number
  onChange: (floor: number) => void
}

export default function FloorSelector({ currentFloor, onChange }: Props) {
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5">
      {[...FLOOR_PLANS].reverse().map((fp) => (
        <button
          key={fp.id}
          onClick={() => onChange(fp.floor)}
          className={`w-10 h-10 rounded-xl text-xs font-bold shadow-md transition-all duration-200 ${
            currentFloor === fp.floor
              ? "bg-[#005EB8] text-white scale-110 shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {fp.label === "Ground" ? "G" : fp.floor}
        </button>
      ))}
    </div>
  )
}
