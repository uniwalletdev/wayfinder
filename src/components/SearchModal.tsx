"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Waypoint, Coordinates, FloorNaming, VenueSummary } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS, WAYPOINT_TYPE_LABELS, floorLabel, waypointDetail } from "@/lib/waypoint-meta"
import { rankWaypoints, rankNearMisses, scoreWaypoint } from "@/lib/search"
import Overlay from "@/components/Overlay"
import { Search, X, ChevronRight, MapPin, Loader2, Building2, ArrowRightLeft } from "lucide-react"

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
  // What the picked place is for. "destination" (default) is the everyday
  // "where to?" search; "origin" is picking a custom starting point, which only
  // changes the wording so it's clear which end of the journey is being set.
  purpose?: "origin" | "destination"
  // Every other place the app knows, so a search for a hospital that is not
  // the open one offers to switch to it instead of "no results".
  otherVenues?: VenueSummary[]
  onSwitchVenue?: (id: string) => void
  onSelect: (waypoint: Waypoint) => void
  onClose: () => void
}

// How many other hospitals to offer for a query.
const MAX_VENUE_HITS = 5

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

// One row the keyboard can land on, whichever list it belongs to. The visible
// lists are rendered from these so arrow keys and taps agree on the order.
interface Item {
  id: string
  select: () => void
  render: (active: boolean, id: string) => React.ReactNode
}

export default function SearchModal({ venueId, waypoints, quickAccess = [], floorNaming, proximity, purpose = "destination", otherVenues = [], onSwitchVenue, onSelect, onClose }: Props) {
  const isOrigin = purpose === "origin"
  const searchPlaceholder = isOrigin ? "Choose a starting point…" : "Search a room, place or address…"
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
  const listRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const listId = useId()

  // Latest proximity, read at fetch time so a moving GPS fix doesn't re-trigger
  // the debounced geocode on every position update.
  const proximityRef = useRef(proximity)
  useEffect(() => {
    proximityRef.current = proximity
  }, [proximity])

  const trimmed = query.trim()

  // Ranked best-match-first, so the closest name wins among similar ones.
  const filtered = useMemo(
    () => (trimmed ? rankWaypoints(trimmed, waypoints, (w) => WAYPOINT_TYPE_LABELS[w.type]) : []),
    [trimmed, waypoints]
  )

  const quickWaypoints = useMemo(() => waypoints.filter((w) => quickAccess.includes(w.name)), [waypoints, quickAccess])

  // Other hospitals whose name matches: someone at the wrong hospital, or
  // planning from home, types the hospital's name and used to get nothing.
  const venueHits = useMemo(() => {
    if (trimmed.length < 2 || !onSwitchVenue) return []
    return otherVenues
      .filter((v) => v.id !== venueId && v.visibility === "public")
      .map((v) => ({ v, score: scoreWaypoint(trimmed, v.name, v.subtitle, "") }))
      .filter((x) => x.score > 0)
      // Mapped hospitals before location-only pins, then by match.
      .sort((a, b) => Number(b.v.mapped) - Number(a.v.mapped) || b.score - a.score || a.v.name.localeCompare(b.v.name))
      .slice(0, MAX_VENUE_HITS)
      .map((x) => x.v)
  }, [trimmed, otherVenues, venueId, onSwitchVenue])

  // The full directory, grouped by floor and alphabetical within each: a
  // visitor who cannot spell the ward can still find it by browsing the floor
  // they were told. Three hundred rows in arbitrary array order was no use.
  const byFloor = useMemo(() => {
    const groups = new Map<number, Waypoint[]>()
    for (const w of waypoints) {
      const list = groups.get(w.floor) ?? []
      list.push(w)
      groups.set(w.floor, list)
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([floor, list]) => [floor, list.slice().sort((a, b) => a.name.localeCompare(b.name))] as const)
  }, [waypoints])

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

  const showEmpty = trimmed !== "" && filtered.length === 0 && extraResults.length === 0 && venueHits.length === 0 && !showLoading

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

  // ── Keyboard navigation ──────────────────────────────────────────────────
  // Every selectable row, in visual order, so Up/Down/Enter work from the
  // search field without leaving it — the desktop convention "/" opens search
  // with, and the one a screen-reader user expects from a combobox.
  const wpItem = (w: Waypoint, prefix: string): Item => ({
    id: `${prefix}-${w.id}`,
    select: () => onSelect(w),
    render: (active, id) => <WaypointRow id={id} active={active} waypoint={w} floorNaming={floorNaming} onSelect={onSelect} />,
  })
  const sections: { label: React.ReactNode; items: Item[]; tone?: "primary" }[] = []
  if (trimmed === "") {
    if (quickWaypoints.length > 0) sections.push({ label: "Quick access", items: quickWaypoints.map((w) => wpItem(w, "quick")) })
    for (const [floor, list] of byFloor) {
      sections.push({ label: floorLabel(floor, floorNaming), items: list.map((w) => wpItem(w, `f${floor}`)) })
    }
  } else {
    if (filtered.length > 0) {
      sections.push({
        label: `In this place · ${filtered.length} result${filtered.length !== 1 ? "s" : ""}`,
        items: filtered.map((w) => wpItem(w, "hit")),
        tone: "primary",
      })
    }
    if (extraResults.length > 0) {
      sections.push({
        label: "On the map",
        items: extraResults.map((r) => ({
          id: `geo-${r.id}`,
          select: () => onSelect(geoToWaypoint(r)),
          render: (active, id) => <GeoRow id={id} active={active} result={r} onSelect={() => onSelect(geoToWaypoint(r))} />,
        })),
      })
    }
    if (venueHits.length > 0 && onSwitchVenue) {
      sections.push({
        label: "Other hospitals",
        items: venueHits.map((v) => ({
          id: `venue-${v.id}`,
          select: () => onSwitchVenue(v.id),
          render: (active, id) => <VenueHitRow id={id} active={active} venue={v} onSelect={() => onSwitchVenue(v.id)} />,
        })),
      })
    }
    if (showEmpty && nearMisses.length > 0) {
      sections.push({ label: "Did you mean…", items: nearMisses.map((w) => wpItem(w, "near")) })
    }
  }
  const flat = sections.flatMap((s) => s.items)

  const [activeIndex, setActiveIndex] = useState(-1)
  // A new result set restarts keyboard focus at the top when there is a query
  // (the best match), and nowhere when browsing.
  const resultKey = `${trimmed}|${flat.length}`
  const [prevResultKey, setPrevResultKey] = useState(resultKey)
  if (resultKey !== prevResultKey) {
    setPrevResultKey(resultKey)
    setActiveIndex(trimmed && flat.length > 0 ? 0 : -1)
  }
  const activeId = activeIndex >= 0 && activeIndex < flat.length ? flat[activeIndex].id : undefined

  useEffect(() => {
    if (!activeId) return
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" })
  }, [activeId])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === "Home" && activeIndex >= 0) {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === "End" && activeIndex >= 0) {
      e.preventDefault()
      setActiveIndex(flat.length - 1)
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < flat.length) {
      e.preventDefault()
      flat[activeIndex].select()
    }
  }

  const header = (
    <>
      <h2 id={titleId} className="sr-only">{isOrigin ? "Choose a starting point" : "Search this place"}</h2>
      <div className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-wf-primary bg-white px-3.5 shadow-[0_4px_14px_rgba(10,93,194,0.12)]">
        <Search size={17} className="flex-shrink-0 text-wf-primary" aria-hidden="true" />
        <input
          autoFocus
          data-autofocus
          type="search"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label={isOrigin ? "Starting point" : "Search a room, place or address"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={searchPlaceholder}
          enterKeyHint="search"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-[11px] text-[15px] text-wf-ink outline-none placeholder:text-wf-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-wf-faint hover:bg-wf-surface hover:text-wf-ink"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </>
  )

  return (
    <Overlay header={header} labelledBy={titleId} onClose={onClose} dismissLabel={isOrigin ? "Close starting point picker" : "Close search"}>
      <div ref={listRef} id={listId} role="listbox" aria-label={isOrigin ? "Starting points" : "Places"} className="flex-1 overflow-y-auto pb-safe-bar">
        {sections.map((section, i) => (
          <div key={i} role="group" aria-label={typeof section.label === "string" ? section.label : undefined}>
            <p
              className={`sticky top-0 z-10 border-b border-wf-border-faint bg-white/95 px-4 pb-1.5 pt-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] backdrop-blur lg:px-6 ${
                section.tone === "primary" ? "text-wf-primary" : "text-wf-muted"
              }`}
            >
              {section.label}
            </p>
            {section.items.map((item) => (
              <div key={item.id}>{item.render(item.id === activeId, item.id)}</div>
            ))}
          </div>
        ))}

        {trimmed === "" && waypoints.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-wf-muted">
            Nothing is mapped inside this place yet. Type an address to route to it from outside.
          </p>
        )}

        {showLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-wf-muted" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            <span className="text-sm">Searching the map…</span>
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-wf-surface text-wf-primary" aria-hidden="true">
              <Search size={24} />
            </span>
            <p className="font-display text-[16px] font-semibold text-wf-ink">No results for &ldquo;{query}&rdquo;</p>
            {geoError === "not_configured" ? (
              <p className="mt-1 max-w-xs text-sm text-wf-muted">
                It isn&apos;t mapped here yet, and address search isn&apos;t enabled on this deployment —
                only mapped places can be found.
              </p>
            ) : geoError ? (
              <p className="mt-1 max-w-xs text-sm text-wf-muted">
                Couldn&apos;t reach the map search just now — check your connection, or try a room,
                place or floor number.
              </p>
            ) : (
              <p className="mt-1 max-w-xs text-sm text-wf-muted">
                It may not be mapped yet. Try another name, or a nearby address.
              </p>
            )}

            {quickWaypoints.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {quickWaypoints.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => onSelect(w)}
                    className="rounded-full border border-wf-border bg-white px-3.5 py-2 text-[13px] font-medium text-wf-body transition-colors hover:border-wf-primary hover:text-wf-primary"
                  >
                    <span aria-hidden="true">{WAYPOINT_TYPE_ICONS[w.type]} </span>
                    {w.name}
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
              className={`mt-6 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                suggestSent ? "bg-wf-teal-tint text-wf-teal-text" : "bg-wf-primary text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)]"
              }`}
            >
              <MapPin size={15} aria-hidden="true" />
              {suggestSent ? "Thanks — noted for the venue team" : "Suggest this place to the venue team"}
            </button>
          </div>
        )}
      </div>
    </Overlay>
  )
}

const rowClass = (active: boolean) =>
  `flex w-full items-center gap-3 border-b border-wf-border-faint px-4 py-3 text-left transition-colors lg:px-6 ${
    active ? "bg-[#EEF5FD]" : "hover:bg-[#F7FAFD] active:bg-wf-surface"
  }`

function WaypointRow({ id, active, waypoint, floorNaming, onSelect }: { id: string; active: boolean; waypoint: Waypoint; floorNaming?: FloorNaming; onSelect: (w: Waypoint) => void }) {
  return (
    <button id={id} role="option" aria-selected={active} tabIndex={-1} onClick={() => onSelect(waypoint)} className={rowClass(active)}>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-wf-surface text-xl" aria-hidden="true">
        {WAYPOINT_TYPE_ICONS[waypoint.type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-wf-ink">{waypoint.name}</span>
        <span className="block truncate text-xs text-wf-muted">
          {WAYPOINT_TYPE_LABELS[waypoint.type]} · {floorLabel(waypoint.floor, floorNaming)}
          {waypointDetail(waypoint) ? ` · ${waypointDetail(waypoint)}` : ""}
        </span>
      </span>
      <ChevronRight size={16} className="flex-shrink-0 text-wf-faint" aria-hidden="true" />
    </button>
  )
}

function GeoRow({ id, active, result, onSelect }: { id: string; active: boolean; result: GeoResult; onSelect: () => void }) {
  return (
    <button id={id} role="option" aria-selected={active} tabIndex={-1} onClick={onSelect} className={rowClass(active)}>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#E7F2FF]" aria-hidden="true">
        <MapPin size={18} className="text-wf-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-wf-ink">{result.name}</span>
        <span className="block truncate text-xs text-wf-muted">{result.description}</span>
      </span>
      <ChevronRight size={16} className="flex-shrink-0 text-wf-faint" aria-hidden="true" />
    </button>
  )
}

function VenueHitRow({ id, active, venue, onSelect }: { id: string; active: boolean; venue: VenueSummary; onSelect: () => void }) {
  return (
    <button id={id} role="option" aria-selected={active} tabIndex={-1} onClick={onSelect} className={rowClass(active)}>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#E7F2FF]" aria-hidden="true">
        <Building2 size={18} className="text-wf-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-wf-ink">{venue.name}</span>
        <span className="block truncate text-xs text-wf-muted">
          {venue.mapped ? "Mapped · switch to this hospital" : "Location only · switch to this hospital"}
          {venue.subtitle ? ` · ${venue.subtitle}` : ""}
        </span>
      </span>
      <ArrowRightLeft size={16} className="flex-shrink-0 text-wf-faint" aria-hidden="true" />
    </button>
  )
}
