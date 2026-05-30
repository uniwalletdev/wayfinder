import { NavGraph } from "./types"

// Indoor navigation graph for GOSH.
// Nodes = waypoints + corridor junction nodes (prefixed "jn-").
// Edges are bidirectional — the pathfinder treats each edge as traversable in both directions.

export const GOSH_NAV_GRAPH: NavGraph = {
  nodes: {
    // ── Ground Floor ─────────────────────────────────────────────────────────
    "ae-entrance":  { id: "ae-entrance",  coordinates: { lat: 51.522829, lng: -0.120551 }, floor: 0, waypointId: "ae-entrance"  },
    "stairs-1-gf":  { id: "stairs-1-gf", coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 0, waypointId: "stairs-1-gf" },
    "pharmacy-gf":  { id: "pharmacy-gf", coordinates: { lat: 51.522829, lng: -0.119622 }, floor: 0, waypointId: "pharmacy-gf" },
    "jn-gf-n":      { id: "jn-gf-n",     coordinates: { lat: 51.522829, lng: -0.119878 }, floor: 0 },
    "lift-b-gf":    { id: "lift-b-gf",   coordinates: { lat: 51.522829, lng: -0.119236 }, floor: 0, waypointId: "lift-b-gf"   },
    "lift-a-gf":    { id: "lift-a-gf",   coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 0, waypointId: "lift-a-gf"   },
    "canteen-gf":   { id: "canteen-gf",  coordinates: { lat: 51.522159, lng: -0.120551 }, floor: 0, waypointId: "canteen-gf"  },
    "toilet-gf":    { id: "toilet-gf",   coordinates: { lat: 51.522159, lng: -0.120143 }, floor: 0, waypointId: "toilet-gf"   },
    "jn-gf-s":      { id: "jn-gf-s",     coordinates: { lat: 51.522159, lng: -0.119878 }, floor: 0 },
    "reception":    { id: "reception",   coordinates: { lat: 51.522159, lng: -0.119622 }, floor: 0, waypointId: "reception"   },
    "main-entrance":{ id: "main-entrance",coordinates: { lat: 51.522159, lng: -0.119236 }, floor: 0, waypointId: "main-entrance" },

    // ── Floor 1 ──────────────────────────────────────────────────────────────
    "ward-1a":      { id: "ward-1a",      coordinates: { lat: 51.522829, lng: -0.120346 }, floor: 1, waypointId: "ward-1a"      },
    "jn-f1-n":      { id: "jn-f1-n",      coordinates: { lat: 51.522829, lng: -0.119878 }, floor: 1 },
    "ward-1b":      { id: "ward-1b",      coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 1, waypointId: "ward-1b"      },
    "lift-a-f1":    { id: "lift-a-f1",    coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 1, waypointId: "lift-a-f1"    },
    "jn-f1-s":      { id: "jn-f1-s",      coordinates: { lat: 51.522159, lng: -0.119878 }, floor: 1 },
    "outpatients-1":{ id: "outpatients-1",coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 1, waypointId: "outpatients-1" },
    "toilet-f1":    { id: "toilet-f1",    coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 1, waypointId: "toilet-f1"    },

    // ── Floor 2 ──────────────────────────────────────────────────────────────
    "ward-2a":   { id: "ward-2a",   coordinates: { lat: 51.522829, lng: -0.120346 }, floor: 2, waypointId: "ward-2a"   },
    "jn-f2-n":   { id: "jn-f2-n",   coordinates: { lat: 51.522829, lng: -0.119878 }, floor: 2 },
    "ward-2b":   { id: "ward-2b",   coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 2, waypointId: "ward-2b"   },
    "lift-a-f2": { id: "lift-a-f2", coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 2, waypointId: "lift-a-f2" },
    "jn-f2-s":   { id: "jn-f2-s",   coordinates: { lat: 51.522159, lng: -0.119878 }, floor: 2 },
    "xray":      { id: "xray",      coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 2, waypointId: "xray"      },
    "toilet-f2": { id: "toilet-f2", coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 2, waypointId: "toilet-f2" },

    // ── Floor 3 ──────────────────────────────────────────────────────────────
    "ward-3a":   { id: "ward-3a",   coordinates: { lat: 51.522829, lng: -0.120551 }, floor: 3, waypointId: "ward-3a"   },
    "ward-3b":   { id: "ward-3b",   coordinates: { lat: 51.522829, lng: -0.120143 }, floor: 3, waypointId: "ward-3b"   },
    "jn-f3-n":   { id: "jn-f3-n",   coordinates: { lat: 51.522829, lng: -0.119878 }, floor: 3 },
    "ward-5b":   { id: "ward-5b",   coordinates: { lat: 51.522829, lng: -0.119431 }, floor: 3, waypointId: "ward-5b"   },
    "lift-a-f3": { id: "lift-a-f3", coordinates: { lat: 51.522374, lng: -0.119878 }, floor: 3, waypointId: "lift-a-f3" },
    "jn-f3-s":   { id: "jn-f3-s",   coordinates: { lat: 51.522159, lng: -0.119878 }, floor: 3 },
    "theatre":   { id: "theatre",   coordinates: { lat: 51.522159, lng: -0.120346 }, floor: 3, waypointId: "theatre"   },
    "toilet-f3": { id: "toilet-f3", coordinates: { lat: 51.522159, lng: -0.119431 }, floor: 3, waypointId: "toilet-f3" },
  },

  edges: [
    // ── Ground floor corridors ─────────────────────────────────────────────
    { from: "ae-entrance",   to: "stairs-1-gf",  accessible: false, type: "corridor" },
    { from: "stairs-1-gf",  to: "pharmacy-gf",   accessible: false, type: "corridor" },
    { from: "pharmacy-gf",  to: "jn-gf-n",       accessible: true,  type: "corridor" },
    { from: "jn-gf-n",      to: "lift-b-gf",     accessible: true,  type: "corridor" },
    { from: "jn-gf-n",      to: "lift-a-gf",     accessible: true,  type: "corridor" },
    { from: "lift-a-gf",    to: "jn-gf-s",       accessible: true,  type: "corridor" },
    { from: "canteen-gf",   to: "toilet-gf",     accessible: true,  type: "corridor" },
    { from: "toilet-gf",    to: "jn-gf-s",       accessible: true,  type: "corridor" },
    { from: "jn-gf-s",      to: "reception",     accessible: true,  type: "corridor" },
    { from: "reception",    to: "main-entrance",  accessible: true,  type: "corridor" },
    // Cross-connect north and south corridors near A&E/canteen
    { from: "ae-entrance",  to: "canteen-gf",    accessible: true,  type: "corridor" },

    // ── Floor 1 corridors ──────────────────────────────────────────────────
    { from: "ward-1a",      to: "jn-f1-n",       accessible: true,  type: "corridor" },
    { from: "jn-f1-n",      to: "ward-1b",        accessible: true,  type: "corridor" },
    { from: "jn-f1-n",      to: "lift-a-f1",      accessible: true,  type: "corridor" },
    { from: "lift-a-f1",    to: "jn-f1-s",        accessible: true,  type: "corridor" },
    { from: "jn-f1-s",      to: "outpatients-1",  accessible: true,  type: "corridor" },
    { from: "jn-f1-s",      to: "toilet-f1",      accessible: true,  type: "corridor" },

    // ── Floor 2 corridors ──────────────────────────────────────────────────
    { from: "ward-2a",      to: "jn-f2-n",        accessible: true,  type: "corridor" },
    { from: "jn-f2-n",      to: "ward-2b",        accessible: true,  type: "corridor" },
    { from: "jn-f2-n",      to: "lift-a-f2",      accessible: true,  type: "corridor" },
    { from: "lift-a-f2",    to: "jn-f2-s",        accessible: true,  type: "corridor" },
    { from: "jn-f2-s",      to: "xray",           accessible: true,  type: "corridor" },
    { from: "jn-f2-s",      to: "toilet-f2",      accessible: true,  type: "corridor" },

    // ── Floor 3 corridors ──────────────────────────────────────────────────
    { from: "ward-3a",      to: "ward-3b",        accessible: true,  type: "corridor" },
    { from: "ward-3b",      to: "jn-f3-n",        accessible: true,  type: "corridor" },
    { from: "jn-f3-n",      to: "ward-5b",        accessible: true,  type: "corridor" },
    { from: "jn-f3-n",      to: "lift-a-f3",      accessible: true,  type: "corridor" },
    { from: "lift-a-f3",    to: "jn-f3-s",        accessible: true,  type: "corridor" },
    { from: "jn-f3-s",      to: "theatre",        accessible: true,  type: "corridor" },
    { from: "jn-f3-s",      to: "toilet-f3",      accessible: true,  type: "corridor" },

    // ── Cross-floor: Lift A shaft ──────────────────────────────────────────
    { from: "lift-a-gf", to: "lift-a-f1", accessible: true, type: "lift" },
    { from: "lift-a-f1", to: "lift-a-f2", accessible: true, type: "lift" },
    { from: "lift-a-f2", to: "lift-a-f3", accessible: true, type: "lift" },
    // Allow skipping floors
    { from: "lift-a-gf", to: "lift-a-f2", accessible: true, type: "lift" },
    { from: "lift-a-gf", to: "lift-a-f3", accessible: true, type: "lift" },
    { from: "lift-a-f1", to: "lift-a-f3", accessible: true, type: "lift" },

    // ── Cross-floor: Staircase 1 (ground only for now — not accessible) ───
    { from: "stairs-1-gf", to: "jn-f1-n", accessible: false, type: "stairs" },
  ],
}

// Returns all nodes reachable from a given node in one step (respects wheelchair accessibility)
export function getNeighbors(graph: NavGraph, nodeId: string, wheelchairOnly: boolean): string[] {
  const neighbors: string[] = []
  for (const edge of graph.edges) {
    if (wheelchairOnly && !edge.accessible) continue
    if (edge.from === nodeId) neighbors.push(edge.to)
    if (edge.to === nodeId) neighbors.push(edge.from)
  }
  return neighbors
}

// Find nearest node on a given floor to the supplied coordinates
export function nearestNode(graph: NavGraph, lat: number, lng: number, floor: number): string | null {
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
