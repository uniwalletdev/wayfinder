import type { Metadata } from "next"
import WayfinderApp from "@/components/WayfinderApp"

export const metadata: Metadata = {
  title: "Map your hospital",
  description: "Walk a building with your phone or upload a floor plan, and Findway turns it into a map with step-by-step directions.",
  alternates: { canonical: "/map" },
}

export default function MapPage() {
  return <WayfinderApp initialMode="map" />
}
