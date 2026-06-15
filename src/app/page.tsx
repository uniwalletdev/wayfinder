"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Waypoint, NavigationState, SurveyTrail, Coordinates, Venue } from "@/lib/types"
import { getAvailableFloors, isInsideBuilding } from "@/lib/waypoint-meta"
import { DEFAULT_VENUE, SEED_VENUES, getVenueById, createVenue, type NewVenueInput } from "@/lib/venues"
import {
  loadUserVenues, saveUserVenues, loadActiveVenueId, saveActiveVenueId,
  loadVenueWaypoints, saveVenueWaypoints, loadVenueTrails, saveVenueTrails,
  loadVenueFloor, saveVenueFloor, migrateLegacyData, deleteUserVenue,
} from "@/lib/venue-store"
import { buildRoute, distanceMeters, fetchOutdoorRoute, isOutdoorDestination } from "@/lib/routing"
import type { TravelMode } from "@/lib/types"
import type { SurveyResult } from "@/components/SurveyMode"
import TopInstructionBar from "@/components/TopInstructionBar"
import BottomSheet from "@/components/BottomSheet"
import FloorSelector from "@/components/FloorSelector"
import SearchModal from "@/components/SearchModal"
import CameraOverlay from "@/components/CameraOverlay"
import SurveyModeComponent from "@/components/SurveyMode"
import VenuePicker from "@/components/VenuePicker"
import AuthModal from "@/components/AuthModal"
import RoleSelect, { type AppRole } from "@/components/RoleSelect"
import { useSupabaseSession } from "@/lib/supabase/use-session"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { fetchAccessibleVenues, createRemoteVenue, addRemoteWaypoints, deleteRemoteVenue } from "@/lib/supabase/venues-remote"
import { Layers, Navigation, ClipboardList, Search, MapPin, AlertCircle, ChevronDown, Home as HomeIcon, Compass } from "lucide-react"

const FloorPlanMap = dynamic(() => import("@/components/FloorPlanMap"), { ssr: false })
const Map3D = dynamic(() => import("@/components/Map3D"), { ssr: false })

type OverlayMode = "none" | "search" | "qr" | "live-camera" | "survey" | "venues" | "auth"
type GpsStatus = "requesting" | "active" | "denied"

// Minimal interface — avoids importing Leaflet types on the server
interface MapHandle {
  flyTo: (latlng: [number, number], zoom: number) => void
}

export default function Home() {
  const leafletMapRef = useRef<MapHandle | null>(null)
  const gpsActiveRef = useRef(false)

  // The place currently being navigated. The user can switch between seed
  // venues and ones they create, or map a brand-new place. Everything below
  // reads the active venue rather than hard-coded constants, so any mapped
  // place — public or private — renders and routes the same way.
  const [activeVenueId, setActiveVenueId] = useState<string>(DEFAULT_VENUE.id)
  const [userVenues, setUserVenues] = useState<Venue[]>([])
  const venue = useMemo(() => getVenueById(activeVenueId, userVenues) ?? DEFAULT_VENUE, [activeVenueId, userVenues])
  const allVenues = useMemo(() => [...SEED_VENUES, ...userVenues], [userVenues])

  // Accounts (optional). In local mode this is { user: null, cloudEnabled: false }
  // and nothing below changes. When signed in, venues sync to Supabase and the
  // public/private rules are enforced server-side by Row-Level Security.
  const { user, cloudEnabled } = useSupabaseSession()
  const cloud = cloudEnabled && !!user
  const isSeedVenue = (id: string) => SEED_VENUES.some((s) => s.id === id)

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

  // Visitors choose on entry whether they're here to find their way
  // ("explorer") or to survey and add areas to the map ("mapper"). Until they
  // pick, the role screen covers the app. The role only gates the mapping
  // tools — both can browse venues and navigate.
  const [role, setRole] = useState<AppRole | null>(null)

  // 2D (Leaflet floor plan) or 3D (MapLibre, tilted with extruded buildings).
  // Opens in 3D so the map reads like Apple/Google Maps; the auto-switch below
  // hands over to the 2D floor plan once you're inside a mapped building.
  const [mapView, setMapView] = useState<"2d" | "3d">("3d")
  // Transient pill explaining an automatic view change
  const [viewNotice, setViewNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // True when WE switched 3D→2D on entering the building, so we know to switch
  // back outdoors. A manual toggle clears it — the user's choice wins.
  const autoSwitchedRef = useRef(false)
  const prevIndoorsRef = useRef<boolean | null>(null)

  const showViewNotice = useCallback((text: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setViewNotice(text)
    noticeTimerRef.current = setTimeout(() => setViewNotice(null), 3500)
  }, [])

  const [overlay, setOverlay] = useState<OverlayMode>("none")
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("requesting")
  const [customWaypoints, setCustomWaypoints] = useState<Waypoint[]>([])
  const [surveyTrails, setSurveyTrails] = useState<SurveyTrail[]>([])

  // On first load, fold any pre-multi-venue data into the default venue, restore
  // the user's saved venues and which one they last had open, and load the
  // points/trails/floor mapped inside it. Switching venues afterwards reloads
  // data in the handler (goToVenue), so this stays a one-time hydration on mount.
  useEffect(() => {
    migrateLegacyData(DEFAULT_VENUE.id)
    const restored = loadUserVenues()
    const savedActive = loadActiveVenueId()
    const startId = savedActive && getVenueById(savedActive, restored) ? savedActive : DEFAULT_VENUE.id
    setUserVenues(restored)
    setActiveVenueId(startId)
    setCustomWaypoints(loadVenueWaypoints(startId))
    setSurveyTrails(loadVenueTrails(startId))
    const savedFloor = loadVenueFloor(startId)
    if (savedFloor !== null) setNavState((s) => ({ ...s, currentFloor: savedFloor }))
  }, [])

  // When signed in, the backend is the source of truth for the user's venues:
  // fetch the ones they're allowed to see (RLS-filtered) — each already carries
  // its waypoints — and use them in place of the local list. Sign-out reverts to
  // local in the handler. The fetch is async, so it never blocks local mode.
  useEffect(() => {
    if (!cloud) return
    let active = true
    fetchAccessibleVenues()
      .then((vs) => { if (active) setUserVenues(vs) })
      .catch((e) => console.warn("Could not load venues from the server:", e))
    return () => { active = false }
  }, [cloud])

  const allWaypoints = useMemo(() => [...venue.waypoints, ...customWaypoints], [venue, customWaypoints])
  const availableFloors = useMemo(() => getAvailableFloors(venue.floorPlans, allWaypoints), [venue, allWaypoints])

  // Any floor change — selector tap, QR scan, or finishing a survey — is
  // remembered for this venue, since GPS can't tell us which floor we're on.
  const setCurrentFloor = useCallback((floor: number) => {
    saveVenueFloor(activeVenueId, floor)
    setNavState((s) => ({ ...s, currentFloor: floor }))
  }, [activeVenueId])

  // Indoor/outdoor with hysteresis: you're "indoors" once inside the venue's
  // building footprint, and only "outdoors" again 25m clear of it — so a jittery
  // GPS fix at the entrance doesn't flap the view back and forth.
  const [indoors, setIndoors] = useState(false)
  useEffect(() => {
    const pos = navState.currentPosition
    if (!pos) return
    setIndoors((prev) =>
      prev ? isInsideBuilding(pos, venue.floorPlans, 25) : isInsideBuilding(pos, venue.floorPlans)
    )
  }, [navState.currentPosition, venue.floorPlans])

  // Auto-switch on the indoor/outdoor transition: 3D is great for finding the
  // building, but indoors the 2D floor plan is the clearer guide. Only restore
  // 3D outdoors if we were the ones who switched away from it. The first reading
  // counts as a transition for the indoors case, so opening the app already
  // inside a venue still drops to the floor plan.
  useEffect(() => {
    const prev = prevIndoorsRef.current
    prevIndoorsRef.current = indoors
    if (prev === indoors) return
    if (indoors) {
      setMapView((v) => {
        if (v !== "3d") return v
        autoSwitchedRef.current = true
        showViewNotice("You're indoors — switched to the floor plan")
        return "2d"
      })
    } else if (prev !== null && autoSwitchedRef.current) {
      autoSwitchedRef.current = false
      setMapView("3d")
      showViewNotice("Back outdoors — switched to 3D")
    }
  }, [indoors, showViewNotice])

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

  const useDemoLocation = useCallback(() => {
    setGpsStatus("active")
    setNavState((s) => ({ ...s, currentPosition: venue.center, positionAccuracy: 0 }))
    leafletMapRef.current?.flyTo([venue.center.lat, venue.center.lng], venue.defaultZoom)
  }, [venue])

  // Fetch a real street/footpath route for outdoor destinations and fold it in,
  // replacing the placeholder offline route. Aborts any earlier in-flight fetch.
  const refreshOutdoorRoute = useCallback(
    async (from: Coordinates, waypoint: Waypoint, mode: TravelMode) => {
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
      const position = navState.currentPosition ?? venue.center
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
    [venue, navState.currentPosition, navState.currentFloor, navState.travelMode, allWaypoints, refreshOutdoorRoute]
  )

  const handleTravelModeChange = useCallback(
    (mode: TravelMode) => {
      setNavState((s) => ({ ...s, travelMode: mode }))
      const dest = navState.destination
      if (!dest) return
      const from = navState.currentPosition ?? venue.center
      if (isOutdoorDestination(dest)) {
        void refreshOutdoorRoute(from, dest, mode)
      } else {
        const route = buildRoute(from, navState.currentFloor, dest, allWaypoints, mode)
        setNavState((s) => ({ ...s, route }))
      }
    },
    [venue, navState.destination, navState.currentPosition, navState.currentFloor, allWaypoints, refreshOutdoorRoute]
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
        const floor = parseInt(parts[floorIdx + 1])
        setGpsStatus("active")
        saveVenueFloor(activeVenueId, floor)
        setNavState((s) => ({
          ...s,
          currentFloor: floor,
          currentPosition: { lat: parseFloat(parts[latIdx + 1]), lng: parseFloat(parts[lngIdx + 1]) },
          positionAccuracy: 1,
        }))
      }
    } catch {}
  }, [activeVenueId])

  const handleSurveyComplete = useCallback(async (result: SurveyResult) => {
    setOverlay("none")
    // Stay on the floor the mapper ended the survey on — they're physically
    // there, so don't snap the app back to Ground.
    setCurrentFloor(result.endFloor)
    const newWaypoints = [...result.markedWaypoints, ...result.aiWaypoints]
    if (newWaypoints.length > 0) {
      if (cloud && !isSeedVenue(activeVenueId)) {
        // Cloud venue: persist to the backend (RLS checks write access). Show the
        // saved rows immediately; they're not also written to local storage, so
        // they won't double up against the venue's server-loaded waypoints.
        try {
          const saved = await addRemoteWaypoints(activeVenueId, newWaypoints)
          setCustomWaypoints((prev) => [...prev, ...saved])
        } catch (e) {
          console.warn("Could not sync points to the server:", e)
          setCustomWaypoints((prev) => [...prev, ...newWaypoints])
        }
      } else {
        // Seed venue or local mode: keep points on this device.
        setCustomWaypoints((prev) => {
          const next = [...prev, ...newWaypoints]
          saveVenueWaypoints(activeVenueId, next)
          return next
        })
      }
    }
    if (result.trails.length > 0) {
      setSurveyTrails((prev) => {
        const next = [...prev, ...result.trails]
        saveVenueTrails(activeVenueId, next)
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
  }, [cloud, activeVenueId, setCurrentFloor])

  // Switching place clears the current route and re-centres on the new venue, so
  // navigation state never leaks across venues. The floor restores to the last
  // one used in that venue (GPS can't sense floors), falling back to Ground.
  const goToVenue = useCallback((v: Venue) => {
    setActiveVenueId(v.id)
    saveActiveVenueId(v.id)
    setCustomWaypoints(loadVenueWaypoints(v.id))
    setSurveyTrails(loadVenueTrails(v.id))
    setOverlay("none")
    const savedFloor = loadVenueFloor(v.id) ?? 0
    setNavState((s) => ({ ...s, currentFloor: savedFloor, destination: null, route: null, currentStepIndex: 0, isNavigating: false }))
    leafletMapRef.current?.flyTo([v.center.lat, v.center.lng], v.defaultZoom)
  }, [])

  const handleSelectVenue = useCallback((id: string) => {
    const v = getVenueById(id, userVenues)
    if (v) goToVenue(v)
  }, [userVenues, goToVenue])

  const handleCreateVenue = useCallback(async (input: NewVenueInput) => {
    if (cloud) {
      // Stored server-side; the DB forces verified=false so a public place can't
      // self-verify. RLS ties ownership to the signed-in user.
      try {
        const v = await createRemoteVenue(input)
        setUserVenues((prev) => [...prev, v])
        goToVenue(v)
        alert(`“${v.name}” created. Tap “Map area” to walk through and add points to it.`)
      } catch (e) {
        alert(`Couldn't create the place on the server: ${e instanceof Error ? e.message : "error"}`)
      }
      return
    }
    const v = createVenue(input)
    setUserVenues((prev) => {
      const next = [...prev, v]
      saveUserVenues(next)
      return next
    })
    goToVenue(v)
    alert(`“${v.name}” created. Tap “Map area” to walk through and add points to it.`)
  }, [cloud, goToVenue])

  const handleDeleteVenue = useCallback(async (id: string) => {
    if (cloud && !isSeedVenue(id)) {
      try {
        await deleteRemoteVenue(id)
        setUserVenues((prev) => prev.filter((v) => v.id !== id))
      } catch (e) {
        alert(`Couldn't delete on the server: ${e instanceof Error ? e.message : "error"}`)
        return
      }
    } else {
      deleteUserVenue(id)
      setUserVenues(loadUserVenues())
    }
    // If the open venue was deleted, fall back to the default and reload its map.
    if (activeVenueId === id) goToVenue(DEFAULT_VENUE)
  }, [cloud, activeVenueId, goToVenue])

  const handleSignOut = useCallback(async () => {
    await getSupabaseBrowserClient()?.auth.signOut()
    // Back to local venues; onAuthStateChange clears the user, disabling cloud.
    setUserVenues(loadUserVenues())
    setOverlay("none")
    goToVenue(DEFAULT_VENUE)
  }, [goToVenue])

  const currentStep = navState.route?.steps[navState.currentStepIndex] ?? null

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-gray-100">
      {mapView === "2d" ? (
        <FloorPlanMap
          currentFloor={navState.currentFloor}
          currentPosition={navState.currentPosition}
          destination={navState.destination}
          route={navState.route}
          isNavigating={navState.isNavigating}
          center={venue.center}
          defaultZoom={venue.defaultZoom}
          floorPlans={venue.floorPlans}
          waypoints={allWaypoints}
          trails={surveyTrails}
          onMapReady={() => {}}
          leafletMapRef={leafletMapRef}
        />
      ) : (
        <Map3D
          currentFloor={navState.currentFloor}
          currentPosition={navState.currentPosition}
          destination={navState.destination}
          route={navState.route}
          isNavigating={navState.isNavigating}
          center={venue.center}
          defaultZoom={venue.defaultZoom}
          floorPlans={venue.floorPlans}
          waypoints={allWaypoints}
          trails={surveyTrails}
          dimBuildings={indoors || (!!navState.destination && !isOutdoorDestination(navState.destination))}
          onMapReady={() => {}}
          leafletMapRef={leafletMapRef}
        />
      )}

      {/* ── Top bar ──────────────────────────────────────────── */}
      {!navState.isNavigating ? (
        <div className="absolute top-0 left-0 right-0 z-50">
          {/* Venue selector + home + search bar */}
          <div className="bg-[#005EB8] px-4 pt-safe-bar pb-3">
            <button
              onClick={() => setOverlay("venues")}
              className="flex items-center gap-1.5 mb-2 max-w-full text-white"
            >
              <MapPin size={14} className="flex-shrink-0 opacity-90" />
              <span className="text-sm font-semibold truncate">{venue.name}</span>
              <ChevronDown size={16} className="flex-shrink-0 opacity-90" />
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRole(null)}
                className="w-11 h-11 flex-shrink-0 bg-white rounded-full shadow flex items-center justify-center"
                title="Back to start — choose Explorer or Mapper"
                aria-label="Back to start screen"
              >
                <HomeIcon size={20} className="text-[#005EB8]" />
              </button>
              <button
                onClick={() => setOverlay("search")}
                className="flex-1 flex items-center gap-3 bg-white rounded-full px-4 py-3 shadow"
              >
                <Search size={18} className="text-[#005EB8] flex-shrink-0" />
                <span className="flex-1 text-left text-gray-400 text-sm">
                  {navState.destination ? navState.destination.name : "Where are you going?"}
                </span>
                <MapPin size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            </div>
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
                onClick={useDemoLocation}
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
          title={venue.name}
          subtitle={venue.subtitle}
        />
      )}

      <FloorSelector
        floors={availableFloors}
        currentFloor={navState.currentFloor}
        onChange={setCurrentFloor}
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

      {/* Auto view-switch notice */}
      {viewNotice && (
        <div className="absolute top-[12.5rem] left-1/2 -translate-x-1/2 z-50 bg-gray-900/85 text-white text-xs font-medium rounded-full px-4 py-2 shadow-lg whitespace-nowrap">
          {viewNotice}
        </div>
      )}

      {/* Floor badge */}
      <div className={`absolute ${navState.isNavigating ? "top-20" : "top-36"} left-1/2 -translate-x-1/2 z-40 bg-white/90 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm`}>
        <Layers size={12} className="text-[#005EB8]" />
        <span className="text-xs text-gray-700 font-semibold">
          {navState.currentFloor === 0 ? "Ground Floor" : `Floor ${navState.currentFloor}`}
        </span>
      </div>

      {/* Role chip — shows how you entered, tap to switch */}
      {!navState.isNavigating && role && (
        <button
          onClick={() => setRole(null)}
          className="absolute top-48 left-3 z-40 bg-white/90 rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-sm"
          title="Switch between Explorer and Mapper"
        >
          {role === "mapper" ? (
            <ClipboardList size={12} className="text-[#005EB8]" />
          ) : (
            <Compass size={12} className="text-[#005EB8]" />
          )}
          <span className="text-xs text-gray-700 font-semibold">
            {role === "mapper" ? "Mapper" : "Explorer"}
          </span>
        </button>
      )}

      {/* Survey / self-map FAB — mappers only */}
      {!navState.isNavigating && role === "mapper" && (
        <button
          onClick={() => setOverlay("survey")}
          className="absolute left-3 bottom-68 z-50 h-12 px-4 bg-[#005EB8] text-white rounded-full shadow-lg flex items-center gap-2 font-semibold text-sm"
          title="Survey Mode — map an area yourself"
        >
          <ClipboardList size={20} />
          Map area
        </button>
      )}

      {/* 2D / 3D view toggle */}
      {!navState.isNavigating && (
        <button
          onClick={() => {
            autoSwitchedRef.current = false
            setMapView((v) => (v === "2d" ? "3d" : "2d"))
          }}
          className="absolute left-3 bottom-52 z-50 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200 text-sm font-bold text-[#005EB8]"
          title={mapView === "2d" ? "Switch to 3D view" : "Switch to 2D view"}
        >
          {mapView === "2d" ? "3D" : "2D"}
        </button>
      )}

      {/* Recenter FAB — hidden while navigating, where the follow-aware
          re-centre control inside the map takes over. */}
      {!navState.isNavigating && (
        <button
          onClick={() => {
            const pos = navState.currentPosition ?? venue.center
            leafletMapRef.current?.flyTo([pos.lat, pos.lng], venue.defaultZoom)
          }}
          className="absolute left-3 bottom-36 z-50 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200"
          title="Re-centre"
        >
          <Navigation size={20} className="text-[#005EB8]" />
        </button>
      )}

      <BottomSheet
        destination={navState.destination}
        route={navState.route}
        currentFloor={navState.currentFloor}
        isNavigating={navState.isNavigating}
        travelMode={navState.travelMode}
        routeLoading={routeLoading}
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
        <SearchModal
          waypoints={allWaypoints}
          quickAccess={venue.quickAccess}
          onSelect={handleDestinationSelect}
          onClose={() => setOverlay("none")}
        />
      )}

      {overlay === "venues" && (
        <VenuePicker
          venues={allVenues}
          activeVenueId={activeVenueId}
          currentCenter={navState.currentPosition ?? venue.center}
          hasGps={gpsStatus === "active" && navState.currentPosition !== null && navState.positionAccuracy > 0}
          cloudEnabled={cloudEnabled}
          userEmail={user?.email ?? null}
          onSignIn={() => setOverlay("auth")}
          onSignOut={handleSignOut}
          onSelect={handleSelectVenue}
          onCreate={handleCreateVenue}
          onDelete={handleDeleteVenue}
          onClose={() => setOverlay("none")}
        />
      )}

      {overlay === "auth" && (
        <AuthModal onClose={() => setOverlay("venues")} onAuthed={() => setOverlay("venues")} />
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
          venueCenter={venue.center}
          venueName={venue.subtitle ?? venue.name}
          onClose={() => setOverlay("none")}
          onSurveyComplete={handleSurveyComplete}
        />
      )}

      {role === null && <RoleSelect onSelect={setRole} />}
    </div>
  )
}
