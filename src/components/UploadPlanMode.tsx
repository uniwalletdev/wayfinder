"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Asset, AssetCategory, Coordinates, FloorPlan, SurveyTrail, Waypoint, WaypointType } from "@/lib/types"
import { ALL_WAYPOINT_TYPES, WAYPOINT_TYPE_ICONS, WAYPOINT_TYPE_LABELS, floorLabel } from "@/lib/waypoint-meta"
import { ALL_ASSET_CATEGORIES, ASSET_CATEGORY_ICONS, ASSET_CATEGORY_LABELS } from "@/lib/asset-meta"
import { loadPlanFile, VectorPlanFeature, NormalisedAsset } from "@/lib/plan-import"
import { PlanCorners, cornersToBounds, defaultPlanCorners, projectPlanPoint } from "@/lib/plan-georeference"
import { SheetData, cropToMapRegion, remapToCrop, sampleZoneFootprints, placeDirectoryEntries } from "@/lib/sheet-import"
import { X, Check, ChevronUp, ChevronDown, UploadCloud, MapPinned, Trash2, Plug } from "lucide-react"

export interface UploadPlanResult {
  floorPlans: FloorPlan[]
  waypoints: Waypoint[]
  trails: SurveyTrail[]
  assets: Asset[]
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
  floor: number
  // The sheet's colour zone this place belongs to, when it came from a map
  // sheet's directory table.
  zone?: string
}

interface ReviewAsset {
  name: string
  category: AssetCategory
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

  // Cancelling analysis bumps the run token so a still-running handleFile
  // abandons its results, and aborts the in-flight AI request. Without this the
  // analyzing spinner has no way out if the file parse or AI read hangs.
  const runRef = useRef(0)
  const parseAbortRef = useRef<AbortController | null>(null)
  function cancelAnalyzing() {
    runRef.current++
    parseAbortRef.current?.abort()
    setStep("pick")
  }

  // Raster path (image/PDF/SVG): the flattened image plus whatever the AI reader
  // found, in coordinates normalised to the image — held until the mapper
  // georeferences it onto the real map.
  const [rasterImage, setRasterImage] = useState<{ dataUrl: string; width: number; height: number } | null>(null)
  const [rawRooms, setRawRooms] = useState<{ name: string; type: WaypointType; x: number; y: number }[]>([])
  const [rawCorridors, setRawCorridors] = useState<{ x: number; y: number }[][]>([])
  // Set when the AI reader recognised a full map sheet (designed site map +
  // Floor/Zone directory table). rasterImage then holds the CROPPED artwork
  // and rawRooms/rawCorridors are already remapped into its frame.
  const [rawSheet, setRawSheet] = useState<SheetData | null>(null)
  // Located fixtures (plug sockets, data points…) read from a CAD plan, in
  // image-normalised space until georeferenced.
  const [rawAssets, setRawAssets] = useState<NormalisedAsset[]>([])
  const [corners, setCorners] = useState<PlanCorners | null>(null)

  // Final, real-world list to confirm — populated after georeferencing a raster
  // plan, or immediately for a vector file that's already georeferenced.
  const [reviewRooms, setReviewRooms] = useState<ReviewRoom[]>([])
  const [reviewTrails, setReviewTrails] = useState<Coordinates[][]>([])
  const [reviewAssets, setReviewAssets] = useState<ReviewAsset[]>([])

  async function handleFile(file: File) {
    const run = ++runRef.current
    setError(null)
    setNotice(null)
    setStep("analyzing")
    try {
      const parsed = await loadPlanFile(file)
      if (run !== runRef.current) return

      if (parsed.kind === "vector") {
        const rooms = parsed.features.filter((f): f is VectorPlanFeature & { point: Coordinates } => !!f.point)
        const lines = parsed.features.filter((f): f is VectorPlanFeature & { line: Coordinates[] } => !!f.line)
        setRasterImage(null)
        setCorners(null)
        setReviewRooms(rooms.map((r) => ({ name: r.name, type: r.type, include: true, coordinates: r.point, floor: planFloor })))
        setReviewTrails(lines.map((l) => l.line))
        setReviewAssets([])
        if (rooms.length === 0) {
          setNotice("That file only had corridor lines — no named point locations to add as waypoints.")
        }
        setStep("review")
        return
      }

      // CAD (DXF): geometry is already extracted from the file, so there's no AI
      // reader step — but its coordinates are local to the drawing, so it still
      // goes through corner-drag georeferencing like a raster plan does.
      if (parsed.kind === "cad") {
        setRasterImage({ dataUrl: parsed.dataUrl, width: parsed.width, height: parsed.height })
        setRawRooms(parsed.rooms)
        setRawCorridors(parsed.corridors)
        setRawAssets(parsed.assets)
        setCorners(defaultPlanCorners(venueCenter, parsed.width / parsed.height))
        const bits: string[] = []
        if (parsed.rooms.length) bits.push(`${parsed.rooms.length} location${parsed.rooms.length === 1 ? "" : "s"}`)
        if (parsed.assets.length) bits.push(`${parsed.assets.length} fixture${parsed.assets.length === 1 ? "" : "s"}`)
        setNotice(
          bits.length
            ? `Read ${bits.join(" and ")} from the CAD file. Position the plan, then review before saving.`
            : "Rendered the CAD line-work. Position the plan, then add points yourself if needed."
        )
        setStep("georeference")
        return
      }

      setRasterImage({ dataUrl: parsed.dataUrl, width: parsed.width, height: parsed.height })
      setRawAssets([])
      setRawSheet(null)

      let rooms: { name: string; type: WaypointType; x: number; y: number }[] = []
      let corridors: { x: number; y: number }[][] = []
      let sheet: SheetData | null = null
      try {
        const ac = new AbortController()
        parseAbortRef.current = ac
        const res = await fetch("/api/parse-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: parsed.dataUrl, venueName, floor: planFloor }),
          signal: ac.signal,
        })
        const data = await res.json()
        rooms = Array.isArray(data.rooms) ? data.rooms : []
        corridors = Array.isArray(data.corridors) ? data.corridors : []
        sheet = data.sheet && data.sheet.isSheet && Array.isArray(data.sheet.directory) ? (data.sheet as SheetData) : null
        if (data.error === "not_configured") {
          setNotice("AI plan-reading isn't enabled on the server — the image will still be placed on the map; add its points yourself afterwards.")
        } else if (data.error) {
          setNotice("Couldn't automatically read the plan — the image will still be placed on the map; add its points yourself afterwards.")
        } else if (rooms.length === 0 && !sheet) {
          setNotice("No clearly labelled rooms were found — the image will still be placed on the map; add its points yourself afterwards.")
        }
      } catch {
        setNotice("Couldn't reach the AI reader — the image will still be placed on the map; add its points yourself afterwards.")
      }
      if (run !== runRef.current) return

      if (sheet) {
        // A full map sheet: crop the overlay to the map artwork (the page
        // title and directory tables must not be draped over real streets)
        // and remap everything the reader saw into the cropped frame.
        try {
          const cropped = await cropToMapRegion(parsed.dataUrl, sheet.mapRegion)
          if (run !== runRef.current) return
          const remappedRooms = rooms
            .map((r) => {
              const p = remapToCrop(sheet!.mapRegion, r)
              return p ? { ...r, x: p.x, y: p.y } : null
            })
            .filter((r): r is { name: string; type: WaypointType; x: number; y: number } => r !== null)
          const remappedCorridors = corridors
            .map((pts) => pts.map((p) => remapToCrop(sheet!.mapRegion, p)).filter((p): p is { x: number; y: number } => p !== null))
            .filter((pts) => pts.length >= 2)
          setRasterImage(cropped)
          setRawRooms(remappedRooms)
          setRawCorridors(remappedCorridors)
          setRawSheet(sheet)
          const floors = new Set(sheet.directory.map((d) => d.floor))
          setNotice(
            `This looks like a full map sheet: ${sheet.directory.length} places across ${floors.size} floor${floors.size === 1 ? "" : "s"}` +
              (sheet.zones.length ? ` in ${sheet.zones.length} colour zones` : "") +
              ". Position the map artwork over the real building, then review."
          )
          // A whole-site sheet starts at a site-ish span instead of a single
          // building's, so the mapper isn't dragging corners across the town.
          setCorners(defaultPlanCorners(venueCenter, cropped.width / cropped.height, 300))
          setStep("georeference")
          return
        } catch {
          // Fall through to the plain-plan path with the uncropped image.
        }
      }

      setRawRooms(rooms)
      setRawCorridors(corridors)
      setCorners(defaultPlanCorners(venueCenter, parsed.width / parsed.height))
      setStep("georeference")
    } catch (e) {
      if (run !== runRef.current) return
      setError(e instanceof Error ? e.message : "Couldn't read that file.")
      setStep("pick")
    }
  }

  async function confirmGeoreference(finalCorners: PlanCorners) {
    setCorners(finalCorners)

    if (rawSheet && rasterImage) {
      // Sheet path: every directory entry becomes a reviewable place. Entries
      // the reader also saw drawn on the map anchor to their true position;
      // the rest are spread across their colour zone's sampled footprint.
      let placed
      try {
        const cells = await sampleZoneFootprints(rasterImage, rawSheet.zones)
        placed = placeDirectoryEntries(rawSheet.directory, cells, rawRooms)
      } catch {
        placed = placeDirectoryEntries(rawSheet.directory, new Map(), rawRooms)
      }
      const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
      const directoryKeys = new Set(rawSheet.directory.map((d) => key(d.name)))
      // Drawn labels that aren't directory rows (entrances, standalone
      // buildings…) still deserve pins — on the ground floor.
      const extraDrawn = rawRooms.filter((r) => !directoryKeys.has(key(r.name)))
      setReviewRooms([
        ...placed.map((p) => ({
          name: p.name,
          type: p.type,
          include: true,
          coordinates: projectPlanPoint(finalCorners, p.x, p.y),
          floor: p.floor,
          zone: p.zone || undefined,
        })),
        ...extraDrawn.map((r) => ({
          name: r.name,
          type: r.type,
          include: true,
          coordinates: projectPlanPoint(finalCorners, r.x, r.y),
          floor: 0,
        })),
      ])
      setReviewTrails(rawCorridors.map((pts) => pts.map((p) => projectPlanPoint(finalCorners, p.x, p.y))))
      setReviewAssets([])
      setStep("review")
      return
    }

    setReviewRooms(
      rawRooms.map((r) => ({
        name: r.name,
        type: r.type,
        include: true,
        coordinates: projectPlanPoint(finalCorners, r.x, r.y),
        floor: planFloor,
      }))
    )
    setReviewTrails(rawCorridors.map((pts) => pts.map((p) => projectPlanPoint(finalCorners, p.x, p.y))))
    setReviewAssets(
      rawAssets.map((a) => ({
        name: a.name,
        category: a.category,
        include: true,
        coordinates: projectPlanPoint(finalCorners, a.x, a.y),
      }))
    )
    setStep("review")
  }

  function updateAsset(index: number, patch: Partial<ReviewAsset>) {
    setReviewAssets((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function removeAsset(index: number) {
    setReviewAssets((prev) => prev.filter((_, i) => i !== index))
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
      floor: r.floor,
      description: r.zone ? `${r.zone} zone` : "Added from an uploaded floor plan",
    }))
    const trailFloor = rawSheet ? 0 : planFloor
    const trails: SurveyTrail[] = reviewTrails
      .filter((pts) => pts.length >= 2)
      .map((pts, i) => ({ id: `plan-trail-${Date.now()}-${i}`, floor: trailFloor, points: pts }))
    const assets: Asset[] = reviewAssets
      .filter((a) => a.name.trim() && a.include)
      .map((a, i) => ({
        id: `plan-asset-${Date.now()}-${i}`,
        name: a.name.trim(),
        category: a.category,
        coordinates: a.coordinates,
        floor: planFloor,
        source: "Uploaded CAD plan",
      }))

    let floorPlans: FloorPlan[] = []
    if (rasterImage && corners) {
      const bounds = cornersToBounds(corners)
      if (rawSheet) {
        // One sheet serves every floor it mentions: wards above ground are
        // found by zone colour + floor, exactly how the trust's sheet works.
        const floors = [...new Set([0, ...included.map((w) => w.floor)])].sort((a, b) => a - b)
        floorPlans = floors.map((f) => ({
          id: `plan-${Date.now()}-f${f}`,
          floor: f,
          label: floorLabel(f),
          imageUrl: rasterImage.dataUrl,
          bounds,
        }))
      } else {
        floorPlans = [
          {
            id: `plan-${Date.now()}`,
            floor: planFloor,
            label: floorLabel(planFloor),
            imageUrl: rasterImage.dataUrl,
            bounds,
          },
        ]
      }
    }
    onUploadComplete({ floorPlans, waypoints, trails, assets })
  }

  if (step === "analyzing") {
    return (
      <div className="fixed inset-0 z-[300] bg-white flex flex-col items-center justify-center text-center p-6">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#005EB8] rounded-full animate-spin mb-5" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Reading your plan…</h2>
        <p className="text-sm text-gray-500">Scanning the file for rooms, labels and corridors.</p>
        <button
          onClick={cancelAnalyzing}
          className="mt-6 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700"
        >
          Cancel
        </button>
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
            {reviewRooms.length} place{reviewRooms.length === 1 ? "" : "s"} detected{" "}
            {rawSheet
              ? `across ${new Set(reviewRooms.map((r) => r.floor)).size} floor${new Set(reviewRooms.map((r) => r.floor)).size === 1 ? "" : "s"}`
              : `on ${floorLabel(planFloor)}`}
            {reviewTrails.length > 0
              ? ` · ${reviewTrails.length} corridor${reviewTrails.length === 1 ? "" : "s"} traced`
              : ""}
            {reviewAssets.length > 0
              ? ` · ${reviewAssets.length} fixture${reviewAssets.length === 1 ? "" : "s"}`
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
                  {rawSheet && (
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-md px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap">
                      {floorLabel(r.floor)}
                      {r.zone ? ` · ${r.zone}` : ""}
                    </span>
                  )}
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

          {reviewAssets.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-1.5 mb-2">
                <Plug size={14} className="text-[#005EB8]" />
                <h3 className="text-xs font-semibold text-gray-600">
                  Fixtures &amp; assets ({reviewAssets.length})
                </h3>
              </div>
              <p className="text-xs text-gray-400 mb-2.5">
                Located fixtures like plug sockets — saved as a separate overlay layer, not navigation destinations.
              </p>
              <div className="flex flex-col gap-2">
                {reviewAssets.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                      a.include ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={a.include}
                      onChange={(e) => updateAsset(i, { include: e.target.checked })}
                      className="w-4 h-4 accent-[#005EB8] flex-shrink-0"
                      aria-label={`Include ${a.name}`}
                    />
                    <span className="text-lg flex-shrink-0">{ASSET_CATEGORY_ICONS[a.category]}</span>
                    <input
                      value={a.name}
                      onChange={(e) => updateAsset(i, { name: e.target.value })}
                      className="flex-1 min-w-0 text-sm font-medium text-gray-900 outline-none border-b border-transparent focus:border-[#005EB8]"
                    />
                    <select
                      value={a.category}
                      onChange={(e) => updateAsset(i, { category: e.target.value as AssetCategory })}
                      className="text-xs text-gray-500 bg-transparent outline-none flex-shrink-0"
                    >
                      {ALL_ASSET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {ASSET_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeAsset(i)}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0"
                      aria-label={`Remove ${a.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
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
          Already have a plan? Upload a photo, scan, exported PDF, SVG diagram, GeoJSON export, or a DXF CAD drawing and
          it&apos;s read automatically — rooms and corridors are detected and turned into a navigable layout, the same way
          a Survey Mode walk would. A DXF also carries its located fixtures (plug sockets, data points…) onto a separate
          overlay.
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Full map sheets work too: a hospital-style site map with colour-coded zones and a Floor/Zone directory table is
          recognised as a whole — every listed ward and department is placed on its zone at the right floor, even ones
          only listed in the table, and the map serves every floor at once.
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
          <p className="text-xs text-gray-400">Image (JPG/PNG/WEBP/SVG) · PDF · GeoJSON · DXF</p>
          <input
            type="file"
            accept="image/*,.pdf,application/pdf,.svg,image/svg+xml,.geojson,.json,application/geo+json,application/json,.dxf,image/vnd.dxf,application/dxf"
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
          DXF CAD drawings are read directly. Binary/BIM formats (DWG, RVT, IFC…) aren&apos;t yet — export those to DXF,
          an image, PDF, or GeoJSON first.
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
