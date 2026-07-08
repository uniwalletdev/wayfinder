import { AssetCategory, Coordinates, WaypointType } from "./types"
import { classifyAsset, defaultAssetName } from "./asset-meta"
import { parseDxf, renderDxf, normalisePoint, DxfDrawing } from "./dxf"

// Turns whatever file a mapper drops in — a photo of a plan, an exported PDF,
// an SVG diagram, or a GeoJSON export from other mapping tools — into either a
// flat raster image (for the AI reader + georeferencing step) or a set of
// already-georeferenced vector features (which skip straight to review, since
// they already carry real coordinates).

export interface RasterPlan {
  kind: "raster"
  dataUrl: string
  width: number
  height: number
}

// A point/asset read off a plan, positioned in image-normalised space (x, y in
// 0..1 from the top-left) — the same frame a raster plan's AI-detected rooms
// use, so a CAD plan hands off to the identical georeferencing step.
export interface NormalisedRoom {
  name: string
  type: WaypointType
  x: number
  y: number
}

export interface NormalisedAsset {
  name: string
  category: AssetCategory
  x: number
  y: number
  source?: string
}

// A parsed CAD (DXF) file. Behaves like a raster plan for placement — it
// carries a rendered image of the line-work plus normalised points — but the
// rooms/corridors/assets are already extracted from the file's structure, so it
// skips the AI vision reader entirely.
export interface CadPlan {
  kind: "cad"
  dataUrl: string
  width: number
  height: number
  rooms: NormalisedRoom[]
  corridors: { x: number; y: number }[][]
  assets: NormalisedAsset[]
}

export interface VectorPlanFeature {
  name: string
  type: WaypointType
  // A point feature becomes a waypoint; a line feature becomes a walkable
  // corridor trail. Exactly one of the two is set.
  point?: Coordinates
  line?: Coordinates[]
}

export interface VectorPlan {
  kind: "vector"
  features: VectorPlanFeature[]
}

export type ParsedPlan = RasterPlan | VectorPlan | CadPlan

const MAX_DIM = 1400

function isVectorFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith(".geojson") || name.endsWith(".json") || file.type.includes("json")
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Couldn't read that image — it may be corrupt or an unsupported format."))
    img.src = src
  })
}

function drawToDataUrl(img: HTMLImageElement): RasterPlan {
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  if (!srcW || !srcH) throw new Error("That file doesn't look like a valid image.")
  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH))
  const width = Math.max(1, Math.round(srcW * scale))
  const height = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser can't process images.")
  // Flatten transparency (PNG/SVG) onto white before JPEG-encoding, so a
  // transparent background doesn't turn black.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return { kind: "raster", dataUrl: canvas.toDataURL("image/jpeg", 0.9), width, height }
}

async function rasterizeImageFile(file: File): Promise<RasterPlan> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageElement(url)
    return drawToDataUrl(img)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function rasterizePdf(file: File): Promise<RasterPlan> {
  let pdfjsLib: typeof import("pdfjs-dist")
  try {
    pdfjsLib = await import("pdfjs-dist")
  } catch {
    throw new Error("Couldn't load the PDF reader. Try again, or upload an image instead.")
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  const page = await doc.getPage(1)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(3, MAX_DIM / Math.max(baseViewport.width, baseViewport.height))
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser can't process PDFs.")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise

  return { kind: "raster", dataUrl: canvas.toDataURL("image/jpeg", 0.9), width: canvas.width, height: canvas.height }
}

// Keyword classifier for vector features (GeoJSON has no vision step to lean
// on), matched against the feature's name plus any type/category property.
const TYPE_KEYWORDS: [RegExp, WaypointType][] = [
  [/lift|elevator/, "lift"],
  [/stair/, "stairs"],
  [/toilet|restroom|wc|bathroom/, "toilet"],
  [/exit|entrance|door/, "exit"],
  [/reception|lobby|front desk/, "reception"],
  [/cafe|café|canteen|restaurant|food/, "canteen"],
  [/pharmacy|chemist/, "pharmacy"],
  [/ward/, "ward"],
  [/department|office|room|clinic|suite/, "department"],
]

function guessWaypointType(hint: string): WaypointType {
  const lower = hint.toLowerCase()
  for (const [pattern, type] of TYPE_KEYWORDS) {
    if (pattern.test(lower)) return type
  }
  return "other"
}

interface GeoJsonGeometry {
  type: string
  coordinates: unknown
}

interface GeoJsonFeature {
  type: string
  properties?: Record<string, unknown> | null
  geometry?: GeoJsonGeometry | null
}

function toLatLng(pair: unknown): Coordinates | null {
  if (!Array.isArray(pair) || pair.length < 2) return null
  const [lng, lat] = pair
  if (typeof lat !== "number" || typeof lng !== "number") return null
  return { lat, lng }
}

function centroidOf(ring: unknown): Coordinates | null {
  if (!Array.isArray(ring) || ring.length === 0) return null
  const points = ring.map(toLatLng).filter((p): p is Coordinates => p !== null)
  if (points.length === 0) return null
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 })
  return { lat: sum.lat / points.length, lng: sum.lng / points.length }
}

export function parseGeoJsonPlan(json: unknown): VectorPlanFeature[] {
  const raw = json as { type?: string; features?: unknown }
  const features: GeoJsonFeature[] = Array.isArray(raw?.features)
    ? (raw.features as GeoJsonFeature[])
    : Array.isArray(json)
      ? (json as GeoJsonFeature[])
      : []

  const out: VectorPlanFeature[] = []
  for (const f of features) {
    const geom = f.geometry
    if (!geom) continue
    const props = f.properties ?? {}
    const name =
      (typeof props.name === "string" && props.name) ||
      (typeof props.label === "string" && props.label) ||
      (typeof props.title === "string" && props.title) ||
      ""
    if (!name.trim()) continue
    const hint = [name, props.type, props.category, props.amenity, props.room]
      .filter((v): v is string => typeof v === "string")
      .join(" ")
    const type = guessWaypointType(hint)

    if (geom.type === "Point") {
      const point = toLatLng(geom.coordinates)
      if (point) out.push({ name: name.trim(), type, point })
    } else if (geom.type === "LineString") {
      const coords = geom.coordinates
      const line = Array.isArray(coords) ? coords.map(toLatLng).filter((p): p is Coordinates => p !== null) : []
      if (line.length >= 2) out.push({ name: name.trim(), type, line })
    } else if (geom.type === "Polygon") {
      const rings = geom.coordinates as unknown
      const outerRing = Array.isArray(rings) ? rings[0] : null
      const point = centroidOf(outerRing)
      if (point) out.push({ name: name.trim(), type, point })
    }
  }
  return out
}

async function parseVectorFile(file: File): Promise<VectorPlan> {
  const text = await file.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON/GeoJSON.")
  }
  const features = parseGeoJsonPlan(json)
  if (features.length === 0) {
    throw new Error("No named point or line features were found in that file.")
  }
  return { kind: "vector", features }
}

// Layers whose line-work represents walkable circulation (so their polylines
// become corridor trails). Everything else stays as wall imagery only — turning
// every wall into a walkable path would wreck routing.
const CORRIDOR_LAYER = /corridor|circulation|route|walkway|path|access|egress/i

// Read a DXF drawing into the same normalised room/corridor/asset shape a raster
// plan produces after the AI reader — but sourced from the file's real geometry.
// Rooms come from text labels + navigational block symbols; assets from fixture
// symbols (plug sockets, data points…); corridors from circulation-layer lines.
function extractCadFeatures(drawing: DxfDrawing): {
  rooms: NormalisedRoom[]
  corridors: { x: number; y: number }[][]
  assets: NormalisedAsset[]
} {
  const rooms: NormalisedRoom[] = []
  const corridors: { x: number; y: number }[][] = []
  const assets: NormalisedAsset[] = []

  for (const e of drawing.entities) {
    const hint = [e.block, e.layer, e.text].filter(Boolean).join(" ")

    // Circulation line-work → corridor trails.
    if (e.vertices && e.vertices.length >= 2 && CORRIDOR_LAYER.test(e.layer)) {
      corridors.push(e.vertices.map((v) => normalisePoint(drawing, v)))
      continue
    }

    // Point-like entities (placed symbols, labels) become rooms or assets.
    if (!e.point) continue

    const category = classifyAsset(hint)
    if (category) {
      const p = normalisePoint(drawing, e.point)
      assets.push({
        name: defaultAssetName(category, e.text || e.block || e.layer),
        category,
        x: p.x,
        y: p.y,
        source: e.block || e.layer,
      })
      continue
    }

    // A room only if it's a text label, or a symbol that clearly names a
    // navigational feature — not every stray block.
    const isLabel = e.type === "TEXT" || e.type === "MTEXT"
    const type = guessWaypointType(hint)
    if (isLabel && e.text) {
      const p = normalisePoint(drawing, e.point)
      rooms.push({ name: e.text, type, x: p.x, y: p.y })
    } else if (e.type === "INSERT" && type !== "other") {
      const p = normalisePoint(drawing, e.point)
      rooms.push({ name: e.block || WAYPOINT_TYPE_FALLBACK[type], type, x: p.x, y: p.y })
    }
  }

  return { rooms, corridors, assets }
}

// A readable name for a navigational symbol that carried only a block code.
const WAYPOINT_TYPE_FALLBACK: Record<WaypointType, string> = {
  ward: "Ward",
  department: "Department",
  lift: "Lift",
  stairs: "Stairs",
  toilet: "Toilets",
  exit: "Exit",
  reception: "Reception",
  canteen: "Café",
  pharmacy: "Pharmacy",
  other: "Location",
}

async function parseDxfFile(file: File): Promise<CadPlan> {
  const text = await file.text()
  const drawing = parseDxf(text)
  if (drawing.entities.length === 0) {
    throw new Error("That DXF file had no readable drawing entities.")
  }
  const rendered = renderDxf(drawing, MAX_DIM)
  if (!rendered) {
    throw new Error("Couldn't render that DXF — it may contain no 2D line-work on the plan.")
  }
  const { rooms, corridors, assets } = extractCadFeatures(drawing)
  return { kind: "cad", dataUrl: rendered.dataUrl, width: rendered.width, height: rendered.height, rooms, corridors, assets }
}

// Binary CAD (DWG) and BIM (RVT/IFC/SKP) still need server-side conversion; only
// text DXF is parseable in the browser. Named explicitly so the message can
// point mappers at the format we DO read.
const UNSUPPORTED_EXTENSIONS = [".dwg", ".rvt", ".ifc", ".skp"]

export async function loadPlanFile(file: File): Promise<ParsedPlan> {
  const name = file.name.toLowerCase()
  if (name.endsWith(".dxf")) return parseDxfFile(file)
  if (UNSUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new Error(
      "That CAD/BIM format isn't supported yet. Export the plan as DXF, an image, a PDF, or GeoJSON and upload that instead."
    )
  }
  if (isVectorFile(file)) return parseVectorFile(file)
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return rasterizePdf(file)
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/.test(name)) return rasterizeImageFile(file)
  throw new Error("Unsupported file. Upload a DXF, an image (JPG/PNG/WEBP/SVG), a PDF, or a GeoJSON file.")
}
