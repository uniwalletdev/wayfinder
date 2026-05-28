"use client"

import { Waypoint, Route } from "@/lib/types"
import { Clock, MapPin, Layers, Camera, QrCode, X, ChevronUp, Building2 } from "lucide-react"

const WAYPOINT_TYPE_ICONS: Record<string, string> = {
  ward: "🏥", department: "🏢", lift: "🛗", stairs: "🪜",
  toilet: "🚻", exit: "🚪", reception: "📋", canteen: "🍽️",
  pharmacy: "💊", other: "📍",
}

interface Props {
  destination: Waypoint | null
  route: Route | null
  currentFloor: number
  isNavigating: boolean
  venueName?: string
  onStopNavigation: () => void
  onOpenCamera: () => void
  onScanQR: () => void
  onOpenSearch: () => void
  onSelectVenue: () => void
  expanded: boolean
  onToggleExpand: () => void
}

export default function BottomSheet({
  destination, route, currentFloor, isNavigating, venueName,
  onStopNavigation, onOpenCamera, onScanQR, onOpenSearch, onSelectVenue,
  expanded, onToggleExpand,
}: Props) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-all duration-300 ${
        expanded ? "max-h-72" : "max-h-44"
      }`}
    >
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
          venueName={venueName}
          onOpenSearch={onOpenSearch}
          onOpenCamera={onOpenCamera}
          onScanQR={onScanQR}
          onSelectVenue={onSelectVenue}
          currentFloor={currentFloor}
        />
      )}
    </div>
  )
}

function NavigatingSheet({
  destination, route, currentFloor, onStop, onOpenCamera, onScanQR, expanded,
}: {
  destination: Waypoint; route: Route; currentFloor: number
  onStop: () => void; onOpenCamera: () => void; onScanQR: () => void; expanded: boolean
}) {
  const icon = WAYPOINT_TYPE_ICONS[destination.type] ?? "📍"
  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="font-bold text-gray-900 text-base leading-tight">{destination.name}</p>
            {destination.description && <p className="text-xs text-gray-500">{destination.description}</p>}
          </div>
        </div>
        <button onClick={onStop} className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
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
          <span className="text-sm font-semibold text-[#005EB8]">Floor {destination.floor === 0 ? "G" : destination.floor}</span>
        </div>
      </div>

      {expanded && route.floorChanges > 0 && (
        <p className="text-xs text-gray-500 mb-3">
          {route.floorChanges} floor change{route.floorChanges > 1 ? "s" : ""} via lift
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={onScanQR} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#005EB8] to-[#0072E3] text-white rounded-full py-3 text-sm font-bold shadow-md shadow-blue-200 active:scale-[0.98] transition-transform">
          <QrCode size={16} />Scan to locate me
        </button>
        <button onClick={onOpenCamera} className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-800 rounded-full py-3 text-sm font-bold active:scale-[0.98] transition-transform">
          <Camera size={16} />Live camera
        </button>
      </div>
    </div>
  )
}

function IdleSheet({
  venueName, onOpenSearch, onOpenCamera, onScanQR, onSelectVenue, currentFloor,
}: {
  venueName?: string; onOpenSearch: () => void; onOpenCamera: () => void
  onScanQR: () => void; onSelectVenue: () => void; currentFloor: number
}) {
  const actions = [
    { key: "qr",     label: "Scan QR",  onClick: onScanQR,     Icon: QrCode,    accent: true  },
    { key: "camera", label: "Camera",   onClick: onOpenCamera, Icon: Camera,    accent: false },
    { key: "venue",  label: "Places",   onClick: onSelectVenue, Icon: Building2, accent: false },
  ]
  return (
    <div className="px-4 pb-5">
      {/* search pill */}
      <button
        onClick={onOpenSearch}
        className="w-full flex items-center gap-3 bg-gray-100 rounded-full px-5 py-3.5 mb-5 shadow-sm active:bg-gray-200 transition-colors"
      >
        <MapPin size={18} className="text-[#005EB8] flex-shrink-0" />
        <span className="text-gray-500 text-sm font-medium truncate">
          {venueName ? `Where in ${venueName}?` : "Select a place to navigate…"}
        </span>
      </button>

      {/* circular quick actions */}
      <div className="flex items-start justify-around mb-1">
        {actions.map(({ key, label, onClick, Icon, accent }) => (
          <button key={key} onClick={onClick} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
            <span
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${
                accent
                  ? "bg-gradient-to-br from-[#005EB8] to-[#0072E3] shadow-blue-200"
                  : "bg-gray-100"
              }`}
            >
              <Icon size={22} className={accent ? "text-white" : "text-gray-700"} />
            </span>
            <span className="text-[11px] font-semibold text-gray-600">{label}</span>
          </button>
        ))}

        {/* floor indicator chip */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center shadow-md">
            <span className="text-base font-extrabold text-[#005EB8]">
              {currentFloor === 0 ? "G" : currentFloor}
            </span>
          </span>
          <span className="text-[11px] font-semibold text-gray-600">Floor</span>
        </div>
      </div>
    </div>
  )
}
