"use client"

import { Navigation, ClipboardList, Search, QrCode, Camera, MapPin, Layers, ChevronRight } from "lucide-react"

export type AppMode = "directions" | "map"

interface Props {
  onChoose: (mode: AppMode) => void
}

/**
 * First screen the user sees. Rather than dropping people straight into a busy
 * map with every control at once, we ask what they're here to do and then enter
 * a focused mode that shows only the functions relevant to that journey:
 *
 *  • Directions — for anyone finding their way to a place.
 *  • Map an area — for surveying and adding new locations to the map.
 *
 * "Get directions" is the recommended default — it's what most people open the
 * app for — so it leads and is visually emphasised.
 */
export default function LaunchScreen({ onChoose }: Props) {
  return (
    <div className="absolute inset-0 z-[200] bg-gradient-to-b from-[#005EB8] to-[#003d7a] flex flex-col">
      {/* Header / branding */}
      <div className="px-6 pt-safe-bar pt-12 pb-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 mb-4">
          <Navigation size={32} className="text-white" />
        </div>
        <h1 className="text-white text-2xl font-bold leading-tight">Wayfinder</h1>
        <p className="text-white/70 text-sm mt-1">
          Find your way around any building
        </p>
      </div>

      {/* Mode cards */}
      <div className="flex-1 px-5 pb-safe-bar pb-8 flex flex-col justify-center gap-4">
        <p className="text-white/80 text-sm font-medium px-1">What would you like to do?</p>

        {/* Recommended: Directions */}
        <button
          onClick={() => onChoose("directions")}
          className="group relative text-left bg-white rounded-2xl p-5 shadow-xl active:scale-[0.99] transition-transform"
        >
          <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide text-[#005EB8] bg-blue-50 rounded-full px-2 py-0.5">
            Recommended
          </span>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#005EB8] flex items-center justify-center">
              <Navigation size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0 pr-16">
              <h2 className="text-gray-900 font-bold text-lg leading-tight">Get directions</h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Find a room, place or facility and follow step-by-step directions to it.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 pl-16">
            <Feature icon={<Search size={13} />} label="Search places" />
            <Feature icon={<Navigation size={13} />} label="Turn-by-turn" />
            <Feature icon={<QrCode size={13} />} label="Scan to locate" />
            <Feature icon={<Layers size={13} />} label="Floor switching" />
          </div>
          <ChevronRight
            size={20}
            className="absolute bottom-5 right-5 text-gray-300 group-active:text-[#005EB8]"
          />
        </button>

        {/* Map an area */}
        <button
          onClick={() => onChoose("map")}
          className="group relative text-left bg-white/10 border border-white/20 rounded-2xl p-5 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <ClipboardList size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-lg leading-tight">Map an area</h2>
              <p className="text-white/70 text-sm mt-0.5">
                Walk through with your camera to survey and add new locations to the map.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 pl-16">
            <Feature dark icon={<Camera size={13} />} label="Camera survey" />
            <Feature dark icon={<MapPin size={13} />} label="Mark locations" />
            <Feature dark icon={<ClipboardList size={13} />} label="Auto-read signs" />
          </div>
          <ChevronRight
            size={20}
            className="absolute bottom-5 right-5 text-white/40 group-active:text-white"
          />
        </button>

        <p className="text-white/50 text-xs text-center mt-2">
          You can switch between these any time from the home button.
        </p>
      </div>
    </div>
  )
}

function Feature({ icon, label, dark }: { icon: React.ReactNode; label: string; dark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        dark ? "bg-white/10 text-white/80" : "bg-blue-50 text-[#005EB8]"
      }`}
    >
      {icon}
      {label}
    </span>
  )
}
