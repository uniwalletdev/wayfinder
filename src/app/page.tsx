import Link from "next/link"
import { Navigation, Map } from "lucide-react"

// First screen: the user picks what they want to do. "Navigate" goes to the
// search/route flow (/navigate); "Map" opens the self-survey flow (/map).
export default function Landing() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center bg-[#005EB8] px-6 text-white">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Wayfinder</h1>
        <p className="mt-2 text-sm text-white/80">
          Map a place, or find your way through one.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <Link
          href="/navigate"
          className="flex items-center gap-4 rounded-2xl bg-white px-6 py-5 text-[#005EB8] shadow-lg transition active:scale-[0.98]"
        >
          <Navigation size={28} className="flex-shrink-0" />
          <span className="flex flex-col text-left">
            <span className="text-lg font-semibold">Navigate</span>
            <span className="text-sm text-[#005EB8]/70">Find your way to a destination</span>
          </span>
        </Link>

        <Link
          href="/map"
          className="flex items-center gap-4 rounded-2xl border border-white/30 bg-white/10 px-6 py-5 text-white shadow-lg transition active:scale-[0.98]"
        >
          <Map size={28} className="flex-shrink-0" />
          <span className="flex flex-col text-left">
            <span className="text-lg font-semibold">Map</span>
            <span className="text-sm text-white/70">Walk an area and add it to the map</span>
          </span>
        </Link>
      </div>
    </main>
  )
}
