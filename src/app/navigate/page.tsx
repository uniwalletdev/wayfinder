import type { Metadata } from "next"
import WayfinderApp from "@/components/WayfinderApp"

// Every link into the app (/navigate?venue=…&to=…, from a hospital's page, a
// shared link or a poster) is this one page to a search engine: the canonical
// address says so, rather than leaving Google with hundreds of duplicates.
export const metadata: Metadata = {
  title: "Hospital map and directions",
  description: "Search a mapped hospital for a ward, clinic or department and get step-by-step directions from the entrance.",
  alternates: { canonical: "/navigate" },
}

export default function NavigatePage() {
  return <WayfinderApp initialMode="navigate" />
}
