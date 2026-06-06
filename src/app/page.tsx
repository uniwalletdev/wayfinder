"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Waypoint, NavigationState, SurveyTrail } from "@/lib/types"
import { GOSH_CENTER, GOSH_WAYPOINTS, getAvailableFloors } from "@/lib/gosh-data"
import { loadCustomWaypoints, saveCustomWaypoints, loadSurveyTrails, saveSurveyTrails } from "@/lib/custom-waypoints"
import { buildRoute } from "@/lib/routing"
import type { SurveyResult } from "@/components/SurveyMode"
import TopInstructionBar from "@/components/TopInstructionBar"
import BottomSheet from "@/components/BottomSheet"
import FloorSelector from "@/components/FloorSelector"
import SearchModal from "@/components/SearchModal"
import CameraOverlay from "@/components/CameraOverlay"
import SurveyModeComponent from "@/components/SurveyMode"
import { Layers, Navigation, ClipboardList, Search, MapPin, AlertCircle } from "lucide-react"

const FloorPlanMap = dynamic(() => import("@/components/FloorPlanMap"), { ssr: false })

type OverlayMode = "none" | "search" | "qr" | "live-camera" | "survey"
type GpsStatus = "requesting" | "active" | "denied"

// Minimal interface — avoids importing Leaflet types on the server
interface MapHandle {
  flyTo: (latlng: [number, number], zoom: number) => void
}

export default function Home() {
  const leafletMapRef = useRef<MapHandle | null>(null)
  const gpsActiveRef = useRef(false)

  const [navState, setNavState] = useState<NavigationState>({
    currentPosition: null,
    currentFloor: 0,
    destination: null,
    route: null,
    currentStepIndex: 0,
    isNavigating: false,
    positionAccuracy: 0,
  })

  const [overlay, setOverlay] = useState<OverlayMode>("none")
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("requesting")
  const [customWaypoints, setCustomWaypoints] = useState<Waypoint[]>([])
  const [surveyTrails, setSurveyTrails] = useState<SurveyTrail[]>([])

  // Restore user-mapped locations and walked trails from previous sessions.
  useEffect(() => {
    setCustomWaypoints(loadCustomWaypoints())
    setSurveyTrails(loadSurveyTrails())
  }, [])

  const allWaypoints = useMemo(() => [...GOSH_WAYPOINTS, ...customWaypoints], [customWaypoints])
  const availableFloors = useMemo(() => getAvailableFloors(allWaypoints), [allWaypoints])

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
        // Centre the map on the user the first time we get a real fix, so it works anywhere
        if (firstFix) {
          leafletMapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 18)
        }
      },
      () => {
        // Don't downgrade to denied once we have a live fix
        if (!gpsActiveRef.current) setGpsStatus("denied")
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const useGoshDemo = useCallback(() => {
    setGpsStatus("active")
    setNavState((s) => ({ ...s, currentPosition: GOSH_CENTER, positionAccuracy: 0 }))
    leafletMapRef.current?.flyTo([GOSH_CENTER.lat, GOSH_CENTER.lng], 18)
  }, [])

  const handleDestinationSelect = useCallback(
    (waypoint: Waypoint) => {
      setOverlay("none")
      const position = navState.currentPosition ?? GOSH_CENTER
      const route = buildRoute(position, navState.currentFloor, waypoint, allWaypoints)
      setNavState((s) => ({
        ...s,
        destination: waypoint,
        route,
        currentStepIndex: 0,
        isNavigating: true,
      }))
    },
    [navState.currentPosition, navState.currentFloor, allWaypoints]
  )

  const handleStopNavigation = useCallback(() => {
    setNavState((s) => ({
      ...s,
      destination: null,
      route: null,
      currentStepIndex: 0,
      isNavigating: false,
    }))
  }, [])

  const handleQRDetected = useCallback((data: string) => {
    try {
      const parts = data.split(":")
      const floorIdx = parts.indexOf("floor")
      const latIdx = parts.indexOf("lat")
      const lngIdx = parts.indexOf("lng")
      if (floorIdx >= 0 && latIdx >= 0 && lngIdx >= 0) {
        setGpsStatus("active")
        setNavState((s) => ({
          ...s,
          currentFloor: parseInt(parts[floorIdx + 1]),
          currentPosition: { lat: parseFloat(parts[latIdx + 1]), lng: parseFloat(parts[lngIdx + 1]) },
          positionAccuracy: 1,
        }))
      }
    } catch {}
  }, [])

  const handleSurveyComplete = useCallback((result: SurveyResult) => {
    setOverlay("none")
    const newWaypoints = [...result.markedWaypoints, ...result.aiWaypoints]
    if (newWaypoints.length > 0) {
      setCustomWaypoints((prev) => {
        const next = [...prev, ...newWaypoints]
        saveCustomWaypoints(next)
        return next
      })
    }
    if (result.trail) {
      setSurveyTrails((prev) => {
        const next = [...prev, result.trail!]
        saveSurveyTrails(next)
        return next
      })
    }

    const marked = result.markedWaypoints.length
    const detected = result.aiWaypoints.length
    const parts: string[] = []
    if (marked > 0) parts.push(`${marked} marked`)
    if (detected > 0) parts.push(`${detected} read from the footage`)

    let message: string
    if (parts.length > 0) {
      message = `Survey complete — ${parts.join(" and ")} location${marked + detected !== 1 ? "s" : ""} added to the map.`
    } else if (result.aiError === "not_configured") {
      message = "Survey saved. AI sign-reading isn't enabled on the server, so nothing was auto-detected — use “Mark Location” to add points yourself."
    } else if (result.aiError) {
      message = "Survey saved, but the footage couldn't be read this time. Try again, or use “Mark Location” to add points yourself."
    } else {
      message = "Survey complete — no clear signs were found in the footage. Try keeping signs and door plates in view, or use “Mark Location”."
    }
    alert(message)
  }, [])

  const currentStep = navState.route?.steps[navState.currentStepIndex] ?? null

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-gray-100">
      <FloorPlanMap
        currentFloor={navState.currentFloor}
        currentPosition={navState.currentPosition}
        destination={navState.destination}
        route={navState.route}
        isNavigating={navState.isNavigating}
        waypoints={allWaypoints}
        trails={surveyTrails}
        onMapReady={() => {}}
        leafletMapRef={leafletMapRef}
      />

      {/* ── Top bar ──────────────────────────────────────────── */}
      {!navState.isNavigating ? (
        <div className="absolute top-0 left-0 right-0 z-50">
          {/* Search bar */}
          <div className="bg-[#005EB8] px-4 pt-safe-bar pb-3">
            <button
              onClick={() => setOverlay("search")}
              className="w-full flex items-center gap-3 bg-white rounded-full px-4 py-3 shadow"
            >
              <Search size={18} className="text-[#005EB8] flex-shrink-0" />
              <span className="flex-1 text-left text-gray-400 text-sm">
                {navState.destination ? navState.destination.name : "Where are you going?"}
              </span>
              <MapPin size={16} className="text-gray-300 flex-shrink-0" />
            </button>
          </div>

          {/* GPS status strip */}
          {gpsStatus === "requesting" && (
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[#005EB8] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-xs text-[#005EB8]">Finding your location…</span>
            </div>
          )}
          {gpsStatus === "denied" && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-700 flex-1">
                GPS unavailable — browse destinations or use demo mode
              </span>
              <button
                onClick={useGoshDemo}
                className="text-xs font-bold text-[#005EB8] whitespace-nowrap ml-2"
              >
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

      <FloorSelector
        floors={availableFloors}
        currentFloor={navState.currentFloor}
        onChange={(floor) => setNavState((s) => ({ ...s, currentFloor: floor }))}
      />

      {/* GPS accuracy badge */}
      {gpsStatus === "active" && (
        <div className="absolute top-36 left-3 z-40 bg-white/90 rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${navState.positionAccuracy === 0 ? "bg-blue-400" : navState.positionAccuracy <= 5 ? "bg-green-500" : navState.positionAccuracy <= 15 ? "bg-yellow-500" : "bg-red-400"}`} />
          <span className="text-xs text-gray-600 font-medium">
            {navState.positionAccuracy === 0 ? "Demo" : `±${Math.round(navState.positionAccuracy)}m`}
          </span>
        </div>
      )}

      {/* Floor badge */}
      <div className={`absolute ${navState.isNavigating ? "top-20" : "top-36"} left-1/2 -translate-x-1/2 z-40 bg-white/90 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm`}>
        <Layers size={12} className="text-[#005EB8]" />
        <span className="text-xs text-gray-700 font-semibold">
          {navState.currentFloor === 0 ? "Ground Floor" : `Floor ${navState.currentFloor}`}
        </span>
      </div>

      {/* Survey / self-map FAB */}
      {!navState.isNavigating && (
        <button
          onClick={() => setOverlay("survey")}
          className="absolute left-3 bottom-52 z-50 h-12 px-4 bg-[#005EB8] text-white rounded-full shadow-lg flex items-center gap-2 font-semibold text-sm"
          title="Survey Mode — map an area yourself"
        >
          <ClipboardList size={20} />
          Map area
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
        currentFloor={navState.currentFloor}
        isNavigating={navState.isNavigating}
        onStopNavigation={handleStopNavigation}
        onOpenCamera={() => setOverlay("live-camera")}
        onScanQR={() => setOverlay("qr")}
        onOpenSearch={() => setOverlay("search")}
        expanded={bottomSheetExpanded}
        onToggleExpand={() => setBottomSheetExpanded((v) => !v)}
      />

      {overlay === "search" && (
        <SearchModal waypoints={allWaypoints} onSelect={handleDestinationSelect} onClose={() => setOverlay("none")} />
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
          currentFloor={navState.currentFloor}
          currentPosition={navState.currentPosition}
          onClose={() => setOverlay("none")}
          onSurveyComplete={handleSurveyComplete}
        />
      )}
    </div>
  )
}
