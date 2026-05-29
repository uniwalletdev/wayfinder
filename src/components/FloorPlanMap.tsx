"use client"

import { useEffect, useRef, MutableRefObject } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapLocation, Route, Coordinates } from "@/lib/types"
import { GOSH_BUILDINGS, ACTIVE_SITE, SITE_MAP } from "@/lib/gosh-data"

interface Props {
  currentPosition: Coordinates | null
  destination: MapLocation | null
  route: Route | null
  isNavigating: boolean
  onMapReady: () => void
  onSelectBuilding?: (buildingId: string) => void
  leafletMapRef?: MutableRefObject<{ flyTo: (latlng: [number, number], zoom: number) => void } | null>
}

export default function FloorPlanMap({
  currentPosition,
  destination,
  route,
  isNavigating,
  onMapReady,
  onSelectBuilding,
  leafletMapRef,
}: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const positionMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const buildingLayersRef = useRef<L.Marker[]>([])
  const onSelectBuildingRef = useRef(onSelectBuilding)
  useEffect(() => {
    onSelectBuildingRef.current = onSelectBuilding
  }, [onSelectBuilding])

  // Init map once
  useEffect(() => {
    if (mapRef.current) return

    const map = L.map("map-container", {
      center: [ACTIVE_SITE.center.lat, ACTIVE_SITE.center.lng],
      zoom: ACTIVE_SITE.defaultZoom,
      zoomControl: false,
      attributionControl: false,
      maxZoom: 21,
      minZoom: 16,
    })

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 22,
    }).addTo(map)

    // Georeferenced official site map laid over the real world.
    L.imageOverlay(SITE_MAP.imageUrl, SITE_MAP.bounds as L.LatLngBoundsExpression, {
      opacity: 1,
      interactive: false,
    }).addTo(map)

    mapRef.current = map
    if (leafletMapRef) leafletMapRef.current = map
    onMapReady()

    return () => {
      map.remove()
      mapRef.current = null
      if (leafletMapRef) leafletMapRef.current = null
    }
  }, [])

  // Building markers
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    buildingLayersRef.current.forEach((m) => map.removeLayer(m))
    buildingLayersRef.current = []

    GOSH_BUILDINGS.forEach((b) => {
      const isDest = destination?.buildingId === b.id
      const icon = L.divIcon({
        html: `<div style="
          display:inline-flex;align-items:center;gap:4px;
          background:${isDest ? "#DA291C" : "rgba(255,255,255,0.95)"};
          color:${isDest ? "#fff" : "#1f2937"};
          border:1.5px solid ${isDest ? "#DA291C" : "#005EB8"};
          border-radius:9999px;
          padding:2px 7px;
          font-size:10px;font-weight:600;line-height:1.1;
          white-space:nowrap;
          box-shadow:0 1px 4px rgba(0,0,0,0.25);
          opacity:${b.precise ? 1 : 0.75};
        ">
          <span style="width:6px;height:6px;border-radius:50%;background:${isDest ? "#fff" : "#005EB8"};display:inline-block;"></span>
          ${b.name}
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        className: "",
      })

      const marker = L.marker([b.coordinates.lat, b.coordinates.lng], { icon }).addTo(map)
      marker.on("click", () => onSelectBuildingRef.current?.(b.id))
      buildingLayersRef.current.push(marker)
    })
  }, [destination])

  // Position marker
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (positionMarkerRef.current) {
      map.removeLayer(positionMarkerRef.current)
      positionMarkerRef.current = null
    }

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
      const marker = L.marker([currentPosition.lat, currentPosition.lng], { icon, zIndexOffset: 1000 })
      marker.addTo(map)
      positionMarkerRef.current = marker
    }
  }, [currentPosition])

  // Route + destination pin
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

    if (isNavigating && route && destination) {
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

      if (currentPosition) {
        const polyline = L.polyline(
          [
            [currentPosition.lat, currentPosition.lng],
            [destination.coordinates.lat, destination.coordinates.lng],
          ],
          { color: "#00BFFF", weight: 6, opacity: 0.9, lineCap: "round", lineJoin: "round", dashArray: "1, 12" }
        )
        polyline.addTo(map)
        routeLayerRef.current = polyline
        map.fitBounds(polyline.getBounds(), { padding: [90, 90], maxZoom: 20 })
      } else {
        map.flyTo([destination.coordinates.lat, destination.coordinates.lng], 19)
      }
    }
  }, [isNavigating, route, destination, currentPosition])

  return <div id="map-container" className="w-full h-full" style={{ isolation: "isolate" }} />
}
