import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Navigation, MapPin } from "lucide-react"
import InfoPage from "@/components/InfoPage"
import JsonLd from "@/components/JsonLd"
import { SEED_VENUES } from "@/lib/venues"
import {
  buildingSummaries,
  directionsLinks,
  hasFloors,
  hospitalAddress,
  hospitalDescription,
  hospitalPages,
  hospitalPath,
  hospitalQuestions,
  navigatePath,
  placeCounts,
  placeGroups,
  placeWhere,
  sameTrust,
  countsPhrase,
  HOSPITALS_PATH,
} from "@/lib/hospital-pages"
import { breadcrumbNode, faqNode, graph, hospitalNode, hospitalPageNode } from "@/lib/structured-data"
import { APP_STORE_URL, PLAY_STORE_URL, appAvailability } from "@/lib/store-links"
import { siteUrl } from "@/lib/site-url"

// One page per mapped hospital (src/lib/hospital-pages.ts): where it is, its
// entrances, and every ward, clinic and department with where to find it, each
// a link to directions in the app. Built at deploy time from the venue data;
// a hospital not in it is a 404, not a page rendered on demand.

const PAGES = hospitalPages(SEED_VENUES)
const pageFor = (slug: string) => PAGES.find((p) => p.slug === slug)

export const dynamicParams = false

export function generateStaticParams() {
  return PAGES.map((p) => ({ slug: p.slug }))
}

type Props = { params: Promise<{ slug: string }> }

const titleOf = (name: string) => `${name} map: wards, departments and directions`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageFor((await params).slug)
  if (!page) return {}
  const title = titleOf(page.venue.name)
  const description = hospitalDescription(page.venue)
  return {
    title,
    description,
    alternates: { canonical: hospitalPath(page.slug) },
    // Replaces the root layout's openGraph whole, so it repeats the parts kept.
    openGraph: {
      type: "website",
      siteName: "Findway",
      locale: "en_GB",
      title,
      description,
      url: hospitalPath(page.slug),
      images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Findway" }],
    },
  }
}

export default async function HospitalPage({ params }: Props) {
  const page = pageFor((await params).slug)
  if (!page) notFound()
  const v = page.venue
  const address = hospitalAddress(v)
  const groups = placeGroups(v)
  const buildings = buildingSummaries(v)
  const multiFloor = hasFloors(v)
  const availability = appAvailability()
  const questions = hospitalQuestions(v, availability)
  const related = sameTrust(page, PAGES)
  const counts = countsPhrase(placeCounts(v))
  const base = siteUrl()
  const title = titleOf(v.name)
  const directions = directionsLinks(v)

  return (
    <InfoPage
      eyebrow="Hospital map"
      title={v.name}
      lead={
        `Where to find ${counts || "every mapped place"} at ${v.name}` +
        `${address.trust ? ` (${address.trust})` : ""}, with step-by-step directions from the entrance. Free ${availability}.`
      }
      back={{ href: HOSPITALS_PATH, label: "All hospital maps" }}
    >
      <JsonLd
        data={graph(
          hospitalPageNode(base, page, title, hospitalDescription(v)),
          hospitalNode(base, page),
          breadcrumbNode(base, [
            { name: "Findway", path: "/" },
            { name: "Hospital maps", path: HOSPITALS_PATH },
            { name: v.name, path: hospitalPath(page.slug) },
          ]),
          faqNode(questions),
        )}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a
          href={navigatePath(v)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-wf-primary px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(10,93,194,0.3)]"
        >
          <Navigation size={16} aria-hidden="true" />
          Open {v.name} in Findway
        </a>
        <a
          href={PLAY_STORE_URL}
          className="flex items-center justify-center rounded-2xl border border-wf-border px-6 py-3.5 text-sm font-semibold text-wf-ink hover:border-wf-primary"
        >
          Get it on Google Play
        </a>
        {APP_STORE_URL && (
          <a
            href={APP_STORE_URL}
            className="flex items-center justify-center rounded-2xl border border-wf-border px-6 py-3.5 text-sm font-semibold text-wf-ink hover:border-wf-primary"
          >
            Download on the App Store
          </a>
        )}
      </div>

      {address.line && (
        <>
          <h2>Address</h2>
          <p className="flex items-start gap-2">
            <MapPin size={18} className="mt-1 flex-shrink-0 text-wf-muted" aria-hidden="true" />
            <span>
              {v.name}, {address.line}
              {address.trust && (
                <>
                  <br />
                  Run by {address.trust}
                </>
              )}
            </span>
          </p>
          <p>
            Directions there in <a href={directions.apple}>Apple Maps</a> or <a href={directions.google}>Google Maps</a>. Once you
            arrive, Findway takes over at the entrance.
          </p>
        </>
      )}

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`${g.key}-heading`}>
          <h2 id={`${g.key}-heading`}>
            {g.title} <span className="font-normal text-wf-muted">({g.places.length})</span>
          </h2>
          <ul className={g.places.length > 8 ? "wf-cols" : undefined}>
            {g.places.map((w) => {
              const where = placeWhere(w, v, multiFloor)
              return (
                <li key={w.id}>
                  <a href={navigatePath(v, w)}>{w.name}</a>
                  {where && <span className="text-wf-muted"> · {where}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {buildings.length > 0 && (
        <>
          <h2>Buildings</h2>
          <ul>
            {buildings.map((b) => (
              <li key={b.name}>
                <strong>{b.name}</strong> · {b.floors}
              </li>
            ))}
          </ul>
        </>
      )}

      {v.verified && v.accessibility?.notes && (
        <>
          <h2>Accessibility</h2>
          <p>{v.accessibility.notes}</p>
        </>
      )}

      <h2>Common questions</h2>
      {questions.map((q) => (
        <div key={q.question}>
          <h3>{q.question}</h3>
          <p>{q.answer}</p>
        </div>
      ))}

      <h2>About this map</h2>
      <p>
        Findway builds its hospital maps from the maps and floor guides hospitals publish. Wards and clinics do move, so on the day follow the
        hospital&apos;s signs, and ask staff if you are unsure. Spotted something wrong? <Link href="/support">Tell us</Link>.
      </p>

      {related.length > 0 && (
        <>
          <h2>Other {address.trust} hospitals</h2>
          <ul>
            {related.map((p) => (
              <li key={p.slug}>
                <Link href={hospitalPath(p.slug)}>{p.venue.name}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </InfoPage>
  )
}
