import { SEED_VENUES } from "@/lib/venues"
import { siteUrl } from "@/lib/site-url"
import { llmsTxt } from "@/lib/llms-txt"

// A summary of Findway for AI assistants (src/lib/llms-txt.ts), built at deploy
// time from the venue data like the sitemap.
export const dynamic = "force-static"

export function GET() {
  return new Response(llmsTxt(SEED_VENUES, siteUrl()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
