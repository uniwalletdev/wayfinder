"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Waypoint, NavigationState, SurveyTrail } from "@/lib/types"
import { GOSH_CENTER, GOSH_WAYPOINTS, getAvailableFloors, floorLabel } from "@/lib/gosh-data"
import { loadCustomWaypoints, saveCustomWaypoints, loadSurveyTrails, saveSurveyTrails } from "@/lib/custom-waypoints"
import { buildRoute, distanceMeters, fetchOutdoorRoute, isOutdoorDestination } from "@/lib/routing"
import type { TravelMode } from "@/lib/types"
import type { SurveyResult } from "@/components/SurveyMode"
import TopInstructionBar from "@/components/TopInstructionBar"
import BottomSheet from "@/components/BottomSheet"
import FloorSelector from "@/components/FloorSelector"
import SearchModal from "@/components/SearchModal"
import CameraOverlay from "@/components/CameraOverlay"
import SurveyModeComponent from "@/components/SurveyMode"
import { LocateFixed, ClipboardList, AlertCircle } from "lucide-react"

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
    travelMode: "walking",
  })
  const [routeLoading, setRouteLoading] = useState(false)
  const dirAbortRef = useRef<AbortController | null>(null)

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

  // Fetch a real street/footpath route for outdoor destinations and fold it in,
  // replacing the placeholder offline route. Aborts any earlier in-flight fetch.
  const refreshOutdoorRoute = useCallback(
    async (from: typeof GOSH_CENTER, waypoint: Waypoint, mode: TravelMode) => {
      dirAbortRef.current?.abort()
      const ac = new AbortController()
      dirAbortRef.current = ac
      setRouteLoading(true)
      const real = await fetchOutdoorRoute(from, waypoint, mode, ac.signal)
      if (ac.signal.aborted) return
      setRouteLoading(false)
      if (real) {
        setNavState((s) => (s.destination?.id === waypoint.id ? { ...s, route: real } : s))
      }
    },
    []
  )

  // Selecting a destination shows a route *preview* (overview + travel mode +
  // ETA) — the user taps Start to begin turn-by-turn, rather than jumping
  // straight into navigation.
  const handleDestinationSelect = useCallback(
    (waypoint: Waypoint) => {
      setOverlay("none")
      const position = navState.currentPosition ?? GOSH_CENTER
      // Offline route renders instantly; outdoor destinations then upgrade to
      // real street geometry once Directions responds.
      const route = buildRoute(position, navState.currentFloor, waypoint, allWaypoints, navState.travelMode)
      setNavState((s) => ({
        ...s,
        destination: waypoint,
        route,
        currentStepIndex: 0,
        isNavigating: false,
      }))
      if (isOutdoorDestination(waypoint)) {
        void refreshOutdoorRoute(position, waypoint, navState.travelMode)
      }
    },
    [navState.currentPosition, navState.currentFloor, navState.travelMode, allWaypoints, refreshOutdoorRoute]
  )

  const handleTravelModeChange = useCallback(
    (mode: TravelMode) => {
      setNavState((s) => ({ ...s, travelMode: mode }))
      const dest = navState.destination
      if (!dest) return
      const from = navState.currentPosition ?? GOSH_CENTER
      if (isOutdoorDestination(dest)) {
        void refreshOutdoorRoute(from, dest, mode)
      } else {
        const route = buildRoute(from, navState.currentFloor, dest, allWaypoints, mode)
        setNavState((s) => ({ ...s, route }))
      }
    },
    [navState.destination, navState.currentPosition, navState.currentFloor, allWaypoints, refreshOutdoorRoute]
  )

  const handleStartNavigation = useCallback(() => {
    setNavState((s) => (s.route ? { ...s, isNavigating: true } : s))
  }, [])

  // Advance through the route as the user moves. A step is "done" once they are
  // within a few metres of its target waypoint (or, for a lift step, once they
  // reach the destination floor), which lets the guidance progress all the way
  // to "You have arrived" instead of staying frozen on the first instruction.
  const ARRIVE_RADIUS_M = 12
  useEffect(() => {
    if (!navState.currentPosition) return
    setNavState((s) => {
      if (!s.isNavigating || !s.route || !s.currentPosition) return s
      const steps = s.route.steps
      let idx = s.currentStepIndex
      while (idx < steps.length - 1) {
        const step = steps[idx]
        let reached: boolean
        if (step.floorChange) {
          reached = s.currentFloor === step.floorChange.to
        } else {
          const target = step.waypoint?.coordinates ?? s.destination?.coordinates
          reached = !!target && distanceMeters(s.currentPosition, target) <= ARRIVE_RADIUS_M
        }
        if (!reached) break
        idx++
      }
      return idx === s.currentStepIndex ? s : { ...s, currentStepIndex: idx }
    })
  }, [navState.currentPosition, navState.currentFloor])

  const handleStopNavigation = useCallback(() => {
    dirAbortRef.current?.abort()
    setRouteLoading(false)
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
    if (result.trails.length > 0) {
      setSurveyTrails((prev) => {
        const next = [...prev, ...result.trails]
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

      {/* ── Turn-by-turn banner — full-bleed map otherwise, Apple Maps style ── */}
      <TopInstructionBar
        step={currentStep}
        nextStep={navState.route?.steps[navState.currentStepIndex + 1] ?? null}
        stepIndex={navState.currentStepIndex}
        totalSteps={navState.route?.steps.length ?? 0}
        isNavigating={navState.isNavigating}
      />

      {/* Floating status pills, top-left */}
      {!navState.isNavigating && (
        <div className="absolute top-safe-fab left-3 z-40 flex flex-col items-start gap-2">
          {availableFloors.length > 1 && (
            <div className="bg-white/90 backdrop-blur rounded-full px-3 py-1.5 shadow-sm">
              <span className="text-xs font-semibold text-gray-700">{floorLabel(navState.currentFloor)}</span>
            </div>
          )}
          {gpsStatus === "requesting" && (
            <div className="bg-white/90 backdrop-blur rounded-full px-3 py-1.5 shadow-sm flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-xs text-gray-700">Finding your location…</span>
            </div>
          )}
          {gpsStatus === "denied" && (
            <div className="bg-white/90 backdrop-blur rounded-full px-3 py-1.5 shadow-sm flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
              <span className="text-xs text-gray-700">GPS unavailable</span>
              <button onClick={useGoshDemo} className="text-xs font-bold text-[#007AFF] whitespace-nowrap">
                Use demo
              </button>
            </div>
          )}
        </div>
      )}

      <FloorSelector
        floors={availableFloors}
        currentFloor={navState.currentFloor}
        onChange={(floor) => setNavState((s) => ({ ...s, currentFloor: floor }))}
      />

      {/* Floating controls above the bottom sheet, Apple Maps style — hidden
          once a destination is picked so they don't collide with the sheet. */}
      {!navState.isNavigating && !navState.destination && (
        <>
          <button
            onClick={() => setOverlay("survey")}
            className="absolute left-3 bottom-60 z-50 w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            title="Survey Mode — map an area yourself"
          >
            <ClipboardList size={20} className="text-[#007AFF]" />
          </button>

          <button
            onClick={() => {
              const pos = navState.currentPosition ?? GOSH_CENTER
              leafletMapRef.current?.flyTo([pos.lat, pos.lng], 18)
            }}
            className="absolute right-3 bottom-60 z-50 w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            title="Re-centre"
          >
            <LocateFixed size={20} className="text-[#007AFF]" />
          </button>
        </>
      )}

      <BottomSheet
        destination={navState.destination}
        route={navState.route}
        currentStepIndex={navState.currentStepIndex}
        isNavigating={navState.isNavigating}
        travelMode={navState.travelMode}
        routeLoading={routeLoading}
        waypoints={allWaypoints}
        onSelectWaypoint={handleDestinationSelect}
        onTravelModeChange={handleTravelModeChange}
        onStartNavigation={handleStartNavigation}
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
