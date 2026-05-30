"use client"

import { TransportMode } from "@/lib/types"

interface Props {
  mode: TransportMode
  onChange: (mode: TransportMode) => void
}

const MODES: { id: TransportMode; label: string; icon: string }[] = [
  { id: "walking",    label: "Walk",    icon: "🚶" },
  { id: "driving",    label: "Drive",   icon: "🚗" },
  { id: "cycling",    label: "Cycle",   icon: "🚴" },
  { id: "wheelchair", label: "Access",  icon: "♿" },
  { id: "transit",    label: "Transit", icon: "🚌" },
]

export default function TransportModeSelector({ mode, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-1 py-1">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
            mode === m.id
              ? "bg-white text-[#005EB8] shadow"
              : "bg-white/20 text-white"
          }`}
        >
          <span>{m.icon}</span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  )
}
