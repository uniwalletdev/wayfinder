import { Waypoint, Route, RouteStep, Coordinates, TransportMode } from "./types"
import { GOSH_NAV_GRAPH, nearestNode } from "./nav-graph"
import { findPath, pathToCoordinates } from "./pathfinder"

function distanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function bearing(a: Coordinates, b: Coordinates): number {
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function headingToInstruction(deg: number): string {
  if (deg > 337.5 || deg <= 22.5) return "Head north"
  if (deg <= 67.5) return "Head north-east"
  if (deg <= 112.5) return "Head east"
  if (deg <= 157.5) return "Head south-east"
  if (deg <= 202.5) return "Head south"
  if (deg <= 247.5) return "Head south-west"
  if (deg <= 292.5) return "Head west"
  return "Head north-west"
}

function speedMpm(mode: TransportMode): number {
  switch (mode) {
    case "driving":    return 400
    case "cycling":    return 200
    case "transit":    return 150
    case "walking":
    case "wheelchair": return 80
  }
}

export function buildRoute(
  from: Coordinates,
  fromFloor: number,
  destination: Waypoint,
  allWaypoints: Waypoint[],
  mode: TransportMode = "walking"
): Route {
  const wheelchair = mode === "wheelchair"
  const graph = GOSH_NAV_GRAPH

  // Map user position to the nearest graph node on their current floor
  const startNodeId = nearestNode(graph, from.lat, from.lng, fromFloor)

  // Map destination to its graph node (prefer waypointId match, else nearest on dest floor)
  const destNodeId =
    Object.values(graph.nodes).find((n) => n.waypointId === destination.id)?.id ??
    nearestNode(graph, destination.coordinates.lat, destination.coordinates.lng, destination.floor)

  let isMapped = false
  let indoorPath: Coordinates[] = [from, destination.coordinates]
  let steps: RouteStep[] = []
  let totalDistance = 0
  let floorChanges = 0

  if (startNodeId && destNodeId) {
    const nodePath = findPath(graph, startNodeId, destNodeId, wheelchair)

    if (nodePath && nodePath.length > 1) {
      isMapped = true
      indoorPath = [from, ...pathToCoordinates(graph, nodePath.slice(1))]

      // Build turn-by-turn steps from the node path
      let prevCoords = from
      let prevFloor = fromFloor

      for (let i = 1; i < nodePath.length; i++) {
        const node = graph.nodes[nodePath[i]]
        const d = distanceMeters(prevCoords, node.coordinates)
        totalDistance += d

        if (node.floor !== prevFloor) {
          // Floor transition step
          floorChanges++
          const edgeType = graph.edges.find(
            (e) =>
              ((e.from === nodePath[i - 1] && e.to === nodePath[i]) ||
               (e.to === nodePath[i - 1] && e.from === nodePath[i])) &&
              e.type !== "corridor"
          )?.type
          const viaType: "lift" | "stairs" = edgeType === "stairs" ? "stairs" : "lift"

          steps.push({
            instruction: `Take ${viaType === "stairs" ? "the stairs" : "lift"} to ${node.floor === 0 ? "Ground" : `Floor ${node.floor}`}`,
            distance: 0,
            heading: 0,
            floorChange: { from: prevFloor, to: node.floor, via: viaType },
          })
          prevFloor = node.floor
        } else {
          // Walking step — only emit when reaching a named waypoint or last node
          const isWaypoint = node.waypointId !== undefined
          const isLast = i === nodePath.length - 1
          if (isWaypoint || isLast) {
            const target = node.waypointId
              ? allWaypoints.find((w) => w.id === node.waypointId)
              : undefined
            const label = target?.name ?? destination.name
            steps.push({
              instruction: `${headingToInstruction(bearing(prevCoords, node.coordinates))} toward ${label}`,
              distance: Math.round(d),
              heading: bearing(prevCoords, node.coordinates),
              waypoint: target,
            })
            prevCoords = node.coordinates
          }
        }
      }
    }
  }

  // Fallback: straight line when no graph path found
  if (!isMapped) {
    const d = distanceMeters(from, destination.coordinates)
    totalDistance = d
    const b = bearing(from, destination.coordinates)
    steps = [
      {
        instruction: `${headingToInstruction(b)} toward ${destination.name}`,
        distance: Math.round(d),
        heading: b,
      },
    ]

    if (fromFloor !== destination.floor) {
      floorChanges = Math.abs(destination.floor - fromFloor)
      steps = [
        { instruction: `Head to nearest lift`, distance: Math.round(d / 2), heading: b },
        {
          instruction: `Take lift to ${destination.floor === 0 ? "Ground" : `Floor ${destination.floor}`}`,
          distance: 0,
          heading: 0,
          floorChange: { from: fromFloor, to: destination.floor, via: "lift" },
        },
        {
          instruction: `${headingToInstruction(b)} toward ${destination.name}`,
          distance: Math.round(d / 2),
          heading: b,
          waypoint: destination,
        },
      ]
    }
  }

  steps.push({
    instruction: `You have arrived at ${destination.name}`,
    distance: 0,
    heading: 0,
    waypoint: destination,
  })

  const speed = speedMpm(mode)

  return {
    steps,
    totalDistance: Math.round(totalDistance),
    estimatedMinutes: Math.max(1, Math.round(totalDistance / speed)),
    floorChanges,
    transportMode: mode,
    isMapped,
    indoorPath,
  }
}
