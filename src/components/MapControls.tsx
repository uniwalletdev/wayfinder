"use client"

import { Moon, Sun, Navigation, Plus, Minus, Layers } from "lucide-react"
import FloorSelector from "@/components/FloorSelector"
import type { FloorNaming } from "@/lib/types"

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
  floors: number[]
  currentFloor: number
  floorNaming?: FloorNaming
  onChangeFloor: (floor: number) => void
}

// All floating map furniture lives in ONE flex column pinned to the right edge
// (the "right rail"): view/style toggles at the top, the floor selector in the
// middle, zoom + re-centre at the bottom. Flex children are laid out
// sequentially, so — unlike the old independently absolute-positioned
// elements — nothing here can ever overlap, however many floors the venue has
// or however short the viewport is. On phones the bottom sheet owns the lower
// half of the screen, so the rail top-anchors, the zoom stack hides (pinch to
// zoom) and the re-centre FAB joins the rail below the floor list.
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
  floors,
  currentFloor,
  floorNaming,
  onChangeFloor,
}: Props) {
  return (
    <>
      <div className="pointer-events-none absolute right-4 top-4 z-30 flex max-h-[calc(100%-32px)] flex-col items-end lg:inset-y-0 lg:right-5 lg:top-0 lg:max-h-none lg:py-5">
        {/* Top: 2D/3D segmented pill + map-style toggle */}
        <div className="pointer-events-auto flex items-center gap-2 lg:gap-3">
          <div className="flex items-center gap-1 rounded-full bg-white/96 p-1 shadow-[0_8px_24px_rgba(11,27,46,0.16)]">
            {(["2d", "3d"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onToggleMapView(v)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors lg:px-[18px] lg:py-2 lg:text-[13.5px] ${
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
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/96 text-wf-ink shadow-[0_8px_24px_rgba(11,27,46,0.16)] transition-transform active:scale-95 lg:h-[42px] lg:w-[42px]"
          >
            {mapStyle === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>

        {/* Middle: floor selector, centred on desktop by the flexible spacers.
            min-h-0 lets it shrink and scroll instead of colliding. */}
        <div className="hidden min-h-0 lg:block lg:flex-1" />
        <div className="mt-3 flex min-h-0 flex-col lg:mt-0">
          <FloorSelector floors={floors} currentFloor={currentFloor} naming={floorNaming} onChange={onChangeFloor} />
        </div>
        <div className="hidden min-h-0 lg:block lg:flex-1" />

        {/* Bottom: zoom stack (desktop only — phones pinch) + re-centre FAB */}
        <div className="pointer-events-auto mt-3 hidden flex-col overflow-hidden rounded-2xl bg-white/96 shadow-[0_8px_24px_rgba(11,27,46,0.16)] lg:flex">
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
            className="pointer-events-auto mt-3 flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-wf-primary text-white shadow-[0_10px_24px_rgba(10,93,194,0.4)] transition-transform active:scale-95 lg:mt-2.5"
          >
            <Navigation size={18} />
          </button>
        )}
      </div>

      {/* Status pill: top-left on phones (the bottom sheet owns the bottom of
          the screen), bottom-left on desktop where the panel is a side column. */}
      <div className="absolute left-4 top-4 z-30 flex items-center gap-2.5 rounded-full bg-white/96 px-3.5 py-2 shadow-[0_8px_24px_rgba(11,27,46,0.16)] lg:bottom-6 lg:left-5 lg:top-auto lg:gap-3 lg:px-[18px] lg:py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${gpsDotClass}`} />
          <span className="text-[12px] font-medium text-wf-body lg:text-[13px]">{gpsLabel}</span>
        </div>
        <span className="hidden h-3.5 w-px bg-wf-border sm:block" />
        <div className="hidden items-center gap-1.5 sm:flex">
          <Layers size={13} className="text-wf-primary" />
          <span className="text-[12px] font-medium text-wf-body lg:text-[13px]">{floorLabel}</span>
        </div>
        <span className="hidden h-3.5 w-px bg-wf-border lg:block" />
        <span className="hidden text-[13px] font-medium text-wf-body lg:block">{mapView.toUpperCase()} view</span>
      </div>
    </>
  )
}
