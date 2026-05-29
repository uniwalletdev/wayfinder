"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useRef } from "react"
import { MapLocation, NavigationState, SurveyFrame } from "@/lib/types"
import { GOSH_CENTER, ACTIVE_SITE, getBuilding } from "@/lib/gosh-data"
import { buildRoute } from "@/lib/routing"
import TopInstructionBar from "@/components/TopInstructionBar"
import BottomSheet from "@/components/BottomSheet"
import SearchModal from "@/components/SearchModal"
import CameraOverlay from "@/components/CameraOverlay"
import SurveyModeComponent from "@/components/SurveyMode"
import { Navigation, ClipboardList, Search, MapPin, AlertCircle } from "lucide-react"

const FloorPlanMap = dynamic(() => import("@/components/FloorPlanMap"), { ssr: false })

type OverlayMode = "none" | "search" | "qr" | "live-camera" | "survey"
type GpsStatus = "requesting" | "active" | "denied"

interface MapHandle {
  flyTo: (latlng: [number, number], zoom: number) => void
}

export default function Home() {
  const leafletMapRef = useRef<MapHandle | null>(null)
  const gpsActiveRef = useRef(false)

  const [navState, setNavState] = useState<NavigationState>({
    currentPosition: null,
    destination: null,
    route: null,
    currentStepIndex: 0,
    isNavigating: false,
    positionAccuracy: 0,
  })

  const [overlay, setOverlay] = useState<OverlayMode>("none")
  const [searchSeed, setSearchSeed] = useState("")
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("requesting")

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("denied")
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const firstFix = !gpsActiveRef.current
        gpsActiveRef.current = true
        setGpsStatus("active")
        setNavState((s) => ({
          ...s,
          currentPosition: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          positionAccuracy: pos.coords.accuracy,
        }))
        if (firstFix) {
          leafletMapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 18)
        }
      },
      () => {
        if (!gpsActiveRef.current) setGpsStatus("denied")
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const useDemo = useCallback(() => {
    setGpsStatus("active")
    setNavState((s) => ({ ...s, currentPosition: GOSH_CENTER, positionAccuracy: 0 }))
    leafletMapRef.current?.flyTo([GOSH_CENTER.lat, GOSH_CENTER.lng], 18)
  }, [])

  const handleDestinationSelect = useCallback(
    (location: MapLocation) => {
      setOverlay("none")
      setSearchSeed("")
      const position = navState.currentPosition ?? GOSH_CENTER
      const route = buildRoute(position, location)
      setNavState((s) => ({
        ...s,
        destination: location,
        route,
        currentStepIndex: 0,
        isNavigating: true,
      }))
    },
    [navState.currentPosition]
  )

  const handleStopNavigation = useCallback(() => {
    setNavState((s) => ({ ...s, destination: null, route: null, currentStepIndex: 0, isNavigating: false }))
  }, [])

  const handleSelectBuilding = useCallback((buildingId: string) => {
    const b = getBuilding(buildingId)
    if (b) {
      setSearchSeed(b.name)
      setOverlay("search")
    }
  }, [])

  const handleQRDetected = useCallback((data: string) => {
    try {
      const parts = data.split(":")
      const latIdx = parts.indexOf("lat")
      const lngIdx = parts.indexOf("lng")
      if (latIdx >= 0 && lngIdx >= 0) {
        setGpsStatus("active")
        setNavState((s) => ({
          ...s,
          currentPosition: { lat: parseFloat(parts[latIdx + 1]), lng: parseFloat(parts[lngIdx + 1]) },
          positionAccuracy: 1,
        }))
      }
    } catch {}
  }, [])

  const handleSurveyComplete = useCallback((frames: SurveyFrame[]) => {
    setOverlay("none")
    alert(`Survey complete — ${frames.length} frames captured and ready to upload.`)
  }, [])

  const currentStep = navState.route?.steps[navState.currentStepIndex] ?? null

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-gray-100">
      <FloorPlanMap
        currentPosition={navState.currentPosition}
        destination={navState.destination}
        route={navState.route}
        isNavigating={navState.isNavigating}
        onMapReady={() => {}}
        onSelectBuilding={handleSelectBuilding}
        leafletMapRef={leafletMapRef}
      />

      {/* ── Top bar ──────────────────────────────────────────── */}
      {!navState.isNavigating ? (
        <div className="absolute top-0 left-0 right-0 z-50">
          <div className="bg-[#005EB8] px-4 pt-safe-bar pb-3">
            <button
              onClick={() => {
                setSearchSeed("")
                setOverlay("search")
              }}
              className="w-full flex items-center gap-3 bg-white rounded-full px-4 py-3 shadow"
            >
              <Search size={18} className="text-[#005EB8] flex-shrink-0" />
              <span className="flex-1 text-left text-gray-400 text-sm">
                {navState.destination ? navState.destination.name : `Search ${ACTIVE_SITE.shortName}…`}
              </span>
              <MapPin size={16} className="text-gray-300 flex-shrink-0" />
            </button>
          </div>

          {gpsStatus === "requesting" && (
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[#005EB8] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-xs text-[#005EB8]">Finding your location…</span>
            </div>
          )}
          {gpsStatus === "denied" && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-700 flex-1">GPS unavailable — browse destinations or use demo mode</span>
              <button onClick={useDemo} className="text-xs font-bold text-[#005EB8] whitespace-nowrap ml-2">
                Use demo
              </button>
            </div>
          )}
        </div>
      ) : (
        <TopInstructionBar
          step={currentStep}
          stepIndex={navState.currentStepIndex}
          totalSteps={navState.route?.steps.length ?? 0}
          isNavigating={navState.isNavigating}
        />
      )}

      {/* Site badge */}
      <div className={`absolute ${navState.isNavigating ? "top-20" : "top-36"} left-1/2 -translate-x-1/2 z-40 bg-white/90 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm`}>
        <MapPin size={12} className="text-[#005EB8]" />
        <span className="text-xs text-gray-700 font-semibold">{ACTIVE_SITE.shortName}</span>
      </div>

      {/* GPS accuracy badge */}
      {gpsStatus === "active" && (
        <div className="absolute top-36 left-3 z-40 bg-white/90 rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${navState.positionAccuracy === 0 ? "bg-blue-400" : navState.positionAccuracy <= 5 ? "bg-green-500" : navState.positionAccuracy <= 15 ? "bg-yellow-500" : "bg-red-400"}`} />
          <span className="text-xs text-gray-600 font-medium">
            {navState.positionAccuracy === 0 ? "Demo" : `±${Math.round(navState.positionAccuracy)}m`}
          </span>
        </div>
      )}

      {/* Survey FAB */}
      {!navState.isNavigating && (
        <button
          onClick={() => setOverlay("survey")}
          className="absolute left-3 bottom-52 z-50 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200"
          title="Survey Mode"
        >
          <ClipboardList size={20} className="text-[#005EB8]" />
        </button>
      )}

      {/* Recenter FAB */}
      <button
        onClick={() => {
          const pos = navState.currentPosition ?? GOSH_CENTER
          leafletMapRef.current?.flyTo([pos.lat, pos.lng], 18)
        }}
        className="absolute left-3 bottom-36 z-50 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200"
        title="Re-centre"
      >
        <Navigation size={20} className="text-[#005EB8]" />
      </button>

      <BottomSheet
        destination={navState.destination}
        route={navState.route}
        isNavigating={navState.isNavigating}
        onStopNavigation={handleStopNavigation}
        onOpenCamera={() => setOverlay("live-camera")}
        onScanQR={() => setOverlay("qr")}
        onOpenSearch={() => {
          setSearchSeed("")
          setOverlay("search")
        }}
        expanded={bottomSheetExpanded}
        onToggleExpand={() => setBottomSheetExpanded((v) => !v)}
      />

      {overlay === "search" && (
        <SearchModal initialQuery={searchSeed} onSelect={handleDestinationSelect} onClose={() => setOverlay("none")} />
      )}

      {(overlay === "qr" || overlay === "live-camera") && (
        <CameraOverlay
          mode={overlay === "qr" ? "qr" : "live"}
          onQRDetected={handleQRDetected}
          onClose={() => setOverlay("none")}
          onFrameCapture={overlay === "live-camera" ? () => {} : undefined}
        />
      )}

      {overlay === "survey" && (
        <SurveyModeComponent
          currentFloor={0}
          currentPosition={navState.currentPosition}
          onClose={() => setOverlay("none")}
          onSurveyComplete={handleSurveyComplete}
        />
      )}
    </div>
  )
}
