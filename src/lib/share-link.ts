// Links into the app: what a shared URL, a printed QR poster and an in-app QR
// scan all carry, and the one parser that reads them.
//
// A share used to be `wayfinder.app/<venue>/<waypoint>` — a domain the app
// does not own and a path it never handled — and the poster's QR code held a
// bare `floor:…:lat:…:lng:…:dest:…` string that only the app's own scanner
// understood, under a caption telling people to point their phone's camera at
// it. Both now carry a real URL on this deployment:
//
//   /navigate?venue=gosh&to=pharmacy&floor=0&lat=51.52&lng=-0.12&stepfree=1
//
// A phone camera opens it in the browser; the in-app scanner reads the same
// URL; and the address bar becomes a share link in its own right, because the
// app keeps `venue` and `to` in it as you go. The legacy colon payload is still
// accepted so posters already on walls keep working.

import type { Coordinates } from "./types"

export const NAVIGATE_PATH = "/navigate"

export interface LinkAnchor extends Coordinates {
  floor: number
}

export interface WayfinderLink {
  venueId?: string
  destinationId?: string
  // A positioning fix: the place the code is posted at. Scanning it re-anchors
  // the walker there before routing.
  anchor?: LinkAnchor
  stepFree?: boolean
}

const MAX_ID_CHARS = 200

function cleanId(v: string | null | undefined): string | undefined {
  if (typeof v !== "string") return undefined
  const s = v.trim().slice(0, MAX_ID_CHARS)
  return s ? s : undefined
}

function finite(v: string | null | undefined): number | null {
  if (v == null || v.trim() === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function anchorFrom(floor: string | null | undefined, lat: string | null | undefined, lng: string | null | undefined): LinkAnchor | undefined {
  const f = finite(floor)
  const la = finite(lat)
  const ln = finite(lng)
  if (f == null || la == null || ln == null) return undefined
  if (!Number.isInteger(f) || f < -10 || f > 200) return undefined
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return undefined
  return { floor: f, lat: la, lng: ln }
}

function isEmpty(link: WayfinderLink): boolean {
  return !link.venueId && !link.destinationId && !link.anchor && !link.stepFree
}

// Read a link out of query parameters. Returns null when nothing usable is
// there, so callers can tell "no link" from "a link with nothing set".
export function linkFromSearchParams(params: URLSearchParams): WayfinderLink | null {
  const link: WayfinderLink = {
    venueId: cleanId(params.get("venue")),
    destinationId: cleanId(params.get("to")),
    anchor: anchorFrom(params.get("floor"), params.get("lat"), params.get("lng")),
    stepFree: params.get("stepfree") === "1" || params.get("stepfree") === "true" ? true : undefined,
  }
  return isEmpty(link) ? null : link
}

// The pre-URL poster format: `floor:<n>:lat:<x>:lng:<y>[:dest:<waypointId>]`.
// Colons separate fields, and a waypoint id can itself contain colons only if
// it is the last field, which the format guarantees.
function parseLegacyPayload(data: string): WayfinderLink | null {
  const parts = data.split(":")
  const at = (key: string) => {
    const i = parts.indexOf(key)
    return i >= 0 ? parts[i + 1] : undefined
  }
  const destIdx = parts.indexOf("dest")
  const link: WayfinderLink = {
    anchor: anchorFrom(at("floor"), at("lat"), at("lng")),
    destinationId: destIdx >= 0 ? cleanId(parts.slice(destIdx + 1).join(":")) : undefined,
  }
  return isEmpty(link) ? null : link
}

// Accepts a full URL (any origin — the poster may have been printed from a
// different deployment), a query string, or the legacy colon payload.
export function parseWayfinderLink(input: string): WayfinderLink | null {
  const s = input.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s) || s.startsWith("/") || s.startsWith("?")) {
    try {
      const url = new URL(s, "https://wayfinder.invalid")
      return linkFromSearchParams(url.searchParams)
    } catch {
      return null
    }
  }
  if (/(^|:)(floor|lat|lng|dest):/.test(s)) return parseLegacyPayload(s)
  return null
}

// The URL for a link, on the given origin (window.location.origin at runtime;
// tests pass a fixed one). Only set fields are written, in a stable order, so
// the same link always produces the same string.
export function buildNavigateUrl(origin: string, link: WayfinderLink): string {
  const params = new URLSearchParams()
  if (link.venueId) params.set("venue", link.venueId)
  if (link.destinationId) params.set("to", link.destinationId)
  if (link.anchor) {
    params.set("floor", String(link.anchor.floor))
    params.set("lat", link.anchor.lat.toFixed(6))
    params.set("lng", link.anchor.lng.toFixed(6))
  }
  if (link.stepFree) params.set("stepfree", "1")
  const q = params.toString()
  return `${origin.replace(/\/+$/, "")}${NAVIGATE_PATH}${q ? `?${q}` : ""}`
}

// Short form for showing under a QR code or in a share sheet: no scheme, no
// one-time positioning fields.
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "")
}
