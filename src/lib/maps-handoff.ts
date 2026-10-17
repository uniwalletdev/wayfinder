import type { Coordinates, TravelMode } from "./types"

// Directions to somewhere outside the building (an address, or the hospital
// itself) are handed to the phone's own maps app. Apple Maps and Google Maps
// do that journey far better than Findway could: live traffic, buses and
// trains, parking, lane-by-lane voice guidance. Findway takes over at the door.
//
// Both are plain https links. On an iPhone, maps.apple.com opens Apple Maps;
// on Android, google.com/maps opens Google Maps; elsewhere each opens its
// website. The apps hand any link to another site to the system, so the same
// link works on the web and inside them.

export type MapsProvider = "apple" | "google"

export const MAPS_PROVIDER_NAMES: Record<MapsProvider, string> = {
  apple: "Apple Maps",
  google: "Google Maps",
}

// Apple Maps on Apple devices (an iPad reports itself as a Mac), Google Maps
// everywhere else.
export function preferredMapsProvider(userAgent: string): MapsProvider {
  return /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(userAgent) ? "apple" : "google"
}

const point = (c: Coordinates) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`

// Directions from wherever the phone is to `destination`, in the travel mode
// chosen in Findway where the provider has it.
export function mapsDirectionsUrl(provider: MapsProvider, destination: Coordinates, mode: TravelMode): string {
  if (provider === "apple") {
    // Apple's link has no cycling mode; Apple Maps then offers its own choice.
    const flag = mode === "walking" ? "w" : mode === "driving" ? "d" : null
    return `https://maps.apple.com/?daddr=${point(destination)}${flag ? `&dirflg=${flag}` : ""}`
  }
  const travel = mode === "cycling" ? "bicycling" : mode
  return `https://www.google.com/maps/dir/?api=1&destination=${point(destination)}&travelmode=${travel}`
}
