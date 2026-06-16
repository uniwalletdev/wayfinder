"use client"

import { useState } from "react"
import { Compass, ClipboardList, MapPin, ChevronRight, ChevronLeft, Box, Map as MapIcon } from "lucide-react"

// Two ways into the app. A "navigator" is here to find their way around an
// existing map; a "mapper" is here to walk a place and add it to the map. The
// role only gates the mapping tools — both can browse venues and navigate.
export type AppRole = "navigator" | "mapper"

interface RoleSelectProps {
  // Called once the visitor has made their choice. Navigators also pick a
  // starting map view; mappers default to the 2D floor plan (best for survey
  // work) and can still toggle it on the map.
  onEnter: (role: AppRole, view: "2d" | "3d") => void
}

/**
 * Entry screen shown before the map.
 *   Step 1 — choose to "Navigate a location" or "Map an area".
 *   Step 2 — navigators only: choose a 2D or 3D map view.
 * The role and the view can both be changed later from the map screen.
 */
export default function RoleSelect({ onEnter }: RoleSelectProps) {
  const [step, setStep] = useState<"role" | "view">("role")

  return (
    <div className="fixed inset-0 z-[100] bg-[#005EB8] flex flex-col items-center justify-center px-6 pt-safe-bar pb-8">
      <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
        <MapPin size={34} className="text-white" />
      </div>
      <h1 className="text-white text-2xl font-bold mb-1">Wayfinder</h1>

      {step === "role" ? (
        <>
          <p className="text-blue-100 text-sm mb-8 text-center">What would you like to do?</p>

          <div className="w-full max-w-sm flex flex-col gap-4">
            <button
              onClick={() => setStep("view")}
              className="w-full bg-white rounded-2xl p-5 shadow-lg flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Compass size={24} className="text-[#005EB8]" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-gray-900">Navigate a location</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Find your way with live, turn-by-turn directions
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
            </button>

            <button
              onClick={() => onEnter("mapper", "2d")}
              className="w-full bg-white rounded-2xl p-5 shadow-lg flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ClipboardList size={24} className="text-[#005EB8]" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-gray-900">Map an area</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Walk and survey a place to add it to the map
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-blue-100 text-sm mb-8 text-center">Choose your map view</p>

          <div className="w-full max-w-sm flex flex-col gap-4">
            <button
              onClick={() => onEnter("navigator", "3d")}
              className="w-full bg-white rounded-2xl p-5 shadow-lg flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Box size={24} className="text-[#005EB8]" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-gray-900">3D view</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Tilted map with buildings — best for finding a place
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
            </button>

            <button
              onClick={() => onEnter("navigator", "2d")}
              className="w-full bg-white rounded-2xl p-5 shadow-lg flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <MapIcon size={24} className="text-[#005EB8]" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-gray-900">2D view</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Flat floor plan — clearest once you&apos;re indoors
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
            </button>
          </div>

          <button
            onClick={() => setStep("role")}
            className="mt-6 text-blue-100 text-sm font-medium flex items-center gap-1 active:opacity-80"
          >
            <ChevronLeft size={16} /> Back
          </button>
        </>
      )}

      <p className="text-blue-200 text-xs mt-8 text-center">
        You can switch at any time from the map screen.
      </p>
    </div>
  )
}
