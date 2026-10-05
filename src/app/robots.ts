import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site-url"

// Crawlers may index the pages people search for (the landing page, the map,
// the information pages). The API is not content, and a crawler hammering the
// geocoder or the AI routes would only burn the rate limits real visitors need,
// and the back office is behind sign-in.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/coverage"] },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  }
}

// Already static on the web; declared so the apps' static export (scripts/app-shell-build.mjs)
// can include this route rather than refuse the build.
export const dynamic = "force-static"
