"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Asset, AssetCategory, Coordinates, FloorNaming, FloorPlan, SurveyTrail, Waypoint, WaypointType } from "@/lib/types"
import { ALL_WAYPOINT_TYPES, WAYPOINT_TYPE_ICONS, WAYPOINT_TYPE_LABELS, floorLabel } from "@/lib/waypoint-meta"
import { ALL_ASSET_CATEGORIES, ASSET_CATEGORY_ICONS, ASSET_CATEGORY_LABELS } from "@/lib/asset-meta"
import { loadPlanFile, VectorPlanFeature, NormalisedAsset } from "@/lib/plan-import"
import { PlanCorners, cornersToBounds, defaultPlanCorners, projectPlanPoint } from "@/lib/plan-georeference"
import { SheetData, cropToMapRegion, remapToCrop, sampleZoneFootprints, placeDirectoryEntries } from "@/lib/sheet-import"
import { Check, ChevronUp, ChevronDown, UploadCloud, MapPinned, Trash2, Plug } from "lucide-react"
import Overlay from "@/components/Overlay"
import { apiUrl } from "@/lib/app-shell"
import { basemapLayer, useBasemapSource } from "@/lib/use-basemap"

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
  // The venue's own storey numbering, for every floor shown here.
  floorNaming?: FloorNaming
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

export default function UploadPlanMode({ currentFloor, venueCenter, venueName, floorNaming, onClose, onUploadComplete }: Props) {
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
        const res = await fetch(apiUrl("/api/parse-plan"), {
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
          label: floorLabel(f, floorNaming),
          imageUrl: rasterImage.dataUrl,
          bounds,
        }))
      } else {
        floorPlans = [
          {
            id: `plan-${Date.now()}`,
            floor: planFloor,
            label: floorLabel(planFloor, floorNaming),
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
      <Overlay title="Reading your plan" z={300} onClose={cancelAnalyzing} dismissLabel="Cancel">
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center" role="status" aria-live="polite">
          <div className="mb-5 h-10 w-10 animate-spin rounded-full border-4 border-wf-border border-t-wf-primary" aria-hidden="true" />
          <h3 className="mb-1 font-display text-lg font-semibold text-wf-ink">Reading your plan…</h3>
          <p className="text-sm text-wf-muted">Scanning the file for rooms, labels and corridors.</p>
          <button
            onClick={cancelAnalyzing}
            className="mt-6 rounded-xl border border-wf-border px-5 py-2.5 text-sm font-semibold text-wf-ink"
          >
            Cancel
          </button>
        </div>
      </Overlay>
    )
  }

  if (step === "georeference" && rasterImage && corners) {
    return (
      <Overlay title="Position the plan" z={300} dismiss="back" onClose={() => setStep("pick")}>
        <div className="flex items-start gap-2 bg-[#E7F2FF] px-4 py-2.5 lg:px-6">
          <MapPinned size={15} className="mt-0.5 flex-shrink-0 text-wf-primary" aria-hidden="true" />
          <p className="text-xs text-wf-primary">
            Drag the two corner handles so the plan lines up with the real building, then confirm.
          </p>
        </div>
        <div className="relative flex-1">
          <GeoreferenceMap imageUrl={rasterImage.dataUrl} initialCorners={corners} onConfirm={confirmGeoreference} />
        </div>
      </Overlay>
    )
  }

  if (step === "review") {
    return (
      <Overlay title="Review detected places" z={300} onClose={onClose} dismissLabel="Cancel">
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe-bar lg:px-6">
          {notice && (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">{notice}</p>
          )}
          <p className="mb-3 text-xs text-wf-muted">
            {reviewRooms.length} place{reviewRooms.length === 1 ? "" : "s"} detected{" "}
            {rawSheet
              ? `across ${new Set(reviewRooms.map((r) => r.floor)).size} floor${new Set(reviewRooms.map((r) => r.floor)).size === 1 ? "" : "s"}`
              : `on ${floorLabel(planFloor, floorNaming)}`}
            {reviewTrails.length > 0
              ? ` · ${reviewTrails.length} corridor${reviewTrails.length === 1 ? "" : "s"} traced`
              : ""}
            {reviewAssets.length > 0
              ? ` · ${reviewAssets.length} fixture${reviewAssets.length === 1 ? "" : "s"}`
              : ""}
            . Untick anything wrong, or fix a name or type before saving.
          </p>

          {reviewRooms.length === 0 ? (
            <p className="py-8 text-center text-sm text-wf-muted">
              No places detected — you can still save the plan and add points to it yourself afterwards.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {reviewRooms.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                    r.include ? "border-wf-border bg-white" : "border-wf-border-faint bg-wf-surface-2 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => updateRoom(i, { include: e.target.checked })}
                    className="w-4 h-4 accent-wf-primary flex-shrink-0"
                    aria-label={`Include ${r.name}`}
                  />
                  <span className="text-lg flex-shrink-0">{WAYPOINT_TYPE_ICONS[r.type]}</span>
                  <input
                    value={r.name}
                    onChange={(e) => updateRoom(i, { name: e.target.value })}
                    className="flex-1 min-w-0 text-sm font-medium text-wf-ink outline-none border-b border-transparent focus:border-wf-primary"
                  />
                  {rawSheet && (
                    <span className="text-[10px] font-semibold text-wf-faint bg-wf-surface rounded-md px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap">
                      {floorLabel(r.floor, floorNaming)}
                      {r.zone ? ` · ${r.zone}` : ""}
                    </span>
                  )}
                  <select
                    value={r.type}
                    onChange={(e) => updateRoom(i, { type: e.target.value as WaypointType })}
                    className="text-xs text-wf-muted bg-transparent outline-none flex-shrink-0"
                  >
                    {ALL_WAYPOINT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {WAYPOINT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeRoom(i)}
                    className="text-wf-faint hover:text-red-500 flex-shrink-0"
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
                <Plug size={14} className="text-wf-primary" />
                <h3 className="text-xs font-semibold text-wf-body">
                  Fixtures &amp; assets ({reviewAssets.length})
                </h3>
              </div>
              <p className="text-xs text-wf-faint mb-2.5">
                Located fixtures like plug sockets — saved as a separate overlay layer, not navigation destinations.
              </p>
              <div className="flex flex-col gap-2">
                {reviewAssets.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                      a.include ? "border-wf-border bg-white" : "border-wf-border-faint bg-wf-surface-2 opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={a.include}
                      onChange={(e) => updateAsset(i, { include: e.target.checked })}
                      className="w-4 h-4 accent-wf-primary flex-shrink-0"
                      aria-label={`Include ${a.name}`}
                    />
                    <span className="text-lg flex-shrink-0">{ASSET_CATEGORY_ICONS[a.category]}</span>
                    <input
                      value={a.name}
                      onChange={(e) => updateAsset(i, { name: e.target.value })}
                      className="flex-1 min-w-0 text-sm font-medium text-wf-ink outline-none border-b border-transparent focus:border-wf-primary"
                    />
                    <select
                      value={a.category}
                      onChange={(e) => updateAsset(i, { category: e.target.value as AssetCategory })}
                      className="text-xs text-wf-muted bg-transparent outline-none flex-shrink-0"
                    >
                      {ALL_ASSET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {ASSET_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeAsset(i)}
                      className="text-wf-faint hover:text-red-500 flex-shrink-0"
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
        <div className="border-t border-wf-border-faint px-4 pb-safe-bar pt-3 lg:px-6">
          <button
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-wf-primary py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)]"
          >
            <Check size={18} aria-hidden="true" />
            Save to map
          </button>
        </div>
      </Overlay>
    )
  }

  // step === "pick"
  return (
    <Overlay title="Upload a floor plan" z={300} onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe-bar lg:px-6">
        <p className="text-sm text-wf-body mb-4">
          Already have a plan? Upload a photo, scan, exported PDF, SVG diagram, GeoJSON export, or a DXF CAD drawing and
          it&apos;s read automatically — rooms and corridors are detected and turned into a navigable layout, the same way
          a Survey Mode walk would. A DXF also carries its located fixtures (plug sockets, data points…) onto a separate
          overlay.
        </p>
        <p className="text-sm text-wf-body mb-4">
          Full map sheets work too: a hospital-style site map with colour-coded zones and a Floor/Zone directory table is
          recognised as a whole — every listed ward and department is placed on its zone at the right floor, even ones
          only listed in the table, and the map serves every floor at once.
        </p>

        <div className="flex items-center justify-between rounded-xl border border-wf-border px-4 py-3 mb-4">
          <div>
            <p className="text-xs font-semibold text-wf-muted">Floor being uploaded</p>
            <p className="text-sm font-bold text-wf-ink">{floorLabel(planFloor, floorNaming)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPlanFloor((f) => Math.max(f - 1, -5))}
              className="w-9 h-9 rounded-lg bg-wf-surface flex items-center justify-center active:bg-wf-border"
              aria-label="Floor down"
            >
              <ChevronDown size={18} />
            </button>
            <button
              onClick={() => setPlanFloor((f) => Math.min(f + 1, 30))}
              className="w-9 h-9 rounded-lg bg-wf-surface flex items-center justify-center active:bg-wf-border"
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
            dragOver ? "border-wf-primary bg-[#E7F2FF]" : "border-wf-border"
          }`}
        >
          <UploadCloud size={32} className="text-wf-primary" />
          <p className="text-sm font-semibold text-wf-ink">Tap to choose a file, or drag one here</p>
          <p className="text-xs text-wf-faint">Image (JPG/PNG/WEBP/SVG) · PDF · GeoJSON · DXF</p>
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

        <p className="mt-4 text-xs text-wf-muted">
          DXF CAD drawings are read directly. Binary/BIM formats (DWG, RVT, IFC…) aren&apos;t yet — export those to DXF,
          an image, PDF, or GeoJSON first.
        </p>
      </div>
    </Overlay>
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
  const basemapSource = useBasemapSource()

  // The street map under the plan (src/lib/basemap.ts), once the server has
  // said whose.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !basemapSource) return
    let layer = basemapLayer(basemapSource, "light", (fallback) => {
      layer = fallback
    }).addTo(map)
    layer.bringToBack()
    return () => {
      map.removeLayer(layer)
    }
  }, [basemapSource])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false })
    L.control.attribution({ prefix: false }).addTo(map)

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
        className="absolute left-4 right-4 bottom-4 z-[1000] flex items-center justify-center gap-2 bg-wf-primary text-white rounded-xl py-3.5 font-semibold text-base shadow-lg"
      >
        <Check size={18} />
        Confirm placement
      </button>
    </div>
  )
}
