import type { Metadata } from "next"
import InfoPage from "@/components/InfoPage"
import CoverageBrowser from "@/components/CoverageBrowser"

export const metadata: Metadata = {
  title: "Coverage",
  description: "Every country, hospital site map and indoor map Findway can guide you around.",
}

// Everything that has been mapped, open to anyone with the link. The app
// itself only ever shows a visitor their own country's hospitals; this page is
// the whole picture, for the people running Findway and anyone they share it
// with. Not linked from the visitor's screens for that reason.
export default function CoveragePage() {
  return (
    <InfoPage
      eyebrow="Coverage"
      title="Everything Findway can guide you around"
      lead="Every country with hospitals listed, every hospital whose grounds are mapped well enough for a site map, and every hospital mapped inside. Pick a country, then open any map in the app."
      wide
    >
      <CoverageBrowser />
    </InfoPage>
  )
}
