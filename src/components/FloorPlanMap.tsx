"use client"

import { useEffect, useRef, MutableRefObject } from "react"
import L from "@/lib/leaflet-setup" // exposes global L + leaflet-rotate, must precede the plugin below
import "leaflet/dist/leaflet.css"
import "leaflet-imageoverlay-rotated"
import { MapLocation, Route, Coordinates } from "@/lib/types"
import { GOSH_BUILDINGS, ACTIVE_SITE, SITE_MAP } from "@/lib/gosh-data"

// leaflet-rotate augments L.Map with these (no published types).
interface RotatableMap extends L.Map {
  setBearing: (deg: number) => void
  getBearing: () => number
  compassBearing: { enable: () => void; disable: () => void; enabled: () => boolean }
  touchRotate: { enable: () => void; disable: () => void }
}

export interface MapHandle {
  flyTo: (latlng: [number, number], zoom: number) => void
  enableCompass: () => Promise<boolean>
  disableCompass: () => void
}

interface Props {
  currentPosition: Coordinates | null
  destination: MapLocation | null
  route: Route | null
  isNavigating: boolean
  onMapReady: () => void
  onSelectBuilding?: (buildingId: string) => void
  leafletMapRef?: MutableRefObject<MapHandle | null>
}

type IOSDeviceOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">
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
  const mapRef = useRef<RotatableMap | null>(null)
  const positionMarkerRef = useRef<L.Marker | null>(null)
  const coneElRef = useRef<HTMLElement | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const buildingLayersRef = useRef<L.Marker[]>([])
  const headingRef = useRef<number | null>(null)
  const onSelectBuildingRef = useRef(onSelectBuilding)
  useEffect(() => {
    onSelectBuildingRef.current = onSelectBuilding
  }, [onSelectBuilding])

  // The map itself is rotated heading-up while the compass is on, so the facing
  // direction is always screen-up — the cone just needs to be shown.
  function updateCone() {
    const el = coneElRef.current
    if (!el) return
    el.style.display = headingRef.current == null ? "none" : "block"
  }

  function onOrientation(e: DeviceOrientationEvent) {
    const ev = e as DeviceOrientationEvent & { webkitCompassHeading?: number }
    let h: number | null = null
    if (typeof ev.webkitCompassHeading === "number") h = ev.webkitCompassHeading
    else if (ev.absolute && typeof ev.alpha === "number") h = 360 - ev.alpha
    if (h != null) {
      headingRef.current = h
      updateCone()
    }
  }

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
      // leaflet-rotate options
      rotate: true,
      rotateControl: false,
      touchRotate: true,
      bearing: 0,
    } as L.MapOptions) as RotatableMap

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 22,
    }).addTo(map)

    // Georeferenced official site map (transparent bg, rotated to the real
    // street grid) laid over the live map via three real-world corners.
    const c = SITE_MAP.corners
    const rotatedFactory = (L.imageOverlay as unknown as {
      rotated?: (
        url: string,
        tl: L.LatLngExpression,
        tr: L.LatLngExpression,
        bl: L.LatLngExpression,
        opts: L.ImageOverlayOptions
      ) => L.Layer
    }).rotated
    if (rotatedFactory) {
      rotatedFactory(SITE_MAP.imageUrl, c.topLeft, c.topRight, c.bottomLeft, {
        opacity: 0.95,
        interactive: false,
      }).addTo(map)
    } else {
      // Fallback: axis-aligned overlay (un-rotated) if the plugin is unavailable.
      L.imageOverlay(SITE_MAP.imageUrl, SITE_MAP.bounds as L.LatLngBoundsExpression, {
        opacity: 0.95,
        interactive: false,
      }).addTo(map)
    }

    map.on("rotate", updateCone)

    mapRef.current = map
    if (leafletMapRef) {
      leafletMapRef.current = {
        flyTo: (latlng, zoom) => map.flyTo(latlng, zoom),
        enableCompass: async () => {
          const DOE = window.DeviceOrientationEvent as IOSDeviceOrientation | undefined
          if (DOE?.requestPermission) {
            try {
              const res = await DOE.requestPermission()
              if (res !== "granted") return false
            } catch {
              return false
            }
          }
          window.addEventListener("deviceorientationabsolute", onOrientation as EventListener)
          window.addEventListener("deviceorientation", onOrientation as EventListener)
          try {
            map.compassBearing.enable()
          } catch {}
          return true
        },
        disableCompass: () => {
          window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener)
          window.removeEventListener("deviceorientation", onOrientation as EventListener)
          try {
            map.compassBearing.disable()
          } catch {}
          map.setBearing(0)
          headingRef.current = null
          updateCone()
        },
      }
    }
    onMapReady()

    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener)
      window.removeEventListener("deviceorientation", onOrientation as EventListener)
      map.remove()
      mapRef.current = null
      if (leafletMapRef) leafletMapRef.current = null
    }
  }, [])

  // Building markers — small interactive dots (the artwork already prints the names).
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    buildingLayersRef.current.forEach((m) => map.removeLayer(m))
    buildingLayersRef.current = []

    GOSH_BUILDINGS.forEach((b) => {
      const isDest = destination?.buildingId === b.id
      const size = isDest ? 16 : b.precise ? 12 : 9
      const color = isDest ? "#DA291C" : "#005EB8"
      const icon = L.divIcon({
        html: `<div title="${b.name}" style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${color};border:2px solid #fff;
          box-shadow:0 1px 4px rgba(0,0,0,0.4);
          opacity:${b.precise || isDest ? 1 : 0.6};
          cursor:pointer;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        className: "",
      })
      const marker = L.marker([b.coordinates.lat, b.coordinates.lng], {
        icon,
        // keep dots fixed to the map surface so they sit on the artwork
      }).addTo(map)
      marker.bindTooltip(b.name, { direction: "top", offset: [0, -size / 2] })
      marker.on("click", () => onSelectBuildingRef.current?.(b.id))
      buildingLayersRef.current.push(marker)
    })
  }, [destination])

  // Position marker (dot + heading cone)
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (positionMarkerRef.current) {
      map.removeLayer(positionMarkerRef.current)
      positionMarkerRef.current = null
      coneElRef.current = null
    }

    if (currentPosition) {
      const icon = L.divIcon({
        html: `<div style="position:relative;width:40px;height:40px;">
          <div class="wf-cone" style="
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%);
            width:0;height:0;
            border-left:13px solid transparent;border-right:13px solid transparent;
            border-bottom:26px solid rgba(0,94,184,0.45);
            margin-top:-22px;
            display:none;
            transform-origin:50% 100%;
          "></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;background:#005EB8;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,94,184,0.6);"></div>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        className: "",
      })
      const marker = L.marker([currentPosition.lat, currentPosition.lng], { icon, zIndexOffset: 1000 })
      marker.addTo(map)
      positionMarkerRef.current = marker
      const el = marker.getElement()?.querySelector<HTMLElement>(".wf-cone") ?? null
      coneElRef.current = el
      updateCone()
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
