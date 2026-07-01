"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Coordinates, FloorPlan, SurveyTrail, Waypoint, WaypointType } from "@/lib/types"
import { ALL_WAYPOINT_TYPES, WAYPOINT_TYPE_ICONS, WAYPOINT_TYPE_LABELS, floorLabel } from "@/lib/waypoint-meta"
import { loadPlanFile, VectorPlanFeature } from "@/lib/plan-import"
import { PlanCorners, cornersToBounds, defaultPlanCorners, projectPlanPoint } from "@/lib/plan-georeference"
import { X, Check, ChevronUp, ChevronDown, UploadCloud, MapPinned, Trash2 } from "lucide-react"

export interface UploadPlanResult {
  floorPlan: FloorPlan | null
  waypoints: Waypoint[]
  trails: SurveyTrail[]
}

interface Props {
  currentFloor: number
  venueCenter: Coordinates
  venueName: string
  onClose: () => void
  onUploadComplete: (result: UploadPlanResult) => void
}

interface ReviewRoom {
  name: string
  type: WaypointType
  include: boolean
  coordinates: Coordinates
}

type Step = "pick" | "analyzing" | "georeference" | "review"

export default function UploadPlanMode({ currentFloor, venueCenter, venueName, onClose, onUploadComplete }: Props) {
  const [step, setStep] = useState<Step>("pick")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [planFloor, setPlanFloor] = useState(currentFloor)
  const [dragOver, setDragOver] = useState(false)

  // Raster path (image/PDF/SVG): the flattened image plus whatever the AI reader
  // found, in coordinates normalised to the image — held until the mapper
  // georeferences it onto the real map.
  const [rasterImage, setRasterImage] = useState<{ dataUrl: string; width: number; height: number } | null>(null)
  const [rawRooms, setRawRooms] = useState<{ name: string; type: WaypointType; x: number; y: number }[]>([])
  const [rawCorridors, setRawCorridors] = useState<{ x: number; y: number }[][]>([])
  const [corners, setCorners] = useState<PlanCorners | null>(null)

  // Final, real-world list to confirm — populated after georeferencing a raster
  // plan, or immediately for a vector file that's already georeferenced.
  const [reviewRooms, setReviewRooms] = useState<ReviewRoom[]>([])
  const [reviewTrails, setReviewTrails] = useState<Coordinates[][]>([])

  async function handleFile(file: File) {
    setError(null)
    setNotice(null)
    setStep("analyzing")
    try {
      const parsed = await loadPlanFile(file)

      if (parsed.kind === "vector") {
        const rooms = parsed.features.filter((f): f is VectorPlanFeature & { point: Coordinates } => !!f.point)
        const lines = parsed.features.filter((f): f is VectorPlanFeature & { line: Coordinates[] } => !!f.line)
        setRasterImage(null)
        setCorners(null)
        setReviewRooms(rooms.map((r) => ({ name: r.name, type: r.type, include: true, coordinates: r.point })))
        setReviewTrails(lines.map((l) => l.line))
        if (rooms.length === 0) {
          setNotice("That file only had corridor lines — no named point locations to add as waypoints.")
        }
        setStep("review")
        return
      }

      setRasterImage({ dataUrl: parsed.dataUrl, width: parsed.width, height: parsed.height })

      let rooms: { name: string; type: WaypointType; x: number; y: number }[] = []
      let corridors: { x: number; y: number }[][] = []
      try {
        const res = await fetch("/api/parse-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: parsed.dataUrl, venueName, floor: planFloor }),
        })
        const data = await res.json()
        rooms = Array.isArray(data.rooms) ? data.rooms : []
        corridors = Array.isArray(data.corridors) ? data.corridors : []
        if (data.error === "not_configured") {
          setNotice("AI plan-reading isn't enabled on the server — the image will still be placed on the map; add its points yourself afterwards.")
        } else if (data.error) {
          setNotice("Couldn't automatically read the plan — the image will still be placed on the map; add its points yourself afterwards.")
        } else if (rooms.length === 0) {
          setNotice("No clearly labelled rooms were found — the image will still be placed on the map; add its points yourself afterwards.")
        }
      } catch {
        setNotice("Couldn't reach the AI reader — the image will still be placed on the map; add its points yourself afterwards.")
      }

      setRawRooms(rooms)
      setRawCorridors(corridors)
      setCorners(defaultPlanCorners(venueCenter, parsed.width / parsed.height))
      setStep("georeference")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.")
      setStep("pick")
    }
  }

  function confirmGeoreference(finalCorners: PlanCorners) {
    setCorners(finalCorners)
    setReviewRooms(
      rawRooms.map((r) => ({
        name: r.name,
        type: r.type,
        include: true,
        coordinates: projectPlanPoint(finalCorners, r.x, r.y),
      }))
    )
    setReviewTrails(rawCorridors.map((pts) => pts.map((p) => projectPlanPoint(finalCorners, p.x, p.y))))
    setStep("review")
  }

  function updateRoom(index: number, patch: Partial<ReviewRoom>) {
    setReviewRooms((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function removeRoom(index: number) {
    setReviewRooms((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    const included = reviewRooms.filter((r) => r.name.trim() && r.include)
    const waypoints: Waypoint[] = included.map((r, i) => ({
      id: `plan-${Date.now()}-${i}`,
      name: r.name.trim(),
      type: r.type,
      coordinates: r.coordinates,
      floor: planFloor,
      description: "Added from an uploaded floor plan",
    }))
    const trails: SurveyTrail[] = reviewTrails
      .filter((pts) => pts.length >= 2)
      .map((pts, i) => ({ id: `plan-trail-${Date.now()}-${i}`, floor: planFloor, points: pts }))
    const plan: FloorPlan | null =
      rasterImage && corners
        ? {
            id: `plan-${Date.now()}`,
            floor: planFloor,
            label: floorLabel(planFloor),
            imageUrl: rasterImage.dataUrl,
            bounds: cornersToBounds(corners),
          }
        : null
    onUploadComplete({ floorPlan: plan, waypoints, trails })
  }

  if (step === "analyzing") {
    return (
      <div className="fixed inset-0 z-[300] bg-white flex flex-col items-center justify-center text-center p-6">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#005EB8] rounded-full animate-spin mb-5" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Reading your plan…</h2>
        <p className="text-sm text-gray-500">Scanning the file for rooms, labels and corridors.</p>
      </div>
    )
  }

  if (step === "georeference" && rasterImage && corners) {
    return (
      <div className="fixed inset-0 z-[300] bg-white flex flex-col">
        <div className="bg-[#005EB8] px-4 pt-safe-bar pb-4 flex items-center gap-3">
          <button onClick={() => setStep("pick")} className="text-white" aria-label="Back">
            <X size={22} />
          </button>
          <h2 className="text-white font-bold text-lg flex-1">Position the plan</h2>
        </div>
        <div className="px-4 py-2.5 bg-blue-50 flex items-start gap-2">
          <MapPinned size={15} className="text-[#005EB8] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#005EB8]">
            Drag the two corner handles so the plan lines up with the real building, then confirm.
          </p>
        </div>
        <div className="flex-1 relative">
          <GeoreferenceMap imageUrl={rasterImage.dataUrl} initialCorners={corners} onConfirm={confirmGeoreference} />
        </div>
      </div>
    )
  }

  if (step === "review") {
    return (
      <div className="fixed inset-0 z-[300] bg-white flex flex-col">
        <div className="bg-[#005EB8] px-4 pt-safe-bar pb-4 flex items-center gap-3">
          <button onClick={onClose} className="text-white" aria-label="Cancel">
            <X size={22} />
          </button>
          <h2 className="text-white font-bold text-lg flex-1">Review detected places</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe-bar">
          {notice && (
            <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">{notice}</p>
          )}
          <p className="text-xs text-gray-500 mb-3">
            {reviewRooms.length} place{reviewRooms.length === 1 ? "" : "s"} detected on {floorLabel(planFloor)}
            {reviewTrails.length > 0
              ? ` · ${reviewTrails.length} corridor${reviewTrails.length === 1 ? "" : "s"} traced`
              : ""}
            . Untick anything wrong, or fix a name or type before saving.
          </p>

          {reviewRooms.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No places detected — you can still save the plan and add points to it yourself afterwards.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {reviewRooms.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    r.include ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => updateRoom(i, { include: e.target.checked })}
                    className="w-4 h-4 accent-[#005EB8] flex-shrink-0"
                    aria-label={`Include ${r.name}`}
                  />
                  <span className="text-lg flex-shrink-0">{WAYPOINT_TYPE_ICONS[r.type]}</span>
                  <input
                    value={r.name}
                    onChange={(e) => updateRoom(i, { name: e.target.value })}
                    className="flex-1 min-w-0 text-sm font-medium text-gray-900 outline-none border-b border-transparent focus:border-[#005EB8]"
                  />
                  <select
                    value={r.type}
                    onChange={(e) => updateRoom(i, { type: e.target.value as WaypointType })}
                    className="text-xs text-gray-500 bg-transparent outline-none flex-shrink-0"
                  >
                    {ALL_WAYPOINT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {WAYPOINT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeRoom(i)}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0"
                    aria-label={`Remove ${r.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 pt-3 pb-safe-bar border-t border-gray-100">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-3.5 font-bold text-base"
          >
            <Check size={18} />
            Save to map
          </button>
        </div>
      </div>
    )
  }

  // step === "pick"
  return (
    <div className="fixed inset-0 z-[300] bg-white flex flex-col">
      <div className="bg-[#005EB8] px-4 pt-safe-bar pb-4 flex items-center gap-3">
        <button onClick={onClose} className="text-white" aria-label="Close">
          <X size={22} />
        </button>
        <h2 className="text-white font-bold text-lg flex-1">Upload a floor plan</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe-bar">
        <p className="text-sm text-gray-600 mb-4">
          Already have a plan? Upload a photo, scan, exported PDF, SVG diagram, or GeoJSON export and it&apos;s read
          automatically — rooms and corridors are detected and turned into a navigable layout, the same way a Survey Mode
          walk would.
        </p>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-500">Floor being uploaded</p>
            <p className="text-sm font-bold text-gray-900">{floorLabel(planFloor)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPlanFloor((f) => Math.max(f - 1, -5))}
              className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center active:bg-gray-200"
              aria-label="Floor down"
            >
              <ChevronDown size={18} />
            </button>
            <button
              onClick={() => setPlanFloor((f) => Math.min(f + 1, 30))}
              className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center active:bg-gray-200"
              aria-label="Floor up"
            >
              <ChevronUp size={18} />
            </button>
          </div>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) void handleFile(file)
          }}
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-10 px-4 text-center cursor-pointer transition-colors ${
            dragOver ? "border-[#005EB8] bg-blue-50" : "border-gray-200"
          }`}
        >
          <UploadCloud size={32} className="text-[#005EB8]" />
          <p className="text-sm font-semibold text-gray-800">Tap to choose a file, or drag one here</p>
          <p className="text-xs text-gray-400">Image (JPG/PNG/WEBP/SVG) · PDF · GeoJSON</p>
          <input
            type="file"
            accept="image/*,.pdf,application/pdf,.svg,image/svg+xml,.geojson,.json,application/geo+json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ""
            }}
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <p className="mt-4 text-xs text-gray-400">
          CAD/BIM files (DWG, RVT, IFC…) aren&apos;t read yet — export the plan as an image, PDF, or GeoJSON first.
        </p>
      </div>
    </div>
  )
}

// Lets the mapper drag an uploaded plan's two opposite corners onto the live
// map until it lines up with the real building. Runs entirely on Leaflet refs
// (like FloorPlanMap) so dragging stays smooth — React state only gets the
// result once, on confirm.
function GeoreferenceMap({
  imageUrl,
  initialCorners,
  onConfirm,
}: {
  imageUrl: string
  initialCorners: PlanCorners
  onConfirm: (corners: PlanCorners) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const cornersRef = useRef<PlanCorners>(initialCorners)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false })
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 22 }).addTo(map)

    const overlay = L.imageOverlay(imageUrl, cornersToBounds(cornersRef.current), { opacity: 0.75 }).addTo(map)
    map.fitBounds(overlay.getBounds(), { padding: [40, 40] })

    const updateOverlay = () => overlay.setBounds(L.latLngBounds(cornersToBounds(cornersRef.current)))

    const makeHandle = (label: string, corner: keyof PlanCorners) => {
      const icon = L.divIcon({ html: `<div class="wf-plan-handle">${label}</div>`, iconSize: [28, 28], iconAnchor: [14, 14], className: "" })
      const start = cornersRef.current[corner]
      const marker = L.marker([start.lat, start.lng], { draggable: true, icon, zIndexOffset: 1000 }).addTo(map)
      marker.on("drag", () => {
        const ll = marker.getLatLng()
        cornersRef.current = { ...cornersRef.current, [corner]: { lat: ll.lat, lng: ll.lng } }
        updateOverlay()
      })
    }
    makeHandle("TL", "topLeft")
    makeHandle("BR", "bottomRight")

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // Only (re)builds when a new image is loaded — corner drags are handled
    // imperatively above rather than by re-running this effect.
  }, [imageUrl])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <button
        onClick={() => onConfirm(cornersRef.current)}
        className="absolute left-4 right-4 bottom-4 z-[1000] flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-3.5 font-bold text-base shadow-lg"
      >
        <Check size={18} />
        Confirm placement
      </button>
    </div>
  )
}
