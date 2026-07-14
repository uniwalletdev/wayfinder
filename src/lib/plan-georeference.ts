import { Coordinates } from "./types"
import { M_PER_LAT } from "./schematic"

// Turns a point normalised to an uploaded floor-plan image (x, y in 0..1, with
// (0,0) at the image's top-left and (1,1) at its bottom-right) into a real-world
// coordinate, given where the mapper has dragged those two corners on the live
// map. The plan is treated as an upright, non-rotated rectangle — enough to
// place most floor plans; a tilted building needs the source image rotated
// before upload.

export interface PlanCorners {
  topLeft: Coordinates
  bottomRight: Coordinates
}

export function projectPlanPoint(corners: PlanCorners, x: number, y: number): Coordinates {
  const { topLeft, bottomRight } = corners
  return {
    lat: topLeft.lat + (bottomRight.lat - topLeft.lat) * y,
    lng: topLeft.lng + (bottomRight.lng - topLeft.lng) * x,
  }
}

export function cornersToBounds(corners: PlanCorners): [[number, number], [number, number]] {
  return [
    [corners.topLeft.lat, corners.topLeft.lng],
    [corners.bottomRight.lat, corners.bottomRight.lng],
  ]
}

// Metres spanned by the longer edge of the default placement rectangle, before
// the mapper drags it into position — roughly a small building footprint. A
// whole-site map sheet passes a larger span instead.
const DEFAULT_SPAN_M = 40

// A starting rectangle around `center`, sized to the plan image's aspect ratio,
// for the mapper to then drag into alignment with the real building.
export function defaultPlanCorners(center: Coordinates, aspectRatio: number, spanM: number = DEFAULT_SPAN_M): PlanCorners {
  const mPerLng = M_PER_LAT * Math.cos((center.lat * Math.PI) / 180)
  const halfWidthM = aspectRatio >= 1 ? spanM / 2 : (spanM * aspectRatio) / 2
  const halfHeightM = aspectRatio >= 1 ? spanM / 2 / aspectRatio : spanM / 2
  return {
    topLeft: {
      lat: center.lat + halfHeightM / M_PER_LAT,
      lng: center.lng - halfWidthM / mPerLng,
    },
    bottomRight: {
      lat: center.lat - halfHeightM / M_PER_LAT,
      lng: center.lng + halfWidthM / mPerLng,
    },
  }
}
