"use client"

import { useMemo, useState } from "react"
import { MapLocation, LocationType } from "@/lib/types"
import {
  GOSH_LOCATIONS,
  WAYPOINT_TYPE_LABELS,
  PRIMARY_CATEGORIES,
  ACTIVE_SITE,
} from "@/lib/gosh-data"
import { Search, X, ChevronRight } from "lucide-react"

interface Props {
  onSelect: (location: MapLocation) => void
  onClose: () => void
  initialQuery?: string
}

type Filter = "all" | LocationType

const QUICK_ACCESS = ["Main Entrance", "Main Reception", "Pharmacy", "The Lagoon (restaurant)", "X Ray", "GOSH Shop"]

export default function SearchModal({ onSelect, onClose, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>("all")

  const q = query.trim().toLowerCase()

  const results = useMemo(() => {
    let list = GOSH_LOCATIONS
    if (filter !== "all") list = list.filter((l) => l.type === filter)
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.building.toLowerCase().includes(q) ||
          l.floorLabel.toLowerCase().includes(q) ||
          WAYPOINT_TYPE_LABELS[l.type].toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [q, filter])

  const quick = useMemo(
    () => QUICK_ACCESS.map((n) => GOSH_LOCATIONS.find((l) => l.name === n)).filter(Boolean) as MapLocation[],
    []
  )

  const showQuick = q === "" && filter === "all"

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">
      {/* Header */}
      <div className="bg-[#005EB8] px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-white" aria-label="Close search">
            <X size={22} />
          </button>
          <div className="flex-1 bg-white rounded-xl flex items-center px-3 gap-2">
            <Search size={18} className="text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${ACTIVE_SITE.shortName} wards, departments…`}
              className="flex-1 py-2.5 text-sm text-gray-800 outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear">
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar -mx-1 px-1">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {PRIMARY_CATEGORIES.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
              {WAYPOINT_TYPE_LABELS[c]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showQuick && (
          <>
            <SectionLabel>Quick access</SectionLabel>
            {quick.map((l) => (
              <LocationRow key={l.id} location={l} onSelect={onSelect} />
            ))}
            <SectionLabel>All locations · {GOSH_LOCATIONS.length}</SectionLabel>
          </>
        )}

        {!showQuick && (
          <SectionLabel>
            {results.length} result{results.length !== 1 ? "s" : ""}
            {filter !== "all" ? ` · ${WAYPOINT_TYPE_LABELS[filter as LocationType]}` : ""}
          </SectionLabel>
        )}

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <span className="text-5xl mb-3">🔍</span>
            <p className="text-gray-600 font-medium">No results{q ? ` for “${query}”` : ""}</p>
            <p className="text-sm text-gray-400 mt-1">Try a ward name, department or building</p>
          </div>
        ) : (
          results.map((l) => <LocationRow key={l.id} location={l} onSelect={onSelect} />)
        )}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
        active ? "bg-white text-[#005EB8]" : "bg-white/20 text-white"
      }`}
    >
      {children}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {children}
    </p>
  )
}

function metaLine(l: MapLocation): string {
  return [l.building, l.floorLabel, l.sideLabel].filter(Boolean).join(" · ")
}

function LocationRow({ location, onSelect }: { location: MapLocation; onSelect: (l: MapLocation) => void }) {
  return (
    <button
      onClick={() => onSelect(location)}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 text-left"
    >
      <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-xl flex-shrink-0">
        {location.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{location.name}</p>
        <p className="text-xs text-gray-500 truncate">{metaLine(location)}</p>
      </div>
      {location.access === "staff" && (
        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 flex-shrink-0">
          Staff
        </span>
      )}
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}
