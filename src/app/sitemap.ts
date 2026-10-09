import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site-url"
import { SEED_VENUES } from "@/lib/venues"

// Every public page, plus a deep link per fully-mapped hospital. A search for
// "<hospital> map" should be able to land on that hospital open in the app,
// not on the generic landing page.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const at = (path: string) => new URL(path, base).toString()
  const now = new Date()
  const mapped = SEED_VENUES.filter((v) => v.visibility === "public" && (v.floorPlans.length > 0 || v.waypoints.length > 0))
  return [
    { url: at("/"), lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: at("/navigate"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: at("/map"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: at("/support"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: at("/for-hospitals"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: at("/for-hospitals/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: at("/accessibility"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: at("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...mapped.map((v) => ({
      url: at(`/navigate?venue=${encodeURIComponent(v.id)}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ]
}

// Already static on the web; declared so the apps' static export (scripts/app-shell-build.mjs)
// can include this route rather than refuse the build.
export const dynamic = "force-static"
