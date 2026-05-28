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
  const [createError, setCreateError] = useState<string | null>(null)

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
    setCreateError(null)
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
      const venue = await res.json().catch(() => null)
      if (res.ok && venue?.id) {
        onSelectVenue({ ...venue, waypoint_count: 0, distance_m: 0 })
        return
      }
      setCreateError(
        venue?.error
          ? `Couldn't save: ${venue.error}`
          : `Couldn't save (HTTP ${res.status}). The database may need initialising — open /api/db-init once.`
      )
    } catch (e) {
      setCreateError(`Network error: ${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  function formatDistance(m?: number) {
    if (m == null) return ""
    if (m < 1000) return `${Math.round(m)}m away`
    return `${(m / 1000).toFixed(1)}km away`
  }

  // ---- Creation screen (tall bottom sheet) ----
  if (creating) {
    return (
      <>
        <div className="fixed inset-0 z-[299] bg-black/30" />
        <div className="fixed bottom-0 left-0 right-0 z-[300] bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]">
          {/* drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* header */}
          <div className="px-4 pb-4 pt-2 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setCreating(false)}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
            >
              <X size={18} />
            </button>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Map a new place</h2>
              <p className="text-xs text-gray-400">Pinned at your current location</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-2">
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
            <p className="text-xs text-gray-400 mb-4">
              Ground floor + {newFloors - 1} above. You can add locations on each floor afterwards.
            </p>
          </div>

          <div className="px-4 pb-8 pt-3 border-t border-gray-100 flex-shrink-0">
            {createError && (
              <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
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
      </>
    )
  }

  // ---- Selection screen (bottom sheet) ----
  return (
    <>
      {/* backdrop — dims map slightly, tap to dismiss if onClose exists */}
      <div
        className="fixed inset-0 z-[299] bg-black/25"
        onClick={onClose}
      />

      <div className="fixed bottom-0 left-0 right-0 z-[300] bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[72vh]">
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* header */}
        <div className="px-4 pt-1 pb-3 flex items-center gap-3 border-b border-gray-100 flex-shrink-0">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <MapPin size={18} className="text-[#005EB8]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-base">Where are you?</h2>
            <p className="text-xs text-gray-400 truncate">Select a nearby place or map a new one</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={26} className="text-[#005EB8] animate-spin" />
              <p className="text-sm text-gray-500">Looking for nearby places…</p>
            </div>
          ) : (
            <>
              {nearby.length > 0 ? (
                <>
                  <p className="px-4 pt-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Nearby ({nearby.length})
                  </p>
                  {nearby.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => onSelectVenue(v)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 text-left"
                    >
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 size={20} className="text-[#005EB8]" />
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
                <div className="flex flex-col items-center py-8 px-6 text-center">
                  <span className="text-4xl mb-2">📍</span>
                  <p className="text-gray-700 font-semibold text-sm">No mapped places nearby</p>
                  <p className="text-xs text-gray-400 mt-1">Be the first to map this place!</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* footer */}
        <div className="px-4 pb-8 pt-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-3.5 font-semibold text-sm"
          >
            <Plus size={18} />
            Map this place
          </button>
        </div>
      </div>
    </>
  )
}
