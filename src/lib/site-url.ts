// The deployment's public origin, for anything that must be an absolute URL:
// Open Graph metadata, the sitemap, robots.txt.
//
// Set NEXT_PUBLIC_SITE_URL explicitly in production. Without it the hosts'
// own variables are used (Vercel and Railway both expose the public hostname),
// and in development it falls back to localhost. Never throws: a missing value
// degrades to a plausible origin rather than failing the build.
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim()
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim()
  const candidate = explicit || (vercel ? `https://${vercel}` : railway ? `https://${railway}` : "http://localhost:3000")
  try {
    return new URL(candidate)
  } catch {
    return new URL("http://localhost:3000")
  }
}
