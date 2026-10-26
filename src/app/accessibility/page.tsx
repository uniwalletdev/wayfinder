import type { Metadata } from "next"
import Link from "next/link"
import InfoPage from "@/components/InfoPage"

export const metadata: Metadata = {
  title: "Accessibility",
  description: "How Findway works with screen readers, keyboards, zoom and reduced motion, and what it cannot yet do.",
  alternates: { canonical: "/accessibility" },
}

// A plain account of what the app does for people who use it differently, and
// of its limits. It describes the software as built; the organisation that
// deploys Findway is responsible for its own published statement.
export default function AccessibilityPage() {
  return (
    <InfoPage
      eyebrow="Accessibility"
      title="Built to be used by everyone who needs to find their way"
      lead="Findway is used by people who are ill, anxious, in a hurry, or all three. This page says what the app does to be usable by as many of them as possible, and where it still falls short."
      updated="September 2026"
    >
      <h2>Getting around the app</h2>
      <ul>
        <li>
          <strong>Keyboard.</strong> Everything can be reached with Tab and activated with Enter or Space. Press <kbd>/</kbd> to start a search,
          use the arrow keys to move through results and Enter to choose one, and Escape to close any panel. Keyboard focus is always visible.
        </li>
        <li>
          <strong>Screen readers.</strong> Search, the places list, the share sheet and the mapping tools are announced as dialogs with a name
          and a heading. While you are being guided, each new instruction is announced as you reach it, along with the distance to the next turn.
        </li>
        <li>
          <strong>Spoken directions.</strong> While navigating, switch on <em>Spoken directions</em> and each step is read aloud using your device’s
          own voice. Your phone also gives a short buzz at each turn and a longer one on arrival, where it supports vibration.
        </li>
        <li>
          <strong>Zoom and text size.</strong> Page zoom is never disabled. Pinching on the map zooms the map; pinching elsewhere zooms the page.
        </li>
        <li>
          <strong>Motion.</strong> If your device asks for reduced motion, the pulsing position dot, the moving route dashes and the panel
          animations are switched off.
        </li>
        <li>
          <strong>Colour.</strong> Colour is never the only carrier of meaning: the floor you are on, your destination and the type of a place
          are also given in text.
        </li>
      </ul>

      <h2>Routes that avoid stairs</h2>
      <p>
        Routes are step-free by default: a change of floor goes by lift unless you choose otherwise, and where a faster route would use stairs
        the app offers both and says which is which. A shared link or printed poster can ask for the step-free route on the reader’s behalf.
      </p>

      <h2>What the map cannot yet do</h2>
      <ul>
        <li>
          The map itself is a picture. Everything it shows is also available as text — the search list, the places near you, the step-by-step
          directions — but the drawn floor plan is not described.
        </li>
        <li>
          Indoor positioning uses your phone’s sensors and cannot be exact. The app shows how confident it is and asks you to scan a poster to
          fix your position when it is unsure.
        </li>
        <li>
          Some hospitals are mapped from the trust’s published site map rather than a survey of the building. Those are marked, and the app says
          when a route is a direction to follow rather than a corridor-by-corridor path.
        </li>
      </ul>

      <h2>Telling us about a problem</h2>
      <p>
        If something in Findway does not work with the way you use your device, tell us through the form on the{" "}
        <Link href="/support#contact">Support</Link> page and choose Accessibility. Say what you were trying to do, which device and assistive
        technology you were using, and what happened instead; that is enough to reproduce most problems.
      </p>
    </InfoPage>
  )
}
