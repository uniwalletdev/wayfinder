// Who may claim a hospital site, decided from the work email they signed in
// with. Pure, and unit-tested (scripts/lib-test/billing.test.mjs).
//
// A claim is accepted at once when the email's domain is one the hospital is
// known by: for an NHS hospital, nhs.net (the NHS's own email service, which
// only NHS staff are given) and the domain of the trust's website from the ODS
// register; for any hospital, the domain of its website when one is known.
// Anything else waits for a person to check it in the back office
// (/admin/customers). Free mail providers and domains that cover a whole
// country or sector never prove anything.

export type SiteKind = "nhs" | "public" | "private" | "other"

// Domains too broad to say which hospital someone works at.
const TOO_BROAD = new Set([
  "nhs.uk", "gov.uk", "co.uk", "org.uk", "ac.uk", "net.uk", "me.uk", "ltd.uk", "plc.uk", "uk",
  "com", "org", "net", "co", "io", "eu", "de", "fr", "us", "info", "health",
  "facebook.com", "twitter.com", "x.com", "linkedin.com", "instagram.com", "youtube.com",
  "google.com", "sites.google.com", "wixsite.com", "wordpress.com", "blogspot.com",
])

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk", "msn.com",
  "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  "gmx.com", "gmx.de", "web.de", "mail.com", "yandex.com", "zoho.com", "btinternet.com", "sky.com", "virginmedia.com",
])

// The NHS's own email service: every address on it belongs to NHS staff.
export const NHS_MAIL = "nhs.net"

export function emailDomain(email: string): string | null {
  const m = email.trim().toLowerCase().match(/^[^@\s]+@([a-z0-9.-]+\.[a-z]{2,})$/)
  return m ? m[1] : null
}

// The domain of a website address, without "www.".
export function websiteDomain(url: string | null | undefined): string | null {
  if (!url) return null
  let host: string
  try {
    host = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    return null
  }
  host = host.replace(/^www\d?\./, "")
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || TOO_BROAD.has(host) || FREE_MAIL.has(host)) return null
  return host
}

export function allowedDomains(site: { kind: SiteKind; website?: string | null }): string[] {
  const out = new Set<string>()
  if (site.kind === "nhs") out.add(NHS_MAIL)
  const web = websiteDomain(site.website)
  if (web) out.add(web)
  return [...out]
}

// An address at the domain itself or any part of it: someone@estates.mft.nhs.uk
// is at mft.nhs.uk.
export function domainMatches(email: string, domains: string[]): boolean {
  const d = emailDomain(email)
  if (!d || FREE_MAIL.has(d)) return false
  return domains.some((allowed) => d === allowed || d.endsWith(`.${allowed}`))
}

// Of someone's verified email addresses, the first that proves they work at
// the site, if any.
export function provingEmail(verifiedEmails: string[], domains: string[]): string | null {
  return verifiedEmails.find((e) => domainMatches(e, domains)) ?? null
}

export function isWorkEmail(email: string): boolean {
  const d = emailDomain(email)
  return !!d && !FREE_MAIL.has(d)
}
