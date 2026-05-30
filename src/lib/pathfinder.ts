import { NavGraph, Coordinates } from "./types"
import { getNeighbors } from "./nav-graph"

function haversine(a: Coordinates, b: Coordinates): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function edgeCost(graph: NavGraph, fromId: string, toId: string): number {
  const from = graph.nodes[fromId]
  const to = graph.nodes[toId]
  if (!from || !to) return Infinity
  const base = haversine(from.coordinates, to.coordinates)
  // Penalise floor changes slightly to prefer same-floor paths when equidistant
  const floorPenalty = from.floor !== to.floor ? 10 : 0
  return base + floorPenalty
}

// Min-heap for A* open set
class MinHeap {
  private heap: [number, string][] = []

  push(priority: number, id: string) {
    this.heap.push([priority, id])
    this.heap.sort((a, b) => a[0] - b[0])
  }

  pop(): [number, string] | undefined {
    return this.heap.shift()
  }

  get size() { return this.heap.length }
}

// Returns ordered list of node IDs from start → goal, or null if unreachable.
export function findPath(
  graph: NavGraph,
  startId: string,
  goalId: string,
  wheelchairOnly: boolean
): string[] | null {
  if (startId === goalId) return [startId]
  if (!graph.nodes[startId] || !graph.nodes[goalId]) return null

  const goalCoords = graph.nodes[goalId].coordinates

  const gCost: Record<string, number> = { [startId]: 0 }
  const cameFrom: Record<string, string> = {}
  const open = new MinHeap()

  open.push(haversine(graph.nodes[startId].coordinates, goalCoords), startId)

  while (open.size > 0) {
    const entry = open.pop()!
    const current = entry[1]

    if (current === goalId) {
      // Reconstruct path
      const path: string[] = []
      let node: string | undefined = goalId
      while (node !== undefined) {
        path.unshift(node)
        node = cameFrom[node]
      }
      return path
    }

    for (const neighbor of getNeighbors(graph, current, wheelchairOnly)) {
      const tentative = gCost[current] + edgeCost(graph, current, neighbor)
      if (!(neighbor in gCost) || tentative < gCost[neighbor]) {
        gCost[neighbor] = tentative
        cameFrom[neighbor] = current
        const f = tentative + haversine(graph.nodes[neighbor].coordinates, goalCoords)
        open.push(f, neighbor)
      }
    }
  }

  return null
}

// Convert a node-ID path to coordinate polyline
export function pathToCoordinates(graph: NavGraph, path: string[]): Coordinates[] {
  return path.map((id) => graph.nodes[id].coordinates)
}
