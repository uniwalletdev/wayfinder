import type { Venue } from "./types"
import {
  hospitalAddress,
  hospitalPath,
  navigatePath,
  placeGroups,
  placeWhere,
  hasFloors,
  HOSPITALS_PATH,
  type HospitalPage,
  type Question,
} from "./hospital-pages"
import { APP_STORE_URL, PLAY_STORE_URL } from "./store-links"

// Structured data (schema.org JSON-LD) for search engines and AI assistants:
// what Findway is, and for each hospital page, the hospital, where it is and
// what is inside it. Rendered by src/components/JsonLd.tsx. Each builder
// returns plain objects; undefined fields vanish when serialised.

type Json = Record<string, unknown>

export const SITE_DESCRIPTION =
  "Findway maps NHS hospitals floor by floor and gives patients, visitors and staff step-by-step directions from the entrance to the right ward, clinic or department."

const at = (base: URL, path: string) => new URL(path, base).toString()

export function graph(...nodes: Json[]): Json {
  return { "@context": "https://schema.org", "@graph": nodes }
}

export function organizationNode(base: URL): Json {
  return {
    "@type": "Organization",
    "@id": at(base, "/#organization"),
    name: "Findway",
    url: at(base, "/"),
    logo: at(base, "/icon-512.png"),
  }
}

export function websiteNode(base: URL): Json {
  return {
    "@type": "WebSite",
    "@id": at(base, "/#website"),
    name: "Findway",
    url: at(base, "/"),
    description: SITE_DESCRIPTION,
    inLanguage: "en-GB",
    publisher: { "@id": at(base, "/#organization") },
  }
}

export function appNode(base: URL, appStore: string | null = APP_STORE_URL): Json {
  const stores = [PLAY_STORE_URL, appStore].filter((u): u is string => !!u)
  return {
    "@type": "SoftwareApplication",
    "@id": at(base, "/#app"),
    name: "Findway",
    description: SITE_DESCRIPTION,
    url: at(base, "/navigate"),
    applicationCategory: "TravelApplication",
    applicationSubCategory: "Hospital wayfinding",
    operatingSystem: ["Web", "Android", appStore ? "iOS" : null].filter(Boolean).join(", "),
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    installUrl: stores,
    sameAs: stores,
    featureList: [
      "Search any ward, clinic or department in a mapped hospital",
      "Step-by-step walking directions from the entrance, across floors",
      "Step-free routes by default",
      "Spoken directions",
      "Directions to a hospital's address through Apple Maps or Google Maps",
    ],
    publisher: { "@id": at(base, "/#organization") },
  }
}

export function breadcrumbNode(base: URL, crumbs: { name: string; path: string }[]): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: at(base, c.path) })),
  }
}

export function faqNode(questions: Question[]): Json {
  return {
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  }
}

// The hospital itself. It has no `url`: that would claim this page as the
// hospital's own website. The page is about it instead (hospitalPageNode).
export function hospitalNode(base: URL, page: HospitalPage): Json {
  const v: Venue = page.venue
  const a = hospitalAddress(v)
  const multiFloor = hasFloors(v)
  return {
    "@type": "Hospital",
    "@id": `${at(base, hospitalPath(page.slug))}#hospital`,
    name: v.name,
    address: a.line
      ? {
          "@type": "PostalAddress",
          streetAddress: a.street,
          addressLocality: a.locality,
          postalCode: a.postcode,
          addressCountry: v.country ?? "GB",
        }
      : undefined,
    geo: { "@type": "GeoCoordinates", latitude: v.center.lat, longitude: v.center.lng },
    hasMap: at(base, navigatePath(v)),
    parentOrganization: a.trust ? { "@type": "MedicalOrganization", name: a.trust } : undefined,
    containsPlace: placeGroups(v).flatMap((g) =>
      g.places.map((w) => ({
        "@type": "Place",
        name: w.name,
        description: placeWhere(w, v, multiFloor) || undefined,
        hasMap: at(base, navigatePath(v, w)),
      })),
    ),
  }
}

export function hospitalPageNode(base: URL, page: HospitalPage, title: string, description: string): Json {
  const url = at(base, hospitalPath(page.slug))
  return {
    "@type": "WebPage",
    "@id": url,
    url,
    name: title,
    description,
    inLanguage: "en-GB",
    isPartOf: { "@id": at(base, "/#website") },
    about: { "@id": `${url}#hospital` },
  }
}

// The hospitals index: every page, in the order listed.
export function hospitalListNode(base: URL, pages: HospitalPage[]): Json {
  return {
    "@type": "ItemList",
    "@id": `${at(base, HOSPITALS_PATH)}#list`,
    name: "Hospital maps",
    numberOfItems: pages.length,
    itemListElement: pages.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.venue.name, url: at(base, hospitalPath(p.slug)) })),
  }
}
