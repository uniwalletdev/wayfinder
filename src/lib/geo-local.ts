import type { Coordinates } from "./types"

// Converting between the app's geographic coordinates (lat/lng) and the flat,
// metre-based local space that a WebXR AR session tracks. At the scale of a
// single building or campus the Earth is effectively flat, so a local tangent
// plane (East/North/Up) around an origin point is accurate to well under a
// metre — plenty for placing arrows on a corridor floor.

const M_PER_DEG_LAT = 111320

// Metres East and North of `p` relative to `origin`, on the local tangent
// plane. East follows +lng, North follows +lat; both shrink with latitude for
// East only (lines of longitude converge toward the poles).
export function enuOffset(origin: Coordinates, p: Coordinates): { east: number; north: number } {
  const north = (p.lat - origin.lat) * M_PER_DEG_LAT
  const east = (p.lng - origin.lng) * M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180)
  return { east, north }
}

// Shortest signed turn from bearing `a` to bearing `b`, in (-180, 180].
export function bearingDelta(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180
}
