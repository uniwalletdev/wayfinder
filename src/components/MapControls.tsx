"use client"

import { Moon, Sun, Navigation, Plus, Minus, Layers } from "lucide-react"

interface Props {
  mapView: "2d" | "3d"
  onToggleMapView: (view: "2d" | "3d") => void
  mapStyle: "light" | "dark"
  onToggleMapStyle: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onRecenter: () => void
  showRecenter: boolean
  gpsLabel: string
  gpsDotClass: string
  floorLabel: string
}

// Floating controls layered over the map canvas: top-right view/style toggles,
// bottom-right zoom + re-centre, bottom-left status pill. Replaces the old
// scattered mobile badges/FABs with the desktop app-home layout.
export default function MapControls({
  mapView,
  onToggleMapView,
  mapStyle,
  onToggleMapStyle,
  onZoomIn,
  onZoomOut,
  onRecenter,
  showRecenter,
  gpsLabel,
  gpsDotClass,
  floorLabel,
}: Props) {
  return (
    <>
      {/* Top-right: 2D/3D segmented pill + map-style toggle */}
      <div className="absolute top-5 right-5 z-40 flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-white/96 p-1 shadow-[0_8px_24px_rgba(11,27,46,0.16)]">
          {(["2d", "3d"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onToggleMapView(v)}
              className={`rounded-full px-[18px] py-2 text-[13.5px] font-semibold transition-colors ${
                mapView === v
                  ? "bg-wf-primary text-white shadow-[0_4px_12px_rgba(10,93,194,0.35)]"
                  : "text-wf-muted"
              }`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={onToggleMapStyle}
          title={mapStyle === "light" ? "Switch to dark map" : "Switch to light map"}
          aria-label={mapStyle === "light" ? "Switch to dark map" : "Switch to light map"}
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/96 text-wf-ink shadow-[0_8px_24px_rgba(11,27,46,0.16)] transition-transform active:scale-95"
        >
          {mapStyle === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>

      {/* Bottom-right: zoom stack + re-centre FAB */}
      <div className="absolute bottom-6 right-5 z-40 flex flex-col items-center gap-2.5">
        <div className="flex flex-col overflow-hidden rounded-2xl bg-white/96 shadow-[0_8px_24px_rgba(11,27,46,0.16)]">
          <button
            onClick={onZoomIn}
            aria-label="Zoom in"
            className="flex h-10 w-[42px] items-center justify-center border-b border-wf-border text-wf-ink active:bg-wf-surface"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={onZoomOut}
            aria-label="Zoom out"
            className="flex h-10 w-[42px] items-center justify-center text-wf-ink active:bg-wf-surface"
          >
            <Minus size={18} />
          </button>
        </div>
        {showRecenter && (
          <button
            onClick={onRecenter}
            aria-label="Re-centre on my location"
            title="Re-centre"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-wf-primary text-white shadow-[0_10px_24px_rgba(10,93,194,0.4)] transition-transform active:scale-95"
          >
            <Navigation size={18} />
          </button>
        )}
      </div>

      {/* Bottom-left: status pill */}
      <div className="absolute bottom-6 left-5 z-40 flex items-center gap-3 rounded-full bg-white/96 px-[18px] py-2.5 shadow-[0_8px_24px_rgba(11,27,46,0.16)]">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${gpsDotClass}`} />
          <span className="text-[13px] font-medium text-wf-body">{gpsLabel}</span>
        </div>
        <span className="h-3.5 w-px bg-wf-border" />
        <div className="flex items-center gap-1.5">
          <Layers size={13} className="text-wf-primary" />
          <span className="text-[13px] font-medium text-wf-body">{floorLabel}</span>
        </div>
        <span className="h-3.5 w-px bg-wf-border" />
        <span className="text-[13px] font-medium text-wf-body">{mapView.toUpperCase()} view</span>
      </div>
    </>
  )
}
