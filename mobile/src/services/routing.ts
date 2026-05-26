import { Coordinates, Route, RouteInstruction } from '../types';
import { api } from './api';

export interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

function heuristic(a: Coordinates, b: Coordinates): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function aStarRoute(
  start: Coordinates,
  end: Coordinates,
  obstacles: Coordinates[] = []
): Coordinates[] {
  const obstacleSet = new Set(obstacles.map((o) => `${o.x},${o.y}`));

  const startNode: PathNode = { ...start, g: 0, h: heuristic(start, end), f: 0, parent: null };
  startNode.f = startNode.h;

  const open: PathNode[] = [startNode];
  const closed = new Set<string>();

  const directions = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ];

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const key = `${current.x},${current.y}`;

    if (current.x === end.x && current.y === end.y) {
      const path: Coordinates[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closed.add(key);

    for (const dir of directions) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const nKey = `${nx},${ny}`;

      if (closed.has(nKey) || obstacleSet.has(nKey)) continue;

      const g = current.g + 1;
      const h = heuristic({ x: nx, y: ny }, end);
      const neighbor: PathNode = { x: nx, y: ny, g, h, f: g + h, parent: current };

      const existing = open.find((n) => n.x === nx && n.y === ny);
      if (!existing || existing.g > g) {
        if (existing) open.splice(open.indexOf(existing), 1);
        open.push(neighbor);
      }
    }
  }

  return [start, end];
}

export function generateInstructions(path: Coordinates[]): RouteInstruction[] {
  const instructions: RouteInstruction[] = [];
  if (path.length < 2) return instructions;

  instructions.push({
    step: 1,
    text: 'Start walking straight ahead',
    coordinates: path[0],
  });

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];

    const prevDir = { x: curr.x - prev.x, y: curr.y - prev.y };
    const nextDir = { x: next.x - curr.x, y: next.y - curr.y };

    const cross = prevDir.x * nextDir.y - prevDir.y * nextDir.x;
    if (cross !== 0) {
      instructions.push({
        step: instructions.length + 1,
        text: cross > 0 ? 'Turn left' : 'Turn right',
        coordinates: curr,
      });
    }
  }

  instructions.push({
    step: instructions.length + 1,
    text: 'You have arrived at your destination',
    coordinates: path[path.length - 1],
  });

  return instructions;
}

export async function fetchRoute(
  startLocationId: string,
  endLocationId: string,
  accessible = false
): Promise<Route | null> {
  try {
    return await api.get<Route>(
      `/api/routes?start_location_id=${startLocationId}&end_location_id=${endLocationId}&accessible=${accessible}`
    );
  } catch {
    return null;
  }
}
