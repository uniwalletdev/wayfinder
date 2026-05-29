"use client"

import React, { useEffect, useRef, MutableRefObject } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Waypoint, Route, Coordinates } from "@/lib/types"
import { GOSH_WAYPOINTS, FLOOR_PLANS, GOSH_CENTER, WAYPOINT_TYPE_ICONS } from "@/lib/gosh-data"

interface MapHandle {
  flyTo: (latlng: [number, number], zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
}

interface Props {
  currentFloor: number
  currentPosition: Coordinates | null
  heading: number | null
  destination: Waypoint | null
  route: Route | null
  isNavigating: boolean
  onMapReady: () => void
  leafletMapRef?: MutableRefObject<MapHandle | null>
}

export default function FloorPlanMap({
  currentFloor,
  currentPosition,
  heading,
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

    const map = L.map("map-container", {
      center: [GOSH_CENTER.lat, GOSH_CENTER.lng],
      zoom: 18,
      minZoom: 3,
      maxZoom: 22,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      zoomSnap: 0.5,
    })

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 22,
    }).addTo(map)

    mapRef.current = map
    if (leafletMapRef) {
      leafletMapRef.current = {
        flyTo: (latlng, zoom) => map.flyTo(latlng, zoom),
        zoomIn: () => map.zoomIn(1),
        zoomOut: () => map.zoomOut(1),
      }
    }
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

  // Update position marker
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (positionMarkerRef.current) {
      map.removeLayer(positionMarkerRef.current)
      positionMarkerRef.current = null
    }

    if (currentPosition) {
      const icon = L.divIcon({
        html: `<div style="position:relative;width:48px;height:48px;">
          <!-- accuracy halo -->
          <div style="
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%);
            width:44px;height:44px;
            background:rgba(0,94,184,0.18);
            border-radius:50%;
          "></div>
          <!-- forward-direction cone -->
          <div class="heading-cone" style="
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%) rotate(${heading ?? 0}deg);
            transform-origin:center center;
            width:48px;height:48px;
            display:${heading == null ? "none" : "block"};
            pointer-events:none;z-index:1;
          ">
            <div style="
              position:absolute;left:50%;top:-2px;
              transform:translateX(-50%);
              width:0;height:0;
              border-left:13px solid transparent;
              border-right:13px solid transparent;
              border-bottom:22px solid rgba(0,94,184,0.55);
            "></div>
          </div>
          <!-- position dot -->
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
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        className: "",
      })

      const marker = L.marker([currentPosition.lat, currentPosition.lng], { icon, zIndexOffset: 1000 })
      marker.addTo(map)
      positionMarkerRef.current = marker
    }
  }, [currentPosition])

  // Rotate the heading cone without re-creating the marker (orientation fires often)
  useEffect(() => {
    const marker = positionMarkerRef.current
    if (!marker) return
    const cone = marker.getElement()?.querySelector<HTMLElement>(".heading-cone")
    if (!cone) return
    if (heading == null) {
      cone.style.display = "none"
    } else {
      cone.style.display = "block"
      cone.style.transform = `translate(-50%,-50%) rotate(${heading}deg)`
    }
  }, [heading, currentPosition])

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

      map.fitBounds(polyline.getBounds(), { padding: [80, 80] })
    }
  }, [isNavigating, route, destination, currentPosition])

  return <div id="map-container" className="w-full h-full" style={{ isolation: "isolate" }} />
}
