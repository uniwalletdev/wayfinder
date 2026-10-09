import type { Metadata } from "next"
import Link from "next/link"
import InfoPage from "@/components/InfoPage"
import { TERMS_VERSION, YEARLY_MONTHS } from "@/lib/billing/plans"

export const metadata: Metadata = {
  title: "Terms for hospitals",
  description: "The terms, data processing agreement and service levels for an Official listing on Findway.",
}

// What a hospital accepts when it signs up (src/components/hospitals/
// HospitalSignup.tsx). Each site records TERMS_VERSION; bump it in
// src/lib/billing/plans.ts whenever this page changes.
export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="For hospitals"
      title="Terms for an Official listing"
      lead="The agreement between Findway and an organisation that lists a hospital as Official: what you get, how billing works, how your data is handled, and the service levels we commit to."
      updated={`October 2026 · version ${TERMS_VERSION}`}
    >
      <h2>1. The agreement</h2>
      <p>
        These terms apply between Findway and the organisation named when a site is signed up (“you”). The person signing up confirms they are
        allowed to agree to them for that organisation. Accepting them online is agreeing to them: no signed copy is needed. If your organisation
        needs its own purchase terms to apply, tell us before you sign up.
      </p>

      <h2>2. What an Official listing is</h2>
      <ul>
        <li>An Official badge on the listed site in Findway’s website and apps, with your organisation’s name, logo and colour.</li>
        <li>Priority handling of corrections and new floor plans you send for the site.</li>
        <li>Anonymous counts of how visitors used the site’s map, in your account.</li>
        <li>Access to your account for the colleagues you add.</li>
      </ul>
      <p>
        Findway is free for patients and visitors. An Official listing never restricts who can see or use a hospital’s map, and ending one never
        removes the map: patients can still find their way.
      </p>

      <h2>3. Fees and billing</h2>
      <ul>
        <li>Fees are per site, shown at sign-up, and exclude VAT or sales tax, which is added where it applies.</li>
        <li>You choose monthly or yearly. A yearly plan costs {YEARLY_MONTHS} months’ fees and is paid in advance.</li>
        <li>Plans renew automatically at the end of each month or year until cancelled.</li>
        <li>
          Paying online, the fee is charged to your card or direct debit at the start of each period. Paying by invoice, the invoice is due 30 days
          after it is issued, by bank transfer to the account shown on it.
        </li>
        <li>
          If a payment is late, the listing stays Official while it is retried and reminders are sent. If it remains unpaid, the listing ends; the map
          stays.
        </li>
        <li>We may change prices with at least 60 days’ notice, taking effect at your next renewal.</li>
      </ul>

      <h2>4. Changing or cancelling</h2>
      <p>
        You can switch between monthly and yearly, update payment details or cancel at any time from <strong>Billing and invoices</strong> in your
        account. A cancellation takes effect at the end of the period already paid for, and fees already paid are not refunded, except where the
        law requires it or we end the agreement without cause.
      </p>

      <h2>5. Your content</h2>
      <p>
        You let Findway use the floor plans, site maps, names, logos and other material you give us, to show and route your hospital in Findway,
        for as long as the hospital is in Findway. You confirm you are allowed to give us that permission. Findway keeps the map it has made of a site
        after a listing ends, so that patients can still use it, unless you ask us to stop showing material you provided.
      </p>

      <h2>6. Data protection</h2>
      <p>
        Findway does not process patients’ personal data on your behalf: visitors use it anonymously, and their position is worked out on their own
        device. What we record about how a site’s map is used is anonymous, described in our <Link href="/privacy">privacy notice</Link>, and is
        what your account shows. For the people at your organisation who use your account, each party is a separate controller of the contact details
        it holds. If your organisation needs a data processing agreement or a DPIA, the procurement pack on the{" "}
        <Link href="/for-hospitals">hospitals page</Link> includes a template.
      </p>

      <h2>7. Service levels</h2>
      <ul>
        <li>Availability of the Findway website and API: 99.5% a month, excluding scheduled maintenance announced in advance.</li>
        <li>The apps keep working without a connection for maps already downloaded, whatever the server’s availability.</li>
        <li>Corrections you send for a listed site: started within 2 working days, and published within 5 working days for routine changes.</li>
        <li>New floor plans for a listed site: mapped within 15 working days.</li>
        <li>Support from your account or the <Link href="/support">support page</Link>: answered within 1 working day.</li>
      </ul>

      <h2>8. Clinical safety</h2>
      <p>
        Findway is a wayfinding aid, not a medical device, and must not be relied on in an emergency. Signs and staff in the hospital take precedence
        over the app. Tell us at once about anything in a map that could put someone at risk, and we will correct or hide it.
      </p>

      <h2>9. Liability</h2>
      <p>
        Nothing in these terms limits liability that cannot lawfully be limited. Otherwise, each party’s total liability under this agreement in any
        12 months is limited to the fees paid for the listing in those 12 months, and neither party is liable for indirect or consequential loss.
      </p>

      <h2>10. Ending the agreement</h2>
      <p>
        Either party may end the agreement for a site by cancelling at the end of a period. Either may end it at once if the other seriously breaks
        these terms and does not put it right within 30 days of being asked. If we stop offering Official listings we will give at least 90 days’
        notice and refund fees paid for time after the end.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms with at least 30 days’ notice to your billing email. The version you accepted is recorded against each site, and
        the new version applies from your next renewal.
      </p>

      <h2>12. Law</h2>
      <p>These terms are governed by the law of England and Wales, and its courts decide any dispute.</p>
    </InfoPage>
  )
}
