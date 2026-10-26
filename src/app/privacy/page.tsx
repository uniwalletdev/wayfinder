import type { Metadata } from "next"
import Link from "next/link"
import InfoPage from "@/components/InfoPage"
import DataControls from "@/components/DataControls"

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Findway keeps on your device, what it sends to the server, and what it never collects.",
  alternates: { canonical: "/privacy" },
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
      updated="October 2026"
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
        <li>Places someone else published that you chose to hide from your list.</li>
        <li>
          A random identifier for this browser, used so that several people walking the same corridor can be counted as several people, and
          so that someone who publishes abusive places can be stopped from publishing more.
        </li>
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

      <h2 id="your-data">Your data on this device</h2>
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
        <li>
          <strong>Places you publish.</strong> A public or unlisted place, and the points you add to it, are stored on the server so other
          people can open them, together with a one-way scramble of the browser identifier above, so that staff can stop someone who publishes
          abusive places. Delete a place you published from the places list and it is removed from the server.
        </li>
        <li>
          <strong>Reports and support messages.</strong> What you write, the place a report is about, and your email address if you give one,
          so the team can reply. Kept while the team deals with it and for 180 days after, and never more than a year.
        </li>
      </ul>

      <h2>Not collected</h2>
      <ul>
        <li>No advertising or analytics trackers.</li>
        <li>No health information: the app knows the name of a ward, not why you are going there.</li>
        <li>No camera footage is stored on the server, and the camera is only used while a camera feature is open.</li>
      </ul>

      <h2 id="delete-your-data">Deleting your data</h2>
      <p>
        Findway, from Universal Wallet Ltd, has no accounts, so nothing the server holds carries your name. To delete what it holds from your
        phone:
      </p>
      <ol>
        <li>
          <strong>Your walks.</strong> Open <Link href="#your-data">Your data on this device</Link> above (in the app: the ? button, then
          Privacy) and press <strong>Delete my walks from the server</strong>. Every corridor trace filed under this phone&apos;s identifier
          is deleted at once, and the identifier is forgotten.
        </li>
        <li>
          <strong>Places you published.</strong> Open the places list and tap the bin beside the place. It is removed from the server with the
          points in it.
        </li>
        <li>
          <strong>Anything else</strong>, such as a report or support message you sent, or a place you published from a phone you no longer
          have: use the form on the <Link href="/support#contact">Support</Link>
          {" page, choose \u201cPrivacy or my data\u201d, and say what to delete."} We delete it within 30 days, and reply if you leave an email address.
        </li>
      </ol>
      <p>If you ask for nothing, data is kept for these periods and then deleted:</p>
      <ul>
        <li>Corridor traces: 30 days.</li>
        <li>Searches that found nothing: 90 days. They carry no identifier, so they cannot be picked out for one person.</li>
        <li>Reports and support messages: 180 days after they are dealt with, never more than a year.</li>
        <li>Places you published: until you or the Findway team delete them.</li>
        <li>
          A publisher blocked for breaking the rules: the block is kept so that it holds, as a one-way scramble of the phone&apos;s identifier,
          not the identifier itself.
        </li>
      </ul>

      <h2>Where to ask</h2>
      <p>
        Questions about this summary, or requests about your data, go to the Findway team through the form on the{" "}
        <Link href="/support#contact">Support</Link> page. Questions about how a particular hospital or organisation uses Findway go to that
        organisation.
      </p>
    </InfoPage>
  )
}
