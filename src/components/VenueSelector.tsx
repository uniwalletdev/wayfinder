"use client"

import { useState, useEffect } from "react"
import { Coordinates } from "@/lib/types"
import { MapPin, Plus, Building2, ChevronRight, Loader2, X, Minus, Lock, Globe } from "lucide-react"

export interface VenueInfo {
  id: number
  name: string
  address?: string
  city?: string
  center_lat?: number
  center_lng?: number
  floors?: number
  venue_type?: string
  is_private?: boolean
  waypoint_count: number
  distance_m?: number
}

interface Props {
  userPosition: Coordinates
  onSelectVenue: (venue: VenueInfo) => void
  onClose?: () => void
}

const VENUE_TYPES = [
  { key: "home",     label: "Home",     icon: "🏠", color: "bg-orange-50 border-orange-200" },
  { key: "hospital", label: "Hospital", icon: "🏥", color: "bg-red-50 border-red-200" },
  { key: "shop",     label: "Shop",     icon: "🛒", color: "bg-green-50 border-green-200" },
  { key: "office",   label: "Office",   icon: "🏢", color: "bg-blue-50 border-blue-200" },
  { key: "airport",  label: "Airport",  icon: "✈️", color: "bg-sky-50 border-sky-200" },
  { key: "mall",     label: "Mall",     icon: "🛍️", color: "bg-pink-50 border-pink-200" },
  { key: "school",   label: "School",   icon: "🏫", color: "bg-yellow-50 border-yellow-200" },
  { key: "other",    label: "Other",    icon: "📍", color: "bg-purple-50 border-purple-200" },
]

export default function VenueSelector({ userPosition, onSelectVenue, onClose }: Props) {
  const [nearby, setNearby]       = useState<VenueInfo[]>([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [newName, setNewName]     = useState("")
  const [newType, setNewType]     = useState("home")
  const [newFloors, setNewFloors] = useState(1)
  const [newPrivate, setNewPrivate] = useState(true)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/venues/nearby?lat=${userPosition.lat}&lng=${userPosition.lng}&radius=1000`)
      .then((r) => r.json())
      .then((data) => { setNearby(Array.isArray(data) ? data : []); setLoading(false) })
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
        body: JSON.stringify({ name, venue_type: newType, floors: newFloors, is_private: newPrivate, lat: userPosition.lat, lng: userPosition.lng }),
      })
      const venue = await res.json().catch(() => null)
      if (res.ok && venue?.id) { onSelectVenue({ ...venue, waypoint_count: 0, distance_m: 0 }); return }
      setCreateError(venue?.error ? `Couldn't save: ${venue.error}` : `Error ${res.status} — try visiting /api/db-init first`)
    } catch (e) {
      setCreateError(`Network error: ${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  function formatDistance(m?: number) {
    if (m == null) return ""
    return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
  }

  // ── Creation sheet ──────────────────────────────────────────────────────────
  if (creating) {
    return (
      <>
        <div className="fixed inset-0 z-[299] bg-black/40" />
        <div className="fixed bottom-0 left-0 right-0 z-[300] bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[94vh]">

          {/* handle */}
          <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
          </div>

          {/* header */}
          <div className="px-5 pb-4 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setCreating(false)}
              className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200"
            >
              <X size={20} />
            </button>
            <div>
              <h2 className="font-extrabold text-gray-900 text-lg leading-tight">Map a new place</h2>
              <p className="text-xs text-gray-400">Saved at your current GPS location</p>
            </div>
          </div>

          {/* scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 pt-1 pb-3">

            {/* name */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Name</p>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. My House, GOSH A&E, Tesco"
              className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#005EB8] rounded-2xl px-4 py-4 text-base font-medium outline-none transition-colors mb-6"
            />

            {/* type */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Type of place</p>
            <div className="grid grid-cols-4 gap-2.5 mb-6">
              {VENUE_TYPES.map((t) => {
                const active = newType === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => { setNewType(t.key); setNewPrivate(t.key === "home") }}
                    className={`relative flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border-2 transition-all active:scale-95 ${
                      active
                        ? "bg-[#005EB8] border-[#005EB8] shadow-lg shadow-blue-200"
                        : `${t.color} hover:border-gray-300`
                    }`}
                  >
                    <span className="text-2xl leading-none">{t.icon}</span>
                    <span className={`text-[11px] font-bold leading-none ${active ? "text-white" : "text-gray-600"}`}>
                      {t.label}
                    </span>
                    {active && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full opacity-80" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* floors */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Floors</p>
            <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-3 mb-6">
              <button
                onClick={() => setNewFloors((f) => Math.max(1, f - 1))}
                disabled={newFloors <= 1}
                className="w-14 h-14 rounded-2xl bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 shadow-sm active:bg-gray-50 disabled:opacity-30 transition-all"
              >
                <Minus size={22} />
              </button>
              <div className="flex-1 text-center">
                <p className="text-5xl font-extrabold text-gray-900 leading-none">{newFloors}</p>
                <p className="text-xs text-gray-400 mt-1 font-medium">
                  {newFloors === 1 ? "Ground only" : `Ground + ${newFloors - 1} above`}
                </p>
              </div>
              <button
                onClick={() => setNewFloors((f) => Math.min(50, f + 1))}
                className="w-14 h-14 rounded-2xl bg-[#005EB8] border-2 border-[#005EB8] flex items-center justify-center text-white shadow-md shadow-blue-200 active:bg-blue-700 transition-all"
              >
                <Plus size={22} />
              </button>
            </div>

            {/* privacy */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Visibility</p>
            <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 mb-2">
              <button
                onClick={() => setNewPrivate(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all ${
                  !newPrivate
                    ? "bg-white text-[#005EB8] shadow-sm"
                    : "text-gray-400"
                }`}
              >
                <Globe size={16} />
                Public
              </button>
              <button
                onClick={() => setNewPrivate(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all ${
                  newPrivate
                    ? "bg-white text-[#005EB8] shadow-sm"
                    : "text-gray-400"
                }`}
              >
                <Lock size={16} />
                Private
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-5 px-1">
              {newPrivate
                ? "🔒 Only you and people you share the link with can see this."
                : "🌐 Anyone nearby can find and use this place."}
            </p>
          </div>

          {/* footer CTA */}
          <div className="px-5 pb-9 pt-3 border-t border-gray-100 flex-shrink-0">
            {createError && (
              <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <span className="text-red-500 text-base leading-none mt-0.5">⚠️</span>
                <p className="text-xs text-red-700 font-medium leading-snug">{createError}</p>
              </div>
            )}
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || saving}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#005EB8] to-[#0072E3] text-white rounded-2xl py-4 font-extrabold text-base shadow-lg shadow-blue-200 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none transition-all"
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              {saving ? "Saving…" : "Create & start mapping"}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Selection sheet ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-[299] bg-black/30" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-[300] bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[72vh]">

        {/* handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {/* header */}
        <div className="px-5 pt-1 pb-4 flex items-center gap-3 border-b border-gray-100 flex-shrink-0">
          <div className="w-11 h-11 bg-gradient-to-br from-[#005EB8] to-[#0072E3] rounded-2xl flex items-center justify-center shadow-md shadow-blue-200 flex-shrink-0">
            <MapPin size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-extrabold text-gray-900 text-lg leading-tight">Where are you?</h2>
            <p className="text-xs text-gray-400">Pick a nearby place or add a new one</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200 flex-shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="text-[#005EB8] animate-spin" />
              <p className="text-sm text-gray-400 font-medium">Looking for nearby places…</p>
            </div>
          ) : nearby.length > 0 ? (
            <>
              <p className="px-5 pt-4 pb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                Nearby · {nearby.length} place{nearby.length !== 1 ? "s" : ""}
              </p>
              {nearby.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onSelectVenue(v)}
                  className="w-full flex items-center gap-4 px-5 py-4 border-b border-gray-50 active:bg-blue-50 text-left transition-colors"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Building2 size={22} className="text-[#005EB8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{v.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-medium">
                      {v.waypoint_count} pin{v.waypoint_count !== 1 ? "s" : ""}
                      {v.distance_m != null ? ` · ${formatDistance(v.distance_m)} away` : ""}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </button>
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center py-10 px-6 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center mb-4">
                <span className="text-3xl">📍</span>
              </div>
              <p className="text-gray-800 font-bold text-base">No mapped places nearby</p>
              <p className="text-sm text-gray-400 mt-1">Be the first to map this place!</p>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 pb-9 pt-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#005EB8] to-[#0072E3] text-white rounded-2xl py-4 font-extrabold text-base shadow-lg shadow-blue-200 active:scale-[0.98] transition-all"
          >
            <Plus size={20} />
            Map this place
          </button>
        </div>
      </div>
    </>
  )
}
