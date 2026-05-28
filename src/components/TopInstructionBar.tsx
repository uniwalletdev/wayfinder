"use client"

import { RouteStep, Coordinates } from "@/lib/types"
import { TurnDir } from "@/lib/routing"
import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight,
  ArrowUpDown, CheckCircle2, Navigation, RotateCcw
} from "lucide-react"

export interface LiveNav {
  label: string
  distance: number
  dir: TurnDir
  name: string
  arriving: boolean
}

interface Props {
  step: RouteStep | null
  live: LiveNav | null
  stepIndex: number
  totalSteps: number
  isNavigating: boolean
  venueName?: string
}

function dirIcon(dir: TurnDir) {
  const cls = "text-white"
  switch (dir) {
    case "straight": return <ArrowUp size={28} className={cls} />
    case "slight-left": return <ArrowUpLeft size={28} className={cls} />
    case "slight-right": return <ArrowUpRight size={28} className={cls} />
    case "left": case "sharp-left": return <ArrowLeft size={28} className={cls} />
    case "right": case "sharp-right": return <ArrowRight size={28} className={cls} />
    case "around": return <RotateCcw size={28} className={cls} />
    default: return <Navigation size={28} className={cls} />
  }
}

export default function TopInstructionBar({ step, live, stepIndex, totalSteps, isNavigating, venueName }: Props) {
  if (!isNavigating || !step) {
    return (
      <div className="absolute top-0 left-0 right-0 z-50 bg-[#005EB8] text-white px-4 py-3 flex items-center gap-3 shadow-lg">
        <Navigation size={22} className="text-white opacity-80" />
        <div>
          <p className="text-sm font-bold">Wayfinder</p>
          <p className="text-xs opacity-80">{venueName ?? "Free indoor navigation"}</p>
        </div>
      </div>
    )
  }

  // Floor change step — static
  if (step.floorChange) {
    return (
      <div className="absolute top-0 left-0 right-0 z-50 text-white px-4 py-3 shadow-xl bg-[#003087]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-[#005EB8]">
            <ArrowUpDown size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold leading-tight truncate">{step.instruction}</p>
            <p className="text-xs opacity-80 mt-0.5">
              Floor {step.floorChange.from === 0 ? "G" : step.floorChange.from} → Floor {step.floorChange.to === 0 ? "G" : step.floorChange.to}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs opacity-70">Step</p>
            <p className="text-sm font-bold">{stepIndex + 1}/{totalSteps}</p>
          </div>
        </div>
      </div>
    )
  }

  const arriving = live?.arriving ?? step.instruction.includes("arrived")
  const mainText = live?.label ?? step.instruction
  const distance = live?.distance ?? step.distance

  return (
    <div className={`absolute top-0 left-0 right-0 z-50 text-white px-4 py-3 shadow-xl transition-colors duration-500 ${
      arriving ? "bg-green-600" : "bg-[#003087]"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          arriving ? "bg-green-500" : "bg-[#005EB8]"
        }`}>
          {arriving ? <CheckCircle2 size={28} className="text-white" /> : (live ? dirIcon(live.dir) : <Navigation size={28} className="text-white" />)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold leading-tight truncate">{mainText}</p>
          {!arriving && distance > 0 && (
            <p className="text-sm opacity-80 mt-0.5">
              {distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`}
              {live?.name ? ` · to ${live.name}` : ""}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs opacity-70">Step</p>
          <p className="text-sm font-bold">{stepIndex + 1}/{totalSteps}</p>
        </div>
      </div>
    </div>
  )
}
