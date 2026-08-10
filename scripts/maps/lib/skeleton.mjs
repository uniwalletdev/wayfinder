// Occupancy grid → walkable centrelines.
//
// The medial axis of the free space is the line every point of which is
// equidistant from two walls — which is, near enough, the middle of the
// corridor. Deriving a navigation graph this way is how indoor mapping turns
// CAD into routes, and the traced sheets in public/floorplans carry the same
// information a CAD plan does: rooms as filled regions, walls as strokes.
//
// Everything is a typed array over a fixed grid. No dependencies — the repo has
// no image library available, and none is needed: the shapes come in as
// polygons, so they can be scan-converted directly.

export const FREE = 0
export const BLOCKED = 1

export function makeGrid(w, h) {
  return { w, h, cells: new Uint8Array(w * h) }
}

// Scan-convert a polygon ring set with the even-odd rule, the fill rule the PDF
// tracer's tessellated output assumes.
export function fillPolygon(grid, rings, value = BLOCKED) {
  const edges = []
  let minY = Infinity
  let maxY = -Infinity
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x0, y0] = ring[j]
      const [x1, y1] = ring[i]
      if (y0 === y1) continue
      edges.push({ x0, y0, x1, y1 })
      minY = Math.min(minY, y0, y1)
      maxY = Math.max(maxY, y0, y1)
    }
  }
  if (!edges.length) return
  const yStart = Math.max(0, Math.floor(minY))
  const yEnd = Math.min(grid.h - 1, Math.ceil(maxY))
  const xs = []
  for (let y = yStart; y <= yEnd; y++) {
    const cy = y + 0.5
    xs.length = 0
    for (const e of edges) {
      const { x0, y0, x1, y1 } = e
      if (cy < Math.min(y0, y1) || cy >= Math.max(y0, y1)) continue
      xs.push(x0 + ((cy - y0) / (y1 - y0)) * (x1 - x0))
    }
    if (xs.length < 2) continue
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] - 0.5))
      const b = Math.min(grid.w - 1, Math.floor(xs[k + 1] - 0.5))
      for (let x = a; x <= b; x++) grid.cells[y * grid.w + x] = value
    }
  }
}

// Stamp a polyline with a width — a wall, drawn as a stroke rather than a shape.
export function strokeLine(grid, points, width, value = BLOCKED) {
  const r = Math.max(0.5, width / 2)
  const ri = Math.ceil(r)
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const cx = x0 + (x1 - x0) * t
      const cy = y0 + (y1 - y0) * t
      const gx = Math.round(cx)
      const gy = Math.round(cy)
      for (let dy = -ri; dy <= ri; dy++) {
        for (let dx = -ri; dx <= ri; dx++) {
          if (dx * dx + dy * dy > r * r + 0.25) continue
          const x = gx + dx
          const y = gy + dy
          if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) continue
          grid.cells[y * grid.w + x] = value
        }
      }
    }
  }
}

// Two-pass chamfer distance transform: for every free cell, the approximate
// distance in cells to the nearest blocked cell. Used both to prune the
// skeleton and to report how wide the corridors it found actually are — a
// "corridor" 30 m across is an open field, not a hallway.
export function distanceTransform(grid) {
  const { w, h, cells } = grid
  const d = new Float32Array(w * h)
  const D1 = 1
  const D2 = Math.SQRT2
  const INF = 1e9
  for (let i = 0; i < cells.length; i++) d[i] = cells[i] === BLOCKED ? 0 : INF
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (d[i] === 0) continue
      let v = d[i]
      if (x > 0) v = Math.min(v, d[i - 1] + D1)
      if (y > 0) v = Math.min(v, d[i - w] + D1)
      if (x > 0 && y > 0) v = Math.min(v, d[i - w - 1] + D2)
      if (x + 1 < w && y > 0) v = Math.min(v, d[i - w + 1] + D2)
      d[i] = v
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (d[i] === 0) continue
      let v = d[i]
      if (x + 1 < w) v = Math.min(v, d[i + 1] + D1)
      if (y + 1 < h) v = Math.min(v, d[i + w] + D1)
      if (x + 1 < w && y + 1 < h) v = Math.min(v, d[i + w + 1] + D2)
      if (x > 0 && y + 1 < h) v = Math.min(v, d[i + w - 1] + D2)
      d[i] = v
    }
  }
  // Cells outside the drawing have nothing blocking them and would read as
  // infinitely wide; clamp so the plausibility gate sees a real number.
  for (let i = 0; i < d.length; i++) if (d[i] > 1e8) d[i] = 0
  return d
}

// Zhang-Suen thinning: erode the free space to a one-cell-wide skeleton while
// preserving connectivity. `mask` marks the cells eligible to be thinned (the
// walkable region); everything else is treated as background.
export function thin(mask, w, h) {
  const img = Uint8Array.from(mask)
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x])
  let changed = true
  const doomed = []
  while (changed) {
    changed = false
    for (const step of [0, 1]) {
      doomed.length = 0
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!img[y * w + x]) continue
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y)
          const p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1)
          const p8 = at(x - 1, y), p9 = at(x - 1, y - 1)
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
          if (b < 2 || b > 6) continue
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
          let a = 0
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) a++
          if (a !== 1) continue
          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue
            if (p4 * p6 * p8 !== 0) continue
          } else {
            if (p2 * p4 * p8 !== 0) continue
            if (p2 * p6 * p8 !== 0) continue
          }
          doomed.push(y * w + x)
        }
      }
      for (const i of doomed) img[i] = 0
      if (doomed.length) changed = true
    }
  }
  return img
}

// Turn a thinned bitmap into polylines: walk each run of skeleton cells from an
// endpoint or junction to the next one.
export function traceSkeleton(skel, w, h) {
  const idx = (x, y) => y * w + x
  const on = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : skel[idx(x, y)])
  const NB = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]
  const degree = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue
      let n = 0
      for (const [dx, dy] of NB) if (on(x + dx, y + dy)) n++
      degree[idx(x, y)] = n
    }
  }

  const visited = new Uint8Array(w * h)
  const lines = []

  const walk = (sx, sy, fdx, fdy) => {
    const pts = [[sx, sy]]
    let x = sx + fdx
    let y = sy + fdy
    let prevX = sx
    let prevY = sy
    while (on(x, y)) {
      pts.push([x, y])
      const d = degree[idx(x, y)]
      if (d !== 2) break // endpoint or junction terminates the run
      visited[idx(x, y)] = 1
      let nx = -1
      let ny = -1
      for (const [dx, dy] of NB) {
        const cx = x + dx
        const cy = y + dy
        if (!on(cx, cy)) continue
        if (cx === prevX && cy === prevY) continue
        nx = cx
        ny = cy
        break
      }
      if (nx < 0) break
      prevX = x
      prevY = y
      x = nx
      y = ny
    }
    return pts
  }

  // Start from endpoints and junctions; anything left over is a closed loop.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y)
      if (!skel[i]) continue
      const d = degree[i]
      if (d === 2) continue
      for (const [dx, dy] of NB) {
        if (!on(x + dx, y + dy)) continue
        if (visited[idx(x + dx, y + dy)]) continue
        const pts = walk(x, y, dx, dy)
        if (pts.length > 1) lines.push(pts)
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y)
      if (!skel[i] || visited[i] || degree[i] !== 2) continue
      const pts = walk(x, y, ...NB.find(([dx, dy]) => on(x + dx, y + dy)))
      if (pts.length > 1) lines.push(pts)
    }
  }
  return lines
}

// Douglas–Peucker. A corridor centreline is a handful of straight runs; keeping
// every cell would put thousands of nodes into the routing graph, which
// buildTrailGraph() compares pairwise.
export function simplify(points, tol) {
  if (points.length < 3) return points.slice()
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let worst = 0
    let wi = -1
    const [ax, ay] = points[a]
    const [bx, by] = points[b]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]
      const d = Math.abs((px - ax) * dy - (py - ay) * dx) / len
      if (d > worst) {
        worst = d
        wi = i
      }
    }
    if (wi > 0 && worst > tol) {
      keep[wi] = 1
      stack.push([a, wi], [wi, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

// Drop the short dead-end whiskers thinning leaves at every doorway and corner.
// A spur is a line with a free end that is shorter than `minLen`; removing one
// can expose another, so it repeats until stable.
export function pruneSpurs(lines, minLen) {
  const key = (p) => `${p[0]},${p[1]}`
  let current = lines
  for (let pass = 0; pass < 12; pass++) {
    const degree = new Map()
    for (const l of current) {
      for (const end of [l[0], l[l.length - 1]]) {
        const k = key(end)
        degree.set(k, (degree.get(k) ?? 0) + 1)
      }
    }
    const kept = current.filter((l) => {
      const a = degree.get(key(l[0])) ?? 0
      const b = degree.get(key(l[l.length - 1])) ?? 0
      const free = (a <= 1 ? 1 : 0) + (b <= 1 ? 1 : 0)
      if (free === 0) return true
      let len = 0
      for (let i = 0; i + 1 < l.length; i++) len += Math.hypot(l[i + 1][0] - l[i][0], l[i + 1][1] - l[i][1])
      return len >= minLen
    })
    if (kept.length === current.length) return kept
    current = kept
  }
  return current
}
