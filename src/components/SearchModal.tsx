"use client"

import { useEffect, useState } from "react"
import { Waypoint } from "@/lib/types"
import { GOSH_WAYPOINTS, WAYPOINT_TYPE_ICONS, WAYPOINT_TYPE_LABELS, QUICK_ACCESS } from "@/lib/gosh-data"
import { Search, X, ChevronRight, MapPin, Loader2 } from "lucide-react"

interface Props {
  waypoints?: Waypoint[]
  onSelect: (waypoint: Waypoint) => void
  onClose: () => void
}

interface GeoResult {
  id: string
  name: string
  description: string
  lat: number
  lng: number
}

// A geocoded hit is outside the hospital's mapped floors, so it lands on the
// ground floor as a generic point the router can still head toward.
function geoToWaypoint(r: GeoResult): Waypoint {
  return {
    id: r.id,
    name: r.name,
    type: "other",
    coordinates: { lat: r.lat, lng: r.lng },
    floor: 0,
    description: r.description,
  }
}

export default function SearchModal({ waypoints = GOSH_WAYPOINTS, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("")
  const [geoResults, setGeoResults] = useState<GeoResult[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const trimmed = query.trim()

  const filtered = trimmed
    ? waypoints.filter(
        (w) =>
          w.name.toLowerCase().includes(query.toLowerCase()) ||
          w.description?.toLowerCase().includes(query.toLowerCase()) ||
          WAYPOINT_TYPE_LABELS[w.type].toLowerCase().includes(query.toLowerCase())
      )
    : []

  const favourites = QUICK_ACCESS.map((q) => ({ ...q, waypoint: waypoints.find((w) => w.id === q.waypointId) })).filter(
    (q): q is typeof q & { waypoint: Waypoint } => !!q.waypoint
  )

  // Geocode anything the user types that the indoor list doesn't already cover,
  // so destinations beyond the hospital's mapped points are still navigable.
  // Debounced, and any in-flight request is abandoned when the query changes.
  useEffect(() => {
    if (trimmed.length < 3) return
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      setGeoLoading(true)
      setGeoError(null)
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as { results?: GeoResult[]; error?: string }
        setGeoResults(Array.isArray(data.results) ? data.results : [])
        setGeoError(data.error ?? null)
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          setGeoResults([])
          setGeoError("unreachable")
        }
      } finally {
        setGeoLoading(false)
      }
    }, 350)
    return () => {
      controller.abort()
      clearTimeout(handle)
    }
  }, [trimmed])

  // Only surface geocoding state once the query is long enough to have been
  // searched; below that the stored results belong to an earlier, longer query.
  const geoActive = trimmed.length >= 3
  // Hide geocoded hits that just duplicate an indoor result by name.
  const indoorNames = new Set(filtered.map((w) => w.name.toLowerCase()))
  const extraResults = geoActive ? geoResults.filter((r) => !indoorNames.has(r.name.toLowerCase())) : []
  const showLoading = geoActive && geoLoading

  const showEmpty = trimmed !== "" && filtered.length === 0 && extraResults.length === 0 && !showLoading

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">
      {/* Header — Apple Maps' "Search Maps" pill with a Cancel link */}
      <div className="bg-white px-4 pt-safe-snug pb-3 flex items-center gap-3 border-b border-gray-100">
        <div className="flex-1 bg-[#F2F2F7] rounded-full flex items-center px-3.5 gap-2">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ward, department or place"
            className="flex-1 py-2.5 text-sm text-gray-800 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>
        <button onClick={onClose} className="text-[#007AFF] text-base font-medium flex-shrink-0">
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {trimmed === "" ? (
          <>
            <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Favourites
            </p>
            <FavouritesRow favourites={favourites} onSelect={onSelect} />

            <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              All locations
            </p>
            {waypoints.map((w) => (
              <WaypointRow key={w.id} waypoint={w} onSelect={onSelect} />
            ))}
          </>
        ) : (
          <>
            {filtered.length > 0 && (
              <>
                <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  In the hospital · {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </p>
                {filtered.map((w) => (
                  <WaypointRow key={w.id} waypoint={w} onSelect={onSelect} />
                ))}
              </>
            )}

            {extraResults.length > 0 && (
              <>
                <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  On the map
                </p>
                {extraResults.map((r) => (
                  <GeoRow key={r.id} result={r} onSelect={() => onSelect(geoToWaypoint(r))} />
                ))}
              </>
            )}

            {showLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Searching the map…</span>
              </div>
            )}

            {showEmpty && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <span className="text-5xl mb-3">🔍</span>
                <p className="text-gray-600 font-medium">No results for "{query}"</p>
                {geoError && geoError !== "not_configured" ? (
                  <p className="text-sm text-gray-400 mt-1">
                    Couldn&apos;t reach the map search just now — check your connection, or try a ward,
                    department or floor number.
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 mt-1">Try a ward name, department, or a nearby place</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FavouritesRow({
  favourites,
  onSelect,
}: {
  favourites: { waypoint: Waypoint; label: string; icon: typeof MapPin }[]
  onSelect: (w: Waypoint) => void
}) {
  return (
    <div className="flex gap-1 px-4 pb-2">
      {favourites.map(({ waypoint, label, icon: Icon }) => (
        <button
          key={waypoint.id}
          onClick={() => onSelect(waypoint)}
          className="flex flex-col items-center gap-1.5 flex-1 active:opacity-60"
        >
          <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center">
            <Icon size={20} className="text-[#007AFF]" />
          </div>
          <span className="text-xs text-gray-600 font-medium truncate w-full text-center">{label}</span>
        </button>
      ))}
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
        {WAYPOINT_TYPE_ICONS[waypoint.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{waypoint.name}</p>
        <p className="text-xs text-gray-500">
          {WAYPOINT_TYPE_LABELS[waypoint.type]} •{" "}
          {waypoint.floor === 0 ? "Ground Floor" : `Floor ${waypoint.floor}`}
          {waypoint.description ? ` • ${waypoint.description}` : ""}
        </p>
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}

function GeoRow({ result, onSelect }: { result: GeoResult; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 text-left"
    >
      <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
        <MapPin size={18} className="text-[#005EB8]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{result.name}</p>
        <p className="text-xs text-gray-500 truncate">{result.description}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}
