"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Waypoint, NavigationState, SurveyTrail, Coordinates, Venue, FloorPlan, RoutePreference } from "@/lib/types"
import { getAvailableFloors, floorLabel } from "@/lib/waypoint-meta"
import { DEFAULT_VENUE, SEED_VENUES, getVenueById, createVenue, type NewVenueInput } from "@/lib/venues"
import {
  loadUserVenues, saveUserVenues, loadActiveVenueId, saveActiveVenueId,
  loadVenueWaypoints, saveVenueWaypoints, loadVenueTrails, saveVenueTrails,
  loadVenueFloorPlans, saveVenueFloorPlans,
  migrateLegacyData, deleteUserVenue,
} from "@/lib/venue-store"
import { buildRoute, distanceMeters, distanceToPath, fetchOutdoorRoute, shouldRouteOutdoors } from "@/lib/routing"
import type { TravelMode } from "@/lib/types"
import type { SurveyResult } from "@/components/SurveyMode"
import type { UploadPlanResult } from "@/components/UploadPlanMode"
import LeftPanel from "@/components/LeftPanel"
import MapControls from "@/components/MapControls"
import ShareDialog from "@/components/ShareDialog"
import FloorSelector from "@/components/FloorSelector"
import SearchModal from "@/components/SearchModal"
import CameraOverlay from "@/components/CameraOverlay"
import SurveyModeComponent from "@/components/SurveyMode"
import VenuePicker from "@/components/VenuePicker"
import AuthModal from "@/components/AuthModal"
import { useDeviceHeading } from "@/lib/use-heading"
import { usePedestrianPosition } from "@/lib/use-pedestrian-position"
import { useArSupport } from "@/lib/use-ar-support"
import { useSupabaseSession } from "@/lib/supabase/use-session"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { fetchAccessibleVenues, createRemoteVenue, addRemoteWaypoints, addRemoteFloorPlan, deleteRemoteVenue } from "@/lib/supabase/venues-remote"

const FloorPlanMap = dynamic(() => import("@/components/FloorPlanMap"), { ssr: false })
// The 3D half of the map's 2D/3D toggle. three.js is browser-only, and the
// chunk loads lazily the first time the user switches to 3D.
const Map3DView = dynamic(() => import("@/components/Map3DView"), { ssr: false })
// WebXR + three.js: only ever loaded in the browser, and only when the device
// actually supports immersive AR.
const ArNavView = dynamic(() => import("@/components/ArNavView"), { ssr: false })
// Statically imports Leaflet for the georeferencing mini-map, so — like
// FloorPlanMap — it must never be pulled into the server bundle.
const UploadPlanMode = dynamic(() => import("@/components/UploadPlanMode"), { ssr: false })

type OverlayMode = "none" | "search" | "qr" | "live-camera" | "ar-camera" | "survey" | "upload-plan" | "venues" | "auth" | "share"
type GpsStatus = "requesting" | "active" | "denied"

// Minimal interface — avoids importing Leaflet types on the server. Both map
// views (2D Leaflet, 3D three.js) implement it, so callers fly the camera the
// same way whichever one is mounted.
interface MapHandle {
  flyTo: (latlng: [number, number], zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
}

// Remembered across visits, like the active venue.
const MAP_VIEW_KEY = "wayfinder.mapView"
const MAP_STYLE_KEY = "wayfinder.mapStyle"
const ALWAYS_STEPFREE_KEY = "wayfinder.alwaysStepFree"

// "navigate" opens straight into the search/route flow; "map" opens the
// self-survey overlay so the user starts mapping an area immediately. The
// landing page (src/app/page.tsx) routes to /navigate or /map, which render
// this component with the matching mode.
export type WayfinderMode = "navigate" | "map"

// While navigating, recompute the route once the walker strays this far (metres)
// from the drawn line — a wrong turn or a deliberate diversion. The trigger is
// widened by the GPS fix's reported accuracy so ordinary jitter doesn't
// needlessly re-route.
const OFF_ROUTE_TRIGGER_M = 25

export default function WayfinderApp({ initialMode = "navigate" }: { initialMode?: WayfinderMode }) {
  const router = useRouter()
  const mapHandleRef = useRef<MapHandle | null>(null)
  const gpsActiveRef = useRef(false)

  // Which map rendering the user is looking at: the flat Leaflet plan or the
  // rotatable three.js building model. Both read the same navigation state.
  const [mapView, setMapView] = useState<"2d" | "3d">("2d")
  const changeMapView = useCallback((next: "2d" | "3d") => {
    setMapView(next)
    try { window.localStorage.setItem(MAP_VIEW_KEY, next) } catch {}
  }, [])

  // Light (default) or dark basemap/scene — the map-style floating control.
  const [mapStyle, setMapStyle] = useState<"light" | "dark">("light")
  const toggleMapStyle = useCallback(() => {
    setMapStyle((v) => {
      const next = v === "light" ? "dark" : "light"
      try { window.localStorage.setItem(MAP_STYLE_KEY, next) } catch {}
      return next
    })
  }, [])

  // Accessibility-first routing (2b): "stepfree" only ever uses a lift for a
  // floor change; "fastest" also considers stairs. alwaysStepFree is the
  // persisted default applied whenever a new destination is picked; the user
  // can still override per-destination via the route-choice cards.
  const [routePreference, setRoutePreference] = useState<RoutePreference>("stepfree")
  const [alwaysStepFree, setAlwaysStepFree] = useState(true)
  const handleChangeAlwaysStepFree = useCallback((v: boolean) => {
    setAlwaysStepFree(v)
    try { window.localStorage.setItem(ALWAYS_STEPFREE_KEY, String(v)) } catch {}
  }, [])

  // Live compass heading for the facing beam. The sensor is permission-gated on
  // iOS and must be unlocked from a user gesture, so we call enableHeading() from
  // taps (Start navigation, re-centre).
  const { heading, enable: enableHeading } = useDeviceHeading()

  // Indoor positioning. GPS, QR scans and the demo fix feed in as anchors;
  // between fixes the position is carried forward by dead-reckoning (step count
  // × compass heading), which is what makes the dot move indoors where GPS can't.
  const { position: fusedPosition, accuracy: fusedAccuracy, setAnchor, enableMotion } =
    usePedestrianPosition(heading)

  // Both motion sensors are gesture-gated on iOS, so unlock them together from a
  // tap (Start navigation, re-centre, Scan to locate me).
  const enableSensors = useCallback(() => {
    void enableHeading()
    void enableMotion()
  }, [enableHeading, enableMotion])

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

  // Whether this phone can run immersive WebXR AR (native SLAM). Decides whether
  // "Live camera" opens the floor-anchored AR view or the compass overlay.
  const arSupported = useArSupport()
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

  const [overlay, setOverlay] = useState<OverlayMode>(initialMode === "map" ? "survey" : "none")
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("requesting")
  const [customWaypoints, setCustomWaypoints] = useState<Waypoint[]>([])
  const [surveyTrails, setSurveyTrails] = useState<SurveyTrail[]>([])
  const [customFloorPlans, setCustomFloorPlans] = useState<FloorPlan[]>([])

  // "/" focuses the search field (desktop convention), unless the user is
  // already typing somewhere or another overlay is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      if (typing) return
      setOverlay((o) => {
        if (o !== "none") return o
        e.preventDefault()
        return "search"
      })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // On first load, fold any pre-multi-venue data into the default venue, restore
  // the user's saved venues and which one they last had open, and load the
  // points/trails/plans mapped inside it. Switching venues afterwards reloads
  // data in the handler (goToVenue), so this stays a one-time hydration on mount.
  useEffect(() => {
    migrateLegacyData(DEFAULT_VENUE.id)
    try {
      if (window.localStorage.getItem(MAP_VIEW_KEY) === "3d") setMapView("3d")
      if (window.localStorage.getItem(MAP_STYLE_KEY) === "dark") setMapStyle("dark")
      if (window.localStorage.getItem(ALWAYS_STEPFREE_KEY) === "false") setAlwaysStepFree(false)
    } catch {}
    const restored = loadUserVenues()
    const savedActive = loadActiveVenueId()
    const startId = savedActive && getVenueById(savedActive, restored) ? savedActive : DEFAULT_VENUE.id
    setUserVenues(restored)
    setActiveVenueId(startId)
    setCustomWaypoints(loadVenueWaypoints(startId))
    setSurveyTrails(loadVenueTrails(startId))
    setCustomFloorPlans(loadVenueFloorPlans(startId))
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
  // Plans uploaded via "Upload plan" layer onto whatever the venue already
  // ships with (seed venues' hand-drawn plans, or ones a cloud venue already
  // persisted), the same way customWaypoints layers onto venue.waypoints.
  const allFloorPlans = useMemo(() => [...venue.floorPlans, ...customFloorPlans], [venue, customFloorPlans])
  const availableFloors = useMemo(() => getAvailableFloors(allFloorPlans, allWaypoints), [allFloorPlans, allWaypoints])

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
        // Feed GPS in as an anchor; indoors it's ignored in favour of
        // dead-reckoning, outdoors it (re-)anchors the estimate.
        setAnchor({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          source: "gps",
        })
        // Centre the map on the user the first time we get a real fix, so it works anywhere
        if (firstFix) {
          mapHandleRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 18)
        }
      },
      () => {
        // Don't downgrade to denied once we have a live fix
        if (!gpsActiveRef.current) setGpsStatus("denied")
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [setAnchor])

  // Mirror the fused (dead-reckoned) estimate into navigation state, so the rest
  // of the app — the map dot, off-route checks, step advance — reads one position.
  useEffect(() => {
    if (!fusedPosition) return
    setNavState((s) =>
      s.currentPosition?.lat === fusedPosition.lat &&
      s.currentPosition?.lng === fusedPosition.lng &&
      s.positionAccuracy === fusedAccuracy
        ? s
        : { ...s, currentPosition: fusedPosition, positionAccuracy: fusedAccuracy }
    )
  }, [fusedPosition, fusedAccuracy])

  const useDemoLocation = useCallback(() => {
    setGpsStatus("active")
    setAnchor({ position: venue.center, accuracy: 0, source: "demo" })
    mapHandleRef.current?.flyTo([venue.center.lat, venue.center.lng], venue.defaultZoom)
  }, [venue, setAnchor])

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
      const pref: RoutePreference = alwaysStepFree ? "stepfree" : "fastest"
      setRoutePreference(pref)
      // Offline route renders instantly; outdoor destinations then upgrade to
      // real street geometry once Directions responds.
      const route = buildRoute(position, navState.currentFloor, waypoint, allWaypoints, navState.travelMode, surveyTrails, pref)
      setNavState((s) => ({
        ...s,
        destination: waypoint,
        route,
        currentStepIndex: 0,
        isNavigating: false,
      }))
      if (shouldRouteOutdoors(position, navState.currentFloor, waypoint, surveyTrails)) {
        void refreshOutdoorRoute(position, waypoint, navState.travelMode)
      }
    },
    [venue, navState.currentPosition, navState.currentFloor, navState.travelMode, allWaypoints, surveyTrails, refreshOutdoorRoute, alwaysStepFree]
  )

  const handleTravelModeChange = useCallback(
    (mode: TravelMode) => {
      setNavState((s) => ({ ...s, travelMode: mode }))
      const dest = navState.destination
      if (!dest) return
      const from = navState.currentPosition ?? venue.center
      if (shouldRouteOutdoors(from, navState.currentFloor, dest, surveyTrails)) {
        void refreshOutdoorRoute(from, dest, mode)
      } else {
        const route = buildRoute(from, navState.currentFloor, dest, allWaypoints, mode, surveyTrails, routePreference)
        setNavState((s) => ({ ...s, route }))
      }
    },
    [venue, navState.destination, navState.currentPosition, navState.currentFloor, allWaypoints, surveyTrails, refreshOutdoorRoute, routePreference]
  )

  // Accessibility-first routing (2b): switch between the fastest and
  // step-free floor-change strategy for the destination already picked, and
  // re-run the (indoor) route build immediately so the step list/ETA follow.
  const handleChangeRoutePreference = useCallback(
    (pref: RoutePreference) => {
      setRoutePreference(pref)
      const dest = navState.destination
      if (!dest) return
      const from = navState.currentPosition ?? venue.center
      const route = buildRoute(from, navState.currentFloor, dest, allWaypoints, navState.travelMode, surveyTrails, pref)
      setNavState((s) => ({ ...s, route }))
    },
    [venue, navState.destination, navState.currentPosition, navState.currentFloor, navState.travelMode, allWaypoints, surveyTrails]
  )

  const handleStartNavigation = useCallback(() => {
    enableSensors()
    setNavState((s) => (s.route ? { ...s, isNavigating: true } : s))
  }, [enableSensors])

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

  // Live re-routing: while navigating, if the walker drifts too far from the
  // drawn path, rebuild the route from where they actually are instead of
  // leaving them on a stale line. Indoor journeys recompute instantly via
  // buildRoute; outdoor ones re-fetch real street geometry. The arrival logic
  // above keeps advancing steps; this only fires on a genuine off-route gap.
  useEffect(() => {
    if (!navState.isNavigating || !navState.route || !navState.destination || !navState.currentPosition) return
    // An outdoor recompute is already in flight — let it settle before judging.
    if (routeLoading) return

    const here = navState.currentPosition
    const dest = navState.destination
    const offBy = distanceToPath(here, navState.route.geometry)
    if (offBy <= OFF_ROUTE_TRIGGER_M + (navState.positionAccuracy || 0)) return

    if (shouldRouteOutdoors(here, navState.currentFloor, dest, surveyTrails)) {
      setNavState((s) => (s.isNavigating && s.destination?.id === dest.id ? { ...s, currentStepIndex: 0 } : s))
      void refreshOutdoorRoute(here, dest, navState.travelMode)
    } else {
      const rebuilt = buildRoute(here, navState.currentFloor, dest, allWaypoints, navState.travelMode, surveyTrails, routePreference)
      setNavState((s) => (s.isNavigating && s.destination?.id === dest.id ? { ...s, route: rebuilt, currentStepIndex: 0 } : s))
    }
  }, [
    navState.currentPosition, navState.isNavigating, navState.route, navState.destination,
    navState.currentFloor, navState.travelMode, navState.positionAccuracy,
    routeLoading, allWaypoints, surveyTrails, refreshOutdoorRoute, routePreference,
  ])

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

  // Also understands the shareable-destination poster format (2a): the same
  // positioning anchor plus a trailing `dest:<waypointId>`, so scanning a
  // poster both re-anchors your position at the entrance it's posted at and
  // starts guidance to the destination it advertises.
  const handleQRDetected = useCallback((data: string) => {
    try {
      const parts = data.split(":")
      const floorIdx = parts.indexOf("floor")
      const latIdx = parts.indexOf("lat")
      const lngIdx = parts.indexOf("lng")
      const destIdx = parts.indexOf("dest")
      if (floorIdx >= 0 && latIdx >= 0 && lngIdx >= 0) {
        setGpsStatus("active")
        setNavState((s) => ({ ...s, currentFloor: parseInt(parts[floorIdx + 1]) }))
        // An exact known fix — re-anchor dead-reckoning here and clear drift.
        setAnchor({
          position: { lat: parseFloat(parts[latIdx + 1]), lng: parseFloat(parts[lngIdx + 1]) },
          accuracy: 1,
          source: "qr",
        })
      }
      if (destIdx >= 0) {
        const wp = allWaypoints.find((w) => w.id === parts[destIdx + 1])
        if (wp) handleDestinationSelect(wp)
      }
    } catch {}
  }, [setAnchor, allWaypoints, handleDestinationSelect])

  const handleSurveyComplete = useCallback(async (result: SurveyResult) => {
    setOverlay("none")
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

    // A multi-point walk on a floor with no pre-drawn plan becomes a corridor
    // layout, so call that out rather than just listing points.
    const drewLayout = result.trails.some((t) => t.points.length >= 2)
    const layoutNote = drewLayout ? " Your walk was drawn as the floor layout." : ""

    let message: string
    if (parts.length > 0) {
      message = `Survey complete — ${parts.join(" and ")} location${marked + detected !== 1 ? "s" : ""} added to the map.${layoutNote}`
    } else if (result.aiError === "not_configured") {
      message = "Survey saved. AI sign-reading isn't enabled on the server, so nothing was auto-detected — use “Mark Location” to add points yourself."
    } else if (result.aiError) {
      message = "Survey saved, but the footage couldn't be read this time. Try again, or use “Mark Location” to add points yourself."
    } else {
      message = "Survey complete — no clear signs were found in the footage. Try keeping signs and door plates in view, or use “Mark Location”."
    }
    alert(message)
  }, [cloud, activeVenueId])

  // Mirrors handleSurveyComplete above for plans uploaded via UploadPlanMode:
  // any detected waypoints/corridors are persisted exactly the same way, plus
  // the plan image itself is saved so it renders as the floor's map layer.
  const handleUploadComplete = useCallback(async (result: UploadPlanResult) => {
    setOverlay("none")
    if (result.waypoints.length > 0) {
      if (cloud && !isSeedVenue(activeVenueId)) {
        try {
          const saved = await addRemoteWaypoints(activeVenueId, result.waypoints)
          setCustomWaypoints((prev) => [...prev, ...saved])
        } catch (e) {
          console.warn("Could not sync points to the server:", e)
          setCustomWaypoints((prev) => [...prev, ...result.waypoints])
        }
      } else {
        setCustomWaypoints((prev) => {
          const next = [...prev, ...result.waypoints]
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
    if (result.floorPlan) {
      const plan = result.floorPlan
      if (cloud && !isSeedVenue(activeVenueId)) {
        try {
          await addRemoteFloorPlan(activeVenueId, plan)
        } catch (e) {
          console.warn("Could not sync the plan image to the server:", e)
        }
        setCustomFloorPlans((prev) => [...prev, plan])
      } else {
        setCustomFloorPlans((prev) => {
          const next = [...prev, plan]
          saveVenueFloorPlans(activeVenueId, next)
          return next
        })
      }
    }

    const parts: string[] = []
    if (result.waypoints.length > 0) parts.push(`${result.waypoints.length} location${result.waypoints.length !== 1 ? "s" : ""}`)
    if (result.floorPlan) parts.push("the plan image")
    alert(parts.length > 0 ? `Upload complete — ${parts.join(" and ")} added to the map.` : "Upload complete, but nothing usable was found on the plan.")
  }, [cloud, activeVenueId])

  // Switching place clears the current route and re-centres on the new venue, so
  // navigation state never leaks across venues.
  const goToVenue = useCallback((v: Venue) => {
    setActiveVenueId(v.id)
    saveActiveVenueId(v.id)
    setCustomWaypoints(loadVenueWaypoints(v.id))
    setSurveyTrails(loadVenueTrails(v.id))
    setCustomFloorPlans(loadVenueFloorPlans(v.id))
    setOverlay("none")
    setNavState((s) => ({ ...s, currentFloor: 0, destination: null, route: null, currentStepIndex: 0, isNavigating: false }))
    mapHandleRef.current?.flyTo([v.center.lat, v.center.lng], v.defaultZoom)
  }, [])

  const handleSelectVenue = useCallback((id: string) => {
    const v = getVenueById(id, userVenues)
    if (v) goToVenue(v)
  }, [userVenues, goToVenue])

  // Mapping tools (Survey Mode, Upload plan) only ever show on the /map screen,
  // so a venue created while browsing /navigate needs to hand off there —
  // otherwise "Tap Map area" below would point at a button that isn't on screen.
  const goMapNewVenue = useCallback(() => {
    if (initialMode !== "map") router.push("/map")
  }, [initialMode, router])

  const handleCreateVenue = useCallback(async (input: NewVenueInput) => {
    if (cloud) {
      // Stored server-side; the DB forces verified=false so a public place can't
      // self-verify. RLS ties ownership to the signed-in user.
      try {
        const v = await createRemoteVenue(input)
        setUserVenues((prev) => [...prev, v])
        goToVenue(v)
        goMapNewVenue()
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
    goMapNewVenue()
    alert(`“${v.name}” created. Tap “Map area” to walk through and add points to it.`)
  }, [cloud, goToVenue, goMapNewVenue])

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

  const userInitials = useMemo(() => (user?.email ? user.email.slice(0, 2).toUpperCase() : null), [user])

  const quickAccessWaypoints = useMemo(
    () => (venue.quickAccess ?? []).map((name) => allWaypoints.find((w) => w.name === name)).filter((w): w is Waypoint => !!w),
    [venue.quickAccess, allWaypoints]
  )

  const nearby = useMemo(() => {
    const pos = navState.currentPosition ?? venue.center
    return allWaypoints
      .filter((w) => w.floor === navState.currentFloor && w.id !== navState.destination?.id)
      .map((w) => ({ ...w, distanceM: distanceMeters(pos, w.coordinates) }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 6)
  }, [allWaypoints, navState.currentFloor, navState.destination, navState.currentPosition, venue.center])

  // Accessibility-first routing (2b): when the destination sits on another
  // floor, compare the fastest and step-free strategies so the panel can
  // offer a real choice — but only surface it when they actually differ.
  const routeOptions = useMemo(() => {
    const dest = navState.destination
    if (!dest || navState.route?.outdoor || dest.floor === navState.currentFloor) return null
    const position = navState.currentPosition ?? venue.center
    const fastest = buildRoute(position, navState.currentFloor, dest, allWaypoints, navState.travelMode, surveyTrails, "fastest")
    const stepfree = buildRoute(position, navState.currentFloor, dest, allWaypoints, navState.travelMode, surveyTrails, "stepfree")
    if (fastest.estimatedMinutes === stepfree.estimatedMinutes && fastest.totalDistance === stepfree.totalDistance) return null
    return { fastest, stepfree }
  }, [navState.destination, navState.route?.outdoor, navState.currentFloor, navState.currentPosition, navState.travelMode, allWaypoints, surveyTrails, venue.center])

  const gpsLabel =
    gpsStatus === "requesting" ? "Locating…" :
    gpsStatus === "denied" ? "GPS unavailable" :
    navState.positionAccuracy === 0 ? "Demo mode" : `GPS ±${Math.round(navState.positionAccuracy)}m`

  const gpsDotClass =
    gpsStatus !== "active" ? "bg-gray-300" :
    navState.positionAccuracy === 0 ? "bg-blue-400" :
    navState.positionAccuracy <= 5 ? "bg-wf-green" :
    navState.positionAccuracy <= 15 ? "bg-yellow-400" : "bg-red-400"

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-wf-map-light-bg">
      <LeftPanel
        venue={venue}
        userInitials={userInitials}
        onOpenVenues={() => setOverlay("venues")}
        onOpenSearch={() => setOverlay("search")}
        quickAccess={quickAccessWaypoints}
        onSelectDestination={handleDestinationSelect}
        nearby={nearby}
        currentFloor={navState.currentFloor}
        destination={navState.destination}
        route={navState.route}
        routeLoading={routeLoading}
        isNavigating={navState.isNavigating}
        currentStepIndex={navState.currentStepIndex}
        travelMode={navState.travelMode}
        onTravelModeChange={handleTravelModeChange}
        routePreference={routePreference}
        onChangeRoutePreference={handleChangeRoutePreference}
        alwaysStepFree={alwaysStepFree}
        onChangeAlwaysStepFree={handleChangeAlwaysStepFree}
        routeOptions={routeOptions}
        onStart={handleStartNavigation}
        onStop={handleStopNavigation}
        onShare={() => setOverlay("share")}
        showMapTools={initialMode === "map"}
        onMapArea={() => setOverlay("survey")}
        onUploadPlan={() => setOverlay("upload-plan")}
        gpsStatus={gpsStatus}
        onUseDemo={useDemoLocation}
        onScanQR={() => { enableSensors(); setOverlay("qr") }}
        onOpenCamera={() => {
          enableSensors()
          // Prefer floor-anchored immersive AR when the device supports it and we
          // have a route to draw; otherwise the compass overlay (which also
          // prompts to pick a destination when there isn't one yet).
          setOverlay(arSupported && navState.route && navState.destination ? "ar-camera" : "live-camera")
        }}
      />

      <div className="relative flex-1">
        {mapView === "2d" ? (
          <FloorPlanMap
            currentFloor={navState.currentFloor}
            currentPosition={navState.currentPosition}
            heading={heading}
            destination={navState.destination}
            route={navState.route}
            isNavigating={navState.isNavigating}
            center={venue.center}
            defaultZoom={venue.defaultZoom}
            floorPlans={allFloorPlans}
            waypoints={allWaypoints}
            trails={surveyTrails}
            onMapReady={() => {}}
            leafletMapRef={mapHandleRef}
            dark={mapStyle === "dark"}
          />
        ) : (
          <Map3DView
            currentFloor={navState.currentFloor}
            currentPosition={navState.currentPosition}
            heading={heading}
            destination={navState.destination}
            route={navState.route}
            isNavigating={navState.isNavigating}
            center={venue.center}
            defaultZoom={venue.defaultZoom}
            floorPlans={allFloorPlans}
            waypoints={allWaypoints}
            trails={surveyTrails}
            onMapReady={() => {}}
            mapHandleRef={mapHandleRef}
            dark={mapStyle === "dark"}
          />
        )}

        <FloorSelector
          floors={availableFloors}
          currentFloor={navState.currentFloor}
          onChange={(floor) => setNavState((s) => ({ ...s, currentFloor: floor }))}
        />

        <MapControls
          mapView={mapView}
          onToggleMapView={changeMapView}
          mapStyle={mapStyle}
          onToggleMapStyle={toggleMapStyle}
          onZoomIn={() => mapHandleRef.current?.zoomIn()}
          onZoomOut={() => mapHandleRef.current?.zoomOut()}
          onRecenter={() => {
            enableSensors()
            const pos = navState.currentPosition ?? venue.center
            mapHandleRef.current?.flyTo([pos.lat, pos.lng], venue.defaultZoom)
          }}
          showRecenter={!navState.isNavigating}
          gpsLabel={gpsLabel}
          gpsDotClass={gpsDotClass}
          floorLabel={floorLabel(navState.currentFloor)}
        />
      </div>

      {overlay === "search" && (
        <SearchModal
          waypoints={allWaypoints}
          quickAccess={venue.quickAccess}
          proximity={navState.currentPosition ?? venue.center}
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
          nav={
            overlay === "live-camera"
              ? {
                  position: navState.currentPosition,
                  heading,
                  route: navState.route,
                  currentStep,
                  stepIndex: navState.currentStepIndex,
                  destination: navState.destination,
                  onPickDestination: () => setOverlay("search"),
                  onScanQR: () => { enableSensors(); setOverlay("qr") },
                  // Offer the floor-anchored view only when the device can run it
                  // and there's a route to anchor.
                  onStartAr:
                    arSupported && navState.route && navState.destination
                      ? () => setOverlay("ar-camera")
                      : undefined,
                }
              : undefined
          }
        />
      )}

      {overlay === "ar-camera" && navState.route && navState.destination && (
        <ArNavView
          position={navState.currentPosition}
          heading={heading}
          route={navState.route}
          currentStep={currentStep}
          destination={navState.destination}
          onExit={() => setOverlay("none")}
          onScanQR={() => { enableSensors(); setOverlay("qr") }}
          // If the session can't start, drop to the compass overlay so the user
          // still gets guidance instead of a dead screen.
          onFallback={() => setOverlay("live-camera")}
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

      {overlay === "upload-plan" && (
        <UploadPlanMode
          currentFloor={navState.currentFloor}
          venueCenter={venue.center}
          venueName={venue.subtitle ?? venue.name}
          onClose={() => setOverlay("none")}
          onUploadComplete={handleUploadComplete}
        />
      )}

      {overlay === "share" && navState.destination && (
        <ShareDialog venue={venue} waypoint={navState.destination} onClose={() => setOverlay("none")} />
      )}
    </div>
  )
}
