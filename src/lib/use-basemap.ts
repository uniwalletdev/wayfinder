"use client"

import { useEffect, useState } from "react"
import L from "leaflet"
import { apiUrl } from "./app-shell"
import { BASEMAP_ATTRIBUTION, CARTO_TILES, MAX_TILE_ZOOM, type BasemapSource, type BasemapStyle } from "./basemap"

// Which street map to draw (src/lib/basemap.ts), asked once per page load.
// Unanswered within a few seconds, or offline, it is CARTO's, as before; a
// failed answer is asked again by the next map that mounts.
let answer: Promise<BasemapSource> | null = null
function askSource(): Promise<BasemapSource> {
  answer ??= (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    try {
      const res = await fetch(apiUrl("/api/basemap"), { signal: controller.signal })
      const data = (await res.json()) as { source?: unknown }
      return data.source === "mapbox" ? "mapbox" : "carto"
    } catch {
      answer = null
      return "carto"
    } finally {
      clearTimeout(timer)
    }
  })()
  return answer
}

// null until the server has said.
export function useBasemapSource(): BasemapSource | null {
  const [source, setSource] = useState<BasemapSource | null>(null)
  useEffect(() => {
    let live = true
    askSource().then((s) => {
      if (live) setSource(s)
    })
    return () => {
      live = false
    }
  }, [])
  return source
}

// Errors before the first Mapbox tile arrives that mean the tiles are not
// coming (a token without the tiles scope, say): the map then draws CARTO's
// instead of staying blank.
const FALLBACK_AFTER_ERRORS = 6

// The street map layer, with the attribution its source asks for. The map
// needs an attribution control for that to show.
export function basemapLayer(source: BasemapSource, style: BasemapStyle, onFallback?: (layer: L.TileLayer) => void): L.TileLayer {
  if (source === "carto") return L.tileLayer(CARTO_TILES[style], { maxZoom: MAX_TILE_ZOOM, attribution: BASEMAP_ATTRIBUTION.carto })
  const layer = L.tileLayer(apiUrl(`/api/basemap/${style}/{z}/{x}/{y}{r}`), { maxZoom: MAX_TILE_ZOOM, attribution: BASEMAP_ATTRIBUTION.mapbox })
  let loaded = false
  let errors = 0
  layer.on("tileload", () => {
    loaded = true
  })
  layer.on("tileerror", () => {
    if (loaded || ++errors < FALLBACK_AFTER_ERRORS) return
    loaded = true
    const map = (layer as unknown as { _map?: L.Map })._map
    if (!map) return
    const fallback = basemapLayer("carto", style).addTo(map)
    fallback.bringToBack()
    map.removeLayer(layer)
    onFallback?.(fallback)
  })
  return layer
}
