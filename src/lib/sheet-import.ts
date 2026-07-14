import { WaypointType } from "./types"

// Client half of the "map sheet" importer. The AI reader (/api/parse-plan)
// recognises hospital-trust style sheets — a designed site map with colour
// coded zones plus a Floor/Zone directory table — and returns the sheet's
// structure. Everything spatial then happens HERE, deterministically:
//
//   * crop the uploaded image to just the map artwork (the geo overlay must
//     not carry the page title or the directory tables onto real streets)
//   * find each colour zone's actual footprint by sampling the artwork's
//     pixels (same technique the QEH/UHL seed venues were built with)
//   * give every directory entry a position: entries the reader also found
//     drawn on the map anchor to their true label position; the rest are
//     spread evenly across their zone's footprint on the correct floor
//
// Positions within a zone are illustrative (the sheet only says "Red zone,
// floor 1", not where on the building) — but they always land on the right
// building, in the right colour, on the right floor.

export interface SheetZone {
  name: string
  color: string // "#rrggbb"
}

export interface SheetDirectoryEntry {
  name: string
  type: WaypointType
  floor: number
  zone: string // zone name, or "" when the row had no swatch
  section: string
}

export interface SheetData {
  isSheet: boolean
  mapRegion: { x0: number; y0: number; x1: number; y1: number }
  zones: SheetZone[]
  directory: SheetDirectoryEntry[]
}

export interface CroppedImage {
  dataUrl: string
  width: number
  height: number
}

// A directory entry with its position resolved, in coordinates normalised to
// the CROPPED map artwork (0..1 from its top-left).
export interface PlacedEntry extends SheetDirectoryEntry {
  x: number
  y: number
  // True when the entry sits at a label the reader actually saw on the map,
  // false when it was distributed across its zone's footprint.
  anchored: boolean
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Couldn't re-read the uploaded image."))
    img.src = src
  })
}

// Crop the uploaded sheet to its map-artwork region. Returns a fresh data URL
// sized to the crop (capped so seven floors of the same image stay storable).
const CROP_MAX_DIM = 1280

export async function cropToMapRegion(dataUrl: string, region: SheetData["mapRegion"]): Promise<CroppedImage> {
  const img = await loadImage(dataUrl)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const sx = Math.round(region.x0 * srcW)
  const sy = Math.round(region.y0 * srcH)
  const sw = Math.max(1, Math.round((region.x1 - region.x0) * srcW))
  const sh = Math.max(1, Math.round((region.y1 - region.y0) * srcH))
  const scale = Math.min(1, CROP_MAX_DIM / Math.max(sw, sh))
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("This browser can't process images.")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width, height }
}

// Remap a point normalised to the full sheet into the cropped artwork's frame.
// Returns null when the point falls outside the crop (e.g. a label the reader
// found inside a directory table rather than on the map).
export function remapToCrop(
  region: SheetData["mapRegion"],
  p: { x: number; y: number }
): { x: number; y: number } | null {
  const w = region.x1 - region.x0
  const h = region.y1 - region.y0
  if (w <= 0 || h <= 0) return null
  const x = (p.x - region.x0) / w
  const y = (p.y - region.y0) / h
  if (x < -0.02 || x > 1.02 || y < -0.02 || y > 1.02) return null
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

// How far (per channel) a pixel may sit from a zone's declared colour and
// still count as that zone. Generous enough for JPEG artefacts and slight
// print-colour drift, tight enough to keep distinct zones apart.
const ZONE_TOLERANCE = 42

// Sample the cropped artwork for each zone's coloured footprint. The image is
// scanned in small blocks; a block belongs to a zone only when all its probe
// pixels match, which keeps thin strokes, text and anti-aliased edges out.
// Returns normalised cell centres per zone name.
export async function sampleZoneFootprints(
  cropped: CroppedImage,
  zones: SheetZone[]
): Promise<Map<string, { x: number; y: number }[]>> {
  const out = new Map<string, { x: number; y: number }[]>()
  if (zones.length === 0) return out
  const img = await loadImage(cropped.dataUrl)
  const canvas = document.createElement("canvas")
  canvas.width = cropped.width
  canvas.height = cropped.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return out
  ctx.drawImage(img, 0, 0, cropped.width, cropped.height)
  const data = ctx.getImageData(0, 0, cropped.width, cropped.height).data

  const rgb = zones.map((z) => ({ name: z.name, c: hexToRgb(z.color) }))
  for (const z of rgb) out.set(z.name, [])

  const B = Math.max(6, Math.round(Math.max(cropped.width, cropped.height) / 160))
  const probes = [
    [2, 2],
    [B - 2, 2],
    [2, B - 2],
    [B - 2, B - 2],
    [B >> 1, B >> 1],
  ]
  const px = (x: number, y: number): [number, number, number] => {
    const i = (y * cropped.width + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }
  const near = (a: [number, number, number], b: [number, number, number]) =>
    Math.abs(a[0] - b[0]) <= ZONE_TOLERANCE && Math.abs(a[1] - b[1]) <= ZONE_TOLERANCE && Math.abs(a[2] - b[2]) <= ZONE_TOLERANCE

  for (let by = 0; by + B < cropped.height; by += B) {
    for (let bx = 0; bx + B < cropped.width; bx += B) {
      for (const z of rgb) {
        let all = true
        for (const [dx, dy] of probes) {
          if (!near(px(bx + dx, by + dy), z.c)) {
            all = false
            break
          }
        }
        if (all) {
          out.get(z.name)!.push({ x: (bx + B / 2) / cropped.width, y: (by + B / 2) / cropped.height })
          break
        }
      }
    }
  }
  return out
}

// Normalise a place name for matching directory rows against labels the
// reader saw drawn on the map ("Blood Tests" vs "Blood\nTests" etc.).
function nameKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

// Resolve a position for every directory entry:
//  * anchored to a drawn label when one matches by name,
//  * otherwise spread evenly across the entry's zone footprint,
//  * otherwise (no zone, or the zone sampled empty) fanned around the centre
//    of the artwork so nothing is lost — the mapper can drag pins afterwards.
export function placeDirectoryEntries(
  directory: SheetDirectoryEntry[],
  zoneCells: Map<string, { x: number; y: number }[]>,
  drawnLabels: { name: string; x: number; y: number }[]
): PlacedEntry[] {
  const labelByKey = new Map<string, { x: number; y: number }>()
  for (const l of drawnLabels) {
    const key = nameKey(l.name)
    if (key && !labelByKey.has(key)) labelByKey.set(key, { x: l.x, y: l.y })
  }

  // Pass 1: anchor by name; collect the leftovers per zone.
  const placed: (PlacedEntry | null)[] = directory.map(() => null)
  const leftoversByZone = new Map<string, number[]>()
  const unzoned: number[] = []
  directory.forEach((entry, i) => {
    const hit = labelByKey.get(nameKey(entry.name))
    if (hit) {
      placed[i] = { ...entry, x: hit.x, y: hit.y, anchored: true }
    } else if (entry.zone && (zoneCells.get(entry.zone)?.length ?? 0) > 0) {
      const list = leftoversByZone.get(entry.zone) ?? []
      list.push(i)
      leftoversByZone.set(entry.zone, list)
    } else {
      unzoned.push(i)
    }
  })

  // Pass 2: spread each zone's leftovers across its footprint. Cells are
  // ordered in row bands so consecutive picks land apart from each other.
  for (const [zone, indices] of leftoversByZone) {
    const cells = [...zoneCells.get(zone)!].sort((a, b) => Math.round(a.y * 40) - Math.round(b.y * 40) || a.x - b.x)
    indices.forEach((entryIdx, i) => {
      const cell = cells[Math.min(Math.floor((i + 0.5) * (cells.length / indices.length)), cells.length - 1)]
      placed[entryIdx] = { ...directory[entryIdx], x: cell.x, y: cell.y, anchored: false }
    })
  }

  // Pass 3: no zone to lean on — fan out around the artwork centre.
  unzoned.forEach((entryIdx, i) => {
    const angle = (i / Math.max(1, unzoned.length)) * Math.PI * 2
    const r = 0.06 + 0.02 * (i % 3)
    placed[entryIdx] = {
      ...directory[entryIdx],
      x: Math.max(0.02, Math.min(0.98, 0.5 + Math.cos(angle) * r)),
      y: Math.max(0.02, Math.min(0.98, 0.5 + Math.sin(angle) * r)),
      anchored: false,
    }
  })

  return placed as PlacedEntry[]
}
