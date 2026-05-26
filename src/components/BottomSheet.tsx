"use client"

import { Waypoint, Route } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS } from "@/lib/gosh-data"
import { Clock, MapPin, Layers, Camera, QrCode, X, ChevronUp } from "lucide-react"

interface Props {
  destination: Waypoint | null
  route: Route | null
  currentFloor: number
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
  currentFloor,
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
        expanded ? "max-h-72" : "max-h-44"
      }`}
    >
      {/* Handle */}
      <div className="flex justify-center pt-2 pb-1 cursor-pointer" onClick={onToggleExpand}>
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      {isNavigating && destination && route ? (
        <NavigatingSheet
          destination={destination}
          route={route}
          currentFloor={currentFloor}
          onStop={onStopNavigation}
          onOpenCamera={onOpenCamera}
          onScanQR={onScanQR}
          expanded={expanded}
        />
      ) : (
        <IdleSheet
          onOpenSearch={onOpenSearch}
          onOpenCamera={onOpenCamera}
          onScanQR={onScanQR}
          currentFloor={currentFloor}
        />
      )}
    </div>
  )
}

function NavigatingSheet({
  destination,
  route,
  currentFloor,
  onStop,
  onOpenCamera,
  onScanQR,
  expanded,
}: {
  destination: Waypoint
  route: Route
  currentFloor: number
  onStop: () => void
  onOpenCamera: () => void
  onScanQR: () => void
  expanded: boolean
}) {
  const icon = WAYPOINT_TYPE_ICONS[destination.type]

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="font-bold text-gray-900 text-base leading-tight">{destination.name}</p>
            {destination.description && (
              <p className="text-xs text-gray-500">{destination.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={onStop}
          className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center"
        >
          <X size={16} className="text-red-600" />
        </button>
      </div>

      <div className="flex gap-4 mb-3">
        <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-1.5">
          <Clock size={14} className="text-[#005EB8]" />
          <span className="text-sm font-semibold text-[#005EB8]">{route.estimatedMinutes} min</span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-1.5">
          <MapPin size={14} className="text-[#005EB8]" />
          <span className="text-sm font-semibold text-[#005EB8]">
            {route.totalDistance < 1000 ? `${route.totalDistance}m` : `${(route.totalDistance / 1000).toFixed(1)}km`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-1.5">
          <Layers size={14} className="text-[#005EB8]" />
          <span className="text-sm font-semibold text-[#005EB8]">Floor {destination.floor}</span>
        </div>
      </div>

      {expanded && route.floorChanges > 0 && (
        <p className="text-xs text-gray-500 mb-3">
          {route.floorChanges} floor change{route.floorChanges > 1 ? "s" : ""} via lift
        </p>
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

function IdleSheet({
  onOpenSearch,
  onOpenCamera,
  onScanQR,
  currentFloor,
}: {
  onOpenSearch: () => void
  onOpenCamera: () => void
  onScanQR: () => void
  currentFloor: number
}) {
  return (
    <div className="px-4 pb-4">
      <button
        onClick={onOpenSearch}
        className="w-full flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-3 mb-3"
      >
        <MapPin size={18} className="text-[#005EB8]" />
        <span className="text-gray-500 text-sm">Where do you want to go?</span>
      </button>

      <div className="flex gap-2 mb-2">
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

      <div className="flex items-center justify-center gap-1.5">
        <Layers size={12} className="text-gray-400" />
        <p className="text-xs text-gray-400">
          You are on: <span className="font-semibold text-gray-600">
            {currentFloor === 0 ? "Ground Floor" : `Floor ${currentFloor}`}
          </span>
        </p>
      </div>
    </div>
  )
}
