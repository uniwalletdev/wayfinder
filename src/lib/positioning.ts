import { Coordinates } from "./types"

const EARTH_R = 6371000

export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return EARTH_R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export function moveByHeading(
  pos: Coordinates,
  heading: number,
  distanceM: number
): Coordinates {
  const rad = (heading * Math.PI) / 180
  const dlat = ((distanceM * Math.cos(rad)) / EARTH_R) * (180 / Math.PI)
  const dlng =
    ((distanceM * Math.sin(rad)) /
      (EARTH_R * Math.cos((pos.lat * Math.PI) / 180))) *
    (180 / Math.PI)
  return { lat: pos.lat + dlat, lng: pos.lng + dlng }
}

// Dead reckon from last GPS fix using heading + estimated walk speed
// Call this on each compass update when GPS hasn't updated recently
export function deadReckon(
  lastFix: Coordinates,
  lastFixTime: number,
  heading: number,
  isMoving: boolean,
  walkSpeedMs = 1.2 // average 1.2 m/s walking
): Coordinates {
  if (!isMoving) return lastFix
  const elapsedS = (Date.now() - lastFixTime) / 1000
  if (elapsedS <= 0 || elapsedS > 30) return lastFix // don't drift more than 30s
  const distanceM = walkSpeedMs * elapsedS
  return moveByHeading(lastFix, heading, distanceM)
}
