"use client"

import React, { useEffect, useRef, useState, MutableRefObject } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { LocateFixed } from "lucide-react"
import { Waypoint, Route, Coordinates, SurveyTrail } from "@/lib/types"
import { GOSH_WAYPOINTS, FLOOR_PLANS, GOSH_CENTER, WAYPOINT_TYPE_ICONS } from "@/lib/gosh-data"

interface Props {
  currentFloor: number
  currentPosition: Coordinates | null
  destination: Waypoint | null
  route: Route | null
  isNavigating: boolean
  waypoints?: Waypoint[]
  trails?: SurveyTrail[]
  onMapReady: () => void
  leafletMapRef?: MutableRefObject<{ flyTo: (latlng: [number, number], zoom: number) => void } | null>
}

export default function FloorPlanMap({
  currentFloor,
  currentPosition,
  destination,
  route,
  isNavigating,
  waypoints = GOSH_WAYPOINTS,
  trails = [],
  onMapReady,
  leafletMapRef,
}: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const positionMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const floorPlanLayerRef = useRef<L.ImageOverlay | null>(null)
  const waypointLayersRef = useRef<L.Marker[]>([])
  const trailLayersRef = useRef<L.Polyline[]>([])
  const framedDestRef = useRef<string | null>(null)

  // Auto-follow keeps the walker centred (Google/Waze style). When the user
  // drags or zooms to explore — e.g. to see the whole route — we pause follow
  // and surface a re-centre button. followingRef mirrors the state so map event
  // handlers and effects can read it without re-subscribing.
  const [following, setFollowing] = useState(true)
  const followingRef = useRef(true)
  const programmaticRef = useRef(false)
  const positionRef = useRef<Coordinates | null>(currentPosition)
  positionRef.current = currentPosition

  const setFollow = (v: boolean) => {
    followingRef.current = v
    setFollowing(v)
  }

  // Init map once
  useEffect(() => {
    if (mapRef.current) return

    const map = L.map("map-container", {
      center: [GOSH_CENTER.lat, GOSH_CENTER.lng],
      zoom: 18,
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 22,
    }).addTo(map)

    // A user-initiated drag or zoom means they want to explore — pause follow.
    // Programmatic moves (fitBounds/panTo) set programmaticRef to opt out.
    const onUserInteract = () => setFollow(false)
    map.on("dragstart", onUserInteract)
    map.on("zoomstart", () => {
      if (!programmaticRef.current) onUserInteract()
    })

    mapRef.current = map
    if (leafletMapRef) leafletMapRef.current = map
    onMapReady()

    return () => {
      map.remove()
      mapRef.current = null
      if (leafletMapRef) leafletMapRef.current = null
    }
  }, [])

  // Update floor plan overlay
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (floorPlanLayerRef.current) {
      map.removeLayer(floorPlanLayerRef.current)
      floorPlanLayerRef.current = null
    }

    const plan = FLOOR_PLANS.find((fp) => fp.floor === currentFloor)
    if (plan) {
      const overlay = L.imageOverlay(plan.imageUrl, plan.bounds as L.LatLngBoundsExpression, {
        opacity: 0.85,
        interactive: false,
      })
      overlay.addTo(map)
      floorPlanLayerRef.current = overlay
    }
  }, [currentFloor])

  // Update waypoint markers
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    waypointLayersRef.current.forEach((m) => map.removeLayer(m))
    waypointLayersRef.current = []

    const floorWaypoints = waypoints.filter((w) => w.floor === currentFloor)

    floorWaypoints.forEach((w) => {
      const icon = L.divIcon({
        html: `<div style="
          background:white;
          border:2px solid #005EB8;
          border-radius:50%;
          width:32px;height:32px;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;
          box-shadow:0 2px 6px rgba(0,0,0,0.25);
          ${destination?.id === w.id ? "border-color:#DA291C;background:#DA291C;" : ""}
        ">${WAYPOINT_TYPE_ICONS[w.type]}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        className: "",
      })

      const marker = L.marker([w.coordinates.lat, w.coordinates.lng], { icon })
        .bindPopup(`<b>${w.name}</b>${w.description ? `<br><small>${w.description}</small>` : ""}`)
        .addTo(map)

      waypointLayersRef.current.push(marker)
    })
  }, [currentFloor, destination, waypoints])

  // Draw walked survey trails (breadcrumbs) for the current floor
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    trailLayersRef.current.forEach((l) => map.removeLayer(l))
    trailLayersRef.current = []

    trails
      .filter((t) => t.floor === currentFloor && t.points.length >= 2)
      .forEach((t) => {
        const line = L.polyline(
          t.points.map((p) => [p.lat, p.lng] as L.LatLngExpression),
          { color: "#7C3AED", weight: 4, opacity: 0.55, lineCap: "round", lineJoin: "round", dashArray: "6, 8" }
        )
        line.addTo(map)
        trailLayersRef.current.push(line)
      })
  }, [currentFloor, trails])

  // Update position marker. We keep a single marker alive across position
  // fixes and slide it (via the .wf-live-marker transform transition) rather
  // than destroying it each tick — that keeps the pulse animation continuous
  // and makes movement read as fluid rather than teleporting.
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (!currentPosition) {
      if (positionMarkerRef.current) {
        map.removeLayer(positionMarkerRef.current)
        positionMarkerRef.current = null
      }
      return
    }

    const latlng: L.LatLngExpression = [currentPosition.lat, currentPosition.lng]

    if (positionMarkerRef.current) {
      positionMarkerRef.current.setLatLng(latlng)
      return
    }

    const icon = L.divIcon({
      html: `<div style="position:relative;width:44px;height:44px;">
        <div class="wf-locate-ring" style="
          position:absolute;top:50%;left:50%;margin:-11px 0 0 -11px;
          width:22px;height:22px;border-radius:50%;
          background:rgba(0,94,184,0.30);
        "></div>
        <div class="wf-locate-core" style="
          position:absolute;top:50%;left:50%;margin:-9px 0 0 -9px;
          width:18px;height:18px;
          background:#005EB8;border:3px solid white;border-radius:50%;
          box-shadow:0 2px 8px rgba(0,94,184,0.6);
        "></div>
      </div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      className: "",
    })

    const marker = L.marker(latlng, { icon, zIndexOffset: 1000, keyboard: false })
    marker.addTo(map)
    positionMarkerRef.current = marker

    // Enable the glide only after first paint, so the marker doesn't visibly
    // fly in from the map origin when Leaflet sets its initial transform.
    requestAnimationFrame(() => {
      positionMarkerRef.current?.getElement()?.classList.add("wf-live-marker")
    })
  }, [currentPosition])

  // Update route
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current)
      routeLayerRef.current = null
    }

    if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current)
      destMarkerRef.current = null
    }

    if (isNavigating && route && destination && currentPosition) {
      const routePoints: L.LatLngExpression[] = [
        [currentPosition.lat, currentPosition.lng],
        [destination.coordinates.lat, destination.coordinates.lng],
      ]

      const polyline = L.polyline(routePoints, {
        color: "#00BFFF",
        weight: 6,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "1, 12",
        className: "wf-route-flow",
      })
      polyline.addTo(map)
      routeLayerRef.current = polyline

      const destIcon = L.divIcon({
        // Outer wrapper carries the bob animation; inner teardrop keeps the
        // rotate so the two transforms don't fight.
        html: `<div class="wf-dest-pin"><div style="
          background:#DA291C;
          border:3px solid white;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          width:28px;height:28px;
          box-shadow:0 2px 8px rgba(218,41,28,0.5);
        "></div></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        className: "",
      })
      destMarkerRef.current = L.marker(
        [destination.coordinates.lat, destination.coordinates.lng],
        { icon: destIcon, zIndexOffset: 900 }
      ).addTo(map)

      // Frame the whole route once when the destination is set, then (while
      // following) gently keep the walker's dot centred as they move.
      if (framedDestRef.current !== destination.id) {
        programmaticRef.current = true
        map.fitBounds(polyline.getBounds(), { padding: [80, 80] })
        map.once("moveend", () => {
          programmaticRef.current = false
        })
        framedDestRef.current = destination.id
        setFollow(true)
      } else if (followingRef.current) {
        map.panTo([currentPosition.lat, currentPosition.lng], { animate: true, duration: 0.8 })
      }
    } else {
      framedDestRef.current = null
      setFollow(true)
    }
  }, [isNavigating, route, destination, currentPosition])

  const recenter = () => {
    const pos = positionRef.current
    if (pos && mapRef.current) {
      programmaticRef.current = true
      mapRef.current.panTo([pos.lat, pos.lng], { animate: true, duration: 0.6 })
      mapRef.current.once("moveend", () => {
        programmaticRef.current = false
      })
    }
    setFollow(true)
  }

  const showRecenter = isNavigating && !following && currentPosition

  return (
    <div className="relative w-full h-full" style={{ isolation: "isolate" }}>
      <div id="map-container" className="w-full h-full" />
      {showRecenter && (
        <button
          onClick={recenter}
          aria-label="Re-centre on my location"
          className="absolute bottom-28 right-4 z-[1000] flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#005EB8] shadow-lg active:scale-95 transition-transform"
        >
          <LocateFixed size={18} />
          Re-centre
        </button>
      )}
    </div>
  )
}
