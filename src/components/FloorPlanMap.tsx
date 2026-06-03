"use client"

import React, { useEffect, useRef, MutableRefObject } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Waypoint, Route, Coordinates } from "@/lib/types"
import { GOSH_WAYPOINTS, FLOOR_PLANS, GOSH_CENTER, WAYPOINT_TYPE_ICONS } from "@/lib/gosh-data"

// Honour users who ask for less motion (vestibular comfort — important in a care setting)
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

interface Props {
  currentFloor: number
  currentPosition: Coordinates | null
  destination: Waypoint | null
  route: Route | null
  isNavigating: boolean
  onMapReady: () => void
  leafletMapRef?: MutableRefObject<{ flyTo: (latlng: [number, number], zoom: number) => void } | null>
}

export default function FloorPlanMap({
  currentFloor,
  currentPosition,
  destination,
  route,
  isNavigating,
  onMapReady,
  leafletMapRef,
}: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const positionMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const floorPlanLayerRef = useRef<L.ImageOverlay | null>(null)
  const waypointLayersRef = useRef<L.Marker[]>([])

  // Init map once
  useEffect(() => {
    if (mapRef.current) return

    // Start pulled back when motion is allowed, so we can descend into the building.
    const reduceMotion = prefersReducedMotion()

    const map = L.map("map-container", {
      center: [GOSH_CENTER.lat, GOSH_CENTER.lng],
      zoom: reduceMotion ? 18 : 15,
      zoomControl: false,
      attributionControl: false,
      // Fractional zoom + gentle wheel steps = buttery pan/zoom
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 120,
      inertia: true,
    })

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 22,
    }).addTo(map)

    mapRef.current = map
    if (leafletMapRef) leafletMapRef.current = map
    onMapReady()

    // Cinematic intro — glide down from the establishing shot into the building.
    let introTimer: ReturnType<typeof setTimeout> | undefined
    if (!reduceMotion) {
      map.whenReady(() => {
        introTimer = setTimeout(() => {
          map.flyTo([GOSH_CENTER.lat, GOSH_CENTER.lng], 18, {
            duration: 2.2,
            easeLinearity: 0.18,
          })
        }, 150)
      })
    }

    return () => {
      if (introTimer) clearTimeout(introTimer)
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

    const floorWaypoints = GOSH_WAYPOINTS.filter(
      (w) => w.floor === currentFloor && !["lift", "stairs"].includes(w.type)
    )

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
  }, [currentFloor, destination])

  // Update position marker — reuse the marker across fixes so the pulse never restarts
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

    // Move the existing dot rather than recreating it (keeps the radar ping continuous)
    if (positionMarkerRef.current) {
      positionMarkerRef.current.setLatLng(latlng)
      return
    }

    const icon = L.divIcon({
      html: `<div style="position:relative;width:40px;height:40px;">
        <div class="position-pulse" style="
          position:absolute;top:50%;left:50%;
          width:40px;height:40px;
          background:rgba(0,94,184,0.25);
          border-radius:50%;
        "></div>
        <div style="
          position:absolute;top:50%;left:50%;
          transform:translate(-50%,-50%);
          width:18px;height:18px;
          background:#005EB8;
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 2px 8px rgba(0,94,184,0.6);
          z-index:2;
        "></div>
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      className: "",
    })

    positionMarkerRef.current = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map)
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
        className: "route-flow",
      })
      polyline.addTo(map)
      routeLayerRef.current = polyline

      const destIcon = L.divIcon({
        html: `<div style="
          background:#DA291C;
          border:3px solid white;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          width:28px;height:28px;
          box-shadow:0 2px 8px rgba(218,41,28,0.5);
        "></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        className: "",
      })
      destMarkerRef.current = L.marker(
        [destination.coordinates.lat, destination.coordinates.lng],
        { icon: destIcon, zIndexOffset: 900 }
      ).addTo(map)

      if (prefersReducedMotion()) {
        map.fitBounds(polyline.getBounds(), { padding: [80, 80] })
      } else {
        map.flyToBounds(polyline.getBounds(), {
          padding: [80, 80],
          duration: 1.2,
          easeLinearity: 0.2,
        })
      }
    }
  }, [isNavigating, route, destination, currentPosition])

  return <div id="map-container" className="w-full h-full" style={{ isolation: "isolate" }} />
}
