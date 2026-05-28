"use client"

import { useState } from "react"
import { Coordinates, Waypoint, WaypointType } from "@/lib/types"
import { X, Check, Loader2, MapPin, Crosshair } from "lucide-react"

const TYPES: { key: WaypointType; label: string; icon: string }[] = [
  { key: "reception", label: "Entrance", icon: "🚪" },
  { key: "ward", label: "Room", icon: "🚪" },
  { key: "department", label: "Area", icon: "🏢" },
  { key: "toilet", label: "Toilet", icon: "🚻" },
  { key: "lift", label: "Lift", icon: "🛗" },
  { key: "stairs", label: "Stairs", icon: "🪜" },
  { key: "canteen", label: "Food", icon: "🍽️" },
  { key: "exit", label: "Exit", icon: "🚪" },
  { key: "other", label: "Other", icon: "📍" },
]

interface Props {
  venueId: number
  currentFloor: number
  position: Coordinates | null
  accuracy: number
  usingTappedPoint: boolean
  onClose: () => void
  onAdded: (w: Waypoint) => void
}

export default function AddLocationPanel({
  venueId, currentFloor, position, accuracy, usingTappedPoint, onClose, onAdded,
}: Props) {
  const [name, setName] = useState("")
  const [type, setType] = useState<WaypointType>("reception")
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim() || !position) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/venues/${venueId}/waypoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floor: currentFloor,
          name: name.trim(),
          type,
          lat: position.lat,
          lng: position.lng,
        }),
      })
      if (!res.ok) throw new Error("save failed")
      const row = await res.json()
      onAdded({
        id: String(row.id),
        name: row.name,
        type: row.type,
        floor: Number(row.floor),
        coordinates: { lat: Number(row.lat), lng: Number(row.lng) },
        description: row.description ?? undefined,
      })
      setSavedCount((c) => c + 1)
      setName("")
    } catch {
      setError("Couldn't save — check connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[250] flex flex-col justify-end pointer-events-none">
      {/* dim only the bottom area so map stays visible for tapping */}
      <div className="pointer-events-auto bg-white rounded-t-2xl shadow-2xl p-4 slide-up">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 text-base">Add a location</h3>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Position source */}
        <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2.5 mb-3">
          {usingTappedPoint ? <MapPin size={16} className="text-[#005EB8]" /> : <Crosshair size={16} className="text-[#005EB8]" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#005EB8]">
              {usingTappedPoint ? "Using the point you tapped" : "Using your GPS position"}
            </p>
            <p className="text-[11px] text-gray-500">
              Floor {currentFloor === 0 ? "G" : currentFloor}
              {position ? ` • ±${Math.round(accuracy)}m • ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : " • waiting for location…"}
            </p>
          </div>
        </div>

        {!usingTappedPoint && (
          <p className="text-[11px] text-gray-400 mb-3 -mt-1">
            Tip: stand where the location is, or tap the exact spot on the map.
          </p>
        )}

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Name (e.g. Kitchen, Front Door, Toilets)"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#005EB8] mb-3"
        />

        <div className="flex flex-wrap gap-2 mb-4">
          {TYPES.map((t) => (
            <button
              key={t.label}
              onClick={() => setType(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                type === t.key
                  ? "bg-[#005EB8] text-white border-[#005EB8]"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!name.trim() || !position || saving}
          className="w-full flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Save location
        </button>

        <p className="text-center text-xs text-gray-400 mt-2 mb-1">
          {savedCount > 0
            ? `✓ ${savedCount} added — walk to the next spot and add more`
            : "Add as many as you like, then close"}
        </p>
      </div>
    </div>
  )
}
