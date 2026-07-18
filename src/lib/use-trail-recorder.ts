import { useEffect, useRef } from "react"
import { Coordinates } from "./types"
import { distanceMeters } from "./routing"
import { getDeviceId } from "./device-id"

// Records the path a navigator walks *while being routed* and posts it to
// /api/signals as a 'trail' — the highest-value passive signal, because the
// router already builds indoor routes from exactly this shape (SurveyTrail
// corridor centre-lines). A navigator doing nothing but following directions is
// producing the corridor data the venue was missing; today that trace is thrown
// away when navigation ends. This captures it. It never blocks or interrupts
// navigation: accumulation is cheap, the flush is fire-and-forget, and with no
// database configured the endpoint simply drops it (device-only mode).

// Ignore sub-3m jitter so a trail is real movement, not a stationary GPS wobble.
const MIN_POINT_DISTANCE_M = 3
// Match the server's per-signal cap so we never build a body it will trim.
const MAX_POINTS_PER_SEGMENT = 400
// Fewer points than this isn't a corridor worth pooling.
const MIN_SEGMENT_POINTS = 4

interface Params {
  // True while turn-by-turn guidance is running (navState.isNavigating).
  active: boolean
  // venue_key for the signal — the active venue id, matching how search-misses
  // keys its rows (seed venues like "gosh", device-local venues like "venue-…").
  venueId: string
  position: Coordinates | null
  floor: number
}

function flush(venueId: string, floor: number, points: Coordinates[]) {
  if (!venueId || points.length < MIN_SEGMENT_POINTS) return
  void fetch("/api/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ venueId, deviceId: getDeviceId(), kind: "trail", floor, points }),
    // Let the post survive the page being backgrounded/closed on arrival.
    keepalive: true,
  }).catch(() => {})
}

export function useTrailRecorder({ active, venueId, position, floor }: Params) {
  // The path collected for the floor currently being walked. A trail signal is
  // single-floor (like SurveyTrail), so a floor change flushes the finished
  // segment and starts a new one.
  const segment = useRef<Coordinates[]>([])
  const segmentFloor = useRef(floor)
  const wasActive = useRef(false)

  useEffect(() => {
    // Navigation just started — begin a fresh recording on the current floor.
    if (active && !wasActive.current) {
      wasActive.current = true
      segment.current = []
      segmentFloor.current = floor
    }

    // Navigation just ended (arrival + Stop, or Clear) — flush what we walked.
    if (!active && wasActive.current) {
      wasActive.current = false
      flush(venueId, segmentFloor.current, segment.current)
      segment.current = []
      return
    }

    if (!active || !position) return

    // Crossed to another floor — the segment for the previous floor is complete.
    if (floor !== segmentFloor.current) {
      flush(venueId, segmentFloor.current, segment.current)
      segment.current = []
      segmentFloor.current = floor
    }

    const last = segment.current[segment.current.length - 1]
    if (!last || distanceMeters(last, position) >= MIN_POINT_DISTANCE_M) {
      if (segment.current.length < MAX_POINTS_PER_SEGMENT) {
        segment.current.push({ lat: position.lat, lng: position.lng })
      }
    }
  }, [active, position, floor, venueId])
}
