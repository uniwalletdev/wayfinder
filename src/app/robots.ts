import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site-url"

// Crawlers may index the pages people search for (the landing page, the map,
// the information pages). The API is not content, and a crawler hammering the
// geocoder or the AI routes would only burn the rate limits real visitors need.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  }
}
