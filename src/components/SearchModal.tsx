"use client"

import { useEffect, useRef, useState } from "react"
import { Waypoint, Coordinates, FloorNaming } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS, WAYPOINT_TYPE_LABELS, floorLabel } from "@/lib/waypoint-meta"
import { rankWaypoints, rankNearMisses } from "@/lib/search"
import { Search, X, ChevronRight, MapPin, Loader2 } from "lucide-react"

interface Props {
  // Which venue the search ran against — recorded with unmatched queries so
  // the venue's mappers can see what visitors looked for and didn't find.
  venueId: string
  waypoints: Waypoint[]
  // Waypoint names to surface as shortcuts, supplied by the active venue.
  quickAccess?: string[]
  // The active venue's storey numbering (e.g. GOSH's "Level 2" ground floor).
  floorNaming?: FloorNaming
  // The active venue's centre or the user's live position — biases worldwide
  // place search toward nearby results.
  proximity?: Coordinates
  onSelect: (waypoint: Waypoint) => void
  onClose: () => void
}

// Fire-and-forget: a missed search is telemetry for the venue's mappers, never
// something the visitor should wait on or see fail.
function reportSearchMiss(venueId: string, query: string, suggested: boolean) {
  void fetch("/api/search-misses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ venueId, query, suggested }),
  }).catch(() => {})
}

interface GeoResult {
  id: string
  name: string
  description: string
  lat: number
  lng: number
}

// A geocoded hit is outside the venue's mapped floors, so it lands on the
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

export default function SearchModal({ venueId, waypoints, quickAccess = [], floorNaming, proximity, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("")
  const [geoResults, setGeoResults] = useState<GeoResult[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  // Which query "Suggest this place" was pressed for — deriving the sent state
  // from the live query means it resets naturally as the visitor types.
  const [suggestedQuery, setSuggestedQuery] = useState<string | null>(null)
  // Queries already logged this session, so retyping the same thing doesn't
  // count the miss twice.
  const loggedMissesRef = useRef<Set<string>>(new Set())

  // Latest proximity, read at fetch time so a moving GPS fix doesn't re-trigger
  // the debounced geocode on every position update.
  const proximityRef = useRef(proximity)
  useEffect(() => {
    proximityRef.current = proximity
  }, [proximity])

  const trimmed = query.trim()

  // Ranked best-match-first, so the closest name wins among similar ones.
  const filtered = trimmed ? rankWaypoints(trimmed, waypoints, (w) => WAYPOINT_TYPE_LABELS[w.type]) : []

  const quickWaypoints = waypoints.filter((w) => quickAccess.includes(w.name))

  // Geocode anything the user types that the indoor list doesn't already cover,
  // so destinations beyond the venue's mapped points are still navigable.
  // Debounced, and any in-flight request is abandoned when the query changes.
  useEffect(() => {
    if (trimmed.length < 3) return
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      setGeoLoading(true)
      setGeoError(null)
      try {
        const params = new URLSearchParams({ q: trimmed })
        const prox = proximityRef.current
        if (prox) {
          params.set("lat", String(prox.lat))
          params.set("lng", String(prox.lng))
        }
        const res = await fetch(`/api/geocode?${params}`, { signal: controller.signal })
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

  // Close near-misses to offer as "Did you mean …?" when nothing matched.
  const nearMisses = showEmpty ? rankNearMisses(trimmed, waypoints) : []

  // Record settled empty queries (debounced so half-typed words don't count).
  // This is what tells a venue owner which places people expect to find here.
  useEffect(() => {
    if (!showEmpty || trimmed.length < 3) return
    const key = trimmed.toLowerCase()
    if (loggedMissesRef.current.has(key)) return
    const handle = setTimeout(() => {
      loggedMissesRef.current.add(key)
      reportSearchMiss(venueId, trimmed, false)
    }, 1500)
    return () => clearTimeout(handle)
  }, [showEmpty, trimmed, venueId])

  const suggestSent = suggestedQuery !== null && suggestedQuery === trimmed

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">
      {/* Header */}
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
            placeholder="Search a room, place or address..."
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
        {trimmed === "" ? (
          <>
            {quickWaypoints.length > 0 && (
              <>
                <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Quick access
                </p>
                {quickWaypoints.map((w) => (
                  <WaypointRow key={w.id} waypoint={w} floorNaming={floorNaming} onSelect={onSelect} />
                ))}
              </>
            )}

            <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              All locations
            </p>
            {waypoints.map((w) => (
              <WaypointRow key={w.id} waypoint={w} floorNaming={floorNaming} onSelect={onSelect} />
            ))}
          </>
        ) : (
          <>
            {filtered.length > 0 && (
              <>
                <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  In this place · {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </p>
                {filtered.map((w) => (
                  <WaypointRow key={w.id} waypoint={w} floorNaming={floorNaming} onSelect={onSelect} />
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
              <>
                {nearMisses.length > 0 && (
                  <>
                    <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Did you mean…
                    </p>
                    {nearMisses.map((w) => (
                      <WaypointRow key={w.id} waypoint={w} floorNaming={floorNaming} onSelect={onSelect} />
                    ))}
                  </>
                )}

                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <span className="text-5xl mb-3">🔍</span>
                  <p className="text-gray-600 font-medium">No results for &ldquo;{query}&rdquo;</p>
                  {geoError === "not_configured" ? (
                    <p className="text-sm text-gray-400 mt-1">
                      It isn&apos;t mapped here yet, and address search isn&apos;t enabled on this deployment —
                      only mapped places can be found.
                    </p>
                  ) : geoError ? (
                    <p className="text-sm text-gray-400 mt-1">
                      Couldn&apos;t reach the map search just now — check your connection, or try a room,
                      place or floor number.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-1">
                      It may not be mapped yet. Try another name, or a nearby address.
                    </p>
                  )}

                  {quickWaypoints.length > 0 && (
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      {quickWaypoints.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => onSelect(w)}
                          className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 active:bg-gray-100"
                        >
                          {WAYPOINT_TYPE_ICONS[w.type]} {w.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (suggestSent) return
                      setSuggestedQuery(trimmed)
                      reportSearchMiss(venueId, trimmed, true)
                    }}
                    disabled={suggestSent}
                    className={`mt-6 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${
                      suggestSent
                        ? "bg-gray-100 text-gray-500"
                        : "bg-[#005EB8] text-white active:bg-[#004a93]"
                    }`}
                  >
                    <MapPin size={15} />
                    {suggestSent ? "Thanks — noted for the venue team" : "Suggest this place to the venue team"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function WaypointRow({ waypoint, floorNaming, onSelect }: { waypoint: Waypoint; floorNaming?: FloorNaming; onSelect: (w: Waypoint) => void }) {
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
          {floorLabel(waypoint.floor, floorNaming)}
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
