"use client"

import { useState } from "react"
import { Coordinates, Waypoint, WaypointType } from "@/lib/types"
import { X, Check, Loader2, Trash2, Crosshair } from "lucide-react"

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
  waypoint: Waypoint
  myPosition: Coordinates | null
  onClose: () => void
  onUpdated: (w: Waypoint) => void
  onDeleted: (id: string) => void
}

export default function EditLocationPanel({ venueId, waypoint, myPosition, onClose, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(waypoint.name)
  const [type, setType] = useState<WaypointType>(waypoint.type)
  const [coords, setCoords] = useState<Coordinates>(waypoint.coordinates)
  const [moved, setMoved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/venues/${venueId}/waypoints`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waypointId: waypoint.id,
          name: name.trim(),
          type,
          lat: coords.lat,
          lng: coords.lng,
        }),
      })
      const row = await res.json()
      if (res.ok) {
        onUpdated({
          ...waypoint,
          name: row.name,
          type: row.type,
          coordinates: { lat: Number(row.lat), lng: Number(row.lng) },
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/venues/${venueId}/waypoints?waypointId=${waypoint.id}`, { method: "DELETE" })
      if (res.ok) onDeleted(waypoint.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[250] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-2xl p-4 slide-up">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 text-base">Edit location</h3>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#005EB8] mb-3"
        />

        <div className="flex flex-wrap gap-2 mb-3">
          {TYPES.map((t) => (
            <button
              key={t.label}
              onClick={() => setType(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                type === t.key ? "bg-[#005EB8] text-white border-[#005EB8]" : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {myPosition && (
          <button
            onClick={() => { setCoords(myPosition); setMoved(true) }}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold mb-3 border ${
              moved ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-700 border-gray-200"
            }`}
          >
            <Crosshair size={16} />
            {moved ? "Moved to your current position ✓" : "Move pin to my current position"}
          </button>
        )}

        <div className="flex gap-2">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center gap-1.5 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-semibold"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center justify-center gap-1.5 bg-red-600 text-white rounded-xl px-4 py-3 text-sm font-semibold"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Confirm
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}
