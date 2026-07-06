"use client"

import React, { useEffect, useMemo, useRef, useState, MutableRefObject } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { LocateFixed } from "lucide-react"
import { Waypoint, Route, Coordinates, SurveyTrail, FloorPlan } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS } from "@/lib/waypoint-meta"
import { buildFloorSchematic } from "@/lib/schematic"

interface Props {
  currentFloor: number
  currentPosition: Coordinates | null
  // Compass heading in degrees clockwise from north, or null when unknown. Drives
  // the facing beam on the you-are-here dot so the user can orient themselves.
  heading: number | null
  destination: Waypoint | null
  route: Route | null
  isNavigating: boolean
  // Where the map opens when there is no live GPS fix — the active venue's centre.
  center: Coordinates
  defaultZoom?: number
  floorPlans: FloorPlan[]
  waypoints: Waypoint[]
  trails?: SurveyTrail[]
  onMapReady: () => void
  leafletMapRef?: MutableRefObject<{ flyTo: (latlng: [number, number], zoom: number) => void; zoomIn: () => void; zoomOut: () => void } | null>
  // Light (default) or dark basemap tiles — the map-style floating control.
  dark?: boolean
}

const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"

export default function FloorPlanMap({
  currentFloor,
  currentPosition,
  heading,
  destination,
  route,
  isNavigating,
  center,
  defaultZoom = 18,
  floorPlans,
  waypoints,
  trails = [],
  onMapReady,
  leafletMapRef,
  dark = false,
}: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const positionMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLayerRef = useRef<L.FeatureGroup | null>(null)
  const floorPlanLayerRef = useRef<L.ImageOverlay | null>(null)
  const waypointLayersRef = useRef<L.Marker[]>([])
  const trailLayersRef = useRef<L.Polyline[]>([])
  const schematicLayerRef = useRef<L.LayerGroup | null>(null)
  const framedDestRef = useRef<string | null>(null)

  // Whether the current floor already has a pre-drawn plan image. When it does
  // (e.g. seed venues with real SVG plans) we leave it alone; the generated
  // schematic is for floors that were only walked, so they don't look blank.
  const hasPlanImage = floorPlans.some((fp) => fp.floor === currentFloor)

  // Derive a simple corridor/room schematic from the walked trails + points on
  // this floor. Memoised so it only rebuilds when the underlying data changes.
  const schematic = useMemo(
    () => (hasPlanImage ? null : buildFloorSchematic(currentFloor, trails, waypoints)),
    [currentFloor, trails, waypoints, hasPlanImage]
  )

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
      center: [center.lat, center.lng],
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: false,
    })

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

  // Swap basemap tiles when the light/dark map-style control is toggled.
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    tileLayerRef.current = L.tileLayer(dark ? DARK_TILES : LIGHT_TILES, { maxZoom: 22 }).addTo(map)
    tileLayerRef.current.bringToBack()
  }, [dark])

  // Update floor plan overlay
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (floorPlanLayerRef.current) {
      map.removeLayer(floorPlanLayerRef.current)
      floorPlanLayerRef.current = null
    }

    const plan = floorPlans.find((fp) => fp.floor === currentFloor)
    if (plan) {
      const overlay = L.imageOverlay(plan.imageUrl, plan.bounds as L.LatLngBoundsExpression, {
        opacity: 0.85,
        interactive: false,
      })
      overlay.addTo(map)
      floorPlanLayerRef.current = overlay
    }
  }, [currentFloor, floorPlans])

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

  // Draw the generated floor schematic: filled corridors (the walked path given
  // real width) with room blocks beside them, so a surveyed floor reads like a
  // building interior. Sits beneath the trail line, markers and route.
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (schematicLayerRef.current) {
      map.removeLayer(schematicLayerRef.current)
      schematicLayerRef.current = null
    }
    if (!schematic) return

    const group = L.layerGroup()

    schematic.corridors.forEach((ring) => {
      L.polygon(
        ring.map((p) => [p.lat, p.lng] as L.LatLngExpression),
        { color: "#94A3B8", weight: 1.5, opacity: 0.7, fillColor: "#E2E8F0", fillOpacity: 0.7, interactive: false }
      ).addTo(group)
    })

    schematic.rooms.forEach((room) => {
      L.polygon(
        room.polygon.map((p) => [p.lat, p.lng] as L.LatLngExpression),
        { color: "#64748B", weight: 1.5, opacity: 0.8, fillColor: "#F8FAFC", fillOpacity: 0.85, interactive: false }
      ).addTo(group)

      const label = L.divIcon({
        html: `<div style="
          display:flex;align-items:center;gap:3px;
          font-size:10px;font-weight:600;color:#334155;white-space:nowrap;
          transform:translate(-50%,-50%);
          text-shadow:0 1px 2px rgba(255,255,255,0.9);
        ">${WAYPOINT_TYPE_ICONS[room.type]}<span>${room.name}</span></div>`,
        iconSize: [0, 0],
        className: "",
      })
      L.marker([room.center.lat, room.center.lng], { icon: label, interactive: false, keyboard: false }).addTo(group)
    })

    group.addTo(map)
    schematicLayerRef.current = group
  }, [schematic])

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
      html: `<div style="position:relative;width:72px;height:72px;">
        <div class="wf-heading-cone" style="
          position:absolute;top:50%;left:50%;margin:-36px 0 0 -36px;
          width:72px;height:72px;border-radius:50%;
        "></div>
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
      iconSize: [72, 72],
      iconAnchor: [36, 36],
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

  // Aim the facing beam at the live compass heading. Updated independently of the
  // marker so the cone rotates smoothly without recreating the dot. Depends on
  // currentPosition too, so it re-applies once the marker first exists.
  useEffect(() => {
    const el = positionMarkerRef.current?.getElement()
    const cone = el?.querySelector(".wf-heading-cone") as HTMLElement | null
    if (!cone) return
    if (heading == null) {
      cone.style.opacity = "0"
      return
    }
    cone.style.opacity = "1"
    cone.style.transform = `rotate(${heading}deg)`
  }, [heading, currentPosition])

  // Draw the route path + destination pin. The line follows the route's actual
  // geometry (real street/footpath geometry outdoors, a connected multi-point
  // path indoors) rather than a single straight line. Drawn in both preview and
  // navigation; only the framing/follow behaviour differs between them.
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

    if (!route || !destination || route.geometry.length < 2) {
      framedDestRef.current = null
      setFollow(true)
      return
    }

    const pts = route.geometry.map((p) => [p.lat, p.lng] as L.LatLngExpression)
    // A real-navigation style line: a white halo (casing) under a bold solid
    // blue core, with a thin animated dashed overlay marching toward the
    // destination. The previous "1, 12" dotted line read as faint specks on the
    // map; this stays legible at every zoom and clearly shows direction of travel.
    const casing = L.polyline(pts, {
      color: "#FFFFFF",
      weight: 11,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    })
    const core = L.polyline(pts, {
      color: "#0A84FF",
      weight: 7,
      opacity: 1,
      lineCap: "round",
      lineJoin: "round",
    })
    const flow = L.polyline(pts, {
      color: "#FFFFFF",
      weight: 3,
      opacity: 0.85,
      lineCap: "round",
      lineJoin: "round",
      dashArray: "2, 14",
      className: "wf-route-flow",
    })
    const group = L.featureGroup([casing, core, flow])
    group.addTo(map)
    routeLayerRef.current = group

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

    const frame = () => {
      programmaticRef.current = true
      map.fitBounds(group.getBounds(), { padding: [70, 70] })
      map.once("moveend", () => {
        programmaticRef.current = false
      })
    }

    if (!isNavigating) {
      // Preview: keep the whole route in view so the user can size it up.
      frame()
      framedDestRef.current = null
    } else if (framedDestRef.current !== destination.id) {
      // Navigation just started: frame once, then follow takes over.
      frame()
      framedDestRef.current = destination.id
      setFollow(true)
    }
  }, [isNavigating, route, destination])

  // Follow the walker while navigating: gently keep their dot centred as new
  // position fixes arrive (unless they've panned away to explore). We use
  // setView at a close zoom so that, after the initial whole-route overview, the
  // map zooms back in to a level where the floor plan and the next turn are
  // actually readable — rather than leaving the building as a tiny box.
  useEffect(() => {
    if (!mapRef.current || !isNavigating || !currentPosition) return
    if (!followingRef.current) return
    const map = mapRef.current
    programmaticRef.current = true
    map.setView([currentPosition.lat, currentPosition.lng], Math.max(map.getZoom(), defaultZoom), {
      animate: true,
      duration: 0.8,
    })
    map.once("moveend", () => {
      programmaticRef.current = false
    })
  }, [currentPosition, isNavigating, defaultZoom])

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
