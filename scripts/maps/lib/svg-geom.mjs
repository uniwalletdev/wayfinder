// Read drawable geometry out of a traced floor-plan SVG.
//
// pdf2svg.mjs rebuilds a trust's PDF as SVG, and the PDF's filled regions arrive
// tessellated into triangle strips while its walls arrive as stroked outlines
// with fill="none". So a plan carries two kinds of information the corridor
// extractor needs, told apart by how they are painted rather than by any
// semantic marking:
//
//   filled, not white  — a room, a zone, a building footprint. Not walkable.
//   stroked, no fill   — a wall line. Not walkable, and thin.
//
// Everything here is pure geometry: no DOM, no dependencies. Curves are
// flattened, because the consumer is a raster grid where a chord shorter than a
// pixel is indistinguishable from the curve it replaces.

const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi

// Attributes off one element's tag text. Cheap and sufficient: pdf2svg writes
// plain double-quoted attributes and no namespaces or entities.
function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, "i"))
  return m ? m[1] : null
}

function parseColor(v) {
  if (!v || v === "none") return null
  const m = v.trim().match(/^#([0-9a-f]{6})$/i)
  if (m) return parseInt(m[1], 16)
  const s = v.trim().match(/^#([0-9a-f]{3})$/i)
  if (s) {
    const [r, g, b] = s[1].split("").map((c) => parseInt(c + c, 16))
    return (r << 16) | (g << 8) | b
  }
  return v.trim().toLowerCase() === "white" ? 0xffffff : v.trim().toLowerCase() === "black" ? 0 : null
}

// Near-white counts as white: a trace rounds #ffffff to #fefefe here and there,
// and treating those few shapes as rooms would wall off a corridor.
export function isWhite(rgb) {
  if (rgb === null) return false
  const r = (rgb >> 16) & 255
  const g = (rgb >> 8) & 255
  const b = rgb & 255
  return r > 244 && g > 244 && b > 244
}

// Flatten a cubic Bézier by recursive subdivision until it is flat to `tol`.
function cubic(out, x0, y0, x1, y1, x2, y2, x3, y3, tol, depth = 0) {
  // Flatness: how far the control points sit off the chord.
  const ux = 3 * x1 - 2 * x0 - x3
  const uy = 3 * y1 - 2 * y0 - y3
  const vx = 3 * x2 - 2 * x3 - x0
  const vy = 3 * y2 - 2 * y3 - y0
  const d = Math.max(ux * ux, vx * vx) + Math.max(uy * uy, vy * vy)
  if (d <= 16 * tol * tol || depth > 16) {
    out.push([x3, y3])
    return
  }
  const x01 = (x0 + x1) / 2, y01 = (y0 + y1) / 2
  const x12 = (x1 + x2) / 2, y12 = (y1 + y2) / 2
  const x23 = (x2 + x3) / 2, y23 = (y2 + y3) / 2
  const xa = (x01 + x12) / 2, ya = (y01 + y12) / 2
  const xb = (x12 + x23) / 2, yb = (y12 + y23) / 2
  const xm = (xa + xb) / 2, ym = (ya + yb) / 2
  cubic(out, x0, y0, x01, y01, xa, ya, xm, ym, tol, depth + 1)
  cubic(out, xm, ym, xb, yb, x23, y23, x3, y3, tol, depth + 1)
}

// Parse a path's `d` into subpaths of flattened points.
// Returns [{ points: [[x,y],…], closed: bool }].
export function parsePathData(d, tol = 0.25) {
  const subs = []
  let cur = null
  let x = 0, y = 0, sx = 0, sy = 0
  let px = 0, py = 0 // last cubic control, for S/T
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []
  let i = 0
  let cmd = null

  const start = () => {
    cur = { points: [[x, y]], closed: false }
    subs.push(cur)
  }
  const num = () => Number(tokens[i++])

  while (i < tokens.length) {
    const t = tokens[i]
    if (/^[A-Za-z]$/.test(t)) {
      cmd = t
      i++
    } else if (cmd === null) {
      i++
      continue
    }
    const rel = cmd === cmd.toLowerCase()
    switch (cmd.toUpperCase()) {
      case "M": {
        const nx = num(), ny = num()
        x = rel ? x + nx : nx
        y = rel ? y + ny : ny
        sx = x; sy = y
        start()
        // Subsequent pairs after an M are implicit L.
        cmd = rel ? "l" : "L"
        break
      }
      case "L": {
        const nx = num(), ny = num()
        x = rel ? x + nx : nx
        y = rel ? y + ny : ny
        if (!cur) start(); else cur.points.push([x, y])
        break
      }
      case "H": {
        const nx = num()
        x = rel ? x + nx : nx
        if (!cur) start(); else cur.points.push([x, y])
        break
      }
      case "V": {
        const ny = num()
        y = rel ? y + ny : ny
        if (!cur) start(); else cur.points.push([x, y])
        break
      }
      case "C": {
        const a = num(), b = num(), c = num(), dd = num(), e = num(), f = num()
        const c1x = rel ? x + a : a, c1y = rel ? y + b : b
        const c2x = rel ? x + c : c, c2y = rel ? y + dd : dd
        const ex = rel ? x + e : e, ey = rel ? y + f : f
        if (!cur) start()
        cubic(cur.points, x, y, c1x, c1y, c2x, c2y, ex, ey, tol)
        px = c2x; py = c2y
        x = ex; y = ey
        break
      }
      case "S": {
        const c = num(), dd = num(), e = num(), f = num()
        const c1x = 2 * x - px, c1y = 2 * y - py
        const c2x = rel ? x + c : c, c2y = rel ? y + dd : dd
        const ex = rel ? x + e : e, ey = rel ? y + f : f
        if (!cur) start()
        cubic(cur.points, x, y, c1x, c1y, c2x, c2y, ex, ey, tol)
        px = c2x; py = c2y
        x = ex; y = ey
        break
      }
      case "Q":
      case "T": {
        let qx, qy, ex, ey
        if (cmd.toUpperCase() === "Q") {
          const a = num(), b = num(), e = num(), f = num()
          qx = rel ? x + a : a; qy = rel ? y + b : b
          ex = rel ? x + e : e; ey = rel ? y + f : f
        } else {
          qx = 2 * x - px; qy = 2 * y - py
          const e = num(), f = num()
          ex = rel ? x + e : e; ey = rel ? y + f : f
        }
        // Quadratic as cubic.
        if (!cur) start()
        cubic(cur.points, x, y, x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y),
          ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey, tol)
        px = qx; py = qy
        x = ex; y = ey
        break
      }
      case "A": {
        // Arcs appear in traced output only rarely; the chord is within a pixel
        // at the grid resolutions this feeds, and a wrong arc bulge cannot open
        // or close a corridor.
        num(); num(); num(); num(); num()
        const e = num(), f = num()
        x = rel ? x + e : e
        y = rel ? y + f : f
        if (!cur) start(); else cur.points.push([x, y])
        break
      }
      case "Z": {
        if (cur) {
          cur.closed = true
          cur = null
        }
        x = sx; y = sy
        break
      }
      default:
        i++
    }
    if (!/^[MmLlHhVvCcSsQqTtAaZz]$/.test(cmd)) i++
  }
  return subs.filter((s) => s.points.length > 1)
}

// Everything drawable in the document, classified by how it is painted.
// `fills` are regions, `strokes` are lines with a width.
export function readSvgGeometry(svg) {
  const vb = svg.match(/viewBox="([^"]+)"/i)
  const [vx, vy, vw, vh] = vb ? vb[1].trim().split(/[\s,]+/).map(Number) : [0, 0, 1000, 1000]

  const fills = []
  const strokes = []

  // <rect> — pdf2svg writes the page background as one, which must not become
  // an obstacle covering the whole plan.
  for (const m of svg.matchAll(/<rect\b[^>]*>/gi)) {
    const tag = m[0]
    const f = parseColor(attr(tag, "fill"))
    if (f === null) continue
    const x = Number(attr(tag, "x") ?? 0)
    const y = Number(attr(tag, "y") ?? 0)
    const w = Number(attr(tag, "width") ?? 0)
    const h = Number(attr(tag, "height") ?? 0)
    if (!(w > 0 && h > 0)) continue
    fills.push({
      rgb: f,
      rings: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]],
      area: w * h,
    })
  }

  for (const m of svg.matchAll(/<path\b[^>]*>/gi)) {
    const tag = m[0]
    const d = attr(tag, "d")
    if (!d) continue
    const subs = parsePathData(d)
    if (!subs.length) continue

    const fill = parseColor(attr(tag, "fill"))
    const stroke = parseColor(attr(tag, "stroke"))
    const sw = Number(attr(tag, "stroke-width") ?? 1) || 1

    if (fill !== null) {
      const rings = subs.map((s) => s.points)
      fills.push({ rgb: fill, rings, area: rings.reduce((a, r) => a + Math.abs(ringArea(r)), 0) })
    }
    // A stroked path with no fill is a line — a wall, a road edge, a leader.
    if (stroke !== null && fill === null) {
      for (const s of subs) strokes.push({ rgb: stroke, width: sw, points: s.points, closed: s.closed })
    }
  }

  return { viewBox: { x: vx, y: vy, w: vw, h: vh }, fills, strokes }
}

// The bounding box of a fill's rings.
export function fillBounds(f) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const ring of f.rings) {
    for (const [x, y] of ring) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}

// What a filled shape is, judged by its shape rather than its colour — colour
// conventions differ per trust, geometry does not.
//
// This distinction is the whole ballgame for corridor extraction. A PDF tracer
// renders a wall as a long thin filled rectangle and a letter of a room label
// as a small compact one, and both are black and both are far too small to pass
// an area threshold. Treating the walls as text leaves the floor one huge open
// region whose medial axis is meaningless — the free space reads 10 m wide
// where a hospital corridor is 2 to 3.
//
// Dimensions are in the drawing's own units; the caller converts from metres so
// the same rule holds at any sheet scale.
export function classifyFill(f, { wallMinLength, wallMaxThickness, massMinArea }) {
  const b = fillBounds(f)
  const long = Math.max(b.w, b.h)
  const short = Math.min(b.w, b.h)
  if (f.area >= massMinArea) return "mass"
  if (long >= wallMinLength && short <= wallMaxThickness) return "wall"
  return "detail"
}

export function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return a / 2
}
