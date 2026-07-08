// A small, dependency-free reader for ASCII DXF files — the one CAD interchange
// format that's plain text and parseable in the browser. It is deliberately
// partial: we only pull out what a wayfinding map needs (placed blocks like
// plug sockets, room labels, and wall/corridor line-work), not the full DXF
// spec. Binary DWG and BIM formats (RVT/IFC) are still out of scope — they need
// server-side conversion first.
//
// DXF is a flat stream of (group-code, value) pairs, two lines each. Entities
// live in the ENTITIES section; every entity starts with a 0/<TYPE> pair, then
// carries its own codes (8 = layer, 10/20 = a point, 1 = text, …). We walk that
// stream once, grouping codes onto the entity they belong to.

export interface DxfPoint {
  x: number
  y: number
}

export interface DxfEntity {
  type: string
  layer: string
  // Insertion/position/centre point — the one location that represents the
  // entity (a socket's placement, a label's anchor, a circle's centre).
  point?: DxfPoint
  // Ordered vertices for line-work (LINE, LWPOLYLINE, POLYLINE).
  vertices?: DxfPoint[]
  // Block name for INSERT entities; the strongest hint for what a symbol is.
  block?: string
  // Text content for TEXT/MTEXT — usually a room name or number.
  text?: string
  // Radius for CIRCLE, so it can be drawn on the rendered plan.
  radius?: number
}

export interface DxfDrawing {
  entities: DxfEntity[]
  min: DxfPoint
  max: DxfPoint
}

interface Pair {
  code: number
  value: string
}

function tokenize(text: string): Pair[] {
  const lines = text.split(/\r\n|\r|\n/)
  const pairs: Pair[] = []
  let i = 0
  while (i + 1 < lines.length) {
    const code = parseInt(lines[i].trim(), 10)
    const value = lines[i + 1]
    if (Number.isNaN(code)) {
      // Malformed/blank line — advance by one to try to resync the pairing.
      i += 1
      continue
    }
    pairs.push({ code, value: value.trim() })
    i += 2
  }
  return pairs
}

function isFinitePoint(p: DxfPoint | undefined): p is DxfPoint {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y)
}

// MTEXT wraps runs in formatting codes (\P newlines, {\f…} font blocks, etc.).
// Strip the common ones so a room label reads as plain text.
function cleanText(raw: string): string {
  return raw
    .replace(/\\P/g, " ")
    .replace(/\\[A-Za-z][^;]*;/g, "")
    .replace(/[{}]/g, "")
    .trim()
}

export function parseDxf(text: string): DxfDrawing {
  const pairs = tokenize(text)
  const entities: DxfEntity[] = []

  let section: string | null = null
  let expectSectionName = false

  let current: DxfEntity | null = null
  // LWPOLYLINE/POLYLINE accumulate several points; track the vertex being built
  // so a 10 (x) followed by a 20 (y) forms one coordinate pair.
  let pendingX: number | null = null
  // Old-style POLYLINE holds its points in trailing VERTEX entities until SEQEND.
  let openPolyline: DxfEntity | null = null

  const commit = () => {
    if (current && current.type) entities.push(current)
    current = null
    pendingX = null
  }

  for (const { code, value } of pairs) {
    if (code === 0) {
      if (value === "SECTION") {
        commit()
        expectSectionName = true
        continue
      }
      if (value === "ENDSEC") {
        commit()
        section = null
        openPolyline = null
        continue
      }
      if (section !== "ENTITIES") {
        // Ignore entity-like markers outside ENTITIES (BLOCKS/TABLES bodies).
        commit()
        continue
      }

      // A VERTEX belongs to the polyline that's currently open, not a new entity.
      if (value === "VERTEX" && openPolyline) {
        commit()
        current = { type: "VERTEX", layer: openPolyline.layer, vertices: [] }
        continue
      }
      if (value === "SEQEND") {
        commit()
        openPolyline = null
        continue
      }

      commit()
      current = { type: value, layer: "0" }
      if (value === "POLYLINE") {
        current.vertices = []
        openPolyline = current
      }
      continue
    }

    if (expectSectionName && code === 2) {
      section = value
      expectSectionName = false
      continue
    }

    if (!current) continue

    switch (code) {
      case 8:
        current.layer = value
        break
      case 2:
        current.block = value
        break
      case 1:
        current.text = cleanText(value)
        break
      case 40:
        current.radius = parseFloat(value)
        break
      case 10: {
        pendingX = parseFloat(value)
        break
      }
      case 20: {
        if (pendingX !== null) {
          const pt = { x: pendingX, y: parseFloat(value) }
          pendingX = null
          // A VERTEX child feeds its parent polyline directly.
          if (current.type === "VERTEX" && openPolyline) {
            openPolyline.vertices!.push(pt)
          } else if (current.type === "LWPOLYLINE" || current.type === "POLYLINE") {
            ;(current.vertices ??= []).push(pt)
          } else if (current.type === "LINE") {
            ;(current.vertices ??= []).push(pt)
            current.point ??= pt
          } else {
            current.point = pt
          }
        }
        break
      }
      case 11: {
        pendingX = parseFloat(value)
        break
      }
      case 21: {
        if (pendingX !== null && current.type === "LINE") {
          ;(current.vertices ??= []).push({ x: pendingX, y: parseFloat(value) })
        }
        pendingX = null
        break
      }
      default:
        break
    }
  }
  commit()

  // Bounds from every coordinate we saw, so both the render and the 0..1
  // normalisation share one frame. (DXF $EXTMIN/$EXTMAX exist but are often
  // stale or absent, so we trust the geometry itself.)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const consider = (p: DxfPoint | undefined) => {
    if (!isFinitePoint(p)) return
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  for (const e of entities) {
    consider(e.point)
    e.vertices?.forEach(consider)
  }

  if (!Number.isFinite(minX)) {
    minX = 0
    minY = 0
    maxX = 1
    maxY = 1
  }

  return { entities, min: { x: minX, y: minY }, max: { x: maxX, y: maxY } }
}

// Normalise a drawing coordinate to 0..1 within the drawing bounds, with the
// Y axis flipped so (0,0) is top-left — matching how uploaded raster plans are
// addressed, so CAD points feed the exact same georeferencing math.
export function normalisePoint(drawing: DxfDrawing, p: DxfPoint): { x: number; y: number } {
  const spanX = drawing.max.x - drawing.min.x || 1
  const spanY = drawing.max.y - drawing.min.y || 1
  return {
    x: (p.x - drawing.min.x) / spanX,
    y: (drawing.max.y - p.y) / spanY,
  }
}

export interface RenderedPlan {
  dataUrl: string
  width: number
  height: number
}

// Draw the drawing's line-work (walls, polylines, circles) onto a white canvas
// so the CAD file becomes a real floor-plan image the mapper can then place on
// the map — otherwise a CAD upload would be an invisible cloud of points.
export function renderDxf(drawing: DxfDrawing, maxDim: number): RenderedPlan | null {
  const spanX = drawing.max.x - drawing.min.x
  const spanY = drawing.max.y - drawing.min.y
  if (!(spanX > 0) || !(spanY > 0)) return null

  const scale = maxDim / Math.max(spanX, spanY)
  const width = Math.max(1, Math.round(spanX * scale))
  const height = Math.max(1, Math.round(spanY * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = "#334155"
  ctx.lineWidth = 1
  ctx.lineJoin = "round"
  ctx.lineCap = "round"

  const px = (p: DxfPoint) => ({
    x: (p.x - drawing.min.x) * scale,
    y: (drawing.max.y - p.y) * scale, // flip Y: DXF is y-up, canvas is y-down
  })

  let drewSomething = false
  for (const e of drawing.entities) {
    if (e.vertices && e.vertices.length >= 2) {
      ctx.beginPath()
      e.vertices.forEach((v, i) => {
        const q = px(v)
        if (i === 0) ctx.moveTo(q.x, q.y)
        else ctx.lineTo(q.x, q.y)
      })
      ctx.stroke()
      drewSomething = true
    } else if (e.type === "CIRCLE" && e.point && e.radius) {
      const c = px(e.point)
      ctx.beginPath()
      ctx.arc(c.x, c.y, Math.max(1, e.radius * scale), 0, Math.PI * 2)
      ctx.stroke()
      drewSomething = true
    }
  }

  if (!drewSomething) return null
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), width, height }
}
