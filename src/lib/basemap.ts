// The street map under the floor plans.
//
// With MAPBOX_ACCESS_TOKEN set on the server, the map is Mapbox's: tiles come
// through /api/basemap/<style>/<z>/<x>/<y>, which adds the token on the server,
// so it never reaches a browser or the apps, and the CDN caches each tile. The
// map asks /api/basemap which source to use. Without a token, or when that
// question goes unanswered, it falls back to CARTO's public tiles, as before.

export type BasemapSource = "mapbox" | "carto"
export type BasemapStyle = "light" | "dark"

export const BASEMAP_STYLES: readonly BasemapStyle[] = ["light", "dark"]

// Mapbox's own styles closest to the CARTO ones the map used before.
export const MAPBOX_STYLES: Record<BasemapStyle, string> = {
  light: "streets-v12",
  dark: "dark-v11",
}

export const CARTO_TILES: Record<BasemapStyle, string> = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png",
}

// What each source's terms ask to be shown on the map.
export const BASEMAP_ATTRIBUTION: Record<BasemapSource, string> = {
  mapbox:
    '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> ' +
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ' +
    '<a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener">Improve this map</a>',
  carto:
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ' +
    '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
}

export const MAX_TILE_ZOOM = 22

export interface TileRequest {
  style: BasemapStyle
  z: number
  x: number
  y: number
  retina: boolean
}

// A tile address from the route's path segments, or null when it names no
// tile. The last segment may carry Leaflet's "@2x" for high-density screens.
export function parseTile(style: string, z: string, x: string, y: string): TileRequest | null {
  if (!(BASEMAP_STYLES as readonly string[]).includes(style)) return null
  const ym = /^(\d{1,8})(@2x)?$/.exec(y)
  if (!/^\d{1,2}$/.test(z) || !/^\d{1,8}$/.test(x) || !ym) return null
  const zi = Number(z)
  const xi = Number(x)
  const yi = Number(ym[1])
  if (zi > MAX_TILE_ZOOM) return null
  const n = 2 ** zi
  if (xi >= n || yi >= n) return null
  return { style: style as BasemapStyle, z: zi, x: xi, y: yi, retina: !!ym[2] }
}

// Mapbox's Static Tiles API address for a tile, in 256-pixel tiles to match
// Leaflet's grid.
export function mapboxTileUrl(t: TileRequest, token: string): string {
  return `https://api.mapbox.com/styles/v1/mapbox/${MAPBOX_STYLES[t.style]}/tiles/256/${t.z}/${t.x}/${t.y}${t.retina ? "@2x" : ""}?access_token=${encodeURIComponent(token)}`
}

// How long a tile may be cached: what Mapbox allows for it, a day when it
// does not say, never more than a week.
export function tileCacheSeconds(upstreamCacheControl: string | null): number {
  const m = /(?:^|,)\s*max-age=(\d+)/i.exec(upstreamCacheControl ?? "")
  const s = m ? Number(m[1]) : 86_400
  return Math.max(0, Math.min(s, 7 * 86_400))
}
