"use client"

import { useState } from "react"
import { Waypoint } from "@/lib/types"
import { Search, X, ChevronRight } from "lucide-react"

const WAYPOINT_TYPE_ICONS: Record<string, string> = {
  ward: "🏥", department: "🏢", lift: "🛗", stairs: "🪜",
  toilet: "🚻", exit: "🚪", reception: "📋", canteen: "🍽️",
  pharmacy: "💊", other: "📍",
}

const WAYPOINT_TYPE_LABELS: Record<string, string> = {
  ward: "Ward", department: "Department", lift: "Lift", stairs: "Stairs",
  toilet: "Toilet", exit: "Exit", reception: "Reception", canteen: "Canteen",
  pharmacy: "Pharmacy", other: "Location",
}

interface Props {
  waypoints: Waypoint[]
  onSelect: (waypoint: Waypoint) => void
  onClose: () => void
}

export default function SearchModal({ waypoints, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("")

  const navigable = waypoints.filter((w) => !["lift", "stairs"].includes(w.type))

  const filtered = query.trim()
    ? navigable.filter(
        (w) =>
          w.name.toLowerCase().includes(query.toLowerCase()) ||
          w.description?.toLowerCase().includes(query.toLowerCase()) ||
          (WAYPOINT_TYPE_LABELS[w.type] ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : []

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">
      <div className="bg-[#005EB8] px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onClose} className="text-white">
          <X size={22} />
        </button>
        <div className="flex-1 bg-white rounded-xl flex items-center px-3 gap-2">
          <Search size={18} className="text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location…"
            className="flex-1 py-2.5 text-sm text-gray-800 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.trim() === "" ? (
          <>
            <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              All locations ({navigable.length})
            </p>
            {navigable.map((w) => (
              <WaypointRow key={w.id} waypoint={w} onSelect={onSelect} />
            ))}
            {navigable.length === 0 && (
              <div className="flex flex-col items-center py-16 px-4 text-center">
                <span className="text-5xl mb-3">🗺️</span>
                <p className="text-gray-600 font-medium">No locations mapped yet</p>
                <p className="text-sm text-gray-400 mt-1">Use Survey Mode to start mapping this place</p>
              </div>
            )}
          </>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <span className="text-5xl mb-3">🔍</span>
            <p className="text-gray-600 font-medium">No results for "{query}"</p>
          </div>
        ) : (
          <>
            <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </p>
            {filtered.map((w) => (
              <WaypointRow key={w.id} waypoint={w} onSelect={onSelect} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function WaypointRow({ waypoint, onSelect }: { waypoint: Waypoint; onSelect: (w: Waypoint) => void }) {
  return (
    <button
      onClick={() => onSelect(waypoint)}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 text-left"
    >
      <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-xl flex-shrink-0">
        {WAYPOINT_TYPE_ICONS[waypoint.type] ?? "📍"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{waypoint.name}</p>
        <p className="text-xs text-gray-500">
          {WAYPOINT_TYPE_LABELS[waypoint.type] ?? "Location"} •{" "}
          {waypoint.floor === 0 ? "Ground Floor" : `Floor ${waypoint.floor}`}
          {waypoint.description ? ` • ${waypoint.description}` : ""}
        </p>
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}
