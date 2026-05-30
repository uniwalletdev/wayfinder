// Pure utility functions for NavGraph traversal.
// Graph data lives inside each Venue object (src/data/*-venue.ts).

import { NavGraph, Coordinates } from "./types"

export function getNeighbors(graph: NavGraph, nodeId: string, wheelchairOnly: boolean): string[] {
  const neighbors: string[] = []
  for (const edge of graph.edges) {
    if (wheelchairOnly && !edge.accessible) continue
    if (edge.from === nodeId) neighbors.push(edge.to)
    if (edge.to   === nodeId) neighbors.push(edge.from)
  }
  return neighbors
}

/** Nearest node on the given floor to (lat, lng) — squared-distance approximation. */
export function nearestNode(
  graph: NavGraph,
  lat: number,
  lng: number,
  floor: number
): string | null {
  let best: string | null = null
  let bestDist = Infinity
  for (const node of Object.values(graph.nodes)) {
    if (node.floor !== floor) continue
    const dlat = node.coordinates.lat - lat
    const dlng = node.coordinates.lng - lng
    const d = dlat * dlat + dlng * dlng
    if (d < bestDist) { bestDist = d; best = node.id }
  }
  return best
}

export function nodeCoords(graph: NavGraph, id: string): Coordinates {
  return graph.nodes[id].coordinates
}
