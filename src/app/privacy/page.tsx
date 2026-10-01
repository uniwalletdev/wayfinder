import type { Metadata } from "next"
import InfoPage from "@/components/InfoPage"
import DataControls from "@/components/DataControls"

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Findway keeps on your device, what it sends to the server, and what it never collects.",
}

// A technical summary of what the app does with data, written from the code
// it describes (see docs/location-data-and-gdpr.md for the fuller analysis).
// It is not a legal notice: the organisation deploying Findway is the data
// controller and publishes its own.
export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Privacy"
      title="What Findway does with your data"
      lead="A plain description of what stays on your phone, what leaves it and why. It describes the software as built; the organisation running this copy of Findway is responsible for its own privacy notice."
      updated="September 2026"
    >
      <h2>No account needed</h2>
      <p>
        You never have to sign in to find a ward. Signing in is optional and only exists to carry saved places and the venues you have mapped
        between your devices. Without it, nothing about you is stored on a server.
      </p>

      <h2>Kept on your device</h2>
      <ul>
        <li>The place you last had open, your map style and view, and whether you prefer step-free routes and spoken directions.</li>
        <li>Any places, floor plans and corridors you have mapped yourself, unless you chose to publish them.</li>
        <li>A random identifier for this browser, used only so that several people walking the same corridor can be counted as several people.</li>
      </ul>
      <p>All of this is in your browser’s storage and goes when you clear it.</p>

      <h2>Your location</h2>
      <p>
        Your position is worked out on the phone, from GPS outside and from your steps and compass inside. It is used to draw the blue dot,
        to build routes and to advance directions as you walk. It is not sent anywhere while you browse the map.
      </p>
      <p>
        <strong>While you are being guided</strong>, the path you walk is sent to the server as an anonymous corridor trace, tagged with the
        browser identifier above, so the map of that hospital can improve. On a deployment with no database it is discarded. This is the one
        place location leaves the device, and it starts when you press Start and stops when you stop navigating or arrive.
      </p>
      <p>
        What is stored is the corridor, not the visit: the last 25 metres of every walk are cut off before it is saved, so the door you
        arrived at is not recorded; positions are rounded to about a metre; and every trace is deleted after 30 days. Searches that found
        nothing are deleted after 90 days.
      </p>

      <h2>Your data on this device</h2>
      <DataControls />

      <h2>Sent to the server when you use a feature</h2>
      <ul>
        <li>
          <strong>Address search.</strong> Typing something that is not a mapped place sends the text and your approximate position to the
          server, which asks a map provider for matching addresses.
        </li>
        <li>
          <strong>Searches that found nothing</strong> are recorded against the hospital, so the people who map it can see what visitors expected
          to find. Only the words typed are kept.
        </li>
        <li>
          <strong>Survey Mode</strong> and <strong>Upload plan</strong> send the camera frames or the plan image to the server, which passes them
          to an AI model to read signs and room labels. Both are things you start deliberately; frames are not kept after they are read.
        </li>
        <li>
          <strong>Map tiles</strong> for the street map are fetched from a map tile provider, which sees the request like any web server does.
        </li>
      </ul>

      <h2>Not collected</h2>
      <ul>
        <li>No advertising or analytics trackers.</li>
        <li>No health information: the app knows the name of a ward, not why you are going there.</li>
        <li>No camera footage is stored on the server, and the camera is only used while a camera feature is open.</li>
      </ul>

      <h2>Where to ask</h2>
      <p>
        Questions about how a particular hospital or organisation uses Findway, or requests about your data, go to the team that deployed it.
      </p>
    </InfoPage>
  )
}
