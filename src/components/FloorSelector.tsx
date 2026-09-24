"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, Check, ChevronDown, ChevronsUpDown } from "lucide-react"
import { floorLabel, floorGroundHint, floorShortLabel } from "@/lib/waypoint-meta"
import { floorsInScope, type Building } from "@/lib/buildings"
import { useEscapeClose } from "@/lib/use-escape"
import type { FloorNaming } from "@/lib/types"

interface Props {
  floors: number[]
  currentFloor: number
  naming?: FloorNaming
  onChange: (floor: number) => void
  // Buildings on the site and the one the walker is in, when the venue says.
  buildings?: Building[]
  autoBuilding?: string | null
  // Marked with a teal dot so the floor you are heading to is findable.
  destinationFloor?: number | null
}

// Up to this many floors the full stack is shown: collapsing it would only
// add a tap. Beyond it the rail folds into one pill showing the floor you are
// on, and opens to the floors of the building you are in.
const ALWAYS_OPEN_MAX = 3

// Positioning is owned by the right rail in MapControls. This component only
// renders the pill or the list, and scrolls within the space the rail gives it.
export default function FloorSelector({ floors, currentFloor, naming, onChange, buildings = [], autoBuilding = null, destinationFloor = null }: Props) {
  const [open, setOpen] = useState(false)
  const [choosingBuilding, setChoosingBuilding] = useState(false)
  // undefined: follow the building the walker is in. null: the whole site.
  const [picked, setPicked] = useState<string | null | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement>(null)

  const close = () => {
    setOpen(false)
    setChoosingBuilding(false)
  }
  useEscapeClose(close)

  // A tap anywhere else on the map folds it back up.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open])

  if (floors.length <= 1) return null

  const buildingName = picked === undefined ? autoBuilding : picked
  const building = buildings.find((b) => b.name === buildingName) ?? null
  const shown = floorsInScope(floors, building, [currentFloor, destinationFloor])
  const collapsible = floors.length > ALWAYS_OPEN_MAX

  const pill = (floor: number, onPick: () => void) => {
    // Under a venue scheme every pill reads "L<n>", so the one you walk in on
    // looks like all the others. A ring marks it, and the title/aria label
    // spell it out for anyone who cannot see the ring.
    const isGround = Boolean(naming) && floor === 0
    const active = currentFloor === floor
    const isDest = destinationFloor === floor && !active
    return (
      <button
        key={floor}
        onClick={onPick}
        title={floorGroundHint(floor, naming) ?? floorLabel(floor, naming)}
        aria-label={`${floorLabel(floor, naming)}${isDest ? ", your destination" : ""}`}
        aria-current={active ? "true" : undefined}
        className={`relative flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold transition-colors ${
          active ? "bg-wf-primary text-white shadow-[0_4px_12px_rgba(10,93,194,0.4)]" : "text-wf-muted hover:bg-wf-surface"
        } ${isGround && !active ? "ring-1 ring-inset ring-wf-primary/40" : ""}`}
      >
        {floorShortLabel(floor, naming)}
        {isDest && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-wf-teal ring-2 ring-white" aria-hidden="true" />}
      </button>
    )
  }

  const list = (onPicked?: () => void) =>
    [...shown].sort((a, b) => b - a).map((floor) =>
      pill(floor, () => {
        onChange(floor)
        onPicked?.()
      })
    )

  if (!collapsible) {
    return (
      <div className="pointer-events-auto flex min-h-0 flex-col gap-1 overflow-y-auto rounded-full bg-white/96 p-1.5 shadow-[0_8px_24px_rgba(11,27,46,0.16)]">
        {list()}
      </div>
    )
  }

  if (!open) {
    const destElsewhere = destinationFloor != null && destinationFloor !== currentFloor
    return (
      <div ref={rootRef} className="pointer-events-auto">
        <button
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label={`${floorLabel(currentFloor, naming)}. ${shown.length} floors${building ? ` in ${building.name}` : ""}. Show floors`}
          title="Change floor"
          className="relative flex w-[50px] flex-col items-center gap-0.5 rounded-full bg-white/96 px-1.5 py-2 shadow-[0_8px_24px_rgba(11,27,46,0.16)] transition-transform active:scale-95"
        >
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-wf-primary font-display text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(10,93,194,0.4)]">
            {floorShortLabel(currentFloor, naming)}
          </span>
          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-wf-muted">
            {shown.length}
            <ChevronsUpDown size={11} aria-hidden="true" />
          </span>
          {destElsewhere && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-wf-teal ring-2 ring-white" aria-hidden="true" />}
        </button>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto flex min-h-0 flex-col items-center gap-1 overflow-y-auto rounded-[22px] bg-white/96 p-1.5 shadow-[0_8px_24px_rgba(11,27,46,0.16)]"
    >
      {buildings.length > 0 && (
        <button
          onClick={() => setChoosingBuilding((v) => !v)}
          aria-expanded={choosingBuilding}
          aria-label={`Building: ${building?.name ?? "whole site"}. Change building`}
          title={building?.name ?? "Whole site"}
          className="flex w-full items-center justify-center gap-0.5 rounded-full px-1.5 py-1.5 text-wf-primary hover:bg-wf-surface"
        >
          <Building2 size={15} aria-hidden="true" />
          <ChevronDown size={11} aria-hidden="true" className={choosingBuilding ? "rotate-180" : ""} />
        </button>
      )}

      {choosingBuilding ? (
        <div className="flex w-[220px] flex-col py-1" role="list">
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-wf-muted">Which building?</p>
          {[{ name: null as string | null, floors }, ...buildings].map((b) => {
            const selected = (building?.name ?? null) === b.name
            return (
              <button
                key={b.name ?? "__site"}
                role="listitem"
                onClick={() => {
                  setPicked(b.name)
                  setChoosingBuilding(false)
                }}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] hover:bg-wf-surface ${selected ? "font-semibold text-wf-primary" : "text-wf-ink"}`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="leading-snug">{b.name ?? "Whole site"}</span>
                  <span className="text-[11.5px] font-normal text-wf-muted">
                    {b.floors.length} floors{b.name === autoBuilding && b.name ? " · you’re here" : ""}
                  </span>
                </span>
                {selected && <Check size={14} aria-hidden="true" className="flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      ) : (
        list(close)
      )}
    </div>
  )
}
