"use client"

import { Navigation, ClipboardList, MapPin, ChevronRight } from "lucide-react"

export type AppRole = "user" | "mapper"

interface RoleSelectProps {
  onSelect: (role: AppRole) => void
}

/**
 * Entry screen shown before the map. Visitors choose how they want to use the
 * app: as a regular user (find their way around) or as a mapper (survey and
 * add areas to the map).
 */
export default function RoleSelect({ onSelect }: RoleSelectProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-[#005EB8] flex flex-col items-center justify-center px-6 pt-safe-bar pb-8">
      <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
        <MapPin size={34} className="text-white" />
      </div>
      <h1 className="text-white text-2xl font-bold mb-1">Wayfinder</h1>
      <p className="text-blue-100 text-sm mb-8 text-center">How would you like to enter?</p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <button
          onClick={() => onSelect("user")}
          className="w-full bg-white rounded-2xl p-5 shadow-lg flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Navigation size={24} className="text-[#005EB8]" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">Enter as User</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Find your way to wards, clinics and departments
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
        </button>

        <button
          onClick={() => onSelect("mapper")}
          className="w-full bg-white rounded-2xl p-5 shadow-lg flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <ClipboardList size={24} className="text-[#005EB8]" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">Enter as Mapper</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Walk and survey areas to add them to the map
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
        </button>
      </div>

      <p className="text-blue-200 text-xs mt-8 text-center">
        You can switch at any time from the map screen.
      </p>
    </div>
  )
}
