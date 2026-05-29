"use client"

interface Props {
  floors: number[]
  currentFloor: number
  onChange: (floor: number) => void
}

export default function FloorSelector({ floors, currentFloor, onChange }: Props) {
  if (floors.length <= 1) return null

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5">
      {[...floors].sort((a, b) => b - a).map((floor) => (
        <button
          key={floor}
          onClick={() => onChange(floor)}
          className={`w-10 h-10 rounded-xl text-xs font-bold shadow-md transition-all duration-200 ${
            currentFloor === floor
              ? "bg-[#005EB8] text-white scale-110 shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {floor === 0 ? "G" : floor}
        </button>
      ))}
    </div>
  )
}
