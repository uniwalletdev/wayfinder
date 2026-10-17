import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site-url"
import { SEED_VENUES } from "@/lib/venues"
import { hospitalPages, hospitalPath, HOSPITALS_PATH } from "@/lib/hospital-pages"

// Every public page, plus a page per mapped hospital (src/app/hospitals/). A
// search for "<hospital> map", or an AI assistant asked where a ward is, should
// land on that hospital's page, which reads as text and links into the app. The
// app's own deep links (/navigate?venue=…) are left out: to a crawler they are
// one JavaScript page under many addresses.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const at = (path: string) => new URL(path, base).toString()
  const now = new Date()
  return [
    { url: at("/"), lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: at("/navigate"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: at(HOSPITALS_PATH), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: at("/map"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: at("/support"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: at("/accessibility"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: at("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...hospitalPages(SEED_VENUES).map((p) => ({
      url: at(hospitalPath(p.slug)),
      lastModified: p.venue.updatedAt ? new Date(p.venue.updatedAt) : now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ]
}

// Already static on the web; declared so the apps' static export (scripts/app-shell-build.mjs)
// can include this route rather than refuse the build.
export const dynamic = "force-static"
