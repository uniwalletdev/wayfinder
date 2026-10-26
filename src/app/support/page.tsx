import type { Metadata } from "next"
import Link from "next/link"
import InfoPage from "@/components/InfoPage"
import SupportForm from "@/components/SupportForm"

export const metadata: Metadata = {
  title: "Help and support",
  description: "Answers to common questions about Findway, the rules for places people share, and how to contact the Findway team.",
  alternates: { canonical: "/support" },
}

// The app's Help button and the stores' Support URL lead here: help with the
// common problems, the rules for places people publish (App Store guideline
// 1.2: shared content needs published rules, reporting and a contact), and a
// form that reaches the back office Inbox. An email address is shown as well
// when the deployment sets NEXT_PUBLIC_SUPPORT_EMAIL.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || undefined

export default function SupportPage() {
  return (
    <InfoPage
      eyebrow="Support"
      title="Help and support"
      lead="Answers to the questions people ask most, the rules for places people share, and a way to reach the Findway team."
      updated="October 2026"
    >
      <h2>Common questions</h2>

      <h3>The blue dot is missing, or in the wrong place</h3>
      <p>
        Findway needs permission to use your location. On an iPhone, open Settings, then Findway, then Location, and choose While Using the
        App; on Android, open Settings, then Apps, then Findway, then Permissions. Inside a building GPS is weak, so the app also counts your
        steps and reads the compass. If the dot drifts, scan a Findway QR code on a wall to put it back where you are.
      </p>

      <h3>Why does my route start at the main entrance?</h3>
      <p>
        When your location is off, or you are not at the hospital yet, routes start at the hospital’s main entrance so you can see the way
        in before you arrive. Tap <strong>From</strong> above the route to start somewhere else.
      </p>

      <h3>Does it work without signal?</h3>
      <p>In the Findway app the maps are part of the app, so search and routes keep working in a basement with no connection.</p>

      <h3>Can I avoid stairs?</h3>
      <p>
        Yes. Routes are step-free unless you choose otherwise: a change of floor goes by lift, and where stairs would be quicker the app
        shows both and says which is which. See <Link href="/accessibility">Accessibility</Link> for more.
      </p>

      <h3>A map is wrong or a ward is missing</h3>
      <p>
        Tell us below, and say which hospital. Searches that find nothing are recorded against the hospital too, so the people who map it can
        see what visitors expected to find.
      </p>

      <h3>Deleting what the app has sent</h3>
      <p>
        Open <Link href="/privacy#your-data">Privacy</Link> and press <strong>Delete my walks from the server</strong>. To delete a place you
        published, open the places list and tap the bin beside it.
      </p>

      <h2 id="place-rules">Rules for shared places</h2>
      <p>
        Anyone can map a place in Findway, and a place that is public, or unlisted and shared by link, can be opened by other people. Those
        places, and the names of the points inside them, must not contain:
      </p>
      <ul>
        <li>anything offensive, hateful, harassing or sexual, or anything that threatens or encourages violence;</li>
        <li>advertising, spam, or places that do not exist;</li>
        <li>personal information about anyone, such as a private person’s name, address or phone number;</li>
        <li>a place you are not allowed to map and publish;</li>
        <li>anything misleading, such as wrong names for wards or exits, that could send someone the wrong way.</li>
      </ul>
      <p>
        We do not tolerate objectionable content or abusive users. Names with offensive words are refused when you publish. Anyone can report a
        shared place: tap <strong>Report</strong> under the place’s name, or the flag beside it in the places list. The Findway team reviews
        reports within a day, removes places that break these rules, and blocks people who break them on purpose from sharing places again.
        You can also hide any place someone else shared from your own list straight away.
      </p>

      <h2 id="contact">Contact us</h2>
      <p>
        Send us a message about the app, a hospital map, your data or accessibility. Leave your email if you would like a reply.
        {SUPPORT_EMAIL && (
          <>
            {" "}
            You can also email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </>
        )}
      </p>
      <SupportForm email={SUPPORT_EMAIL} />
      <p className="mt-6">
        Findway gives directions inside buildings. It is not a medical service: for medical help, contact the hospital or your local emergency
        number.
      </p>
    </InfoPage>
  )
}
