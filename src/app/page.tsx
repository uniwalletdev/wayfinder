"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useRef } from "react"
import { Waypoint, NavigationState, SurveyFrame, TransportMode, Venue, AppMode } from "@/lib/types"
import { buildRoute } from "@/lib/routing"
import { fetchOutdoorRoute } from "@/lib/outdoor-routing"
import {
  VENUE_REGISTRY,
  venueContaining,
  nearestVenue,
  isNearAnyVenue,
  venueOf,
  nearestEntrance,
  allWaypoints,
} from "@/lib/venue-registry"
import TopInstructionBar from "@/components/TopInstructionBar"
import BottomSheet from "@/components/BottomSheet"
import FloorSelector from "@/components/FloorSelector"
import SearchModal from "@/components/SearchModal"
import CameraOverlay from "@/components/CameraOverlay"
import SurveyModeComponent from "@/components/SurveyMode"
import TransportModeSelector from "@/components/TransportModeSelector"
import { Layers, Navigation, ClipboardList, Search, MapPin, AlertCircle, Building2 } from "lucide-react"

const FloorPlanMap = dynamic(() => import("@/components/FloorPlanMap"), { ssr: false })

type OverlayMode = "none" | "search" | "qr" | "live-camera" | "survey"
type GpsStatus = "requesting" | "active" | "denied"
interface MapHandle { flyTo: (latlng: [number, number], zoom: number) => void }

const CENTRAL_LONDON = { lat: 51.505, lng: -0.09 }

function makeEmptyNavState(): NavigationState {
  return {
    currentPosition: null, currentFloor: 0,
    destination: null, route: null,
    currentStepIndex: 0, isNavigating: false, positionAccuracy: 0,
  }
}

export default function Home() {
  const leafletMapRef   = useRef<MapHandle | null>(null)
  const gpsActiveRef    = useRef(false)
  // Refs so geofence callback always reads current values without stale closures
  const activeVenueRef  = useRef<Venue | null>(null)
  const appModeRef      = useRef<AppMode>("world")
  const isNavigatingRef = useRef(false)

  const [navState, setNavState]           = useState<NavigationState>(makeEmptyNavState())
  const [activeVenue, setActiveVenue]     = useState<Venue | null>(null)
  const [appMode, setAppMode]             = useState<AppMode>("world")
  const [transportMode, setTransportMode] = useState<TransportMode>("walking")
  const [overlay, setOverlay]             = useState<OverlayMode>("none")
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false)
  const [gpsStatus, setGpsStatus]         = useState<GpsStatus>("requesting")
  const [isLoadingOutdoor, setIsLoadingOutdoor] = useState(false)

  // Keep refs in sync with state
  useEffect(() => { activeVenueRef.current  = activeVenue },  [activeVenue])
  useEffect(() => { appModeRef.current      = appMode },      [appMode])
  useEffect(() => { isNavigatingRef.current = navState.isNavigating }, [navState.isNavigating])

  // ── Geofence transition helper ────────────────────────────────────────────
  const applyGeofence = useCallback((lat: number, lng: number) => {
    const pos = { lat, lng }
    const inside = venueContaining(pos)

    if (inside) {
      if (!activeVenueRef.current || activeVenueRef.current.id !== inside.id) {
        activeVenueRef.current = inside
        setActiveVenue(inside)
      }
      if (appModeRef.current !== "indoor") {
        appModeRef.current = "indoor"
        setAppMode("indoor")
      }
      return
    }

    // Not inside any footprint.  Apply hysteresis: stay put while within 50 m of footprint edge.
    if (activeVenueRef.current && isNearAnyVenue(pos, 50)) return

    // Clearly outside — transition depends on whether we have an active destination
    if (appModeRef.current === "indoor") {
      const next: AppMode = isNavigatingRef.current ? "approaching" : "world"
      appModeRef.current = next
      setAppMode(next)
      if (next === "world") {
        activeVenueRef.current = null
        setActiveVenue(null)
      }
    } else if (appModeRef.current === "world") {
      // Auto-wake approaching mode if a known venue is within 500 m
      const near = nearestVenue(pos, 500)
      if (near && !isNavigatingRef.current) {
        // Just proximity — don't set a venue yet; wait for user intent or entry
      }
    }
  }, [])

  // ── GPS watch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("denied"); return }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        const firstFix = !gpsActiveRef.current
        gpsActiveRef.current = true
        setGpsStatus("active")
        setNavState((s) => ({
          ...s,
          currentPosition: { lat: latitude, lng: longitude },
          positionAccuracy: accuracy,
        }))
        applyGeofence(latitude, longitude)
        if (firstFix) leafletMapRef.current?.flyTo([latitude, longitude], 17)
      },
      () => { if (!gpsActiveRef.current) setGpsStatus("denied") },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [applyGeofence])

  // ── Demo mode ─────────────────────────────────────────────────────────────
  const activateDemo = useCallback((venue: Venue) => {
    setGpsStatus("active")
    setNavState((s) => ({ ...s, currentPosition: venue.center, positionAccuracy: 0 }))
    setActiveVenue(venue)
    setAppMode("indoor")
    activeVenueRef.current = venue
    appModeRef.current = "indoor"
    leafletMapRef.current?.flyTo([venue.center.lat, venue.center.lng], 18)
  }, [])

  const handleDemoClick = useCallback(() => {
    // Demo from the first (or only) venue in the registry
    activateDemo(VENUE_REGISTRY[0])
  }, [activateDemo])

  // ── Destination selection (intent path) ──────────────────────────────────
  const handleDestinationSelect = useCallback(
    async (waypoint: Waypoint) => {
      setOverlay("none")

      const venue = venueOf(waypoint.id) ?? activeVenueRef.current
      const position = navState.currentPosition ?? venue?.center ?? CENTRAL_LONDON

      // Activate the venue this waypoint belongs to
      if (venue && (!activeVenueRef.current || activeVenueRef.current.id !== venue.id)) {
        activeVenueRef.current = venue
        setActiveVenue(venue)
      }

      // Determine mode: inside the venue → indoor; outside → approaching
      const posInVenue = venue ? venueContaining(position)?.id === venue.id : false
      const newMode: AppMode = posInVenue ? "indoor" : "approaching"
      appModeRef.current = newMode
      setAppMode(newMode)

      // Build indoor route immediately (synchronous, map responds at once)
      const graph      = venue?.navGraph ?? { nodes: {}, edges: [] }
      const waypoints  = venue?.waypoints ?? []
      const floor      = navState.currentFloor
      const route = buildRoute(position, floor, waypoint, waypoints, graph, transportMode)

      setNavState((s) => ({
        ...s,
        destination: waypoint,
        route,
        currentStepIndex: 0,
        isNavigating: true,
      }))

      // Outdoor leg: only if outside the venue and mode supports routing
      if (!posInVenue && transportMode !== "transit" && venue) {
        setIsLoadingOutdoor(true)
        const entrance = nearestEntrance(venue, position, transportMode === "wheelchair")
        const outdoorLeg = await fetchOutdoorRoute(position, entrance.coordinates, transportMode)
        setIsLoadingOutdoor(false)
        if (outdoorLeg) {
          setNavState((s) =>
            s.route ? { ...s, route: { ...s.route, outdoorLeg } } : s
          )
        }
      }
    },
    [navState.currentPosition, navState.currentFloor, transportMode]
  )

  // ── Stop navigation ───────────────────────────────────────────────────────
  const handleStopNavigation = useCallback(() => {
    setNavState((s) => ({
      ...s, destination: null, route: null, currentStepIndex: 0, isNavigating: false,
    }))
    setIsLoadingOutdoor(false)

    // Revert mode based on current position
    const pos = navState.currentPosition
    if (pos) {
      const inside = venueContaining(pos)
      if (inside) {
        appModeRef.current = "indoor"
        setAppMode("indoor")
      } else {
        activeVenueRef.current = null
        appModeRef.current = "world"
        setActiveVenue(null)
        setAppMode("world")
      }
    }
  }, [navState.currentPosition])

  // ── QR positioning ────────────────────────────────────────────────────────
  const handleQRDetected = useCallback((data: string) => {
    try {
      const parts   = data.split(":")
      const floorIdx = parts.indexOf("floor")
      const latIdx   = parts.indexOf("lat")
      const lngIdx   = parts.indexOf("lng")
      if (floorIdx >= 0 && latIdx >= 0 && lngIdx >= 0) {
        const lat   = parseFloat(parts[latIdx + 1])
        const lng   = parseFloat(parts[lngIdx + 1])
        const floor = parseInt(parts[floorIdx + 1])
        setGpsStatus("active")
        setNavState((s) => ({
          ...s, currentFloor: floor, currentPosition: { lat, lng }, positionAccuracy: 1,
        }))
        // QR always confirms indoor mode
        const inside = venueContaining({ lat, lng }) ?? nearestVenue({ lat, lng }, 100)?.venue
        if (inside) {
          activeVenueRef.current = inside
          setActiveVenue(inside)
        }
        appModeRef.current = "indoor"
        setAppMode("indoor")
      }
    } catch {}
  }, [])

  // ── Survey ────────────────────────────────────────────────────────────────
  const handleSurveyComplete = useCallback((_frames: SurveyFrame[]) => {
    setOverlay("none")
  }, [])

  // ── Rebuild route when transport mode changes mid-navigation ──────────────
  useEffect(() => {
    if (!navState.isNavigating || !navState.destination) return
    const venue    = activeVenueRef.current
    const position = navState.currentPosition ?? venue?.center ?? CENTRAL_LONDON
    const graph    = venue?.navGraph ?? { nodes: {}, edges: [] }
    const waypoints = venue?.waypoints ?? []
    const route = buildRoute(position, navState.currentFloor, navState.destination, waypoints, graph, transportMode)
    setNavState((s) => ({ ...s, route, currentStepIndex: 0 }))

    const posInVenue = venue ? venueContaining(position)?.id === venue.id : false
    if (!posInVenue && transportMode !== "transit" && venue) {
      setIsLoadingOutdoor(true)
      const entrance = nearestEntrance(venue, position, transportMode === "wheelchair")
      fetchOutdoorRoute(position, entrance.coordinates, transportMode).then((leg) => {
        setIsLoadingOutdoor(false)
        if (leg) setNavState((s) => s.route ? { ...s, route: { ...s.route, outdoorLeg: leg } } : s)
      })
    }
  }, [transportMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ────────────────────────────────────────────────────────
  const currentStep   = navState.route?.steps[navState.currentStepIndex] ?? null
  const showIndoorUI  = appMode === "indoor" || appMode === "approaching"
  const searchWaypoints = activeVenue
    ? activeVenue.waypoints
    : allWaypoints()

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-gray-100">
      <FloorPlanMap
        currentFloor={navState.currentFloor}
        currentPosition={navState.currentPosition}
        destination={navState.destination}
        route={navState.route}
        isNavigating={navState.isNavigating}
        floorPlans={activeVenue?.floorPlans ?? []}
        venueWaypoints={activeVenue?.waypoints ?? []}
        initialCenter={activeVenue?.center ?? CENTRAL_LONDON}
        onMapReady={() => {}}
        leafletMapRef={leafletMapRef}
        onRequestMap={() => setOverlay("survey")}
      />

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      {!navState.isNavigating ? (
        <div className="absolute top-0 left-0 right-0 z-50">
          <div className="bg-[#005EB8] px-4 pt-safe-bar pb-2">
            <button
              onClick={() => setOverlay("search")}
              className="w-full flex items-center gap-3 bg-white rounded-full px-4 py-3 shadow mb-2"
            >
              <Search size={18} className="text-[#005EB8] flex-shrink-0" />
              <span className="flex-1 text-left text-gray-400 text-sm">
                {activeVenue ? `Search ${activeVenue.name}` : "Search a hospital, building…"}
              </span>
              <MapPin size={16} className="text-gray-300 flex-shrink-0" />
            </button>
            <TransportModeSelector mode={transportMode} onChange={setTransportMode} />
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
              <span className="text-xs text-amber-700 flex-1">
                GPS unavailable — browse destinations or use demo mode
              </span>
              <button onClick={handleDemoClick} className="text-xs font-bold text-[#005EB8] whitespace-nowrap ml-2">
                Demo at GOSH
              </button>
            </div>
          )}

          {/* Venue context strip */}
          {activeVenue && appMode === "indoor" && (
            <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2">
              <Building2 size={13} className="text-[#005EB8]" />
              <span className="text-xs text-[#005EB8] font-semibold">{activeVenue.name}</span>
              <span className="text-xs text-gray-400 ml-auto">Indoor map active</span>
            </div>
          )}
        </div>
      ) : (
        <div className="absolute top-0 left-0 right-0 z-50">
          <TopInstructionBar
            step={currentStep}
            stepIndex={navState.currentStepIndex}
            totalSteps={navState.route?.steps.length ?? 0}
            isNavigating={navState.isNavigating}
          />
          {isLoadingOutdoor && (
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-1.5 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[#005EB8] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-xs text-[#005EB8]">Loading outdoor directions…</span>
            </div>
          )}
        </div>
      )}

      {/* Floor selector — only when a venue is active */}
      {showIndoorUI && (
        <FloorSelector
          floorPlans={activeVenue?.floorPlans ?? []}
          currentFloor={navState.currentFloor}
          onChange={(floor) => setNavState((s) => ({ ...s, currentFloor: floor }))}
        />
      )}

      {/* GPS accuracy badge */}
      {gpsStatus === "active" && (
        <div className="absolute top-36 left-3 z-40 bg-white/90 rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${
            navState.positionAccuracy === 0 ? "bg-blue-400"
            : navState.positionAccuracy <= 5 ? "bg-green-500"
            : navState.positionAccuracy <= 15 ? "bg-yellow-500"
            : "bg-red-400"
          }`} />
          <span className="text-xs text-gray-600 font-medium">
            {navState.positionAccuracy === 0 ? "Demo" : `±${Math.round(navState.positionAccuracy)}m`}
          </span>
        </div>
      )}

      {/* Floor badge — only in indoor/approaching */}
      {showIndoorUI && (
        <div className={`absolute ${navState.isNavigating ? "top-20" : "top-40"} left-1/2 -translate-x-1/2 z-40 bg-white/90 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm`}>
          <Layers size={12} className="text-[#005EB8]" />
          <span className="text-xs text-gray-700 font-semibold">
            {navState.currentFloor === 0 ? "Ground Floor" : `Floor ${navState.currentFloor}`}
          </span>
        </div>
      )}

      {/* Survey FAB — only when inside a venue */}
      {!navState.isNavigating && appMode === "indoor" && (
        <button
          onClick={() => setOverlay("survey")}
          className="absolute left-3 bottom-52 z-50 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200"
          title="Survey Mode — help map this area"
        >
          <ClipboardList size={20} className="text-[#005EB8]" />
        </button>
      )}

      {/* Recenter FAB */}
      <button
        onClick={() => {
          const pos = navState.currentPosition ?? activeVenue?.center ?? CENTRAL_LONDON
          leafletMapRef.current?.flyTo([pos.lat, pos.lng], 17)
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
        isLoadingOutdoor={isLoadingOutdoor}
        onStopNavigation={handleStopNavigation}
        onOpenCamera={() => setOverlay("live-camera")}
        onScanQR={() => setOverlay("qr")}
        onOpenSearch={() => setOverlay("search")}
        expanded={bottomSheetExpanded}
        onToggleExpand={() => setBottomSheetExpanded((v) => !v)}
      />

      {overlay === "search" && (
        <SearchModal
          waypoints={searchWaypoints}
          venueName={activeVenue?.name}
          quickAccessIds={activeVenue?.quickAccessIds}
          onSelect={handleDestinationSelect}
          onClose={() => setOverlay("none")}
        />
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
