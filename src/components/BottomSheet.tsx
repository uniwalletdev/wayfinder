"use client"

import { useState } from "react"
import { Waypoint, Route, RouteStep, TravelMode } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS, WAYPOINT_TYPE_LABELS, QUICK_ACCESS } from "@/lib/gosh-data"
import {
  Layers, Camera, QrCode, X, Navigation, PersonStanding, Bike, Car, Loader2,
  Search, Plus, ArrowUpDown, CheckCircle2, Footprints,
} from "lucide-react"

interface Props {
  destination: Waypoint | null
  route: Route | null
  currentStepIndex: number
  isNavigating: boolean
  travelMode: TravelMode
  routeLoading: boolean
  waypoints: Waypoint[]
  onSelectWaypoint: (waypoint: Waypoint) => void
  onTravelModeChange: (mode: TravelMode) => void
  onStartNavigation: () => void
  onStopNavigation: () => void
  onOpenCamera: () => void
  onScanQR: () => void
  onOpenSearch: () => void
  expanded: boolean
  onToggleExpand: () => void
}

export default function BottomSheet({
  destination,
  route,
  currentStepIndex,
  isNavigating,
  travelMode,
  routeLoading,
  waypoints,
  onSelectWaypoint,
  onTravelModeChange,
  onStartNavigation,
  onStopNavigation,
  onOpenCamera,
  onScanQR,
  onOpenSearch,
  expanded,
  onToggleExpand,
}: Props) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-all duration-300 max-h-[75vh] overflow-y-auto">
      {/* Handle */}
      <div className="flex justify-center pt-2 pb-1 cursor-pointer sticky top-0 bg-white" onClick={onToggleExpand}>
        <div className="w-9 h-1.5 bg-gray-300 rounded-full" />
      </div>

      {isNavigating && destination && route ? (
        <NavigatingSheet
          destination={destination}
          route={route}
          currentStepIndex={currentStepIndex}
          onStop={onStopNavigation}
          onOpenCamera={onOpenCamera}
          onScanQR={onScanQR}
          expanded={expanded}
        />
      ) : destination && route ? (
        <PreviewSheet
          destination={destination}
          route={route}
          travelMode={travelMode}
          routeLoading={routeLoading}
          onTravelModeChange={onTravelModeChange}
          onStart={onStartNavigation}
          onCancel={onStopNavigation}
          expanded={expanded}
        />
      ) : (
        <IdleSheet
          onOpenSearch={onOpenSearch}
          onOpenCamera={onOpenCamera}
          onScanQR={onScanQR}
          waypoints={waypoints}
          onSelectWaypoint={onSelectWaypoint}
        />
      )}
    </div>
  )
}

const TRAVEL_MODES: { mode: TravelMode; label: string; Icon: typeof PersonStanding }[] = [
  { mode: "walking", label: "Walk", Icon: PersonStanding },
  { mode: "cycling", label: "Cycle", Icon: Bike },
  { mode: "driving", label: "Drive", Icon: Car },
]

function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

// Small glyph for a route step in the leg list — mirrors the active
// turn-by-turn icon but kept lightweight since this is a secondary list.
function StepGlyph({ step, size = 15 }: { step: RouteStep; size?: number }) {
  if (step.instruction.includes("arrived")) return <CheckCircle2 size={size} />
  if (step.floorChange) return <ArrowUpDown size={size} />
  return <Footprints size={size} />
}

// Apple Maps' route-preview shows each leg as its own card (e.g. "Walk to
// Abbey Wood station — 0.8 miles, about 18 min"). Surfacing route.steps the
// same way here, with the active leg highlighted once navigation starts.
function RouteStepsList({ steps, currentIndex }: { steps: RouteStep[]; currentIndex: number }) {
  return (
    <div className="mb-3 -mx-1 max-h-44 overflow-y-auto">
      {steps.map((step, i) => {
        const done = currentIndex >= 0 && i < currentIndex
        const active = i === currentIndex
        return (
          <div key={i} className={`flex items-center gap-3 px-1 py-2 rounded-lg ${active ? "bg-blue-50" : ""}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                done ? "bg-gray-100 text-gray-300" : active ? "bg-[#007AFF] text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              <StepGlyph step={step} />
            </div>
            <p className={`flex-1 min-w-0 text-sm truncate ${done ? "text-gray-400" : "text-gray-800 font-medium"}`}>
              {step.instruction}
            </p>
            {step.distance > 0 && (
              <span className={`text-xs flex-shrink-0 ${done ? "text-gray-300" : "text-gray-400"}`}>
                {fmtDistance(step.distance)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Apple Maps' "Directions" card: From/To rows joined by a line, a row of
// mode pills, the big route summary, and a green GO button.
function PreviewSheet({
  destination,
  route,
  travelMode,
  routeLoading,
  onTravelModeChange,
  onStart,
  onCancel,
  expanded,
}: {
  destination: Waypoint
  route: Route
  travelMode: TravelMode
  routeLoading: boolean
  onTravelModeChange: (mode: TravelMode) => void
  onStart: () => void
  onCancel: () => void
  expanded: boolean
}) {
  const icon = WAYPOINT_TYPE_ICONS[destination.type]

  return (
    <div className="px-4 pb-safe-bar">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-lg leading-tight truncate">{destination.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {WAYPOINT_TYPE_LABELS[destination.type]}
              {destination.description ? ` · ${destination.description}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0"
        >
          <X size={16} className="text-gray-600" />
        </button>
      </div>

      {/* From/To rows, Apple Maps style */}
      <div className="flex gap-3 mb-3">
        <div className="flex flex-col items-center w-3 pt-1.5 pb-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#007AFF] ring-[3px] ring-[#007AFF]/20 flex-shrink-0" />
          <div className="w-px flex-1 bg-gray-200 my-1" />
          <div
            className="w-2.5 h-2.5 flex-shrink-0"
            style={{ background: "#FF3B30", borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)" }}
          />
        </div>
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm font-medium text-gray-800">My Location</div>
          <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 truncate">
            {destination.name}
          </div>
        </div>
      </div>

      {/* Travel mode selector — only meaningful outdoors, where it changes the
          path and ETA. Indoor routes are always on foot. */}
      {route.outdoor && (
        <div className="flex gap-2 mb-3">
          {TRAVEL_MODES.map(({ mode, label, Icon }) => {
            const active = mode === travelMode
            return (
              <button
                key={mode}
                onClick={() => onTravelModeChange(mode)}
                aria-label={label}
                title={label}
                className={`flex-1 flex items-center justify-center rounded-xl py-2.5 transition-colors ${
                  active ? "bg-[#007AFF] text-white" : "bg-[#F2F2F7] text-gray-600"
                }`}
              >
                <Icon size={20} />
              </button>
            )
          })}
        </div>
      )}

      {/* Route summary */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-3xl font-bold text-gray-900 leading-tight">
            {routeLoading ? "—" : `${route.estimatedMinutes} min`}
          </p>
          <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
            <span>{routeLoading ? "—" : fmtDistance(route.totalDistance)}</span>
            {route.floorChanges > 0 && (
              <span className="flex items-center gap-1">
                <Layers size={13} />
                {route.floorChanges} lift{route.floorChanges > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && <RouteStepsList steps={route.steps} currentIndex={-1} />}

      <button
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 bg-[#34C759] text-white rounded-2xl py-3.5 text-lg font-bold tracking-wide active:scale-[0.98] transition-transform"
      >
        {routeLoading ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
        {routeLoading ? "Finding route…" : "GO"}
      </button>
    </div>
  )
}

// Apple Maps' active-navigation bottom bar: time remaining / arrival clock /
// distance remaining, plus a red circular End button.
function NavigatingSheet({
  destination,
  route,
  currentStepIndex,
  onStop,
  onOpenCamera,
  onScanQR,
  expanded,
}: {
  destination: Waypoint
  route: Route
  currentStepIndex: number
  onStop: () => void
  onOpenCamera: () => void
  onScanQR: () => void
  expanded: boolean
}) {
  const icon = WAYPOINT_TYPE_ICONS[destination.type]

  // Anchor the ETA clock to when this sheet first mounted (navigation start)
  // rather than calling Date.now() during render on every update.
  const [startTime] = useState(() => Date.now())

  const remainingDistance = route.steps.slice(currentStepIndex).reduce((sum, s) => sum + s.distance, 0)
  const remainingMinutes =
    route.totalDistance > 0
      ? Math.max(1, Math.round(route.estimatedMinutes * (remainingDistance / route.totalDistance)))
      : route.estimatedMinutes
  const arrival = new Date(startTime + remainingMinutes * 60000)
  const arrivalLabel = arrival.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  return (
    <div className="px-4 pb-safe-bar">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{icon}</span>
          <p className="font-semibold text-gray-900 text-sm truncate">{destination.name}</p>
        </div>
        <button
          onClick={onStop}
          aria-label="End navigation"
          className="w-9 h-9 bg-[#FF3B30] rounded-full flex items-center justify-center flex-shrink-0 shadow-sm active:scale-95 transition-transform"
        >
          <X size={18} className="text-white" strokeWidth={3} />
        </button>
      </div>

      <div className="flex items-end justify-between mb-3 px-1">
        <div className="text-left">
          <p className="text-3xl font-bold text-[#007AFF] leading-none">
            {remainingMinutes}
            <span className="text-base font-semibold"> min</span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-gray-900 leading-tight">{arrivalLabel}</p>
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">arrival</p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-gray-900 leading-tight">{fmtDistance(remainingDistance)}</p>
          <p className="text-[11px] text-gray-400 uppercase tracking-wide">remaining</p>
        </div>
      </div>

      {expanded && <RouteStepsList steps={route.steps} currentIndex={currentStepIndex} />}

      <div className="flex gap-2">
        <button
          onClick={onScanQR}
          className="flex-1 flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-2.5 text-sm font-semibold"
        >
          <QrCode size={16} />
          Scan to locate me
        </button>
        <button
          onClick={onOpenCamera}
          className="flex-1 flex items-center justify-center gap-2 bg-[#F2F2F7] text-gray-800 rounded-xl py-2.5 text-sm font-semibold"
        >
          <Camera size={16} />
          Live camera
        </button>
      </div>
    </div>
  )
}

// Apple Maps' collapsed sheet: a "Search Maps"-style pill plus a Favourites
// row of circular shortcuts.
function IdleSheet({
  onOpenSearch,
  onOpenCamera,
  onScanQR,
  waypoints,
  onSelectWaypoint,
}: {
  onOpenSearch: () => void
  onOpenCamera: () => void
  onScanQR: () => void
  waypoints: Waypoint[]
  onSelectWaypoint: (waypoint: Waypoint) => void
}) {
  const favourites = QUICK_ACCESS.map((q) => ({ ...q, waypoint: waypoints.find((w) => w.id === q.waypointId) })).filter(
    (q): q is typeof q & { waypoint: Waypoint } => !!q.waypoint
  )

  return (
    <div className="px-4 pb-safe-bar">
      <button
        onClick={onOpenSearch}
        className="w-full flex items-center gap-2.5 bg-[#F2F2F7] rounded-full px-4 py-3 mb-4"
      >
        <Search size={18} className="text-gray-400 flex-shrink-0" />
        <span className="text-gray-500 text-base">Search Wayfinder</span>
      </button>

      <div className="flex justify-between gap-1 mb-4">
        {favourites.map(({ waypoint, label, icon: Icon }) => (
          <button
            key={waypoint.id}
            onClick={() => onSelectWaypoint(waypoint)}
            className="flex flex-col items-center gap-1.5 flex-1 active:opacity-60"
          >
            <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center">
              <Icon size={20} className="text-[#007AFF]" />
            </div>
            <span className="text-xs text-gray-600 font-medium truncate w-full text-center">{label}</span>
          </button>
        ))}
        <button onClick={onOpenSearch} className="flex flex-col items-center gap-1.5 flex-1 active:opacity-60">
          <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center">
            <Plus size={20} className="text-[#007AFF]" />
          </div>
          <span className="text-xs text-gray-600 font-medium">More</span>
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onScanQR}
          className="flex-1 flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-2.5 text-sm font-semibold"
        >
          <QrCode size={16} />
          Scan QR code
        </button>
        <button
          onClick={onOpenCamera}
          className="flex-1 flex items-center justify-center gap-2 bg-[#F2F2F7] text-gray-800 rounded-xl py-2.5 text-sm font-semibold"
        >
          <Camera size={16} />
          Live camera
        </button>
      </div>
    </div>
  )
}
