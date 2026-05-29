"use client"

import { MapLocation, Route } from "@/lib/types"
import { WAYPOINT_TYPE_LABELS } from "@/lib/gosh-data"
import { Clock, MapPin, Building2, Camera, QrCode, X } from "lucide-react"

interface Props {
  destination: MapLocation | null
  route: Route | null
  isNavigating: boolean
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
  isNavigating,
  onStopNavigation,
  onOpenCamera,
  onScanQR,
  onOpenSearch,
  expanded,
  onToggleExpand,
}: Props) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-all duration-300 ${
        expanded ? "max-h-80" : "max-h-44"
      }`}
    >
      <div className="flex justify-center pt-2 pb-1 cursor-pointer" onClick={onToggleExpand}>
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      {isNavigating && destination && route ? (
        <NavigatingSheet
          destination={destination}
          route={route}
          onStop={onStopNavigation}
          onOpenCamera={onOpenCamera}
          onScanQR={onScanQR}
          expanded={expanded}
        />
      ) : (
        <IdleSheet onOpenSearch={onOpenSearch} onOpenCamera={onOpenCamera} onScanQR={onScanQR} />
      )}
    </div>
  )
}

function NavigatingSheet({
  destination,
  route,
  onStop,
  onOpenCamera,
  onScanQR,
  expanded,
}: {
  destination: MapLocation
  route: Route
  onStop: () => void
  onOpenCamera: () => void
  onScanQR: () => void
  expanded: boolean
}) {
  const where = [destination.building, destination.floorLabel, destination.sideLabel]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="px-4 pb-safe-bar">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl flex-shrink-0">{destination.icon}</span>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-base leading-tight truncate">{destination.name}</p>
            <p className="text-xs text-gray-500 truncate">{where || WAYPOINT_TYPE_LABELS[destination.type]}</p>
          </div>
        </div>
        <button onClick={onStop} className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
          <X size={16} className="text-red-600" />
        </button>
      </div>

      <div className="flex gap-3 mb-3">
        <Stat icon={<Clock size={14} className="text-[#005EB8]" />} text={`${route.estimatedMinutes} min`} />
        <Stat
          icon={<MapPin size={14} className="text-[#005EB8]" />}
          text={route.totalDistance < 1000 ? `${route.totalDistance}m` : `${(route.totalDistance / 1000).toFixed(1)}km`}
        />
        {destination.building && destination.building !== "Site entrance" && (
          <Stat icon={<Building2 size={14} className="text-[#005EB8]" />} text={destination.floorLabel || "—"} />
        )}
      </div>

      {expanded && (
        <div className="mb-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5 leading-relaxed">
          {route.steps.map((s, i) => (
            <p key={i} className={i < route.steps.length - 1 ? "mb-1" : ""}>
              <span className="font-semibold text-[#005EB8]">{i + 1}.</span> {s.instruction}
              {s.distance > 0 ? ` (${s.distance}m)` : ""}
            </p>
          ))}
          {destination.access === "staff" && (
            <p className="mt-2 text-amber-700">⚠️ Staff-access area — ask at reception for directions.</p>
          )}
        </div>
      )}

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
          className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-800 rounded-xl py-2.5 text-sm font-semibold"
        >
          <Camera size={16} />
          Live camera
        </button>
      </div>
    </div>
  )
}

function Stat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-1.5">
      {icon}
      <span className="text-sm font-semibold text-[#005EB8]">{text}</span>
    </div>
  )
}

function IdleSheet({
  onOpenSearch,
  onOpenCamera,
  onScanQR,
}: {
  onOpenSearch: () => void
  onOpenCamera: () => void
  onScanQR: () => void
}) {
  return (
    <div className="px-4 pb-safe-bar">
      <button
        onClick={onOpenSearch}
        className="w-full flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-3 mb-3"
      >
        <MapPin size={18} className="text-[#005EB8]" />
        <span className="text-gray-500 text-sm">Where do you want to go?</span>
      </button>

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
          className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-800 rounded-xl py-2.5 text-sm font-semibold"
        >
          <Camera size={16} />
          Live camera
        </button>
      </div>
    </div>
  )
}
