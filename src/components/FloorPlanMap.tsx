"use client"

import React, { useEffect, useRef, MutableRefObject } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Waypoint, Route, Coordinates } from "@/lib/types"
import { GOSH_WAYPOINTS, FLOOR_PLANS, GOSH_CENTER, WAYPOINT_TYPE_ICONS } from "@/lib/gosh-data"

interface Props {
  currentFloor: number
  currentPosition: Coordinates | null
  destination: Waypoint | null
  route: Route | null
  isNavigating: boolean
  onMapReady: () => void
  leafletMapRef?: MutableRefObject<{ flyTo: (latlng: [number, number], zoom: number) => void } | null>
  onRequestMap?: () => void
}

export default function FloorPlanMap({
  currentFloor,
  currentPosition,
  destination,
  route,
  isNavigating,
  onMapReady,
  leafletMapRef,
  onRequestMap,
}: Props) {
  const mapRef              = useRef<L.Map | null>(null)
  const positionMarkerRef   = useRef<L.Marker | null>(null)
  const destMarkerRef       = useRef<L.Marker | null>(null)
  const indoorRouteRef      = useRef<L.Polyline | null>(null)
  const outdoorRouteRef     = useRef<L.Polyline | null>(null)
  const unmappedBannerRef   = useRef<L.Marker | null>(null)
  const floorPlanLayerRef   = useRef<L.ImageOverlay | null>(null)
  const waypointLayersRef   = useRef<L.Marker[]>([])

  // ── Init map ──────────────────────────────────────────────────────────────
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

    mapRef.current = map
    if (leafletMapRef) leafletMapRef.current = map
    onMapReady()

    return () => {
      map.remove()
      mapRef.current = null
      if (leafletMapRef) leafletMapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Floor plan overlay ────────────────────────────────────────────────────
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

  // ── Waypoint markers ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    waypointLayersRef.current.forEach((m) => map.removeLayer(m))
    waypointLayersRef.current = []

    const floorWaypoints = GOSH_WAYPOINTS.filter(
      (w) => w.floor === currentFloor && !["lift", "stairs"].includes(w.type)
    )

    floorWaypoints.forEach((w) => {
      const isDestination = destination?.id === w.id
      const icon = L.divIcon({
        html: `<div style="
          background:${isDestination ? "#DA291C" : "white"};
          border:2px solid ${isDestination ? "#DA291C" : "#005EB8"};
          border-radius:50%;
          width:32px;height:32px;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;
          box-shadow:0 2px 6px rgba(0,0,0,0.25);
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

  // ── User position marker ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (positionMarkerRef.current) { map.removeLayer(positionMarkerRef.current); positionMarkerRef.current = null }

    if (currentPosition) {
      const icon = L.divIcon({
        html: `<div style="position:relative;">
          <div style="width:20px;height:20px;background:#005EB8;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,94,184,0.6);position:relative;z-index:2;"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;background:rgba(0,94,184,0.2);border-radius:50%;"></div>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        className: "",
      })
      positionMarkerRef.current = L.marker(
        [currentPosition.lat, currentPosition.lng],
        { icon, zIndexOffset: 1000 }
      ).addTo(map)
    }
  }, [currentPosition])

  // ── Route layers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    // Clear previous route layers
    if (indoorRouteRef.current)    { map.removeLayer(indoorRouteRef.current);    indoorRouteRef.current    = null }
    if (outdoorRouteRef.current)   { map.removeLayer(outdoorRouteRef.current);   outdoorRouteRef.current   = null }
    if (destMarkerRef.current)     { map.removeLayer(destMarkerRef.current);     destMarkerRef.current     = null }
    if (unmappedBannerRef.current) { map.removeLayer(unmappedBannerRef.current); unmappedBannerRef.current = null }

    if (!isNavigating || !route || !destination || !currentPosition) return

    const allBounds: L.LatLngExpression[] = []

    // ── Outdoor leg ───────────────────────────────────────────────────────
    if (route.outdoorLeg && route.outdoorLeg.polyline.length >= 2) {
      const pts = route.outdoorLeg.polyline.map((c): L.LatLngExpression => [c.lat, c.lng])
      outdoorRouteRef.current = L.polyline(pts, {
        color: "#003087",
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map)
      pts.forEach((p) => allBounds.push(p))
    }

    // ── Indoor path ───────────────────────────────────────────────────────
    if (route.indoorPath && route.indoorPath.length >= 2) {
      const pts = route.indoorPath.map((c): L.LatLngExpression => [c.lat, c.lng])

      if (route.isMapped) {
        // Real corridor path — solid cyan
        indoorRouteRef.current = L.polyline(pts, {
          color: "#00BFFF",
          weight: 6,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map)
      } else {
        // Unmapped fallback — dotted line
        indoorRouteRef.current = L.polyline(pts, {
          color: "#00BFFF",
          weight: 6,
          opacity: 0.6,
          lineCap: "round",
          lineJoin: "round",
          dashArray: "1, 12",
        }).addTo(map)

        // "Help map this" banner at midpoint
        const mid = route.indoorPath[Math.floor(route.indoorPath.length / 2)]
        const bannerIcon = L.divIcon({
          html: `<div style="
            background:rgba(0,48,135,0.9);color:white;
            font-size:11px;font-weight:600;
            padding:4px 8px;border-radius:8px;
            white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);
            cursor:pointer;
          ">📍 Area not yet mapped — tap to help</div>`,
          className: "",
          iconAnchor: [80, 12],
        })
        unmappedBannerRef.current = L.marker([mid.lat, mid.lng], { icon: bannerIcon, zIndexOffset: 800 })
          .addTo(map)
        if (onRequestMap) {
          unmappedBannerRef.current.on("click", onRequestMap)
        }
      }

      pts.forEach((p) => allBounds.push(p))
    }

    // ── Destination pin ───────────────────────────────────────────────────
    const destIcon = L.divIcon({
      html: `<div style="background:#DA291C;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:28px;height:28px;box-shadow:0 2px 8px rgba(218,41,28,0.5);"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      className: "",
    })
    destMarkerRef.current = L.marker(
      [destination.coordinates.lat, destination.coordinates.lng],
      { icon: destIcon, zIndexOffset: 900 }
    ).addTo(map)
    allBounds.push([destination.coordinates.lat, destination.coordinates.lng])

    if (allBounds.length >= 2) {
      map.fitBounds(allBounds as L.LatLngBoundsExpression, { padding: [80, 80] })
    }
  }, [isNavigating, route, destination, currentPosition, onRequestMap])

  return <div id="map-container" className="w-full h-full" style={{ isolation: "isolate" }} />
}
