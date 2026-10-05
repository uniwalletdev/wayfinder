// A change must come from this site. Browsers send Origin on every POST, PATCH
// and DELETE; it must name the host the request was made to — as the browser
// saw it, so behind a proxy the forwarded host, not the address `next start`
// listens on. Without Origin, the browser's own Sec-Fetch-Site must say
// same-origin. Anything else is refused, whatever cookies it carries.
export function sameOrigin(h: Pick<Headers, "get">): boolean {
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase()
  const origin = h.get("origin")
  if (origin) {
    try {
      return !!host && new URL(origin).host.toLowerCase() === host
    } catch {
      return false
    }
  }
  return h.get("sec-fetch-site") === "same-origin"
}
