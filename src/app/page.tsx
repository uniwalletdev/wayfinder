"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback } from "react"
import { Waypoint, NavigationState, SurveyFrame } from "@/lib/types"
import { GOSH_CENTER } from "@/lib/gosh-data"
import { buildRoute } from "@/lib/routing"
import { GOSH_WAYPOINTS } from "@/lib/gosh-data"
import TopInstructionBar from "@/components/TopInstructionBar"
import BottomSheet from "@/components/BottomSheet"
import FloorSelector from "@/components/FloorSelector"
import SearchModal from "@/components/SearchModal"
import CameraOverlay from "@/components/CameraOverlay"
import SurveyModeComponent from "@/components/SurveyMode"
import { Layers, Navigation, ClipboardList } from "lucide-react"

const FloorPlanMap = dynamic(() => import("@/components/FloorPlanMap"), { ssr: false })

type OverlayMode = "none" | "search" | "qr" | "live-camera" | "survey"

export default function Home() {
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
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) {
      setNavState((s) => ({ ...s, currentPosition: GOSH_CENTER, positionAccuracy: 15 }))
      return
    }
    setLocating(true)
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLocating(false)
        setNavState((s) => ({
          ...s,
          currentPosition: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          positionAccuracy: pos.coords.accuracy,
        }))
      },
      () => {
        setLocating(false)
        setNavState((s) => ({ ...s, currentPosition: GOSH_CENTER, positionAccuracy: 15 }))
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const handleDestinationSelect = useCallback(
    (waypoint: Waypoint) => {
      setOverlay("none")
      const position = navState.currentPosition ?? GOSH_CENTER
      const route = buildRoute(position, navState.currentFloor, waypoint, GOSH_WAYPOINTS)
      setNavState((s) => ({
        ...s,
        destination: waypoint,
        route,
        currentStepIndex: 0,
        isNavigating: true,
      }))
    },
    [navState.currentPosition, navState.currentFloor]
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
        setNavState((s) => ({
          ...s,
          currentFloor: parseInt(parts[floorIdx + 1]),
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
    <div className="relative w-full h-screen overflow-hidden bg-gray-100">
      <FloorPlanMap
        currentFloor={navState.currentFloor}
        currentPosition={navState.currentPosition}
        destination={navState.destination}
        route={navState.route}
        isNavigating={navState.isNavigating}
        onMapReady={() => {}}
      />

      <TopInstructionBar
        step={currentStep}
        stepIndex={navState.currentStepIndex}
        totalSteps={navState.route?.steps.length ?? 0}
        isNavigating={navState.isNavigating}
      />

      <FloorSelector
        currentFloor={navState.currentFloor}
        onChange={(floor) => setNavState((s) => ({ ...s, currentFloor: floor }))}
      />

      {/* Accuracy badge */}
      {navState.positionAccuracy > 0 && (
        <div className="absolute top-20 left-3 z-50 bg-white/90 rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${
            navState.positionAccuracy <= 5 ? "bg-green-500"
            : navState.positionAccuracy <= 15 ? "bg-yellow-500"
            : "bg-red-400"
          }`} />
          <span className="text-xs text-gray-600 font-medium">±{Math.round(navState.positionAccuracy)}m</span>
        </div>
      )}

      {/* Floor badge */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-white/90 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm">
        <Layers size={12} className="text-[#005EB8]" />
        <span className="text-xs text-gray-700 font-semibold">
          {navState.currentFloor === 0 ? "Ground Floor" : `Floor ${navState.currentFloor}`}
        </span>
      </div>

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
        <SearchModal onSelect={handleDestinationSelect} onClose={() => setOverlay("none")} />
      )}

      {(overlay === "qr" || overlay === "live-camera") && (
        <CameraOverlay
          mode={overlay === "qr" ? "qr" : "live"}
          onQRDetected={handleQRDetected}
          onClose={() => setOverlay("none")}
          onFrameCapture={overlay === "live-camera" ? (d) => console.log("frame", d.length) : undefined}
        />
      )}

      {overlay === "survey" && (
        <SurveyModeComponent
          currentFloor={navState.currentFloor}
          onClose={() => setOverlay("none")}
          onSurveyComplete={handleSurveyComplete}
        />
      )}

      {locating && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl px-6 py-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#005EB8] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-700 font-medium">Finding your location…</p>
        </div>
      )}
    </div>
  )
}
