"use client"

import { useEffect, useRef } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { Waypoint, Route, Coordinates } from "@/lib/types"

const WAYPOINT_TYPE_ICONS: Record<string, string> = {
  ward: "🏥", department: "🏢", lift: "🛗", stairs: "🪜",
  toilet: "🚻", exit: "🚪", reception: "📋", canteen: "🍽️",
  pharmacy: "💊", other: "📍",
}

interface Props {
  currentFloor: number
  currentPosition: Coordinates | null
  initialCenter: Coordinates
  heading: number
  destination: Waypoint | null
  route: Route | null
  isNavigating: boolean
  waypoints: Waypoint[]
  onMapTap?: (coords: Coordinates) => void
  onMapReady: () => void
}

export default function FloorPlanMap({
  currentFloor,
  currentPosition,
  initialCenter,
  heading,
  destination,
  route,
  isNavigating,
  waypoints,
  onMapTap,
  onMapReady,
}: Props) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const positionMarkerRef = useRef<maplibregl.Marker | null>(null)
  const destMarkerRef = useRef<maplibregl.Marker | null>(null)
  const waypointMarkersRef = useRef<maplibregl.Marker[]>([])
  const initializedRef = useRef(false)

  // Init map once — centered on user GPS
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const map = new maplibregl.Map({
      container: "map-container",
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 18,
      pitch: 45,
      bearing: 0,
      attributionControl: false,
      maxZoom: 22,
    })

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left")

    map.on("load", () => {
      map.addLayer({
        id: "3d-buildings",
        source: "openmaptiles",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#e8e0d8",
          "fill-extrusion-height": ["get", "render_height"],
          "fill-extrusion-base": ["get", "render_min_height"],
          "fill-extrusion-opacity": 0.7,
        },
      })

      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      })

      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#00BFFF", "line-width": 16, "line-opacity": 0.2, "line-blur": 4 },
      })

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#00BFFF", "line-width": 7, "line-opacity": 0.95 },
      })

      // Fly to user's real GPS immediately on load — no blank/wrong map
      map.flyTo({
        center: [initialCenter.lng, initialCenter.lat],
        zoom: 18,
        pitch: 45,
        bearing: 0,
        duration: 1200,
        essential: true,
      })

      onMapReady()
    })

    // Tap to set position
    map.on("click", (e) => {
      if (onMapTap) onMapTap({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      initializedRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Smooth camera follow
  useEffect(() => {
    if (!mapRef.current || !currentPosition) return
    mapRef.current.easeTo({
      center: [currentPosition.lng, currentPosition.lat],
      bearing: isNavigating ? heading : 0,
      pitch: isNavigating ? 52 : 45,
      zoom: isNavigating ? 19 : 18,
      duration: 800,
      easing: (t) => t * (2 - t),
    })
  }, [currentPosition, heading, isNavigating])

  // Position dot
  useEffect(() => {
    if (!mapRef.current) return
    if (positionMarkerRef.current) { positionMarkerRef.current.remove(); positionMarkerRef.current = null }
    if (!currentPosition) return

    const el = document.createElement("div")
    el.innerHTML = `
      <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:52px;height:52px;background:rgba(0,94,184,0.15);border-radius:50%;animation:pulse 2s infinite;"></div>
        <div style="width:22px;height:22px;background:#005EB8;border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(0,94,184,0.7);position:relative;z-index:2;"></div>
        <div style="position:absolute;top:-4px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid #005EB8;"></div>
      </div>`
    el.style.cssText = "width:52px;height:52px;cursor:default;"

    positionMarkerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "map" })
      .setLngLat([currentPosition.lng, currentPosition.lat])
      .addTo(mapRef.current)
  }, [currentPosition])

  // Rotate arrow
  useEffect(() => {
    if (positionMarkerRef.current) positionMarkerRef.current.setRotation(heading)
  }, [heading])

  // Destination pin
  useEffect(() => {
    if (!mapRef.current) return
    if (destMarkerRef.current) { destMarkerRef.current.remove(); destMarkerRef.current = null }
    if (!destination || !isNavigating) return

    const el = document.createElement("div")
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="background:#DA291C;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:32px;height:32px;box-shadow:0 3px 10px rgba(218,41,28,0.5);"></div>
        <div style="background:white;border:2px solid #DA291C;border-radius:8px;padding:2px 6px;font-size:10px;font-weight:700;color:#DA291C;margin-top:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.15);max-width:120px;overflow:hidden;text-overflow:ellipsis;">${destination.name}</div>
      </div>`
    el.style.cssText = "cursor:default;"

    destMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([destination.coordinates.lng, destination.coordinates.lat])
      .addTo(mapRef.current)
  }, [destination, isNavigating])

  // Route line
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getSource("route")) return
    const source = mapRef.current.getSource("route") as maplibregl.GeoJSONSource
    if (isNavigating && route && destination && currentPosition) {
      source.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [
          [currentPosition.lng, currentPosition.lat],
          [destination.coordinates.lng, destination.coordinates.lat],
        ]},
        properties: {},
      })
    } else {
      source.setData({ type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} })
    }
  }, [isNavigating, route, destination, currentPosition])

  // Waypoint markers per floor
  useEffect(() => {
    if (!mapRef.current) return
    waypointMarkersRef.current.forEach((m) => m.remove())
    waypointMarkersRef.current = []

    const floorWaypoints = waypoints.filter(
      (w) => w.floor === currentFloor && !["lift", "stairs"].includes(w.type)
    )

    floorWaypoints.forEach((w) => {
      if (!mapRef.current) return
      const isDestination = destination?.id === w.id
      const el = document.createElement("div")
      el.innerHTML = `
        <div style="background:${isDestination ? "#DA291C" : "white"};border:2.5px solid ${isDestination ? "#DA291C" : "#005EB8"};border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.2);cursor:pointer;">${WAYPOINT_TYPE_ICONS[w.type] ?? "📍"}</div>`
      el.style.cssText = "width:34px;height:34px;"

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([w.coordinates.lng, w.coordinates.lat])
        .setPopup(new maplibregl.Popup({ offset: 20, closeButton: false })
          .setHTML(`<b style="font-size:13px">${w.name}</b>${w.description ? `<br><span style="font-size:11px;color:#666">${w.description}</span>` : ""}`))
        .addTo(mapRef.current)

      waypointMarkersRef.current.push(marker)
    })
  }, [currentFloor, destination, waypoints])

  return <div id="map-container" className="w-full h-full" />
}
