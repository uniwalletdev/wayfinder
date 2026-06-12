"use client"

import { RouteStep } from "@/lib/types"
import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight,
  ArrowUpDown, Footprints, CheckCircle2, Navigation
} from "lucide-react"

interface Props {
  step: RouteStep | null
  nextStep: RouteStep | null
  stepIndex: number
  totalSteps: number
  isNavigating: boolean
}

function StepIcon({ step, size }: { step: RouteStep; size: number }) {
  if (step.instruction.includes("arrived")) return <CheckCircle2 size={size} className="text-white" />
  if (step.floorChange) return <ArrowUpDown size={size} className="text-white" />
  if (step.instruction.includes("north")) return <ArrowUp size={size} className="text-white" />
  if (step.instruction.includes("east")) return <ArrowUpRight size={size} className="text-white" />
  if (step.instruction.includes("west")) return <ArrowUpLeft size={size} className="text-white" />
  if (step.instruction.includes("south")) return <Footprints size={size} className="text-white" />
  if (step.instruction.includes("left")) return <ArrowLeft size={size} className="text-white" />
  if (step.instruction.includes("right")) return <ArrowRight size={size} className="text-white" />
  return <Navigation size={size} className="text-white" />
}

function fmtDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}

// Apple Maps' active-navigation banner: a big icon tile on the left, a huge
// "next turn" distance, and the instruction underneath. Hidden entirely off
// the full-bleed map until turn-by-turn starts.
export default function TopInstructionBar({ step, nextStep, stepIndex, totalSteps, isNavigating }: Props) {
  if (!isNavigating || !step) return null

  const isArrived = step.instruction.includes("arrived")
  const primaryText = isArrived || step.distance === 0 ? step.instruction : fmtDistance(step.distance)
  const secondaryText = isArrived
    ? ""
    : step.distance > 0
      ? step.instruction
      : step.floorChange
        ? `Floor ${step.floorChange.from} → Floor ${step.floorChange.to}`
        : ""

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-50 text-white pt-safe-snug pb-4 px-4 shadow-xl rounded-b-[28px] transition-colors duration-500 ${
        isArrived ? "bg-[#1E8E3E]" : "bg-[#003087]"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isArrived ? "bg-[#34C759]" : "bg-[#0072CE]"
          }`}
        >
          <StepIcon step={step} size={isArrived ? 32 : 36} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-3xl font-bold leading-tight truncate">{primaryText}</p>
          {secondaryText && <p className="text-base opacity-80 truncate mt-0.5">{secondaryText}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[11px] opacity-60 uppercase tracking-wide">Step</p>
          <p className="text-sm font-semibold opacity-90">
            {stepIndex + 1}/{totalSteps}
          </p>
        </div>
      </div>

      {nextStep && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/15 text-sm opacity-70">
          <span className="uppercase tracking-wide text-[11px] font-semibold flex-shrink-0">Then</span>
          <StepIcon step={nextStep} size={16} />
          <span className="truncate">{nextStep.instruction}</span>
        </div>
      )}
    </div>
  )
}
