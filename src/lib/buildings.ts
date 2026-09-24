import type { Coordinates, Waypoint } from "./types"
import { distanceMeters } from "./routing"

// Buildings on a multi-building hospital site, and which storeys each one has.
//
// A venue's floor list is the union of every building's floors. At GOSH that is
// ten levels, but the Sight and Sound Centre has three and Weston House eight,
// so a rail offering all ten while you stand in the Sight and Sound Centre
// offers seven floors you cannot walk to without changing building. Knowing the
// building lets the rail offer the floors that are actually above and below you.

export interface Building {
  name: string
  floors: number[]
}

// A building needs a few waypoints before it is believed: one stray
// "Chapel - Variety Club Building" is a label, not a floor plan.
const MIN_WAYPOINTS = 3

// "Nurses Home, Level 4" -> "Nurses Home". A prefix that is itself a place
// inside a building ("Same Day Admissions Unit - Variety Club Building, Level 2")
// names the building after its last " - ".
const STOREY_SUFFIX = /^(.+?),\s*(?:Level|Floor|Ground|Basement|Lower|Upper|First|Second|Third)\b/i

export function buildingOf(w: Waypoint): string | null {
  if (w.building?.trim()) return w.building.trim()
  const m = w.description?.match(STOREY_SUFFIX)
  if (!m) return null
  const name = m[1].split(" - ").pop()!.trim()
  return name.length >= 3 ? name : null
}

// Every building with enough evidence, largest first. Fewer than two means the
// site is effectively one building and there is nothing to choose between.
export function venueBuildings(waypoints: Waypoint[]): Building[] {
  const floors = new Map<string, Set<number>>()
  const counts = new Map<string, number>()
  for (const w of waypoints) {
    const b = buildingOf(w)
    if (!b) continue
    counts.set(b, (counts.get(b) ?? 0) + 1)
    if (!floors.has(b)) floors.set(b, new Set())
    floors.get(b)!.add(w.floor)
  }
  const out = [...floors]
    .filter(([name]) => (counts.get(name) ?? 0) >= MIN_WAYPOINTS)
    .map(([name, f]) => ({ name, floors: [...f].sort((a, b) => a - b) }))
    .sort((a, b) => b.floors.length - a.floors.length || a.name.localeCompare(b.name))
  return out.length >= 2 ? out : []
}

// Which building is this position in? The building of the nearest tagged
// waypoint on the same floor, if it is close enough to plausibly be the same
// building. Nothing is better than a guess: a wrong building hides floors.
export function buildingAt(
  position: Coordinates | null | undefined,
  floor: number,
  waypoints: Waypoint[],
  buildings: Building[],
  maxMeters = 45
): string | null {
  if (!position || buildings.length === 0) return null
  const known = new Set(buildings.map((b) => b.name))
  let best: { name: string; d: number } | null = null
  for (const w of waypoints) {
    if (w.floor !== floor) continue
    const name = buildingOf(w)
    if (!name || !known.has(name)) continue
    const d = distanceMeters(position, w.coordinates)
    if (d <= maxMeters && (!best || d < best.d)) best = { name, d }
  }
  return best?.name ?? null
}

// The floors to offer for a building (or the whole site when null). The floor
// on screen and the destination's floor are always kept, so choosing a building
// can never strand the map on a floor the rail no longer shows, or hide where
// you are going.
export function floorsInScope(allFloors: number[], building: Building | null, keep: (number | null | undefined)[]): number[] {
  if (!building) return allFloors
  const set = new Set(building.floors.filter((f) => allFloors.includes(f)))
  for (const f of keep) if (f != null && allFloors.includes(f)) set.add(f)
  return [...set].sort((a, b) => a - b)
}
