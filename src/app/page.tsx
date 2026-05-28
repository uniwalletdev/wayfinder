"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Waypoint, NavigationState, SurveyFrame, Coordinates } from "@/lib/types"
import { buildRoute } from "@/lib/routing"
import { deadReckon } from "@/lib/positioning"
import TopInstructionBar from "@/components/TopInstructionBar"
import BottomSheet from "@/components/BottomSheet"
import FloorSelector from "@/components/FloorSelector"
import SearchModal from "@/components/SearchModal"
import CameraOverlay from "@/components/CameraOverlay"
import SurveyModeComponent from "@/components/SurveyMode"
import VenueSelector, { VenueInfo } from "@/components/VenueSelector"
import AddLocationPanel from "@/components/AddLocationPanel"
import { Layers, Navigation, ClipboardList, ArrowUpDown, Building2, Plus } from "lucide-react"

const FloorPlanMap = dynamic(() => import("@/components/FloorPlanMap"), { ssr: false })

type OverlayMode = "none" | "search" | "qr" | "live-camera" | "survey" | "venue-select" | "add-location"

// DB waypoint row → Waypoint type
function rowToWaypoint(r: Record<string, unknown>): Waypoint {
  return {
    id: String(r.id),
    name: r.name as string,
    type: r.type as Waypoint["type"],
    floor: Number(r.floor),
    coordinates: { lat: Number(r.lat), lng: Number(r.lng) },
    description: r.description as string | undefined,
    qrCode: r.qr_code as string | undefined,
  }
}

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
  const [locating, setLocating] = useState(true)
  const [locationError, setLocationError] = useState<"denied" | "unavailable" | "https" | null>(null)
  const [floorConfirm, setFloorConfirm] = useState<number | null>(null)
  const [venue, setVenue] = useState<VenueInfo | null>(null)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [isMoving, setIsMoving] = useState(false)
  const [tappedPoint, setTappedPoint] = useState<Coordinates | null>(null)

  // Dead reckoning refs
  const lastGPSFixRef = useRef<{ pos: Coordinates; time: number } | null>(null)
  const lastGPSUpdateRef = useRef<number>(0)
  const deadReckonTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Passive trace buffer
  const traceBufferRef = useRef<Array<{ lat: number; lng: number; heading: number; accuracy: number; floor: number; timestamp: number }>>([])
  const traceFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Detect motion via accelerometer
  useEffect(() => {
    if (typeof window === "undefined") return
    let lastMag = 0
    function handleMotion(e: DeviceMotionEvent) {
      const a = e.acceleration
      if (!a) return
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2)
      const delta = Math.abs(mag - lastMag)
      lastMag = mag
      setIsMoving(delta > 0.3) // threshold: 0.3 m/s² change = walking
    }
    window.addEventListener("devicemotion", handleMotion)
    return () => window.removeEventListener("devicemotion", handleMotion)
  }, [])

  // Dead reckoning — runs every second when GPS is stale (>5s) and user is moving
  useEffect(() => {
    deadReckonTimerRef.current = setInterval(() => {
      const staleness = Date.now() - lastGPSUpdateRef.current
      if (staleness < 5000 || !lastGPSFixRef.current || !isMoving) return

      const estimated = deadReckon(
        lastGPSFixRef.current.pos,
        lastGPSFixRef.current.time,
        heading,
        isMoving
      )
      setNavState((s) => ({ ...s, currentPosition: estimated, positionAccuracy: 15 }))
    }, 1000)
    return () => {
      if (deadReckonTimerRef.current) clearInterval(deadReckonTimerRef.current)
    }
  }, [heading, isMoving])

  // Flush trace buffer to API every 30s
  useEffect(() => {
    traceFlushTimerRef.current = setInterval(() => {
      const buf = traceBufferRef.current.splice(0)
      if (buf.length === 0 || !venue) return
      fetch("/api/traces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue_id: venue.id, points: buf }),
      }).catch(() => {}) // fire-and-forget
    }, 30000)
    return () => {
      if (traceFlushTimerRef.current) clearInterval(traceFlushTimerRef.current)
    }
  }, [venue])

  // Geolocation
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.protocol === "http:" && window.location.hostname !== "localhost") {
      setLocationError("https")
      setLocating(false)
      return
    }
    if (!navigator.geolocation) {
      setLocationError("unavailable")
      setLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocating(false)
        setLocationError(null)
        lastGPSFixRef.current = { pos: coords, time: Date.now() }
        lastGPSUpdateRef.current = Date.now()
        setNavState((s) => ({ ...s, currentPosition: coords, positionAccuracy: pos.coords.accuracy }))
      },
      (err) => {
        setLocating(false)
        setLocationError(err.code === 1 ? "denied" : "unavailable")
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    )

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocating(false)
        setLocationError(null)
        lastGPSFixRef.current = { pos: coords, time: Date.now() }
        lastGPSUpdateRef.current = Date.now()
        setNavState((s) => ({ ...s, currentPosition: coords, positionAccuracy: pos.coords.accuracy }))

        // Buffer trace point
        traceBufferRef.current.push({
          lat: coords.lat, lng: coords.lng,
          heading, accuracy: pos.coords.accuracy,
          floor: navState.currentFloor,
          timestamp: Date.now(),
        })
      },
      (err) => { if (err.code === 1) setLocationError("denied") },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load waypoints when venue changes
  useEffect(() => {
    if (!venue) return
    fetch(`/api/venues/${venue.id}/waypoints`)
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) setWaypoints(rows.map(rowToWaypoint))
      })
      .catch(() => {})
  }, [venue])

  // Compass
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      const h = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      if (h != null) setHeading(h)
      else if (e.alpha != null) setHeading(360 - e.alpha)
    }
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof DOE.requestPermission !== "function") {
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

  const handleVenueSelect = useCallback((v: VenueInfo) => {
    setVenue(v)
    setOverlay("none")
  }, [])

  const handleDestinationSelect = useCallback(
    (waypoint: Waypoint) => {
      setOverlay("none")
      if (!navState.currentPosition) return
      const route = buildRoute(navState.currentPosition, navState.currentFloor, waypoint, waypoints)
      setNavState((s) => ({ ...s, destination: waypoint, route, currentStepIndex: 0, isNavigating: true }))
    },
    [navState.currentPosition, navState.currentFloor, waypoints]
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
        const newPos = { lat: parseFloat(parts[latIdx + 1]), lng: parseFloat(parts[lngIdx + 1]) }
        lastGPSFixRef.current = { pos: newPos, time: Date.now() }
        lastGPSUpdateRef.current = Date.now()
        setNavState((s) => ({
          ...s,
          currentFloor: parseInt(parts[floorIdx + 1]),
          currentPosition: newPos,
          positionAccuracy: 1,
          currentStepIndex: s.route?.steps[s.currentStepIndex]?.floorChange ? s.currentStepIndex + 1 : s.currentStepIndex,
        }))
        setFloorConfirm(null)
      }
    } catch {}
  }, [])

  // Map tap: when adding a location, set the pin point; otherwise "I'm here" correction
  const handleMapTap = useCallback((coords: Coordinates) => {
    if (overlay === "add-location") {
      setTappedPoint(coords)
      return
    }
    if (navState.isNavigating) return // don't hijack taps during navigation
    lastGPSFixRef.current = { pos: coords, time: Date.now() }
    lastGPSUpdateRef.current = Date.now()
    setNavState((s) => ({ ...s, currentPosition: coords, positionAccuracy: 5 }))
  }, [navState.isNavigating, overlay])

  const handleLocationAdded = useCallback((w: Waypoint) => {
    setWaypoints((prev) => [...prev, w])
    setTappedPoint(null)
  }, [])

  const currentStep = navState.route?.steps[navState.currentStepIndex] ?? null
  useEffect(() => {
    if (currentStep?.floorChange && floorConfirm === null) {
      setFloorConfirm(currentStep.floorChange.to)
    }
  }, [currentStep, floorConfirm])

  const handleFloorConfirmed = useCallback(() => {
    if (floorConfirm === null) return
    setNavState((s) => ({ ...s, currentFloor: floorConfirm, currentStepIndex: s.currentStepIndex + 1 }))
    setFloorConfirm(null)
  }, [floorConfirm])

  const handleSurveyComplete = useCallback(async (frames: SurveyFrame[]) => {
    setOverlay("none")
    if (!venue || frames.length === 0) return
    try {
      await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id: venue.id,
          frames: frames.map((f) => ({
            floor: f.floor,
            coordinates: f.coordinates,
            heading: f.heading,
            annotation: f.annotation,
            imageData: f.imageData,
            timestamp: f.timestamp,
          })),
        }),
      })
    } catch {}
  }, [venue])

  // Map center: use current GPS or fallback — map flies to GPS once acquired
  const mapCenter: Coordinates = navState.currentPosition ?? { lat: 51.505, lng: -0.09 }

  // Floors available: from venue's declared floor count, plus any floor with waypoints
  const venueFloors = useMemo(() => {
    const set = new Set<number>([0])
    if (venue?.floors) for (let i = 0; i < venue.floors; i++) set.add(i)
    waypoints.forEach((w) => set.add(w.floor))
    set.add(navState.currentFloor)
    return [...set].sort((a, b) => a - b)
  }, [venue, waypoints, navState.currentFloor])

  // Show venue selector if no venue chosen and GPS is ready
  const showVenueSelector = !locating && !venue && overlay !== "venue-select"

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-100">
      <FloorPlanMap
        currentFloor={navState.currentFloor}
        currentPosition={navState.currentPosition}
        initialCenter={mapCenter}
        heading={heading}
        destination={navState.destination}
        route={navState.route}
        isNavigating={navState.isNavigating}
        waypoints={waypoints}
        onMapTap={handleMapTap}
        onMapReady={() => {}}
      />

      <TopInstructionBar
        step={currentStep}
        stepIndex={navState.currentStepIndex}
        totalSteps={navState.route?.steps.length ?? 0}
        isNavigating={navState.isNavigating}
      />

      <FloorSelector
        floors={venueFloors}
        currentFloor={navState.currentFloor}
        onChange={(floor) => setNavState((s) => ({ ...s, currentFloor: floor }))}
      />

      {/* Venue badge */}
      {venue && (
        <button
          onClick={() => setOverlay("venue-select")}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-white/95 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm max-w-[60vw]"
        >
          <Building2 size={12} className="text-[#005EB8] flex-shrink-0" />
          <span className="text-xs text-gray-700 font-semibold truncate">{venue.name}</span>
        </button>
      )}

      {/* Location error banner */}
      {locationError && (
        <div className="absolute top-16 left-3 right-3 z-50 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 shadow-sm">
          {locationError === "denied" && (
            <p className="text-xs text-amber-800 font-medium">
              📍 Location blocked — go to <strong>Settings → Safari → Location</strong> and allow, then reload.
            </p>
          )}
          {locationError === "https" && (
            <p className="text-xs text-amber-800 font-medium">
              🔒 Location requires HTTPS. Open via your secure deployment URL.
            </p>
          )}
          {locationError === "unavailable" && (
            <p className="text-xs text-amber-800 font-medium">
              📍 Tap the map to set your position manually.
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

      {/* Floor change confirmation */}
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
                ✓ I&apos;m on Floor {floorConfirm === 0 ? "G" : floorConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Location FAB */}
      {!navState.isNavigating && venue && overlay === "none" && (
        <button
          onClick={() => { setTappedPoint(null); setOverlay("add-location") }}
          className="absolute left-3 bottom-[17rem] z-50 px-4 h-12 bg-[#005EB8] rounded-full shadow-lg flex items-center justify-center gap-1.5 text-white font-semibold text-sm"
          title="Add a location"
        >
          <Plus size={18} />
          Add location
        </button>
      )}

      {/* Survey FAB */}
      {!navState.isNavigating && venue && (
        <button
          onClick={() => setOverlay("survey")}
          className="absolute left-3 bottom-52 z-50 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200"
          title="Survey Mode"
        >
          <ClipboardList size={20} className="text-[#005EB8]" />
        </button>
      )}

      {/* Recenter / compass */}
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
        venueName={venue?.name}
        onStopNavigation={handleStopNavigation}
        onOpenCamera={() => setOverlay("live-camera")}
        onScanQR={() => setOverlay("qr")}
        onOpenSearch={() => venue ? setOverlay("search") : setOverlay("venue-select")}
        onSelectVenue={() => setOverlay("venue-select")}
        expanded={bottomSheetExpanded}
        onToggleExpand={() => setBottomSheetExpanded((v) => !v)}
      />

      {/* Venue selector overlay */}
      {(overlay === "venue-select" || showVenueSelector) && navState.currentPosition && (
        <VenueSelector
          userPosition={navState.currentPosition}
          onSelectVenue={handleVenueSelect}
          onClose={venue ? () => setOverlay("none") : undefined}
        />
      )}

      {overlay === "search" && venue && (
        <SearchModal waypoints={waypoints} onSelect={handleDestinationSelect} onClose={() => setOverlay("none")} />
      )}

      {(overlay === "qr" || overlay === "live-camera") && (
        <CameraOverlay
          mode={overlay === "qr" ? "qr" : "live"}
          onQRDetected={handleQRDetected}
          onClose={() => setOverlay("none")}
          onFrameCapture={overlay === "live-camera" ? (d) => console.log("frame", d.length) : undefined}
        />
      )}

      {overlay === "survey" && venue && (
        <SurveyModeComponent
          currentFloor={navState.currentFloor}
          currentPosition={navState.currentPosition}
          heading={heading}
          onClose={() => setOverlay("none")}
          onSurveyComplete={handleSurveyComplete}
        />
      )}

      {overlay === "add-location" && venue && (
        <AddLocationPanel
          venueId={venue.id}
          currentFloor={navState.currentFloor}
          position={tappedPoint ?? navState.currentPosition}
          accuracy={tappedPoint ? 2 : navState.positionAccuracy}
          usingTappedPoint={tappedPoint !== null}
          onClose={() => { setTappedPoint(null); setOverlay("none") }}
          onAdded={handleLocationAdded}
        />
      )}

      {locating && (
        <div className="absolute inset-0 z-[400] bg-white flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-3 border-[#005EB8] border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
          <p className="text-base font-semibold text-gray-700">Finding your location…</p>
          <p className="text-sm text-gray-400">Please allow location access</p>
        </div>
      )}
    </div>
  )
}
