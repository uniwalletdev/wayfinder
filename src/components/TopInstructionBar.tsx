"use client"

import { RouteStep } from "@/lib/types"
import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight,
  ArrowUpDown, Footprints, CheckCircle2, Navigation
} from "lucide-react"

interface Props {
  step: RouteStep | null
  stepIndex: number
  totalSteps: number
  isNavigating: boolean
}

function StepIcon({ step }: { step: RouteStep }) {
  if (step.instruction.includes("arrived")) return <CheckCircle2 size={28} className="text-green-400" />
  if (step.floorChange) return <ArrowUpDown size={28} className="text-white" />
  if (step.instruction.includes("north")) return <ArrowUp size={28} className="text-white" />
  if (step.instruction.includes("east")) return <ArrowUpRight size={28} className="text-white" />
  if (step.instruction.includes("west")) return <ArrowUpLeft size={28} className="text-white" />
  if (step.instruction.includes("south")) return <Footprints size={28} className="text-white" />
  if (step.instruction.includes("left")) return <ArrowLeft size={28} className="text-white" />
  if (step.instruction.includes("right")) return <ArrowRight size={28} className="text-white" />
  return <Navigation size={28} className="text-white" />
}

export default function TopInstructionBar({ step, stepIndex, totalSteps, isNavigating }: Props) {
  if (!isNavigating || !step) {
    return (
      <div className="absolute top-0 left-0 right-0 z-50 bg-[#005EB8] text-white px-4 pt-safe-snug pb-3 flex items-center gap-3 shadow-lg">
        <Navigation size={22} className="text-white opacity-80" />
        <div>
          <p className="text-sm font-bold">GOSH Wayfinder</p>
          <p className="text-xs opacity-80">Great Ormond Street Hospital</p>
        </div>
      </div>
    )
  }

  const isArrived = step.instruction.includes("arrived")

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-50 text-white px-4 pt-safe-snug pb-3 shadow-xl transition-colors duration-500 ${
        isArrived ? "bg-green-600" : "bg-[#003087]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          isArrived ? "bg-green-500" : "bg-[#005EB8]"
        }`}>
          <StepIcon step={step} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold leading-tight truncate">{step.instruction}</p>
          {step.distance > 0 && (
            <p className="text-sm opacity-80 mt-0.5">
              {step.distance < 1000 ? `${step.distance}m` : `${(step.distance / 1000).toFixed(1)}km`}
            </p>
          )}
          {step.floorChange && (
            <p className="text-xs opacity-80 mt-0.5">
              Floor {step.floorChange.from} → Floor {step.floorChange.to}
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
