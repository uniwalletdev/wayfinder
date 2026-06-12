"use client"

import React, { useEffect, useRef, useState, MutableRefObject } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
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

// Free, keyless vector style with OSM building footprints (for extrusion).
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty"

/**
 * 3D map view — same contract as FloorPlanMap, rendered with MapLibre GL at a
 * 60° tilt with extruded buildings. The shared leafletMapRef handle is adapted
 * so the page's flyTo / re-centre logic works unchanged in either view.
 */
export default function Map3DView({
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const positionMarkerRef = useRef<maplibregl.Marker | null>(null)
  const destMarkerRef = useRef<maplibregl.Marker | null>(null)
  const waypointMarkersRef = useRef<maplibregl.Marker[]>([])
  const framedDestRef = useRef<string | null>(null)
  const [styleReady, setStyleReady] = useState(false)

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
    if (mapRef.current || !containerRef.current) return

    const start = positionRef.current ?? GOSH_CENTER
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [start.lng, start.lat],
      zoom: 17,
      pitch: 60,
      bearing: -15,
      attributionControl: false,
    })

    map.on("load", () => {
      // The liberty style ships a 3D building layer; if a future style change
      // drops it, extrude the OSM building footprints ourselves.
      const has3d = map.getStyle().layers?.some((l) => l.type === "fill-extrusion")
      if (!has3d && map.getSource("openmaptiles")) {
        map.addLayer({
          id: "wf-building-3d",
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#d6d0c8",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.85,
          },
        })
      }
      setStyleReady(true)
      onMapReady()
    })

    const onUserInteract = () => setFollow(false)
    map.on("dragstart", onUserInteract)
    map.on("zoomstart", () => {
      if (!programmaticRef.current) onUserInteract()
    })

    mapRef.current = map
    if (leafletMapRef) {
      // Adapt to the Leaflet-style handle the page uses ([lat, lng] order).
      leafletMapRef.current = {
        flyTo: ([lat, lng], zoom) => map.flyTo({ center: [lng, lat], zoom }),
      }
    }

    return () => {
      map.remove()
      mapRef.current = null
      if (leafletMapRef) leafletMapRef.current = null
    }
  }, [])

  // Floor plan image overlay
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    if (map.getLayer("wf-floorplan")) map.removeLayer("wf-floorplan")
    if (map.getSource("wf-floorplan")) map.removeSource("wf-floorplan")

    const plan = FLOOR_PLANS.find((fp) => fp.floor === currentFloor)
    if (!plan) return
    const [[s, w], [n, e]] = plan.bounds
    map.addSource("wf-floorplan", {
      type: "image",
      url: plan.imageUrl,
      coordinates: [
        [w, n],
        [e, n],
        [e, s],
        [w, s],
      ],
    })
    map.addLayer({
      id: "wf-floorplan",
      type: "raster",
      source: "wf-floorplan",
      paint: { "raster-opacity": 0.85 },
    })
  }, [currentFloor, styleReady])

  // Waypoint markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    waypointMarkersRef.current.forEach((m) => m.remove())
    waypointMarkersRef.current = []

    waypoints
      .filter((wp) => wp.floor === currentFloor)
      .forEach((wp) => {
        const el = document.createElement("div")
        el.innerHTML = `<div style="
          background:${destination?.id === wp.id ? "#DA291C" : "white"};
          border:2px solid ${destination?.id === wp.id ? "#DA291C" : "#005EB8"};
          border-radius:50%;
          width:32px;height:32px;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;
          box-shadow:0 2px 6px rgba(0,0,0,0.25);
        ">${WAYPOINT_TYPE_ICONS[wp.type]}</div>`

        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(
          `<b>${wp.name}</b>${wp.description ? `<br><small>${wp.description}</small>` : ""}`
        )
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([wp.coordinates.lng, wp.coordinates.lat])
          .setPopup(popup)
          .addTo(map)
        waypointMarkersRef.current.push(marker)
      })
  }, [currentFloor, destination, waypoints])

  // Walked survey trails for the current floor
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    if (map.getLayer("wf-trails")) map.removeLayer("wf-trails")
    if (map.getSource("wf-trails")) map.removeSource("wf-trails")

    const lines = trails
      .filter((t) => t.floor === currentFloor && t.points.length >= 2)
      .map((t) => ({
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: t.points.map((p) => [p.lng, p.lat]),
        },
      }))
    if (lines.length === 0) return

    map.addSource("wf-trails", {
      type: "geojson",
      data: { type: "FeatureCollection", features: lines },
    })
    map.addLayer({
      id: "wf-trails",
      type: "line",
      source: "wf-trails",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#7C3AED", "line-width": 4, "line-opacity": 0.55, "line-dasharray": [1.5, 2] },
    })
  }, [currentFloor, trails, styleReady])

  // Live position marker (same pulsing dot as the 2D view)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!currentPosition) {
      positionMarkerRef.current?.remove()
      positionMarkerRef.current = null
      return
    }

    if (positionMarkerRef.current) {
      positionMarkerRef.current.setLngLat([currentPosition.lng, currentPosition.lat])
      return
    }

    const el = document.createElement("div")
    el.innerHTML = `<div style="position:relative;width:44px;height:44px;">
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
    </div>`
    positionMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([currentPosition.lng, currentPosition.lat])
      .addTo(map)
  }, [currentPosition])

  // Route line + destination pin, with the same preview/navigation framing as 2D
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return

    if (map.getLayer("wf-route")) map.removeLayer("wf-route")
    if (map.getSource("wf-route")) map.removeSource("wf-route")
    destMarkerRef.current?.remove()
    destMarkerRef.current = null

    if (!route || !destination || route.geometry.length < 2) {
      framedDestRef.current = null
      setFollow(true)
      return
    }

    const coords = route.geometry.map((p) => [p.lng, p.lat] as [number, number])
    map.addSource("wf-route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      },
    })
    map.addLayer({
      id: "wf-route",
      type: "line",
      source: "wf-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#00BFFF", "line-width": 6, "line-opacity": 0.9, "line-dasharray": [0.1, 2] },
    })

    const el = document.createElement("div")
    el.innerHTML = `<div class="wf-dest-pin"><div style="
      background:#DA291C;
      border:3px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      width:28px;height:28px;
      box-shadow:0 2px 8px rgba(218,41,28,0.5);
    "></div></div>`
    destMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([destination.coordinates.lng, destination.coordinates.lat])
      .addTo(map)

    const frame = () => {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      )
      programmaticRef.current = true
      map.fitBounds(bounds, { padding: 70, pitch: 50 })
      map.once("moveend", () => {
        programmaticRef.current = false
      })
    }

    if (!isNavigating) {
      frame()
      framedDestRef.current = null
    } else if (framedDestRef.current !== destination.id) {
      frame()
      framedDestRef.current = destination.id
      setFollow(true)
    }
  }, [isNavigating, route, destination, styleReady])

  // Follow the walker while navigating
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isNavigating || !currentPosition) return
    if (!followingRef.current) return
    map.easeTo({ center: [currentPosition.lng, currentPosition.lat], duration: 800 })
  }, [currentPosition, isNavigating])

  const recenter = () => {
    const pos = positionRef.current
    const map = mapRef.current
    if (pos && map) {
      programmaticRef.current = true
      map.easeTo({ center: [pos.lng, pos.lat], duration: 600 })
      map.once("moveend", () => {
        programmaticRef.current = false
      })
    }
    setFollow(true)
  }

  const showRecenter = isNavigating && !following && currentPosition

  return (
    <div className="relative w-full h-full" style={{ isolation: "isolate" }}>
      <div ref={containerRef} className="w-full h-full" />
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
