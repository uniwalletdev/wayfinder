"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useRef } from "react"
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
import { Layers, Navigation, ClipboardList, ArrowUpDown } from "lucide-react"

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

  const [heading, setHeading] = useState(0)
  const [overlay, setOverlay] = useState<OverlayMode>("none")
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<"denied" | "unavailable" | "https" | null>(null)
  const [floorConfirm, setFloorConfirm] = useState<number | null>(null)

  // Geolocation
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.protocol === "http:" && window.location.hostname !== "localhost") {
      setLocationError("https")
      setNavState((s) => ({ ...s, currentPosition: GOSH_CENTER, positionAccuracy: 999 }))
      return
    }
    if (!navigator.geolocation) {
      setLocationError("unavailable")
      setNavState((s) => ({ ...s, currentPosition: GOSH_CENTER, positionAccuracy: 999 }))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setLocationError(null)
        setNavState((s) => ({
          ...s,
          currentPosition: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          positionAccuracy: pos.coords.accuracy,
        }))
      },
      (err) => {
        setLocating(false)
        setLocationError(err.code === 1 ? "denied" : "unavailable")
        setNavState((s) => ({ ...s, currentPosition: GOSH_CENTER, positionAccuracy: 999 }))
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    )
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLocating(false)
        setLocationError(null)
        setNavState((s) => ({
          ...s,
          currentPosition: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          positionAccuracy: pos.coords.accuracy,
        }))
      },
      (err) => { if (err.code === 1) setLocationError("denied") },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Device compass heading — iOS requires DeviceOrientationEvent permission
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      const h = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      if (h != null) setHeading(h)
      else if (e.alpha != null) setHeading(360 - e.alpha)
    }

    if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === "function") {
      // iOS 13+ — will request on first user interaction, handled by button below
    } else {
      window.addEventListener("deviceorientation", handleOrientation, true)
      return () => window.removeEventListener("deviceorientation", handleOrientation, true)
    }
  }, [])

  const requestCompass = useCallback(async () => {
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof DOE.requestPermission === "function") {
      const result = await DOE.requestPermission()
      if (result === "granted") {
        window.addEventListener("deviceorientation", (e: DeviceOrientationEvent) => {
          const h = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
          if (h != null) setHeading(h)
          else if (e.alpha != null) setHeading(360 - e.alpha)
        }, true)
      }
    }
  }, [])

  const handleDestinationSelect = useCallback(
    (waypoint: Waypoint) => {
      setOverlay("none")
      const position = navState.currentPosition ?? GOSH_CENTER
      const route = buildRoute(position, navState.currentFloor, waypoint, GOSH_WAYPOINTS)
      setNavState((s) => ({ ...s, destination: waypoint, route, currentStepIndex: 0, isNavigating: true }))
    },
    [navState.currentPosition, navState.currentFloor]
  )

  const handleStopNavigation = useCallback(() => {
    setNavState((s) => ({ ...s, destination: null, route: null, currentStepIndex: 0, isNavigating: false }))
    setFloorConfirm(null)
  }, [])

  const handleQRDetected = useCallback((data: string) => {
    try {
      const parts = data.split(":")
      const floorIdx = parts.indexOf("floor")
      const latIdx = parts.indexOf("lat")
      const lngIdx = parts.indexOf("lng")
      if (floorIdx >= 0 && latIdx >= 0 && lngIdx >= 0) {
        const newFloor = parseInt(parts[floorIdx + 1])
        setNavState((s) => ({
          ...s,
          currentFloor: newFloor,
          currentPosition: { lat: parseFloat(parts[latIdx + 1]), lng: parseFloat(parts[lngIdx + 1]) },
          positionAccuracy: 1,
          // Auto-advance past floor change step if navigating
          currentStepIndex: s.route?.steps[s.currentStepIndex]?.floorChange ? s.currentStepIndex + 1 : s.currentStepIndex,
        }))
        setFloorConfirm(null)
      }
    } catch {}
  }, [])

  // When navigation hits a floor change step — show confirm prompt
  const currentStep = navState.route?.steps[navState.currentStepIndex] ?? null
  useEffect(() => {
    if (currentStep?.floorChange && floorConfirm === null) {
      setFloorConfirm(currentStep.floorChange.to)
    }
  }, [currentStep, floorConfirm])

  const handleFloorConfirmed = useCallback(() => {
    if (floorConfirm === null) return
    setNavState((s) => ({
      ...s,
      currentFloor: floorConfirm,
      currentStepIndex: s.currentStepIndex + 1,
    }))
    setFloorConfirm(null)
  }, [floorConfirm])

  const handleSurveyComplete = useCallback((frames: SurveyFrame[]) => {
    setOverlay("none")
    alert(`Survey complete — ${frames.length} frames captured and ready to upload.`)
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-100">
      <FloorPlanMap
        currentFloor={navState.currentFloor}
        currentPosition={navState.currentPosition}
        heading={heading}
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

      {/* Location error banner */}
      {locationError && (
        <div className="absolute top-16 left-3 right-3 z-50 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 shadow-sm">
          {locationError === "denied" && (
            <p className="text-xs text-amber-800 font-medium">
              📍 Location blocked — go to <strong>Settings → Safari → Location</strong> and allow access, then reload.
            </p>
          )}
          {locationError === "https" && (
            <p className="text-xs text-amber-800 font-medium">
              🔒 Location requires HTTPS. Open the app via your secure deployment URL.
            </p>
          )}
          {locationError === "unavailable" && (
            <p className="text-xs text-amber-800 font-medium">
              📍 Could not get your location. Showing a default map position.
            </p>
          )}
        </div>
      )}

      {/* Accuracy badge */}
      {!locationError && navState.positionAccuracy > 0 && navState.positionAccuracy < 999 && (
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

      {/* Floor change confirmation prompt */}
      {floorConfirm !== null && (
        <div className="absolute bottom-48 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden slide-up">
          <div className="bg-[#003087] px-4 py-3 flex items-center gap-3">
            <ArrowUpDown size={20} className="text-white" />
            <p className="text-white font-bold text-sm">Floor change needed</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-gray-700 text-sm mb-3">
              Take the lift or stairs to{" "}
              <strong>{floorConfirm === 0 ? "Ground Floor" : `Floor ${floorConfirm}`}</strong>.
              Tap when you arrive.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOverlay("qr")}
                className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 text-sm font-semibold"
              >
                📷 Scan QR on wall
              </button>
              <button
                onClick={handleFloorConfirmed}
                className="flex-1 bg-[#005EB8] text-white rounded-xl py-2.5 text-sm font-bold"
              >
                ✓ I'm on Floor {floorConfirm === 0 ? "G" : floorConfirm}
              </button>
            </div>
          </div>
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

      {/* Recenter / compass button — also requests iOS compass permission */}
      <button
        onClick={requestCompass}
        className="absolute left-3 bottom-36 z-50 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200"
        title="Re-centre and enable compass"
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
