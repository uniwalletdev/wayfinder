"use client"

import { useState, useEffect } from "react"
import { Coordinates } from "@/lib/types"
import { MapPin, Plus, Building2, ChevronRight, Loader2, X, Minus } from "lucide-react"

export interface VenueInfo {
  id: number
  name: string
  address?: string
  city?: string
  center_lat?: number
  center_lng?: number
  floors?: number
  venue_type?: string
  waypoint_count: number
  distance_m?: number
}

interface Props {
  userPosition: Coordinates
  onSelectVenue: (venue: VenueInfo) => void
  onClose?: () => void
}

const VENUE_TYPES = [
  { key: "home", label: "Home", icon: "🏠" },
  { key: "hospital", label: "Hospital", icon: "🏥" },
  { key: "shop", label: "Shop", icon: "🛒" },
  { key: "office", label: "Office", icon: "🏢" },
  { key: "airport", label: "Airport", icon: "✈️" },
  { key: "mall", label: "Mall", icon: "🛍️" },
  { key: "school", label: "School", icon: "🏫" },
  { key: "other", label: "Other", icon: "📍" },
]

export default function VenueSelector({ userPosition, onSelectVenue, onClose }: Props) {
  const [nearby, setNearby] = useState<VenueInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("home")
  const [newFloors, setNewFloors] = useState(1)

  useEffect(() => {
    fetch(`/api/venues/nearby?lat=${userPosition.lat}&lng=${userPosition.lng}&radius=1000`)
      .then((r) => r.json())
      .then((data) => {
        setNearby(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userPosition.lat, userPosition.lng])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    try {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          venue_type: newType,
          floors: newFloors,
          lat: userPosition.lat,
          lng: userPosition.lng,
        }),
      })
      const venue = await res.json()
      if (venue?.id) {
        onSelectVenue({ ...venue, waypoint_count: 0, distance_m: 0 })
      }
    } finally {
      setSaving(false)
    }
  }

  function formatDistance(m?: number) {
    if (m == null) return ""
    if (m < 1000) return `${Math.round(m)}m away`
    return `${(m / 1000).toFixed(1)}km away`
  }

  // ---- Creation screen ----
  if (creating) {
    return (
      <div className="fixed inset-0 z-[300] bg-white flex flex-col">
        <div className="bg-[#005EB8] px-4 pt-12 pb-5 flex items-center gap-3">
          <button onClick={() => setCreating(false)} className="text-white">
            <X size={22} />
          </button>
          <div>
            <h1 className="text-white font-bold text-lg">Map a new place</h1>
            <p className="text-blue-200 text-sm">Pinned at your current location</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Name of this place
          </label>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. My House, Tesco Finchley"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#005EB8] mb-6"
          />

          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            What kind of place?
          </label>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {VENUE_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setNewType(t.key)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all ${
                  newType === t.key
                    ? "bg-blue-50 border-[#005EB8] text-[#005EB8]"
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            How many floors?
          </label>
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => setNewFloors((f) => Math.max(1, f - 1))}
              className="w-12 h-12 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 active:bg-gray-100"
            >
              <Minus size={20} />
            </button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-gray-900">{newFloors}</span>
              <span className="text-sm text-gray-500 ml-1">floor{newFloors > 1 ? "s" : ""}</span>
            </div>
            <button
              onClick={() => setNewFloors((f) => Math.min(50, f + 1))}
              className="w-12 h-12 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 active:bg-gray-100"
            >
              <Plus size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Ground floor + {newFloors - 1} above. You can add locations on each floor afterwards.
          </p>
        </div>

        <div className="px-4 pb-8 pt-3 border-t border-gray-100">
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || saving}
            className="w-full flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Create &amp; start mapping
          </button>
        </div>
      </div>
    )
  }

  // ---- Selection screen ----
  return (
    <div className="fixed inset-0 z-[300] bg-white flex flex-col">
      <div className="bg-[#005EB8] px-4 pt-12 pb-5 relative">
        {onClose && (
          <button onClick={onClose} className="absolute top-12 right-4 text-white">
            <X size={22} />
          </button>
        )}
        <div className="flex items-center gap-3 mb-1">
          <MapPin size={22} className="text-white" />
          <h1 className="text-white font-bold text-lg">Where are you?</h1>
        </div>
        <p className="text-blue-200 text-sm ml-9">Select a nearby place or map a new one</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={28} className="text-[#005EB8] animate-spin" />
            <p className="text-sm text-gray-500">Looking for nearby places…</p>
          </div>
        ) : (
          <>
            {nearby.length > 0 ? (
              <>
                <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Nearby ({nearby.length})
                </p>
                {nearby.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => onSelectVenue(v)}
                    className="w-full flex items-center gap-3 px-4 py-4 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 text-left"
                  >
                    <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 size={22} className="text-[#005EB8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{v.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v.waypoint_count} location{v.waypoint_count !== 1 ? "s" : ""}
                        {v.distance_m != null ? ` • ${formatDistance(v.distance_m)}` : ""}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center py-12 px-6 text-center">
                <span className="text-5xl mb-3">📍</span>
                <p className="text-gray-700 font-semibold">No mapped places nearby</p>
                <p className="text-sm text-gray-400 mt-1">Be the first to map this place!</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-4 pb-8 pt-3 border-t border-gray-100 bg-white">
        <button
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-3.5 font-semibold text-sm"
        >
          <Plus size={18} />
          Map this place
        </button>
      </div>
    </div>
  )
}
