import type { Metadata } from "next"
import Link from "next/link"
import InfoPage from "@/components/InfoPage"
import JsonLd from "@/components/JsonLd"
import { SEED_VENUES } from "@/lib/venues"
import { countsPhrase, hospitalAddress, hospitalPages, hospitalPath, placeCounts, HOSPITALS_PATH, type HospitalPage } from "@/lib/hospital-pages"
import { breadcrumbNode, graph, hospitalListNode } from "@/lib/structured-data"
import { appAvailability } from "@/lib/store-links"
import { siteUrl } from "@/lib/site-url"

// Every hospital with a page (src/app/hospitals/[slug]), grouped by the trust
// that runs it: the way into those pages for people and crawlers alike.

const PAGES = hospitalPages(SEED_VENUES)
const isMapped = (v: { floorPlans: unknown[]; waypoints: unknown[] }) => v.floorPlans.length > 0 || v.waypoints.length > 0
const LOCATED = SEED_VENUES.filter((v) => v.visibility === "public" && v.category === "hospital" && !isMapped(v)).length

const DESCRIPTION = `Maps of ${PAGES.length} NHS hospitals with every ward, clinic and department, and step-by-step directions from the entrance. Free ${appAvailability()}.`

export const metadata: Metadata = {
  title: "Hospital maps",
  description: DESCRIPTION,
  alternates: { canonical: HOSPITALS_PATH },
}

function byTrust(pages: HospitalPage[]): [string, HospitalPage[]][] {
  const groups = new Map<string, HospitalPage[]>()
  for (const p of pages) {
    const trust = hospitalAddress(p.venue).trust ?? "Other hospitals"
    groups.set(trust, [...(groups.get(trust) ?? []), p])
  }
  return [...groups]
    .map(([trust, list]): [string, HospitalPage[]] => [trust, list.sort((a, b) => a.venue.name.localeCompare(b.venue.name, "en-GB"))])
    .sort(([a], [b]) => a.localeCompare(b, "en-GB"))
}

export default function HospitalsPage() {
  const base = siteUrl()
  return (
    <InfoPage eyebrow="Hospital maps" title="Find your way around NHS hospitals" lead={DESCRIPTION}>
      <JsonLd
        data={graph(
          hospitalListNode(base, PAGES),
          breadcrumbNode(base, [
            { name: "Findway", path: "/" },
            { name: "Hospital maps", path: HOSPITALS_PATH },
          ]),
        )}
      />
      <p>
        Choose a hospital to see where its wards, clinics and departments are. Each one opens in Findway with directions from the entrance,
        avoiding stairs unless you choose otherwise.
        {LOCATED > 0 && (
          <>
            {" "}Findway also knows where {LOCATED.toLocaleString("en-GB")} more NHS hospitals and clinics are: <Link href="/navigate">open the map</Link>{" "}
            to get directions to any of them.
          </>
        )}
      </p>
      {byTrust(PAGES).map(([trust, pages]) => (
        <section key={trust}>
          <h2>{trust}</h2>
          <ul>
            {pages.map((p) => {
              const { line } = hospitalAddress(p.venue)
              const counts = countsPhrase(placeCounts(p.venue))
              return (
                <li key={p.slug}>
                  <Link href={hospitalPath(p.slug)}>{p.venue.name}</Link>
                  {line && <span className="text-wf-muted"> · {line}</span>}
                  {counts && <span className="block text-[14px] text-wf-muted">{counts}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </InfoPage>
  )
}
