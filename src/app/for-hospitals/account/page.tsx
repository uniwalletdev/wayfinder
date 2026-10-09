import type { Metadata } from "next"
import InfoPage from "@/components/InfoPage"
import HospitalAccount from "@/components/hospitals/HospitalAccount"

export const metadata: Metadata = {
  title: "Hospital account",
  robots: { index: false, follow: false },
}

export default function HospitalAccountPage() {
  return (
    <InfoPage eyebrow="For hospitals" title="Your hospital account" lead="Your Official listings, billing, branding and the people who can manage them." wide>
      <div className="not-prose">
        <HospitalAccount />
      </div>
    </InfoPage>
  )
}
