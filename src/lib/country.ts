import { TIME_ZONES_BY_COUNTRY } from "./data/timezone-countries"

// Which country the visitor is in, so the app shows that country's hospitals
// and nothing else — someone opening it in Luxembourg sees Luxembourg's
// hospitals without choosing a country, or knowing the list has others.
//
// Nothing here asks for a permission. The device's IANA time zone is the
// signal: every browser reports it, it is set from the phone's location on
// most devices, and it names the country for all but a few shared zones (the
// generated table resolves those to the country the zone is named for). A
// visitor whose phone keeps the wrong zone can still reach another country by
// searching for it in the places list, and that choice is remembered.

// The country the seed venues were built for: the NHS directory and the
// mapped hospitals. Also the fallback when nothing about the device says
// otherwise, so the app behaves as it always did.
export const HOME_COUNTRY = "GB"

const STORAGE_KEY = "wayfinder:country"

let zoneIndex: Map<string, string> | null = null
function countryOfZone(zone: string): string | null {
  if (!zoneIndex) {
    zoneIndex = new Map()
    for (const [code, zones] of Object.entries(TIME_ZONES_BY_COUNTRY)) {
      for (const z of zones.split(" ")) zoneIndex.set(z.toLowerCase(), code)
    }
  }
  return zoneIndex.get(zone.toLowerCase()) ?? null
}

// The country a time zone belongs to, or null for a zone the table does not
// know (a UTC offset like "Etc/GMT+1" says nothing about where someone is).
export function countryFromTimeZone(zone: string | undefined | null): string | null {
  if (!zone) return null
  return countryOfZone(zone)
}

// The region of a locale tag with one spelled out ("fr-LU" → LU). A bare
// language ("fr") is a language, not a place, and resolves to nothing.
export function countryFromLocale(tag: string | undefined | null): string | null {
  if (!tag) return null
  const m = tag.match(/^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})(?:-|$)/)
  return m ? m[1].toUpperCase() : null
}

export function isCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code) && code in TIME_ZONES_BY_COUNTRY
}

// The country to show, in order of trust: the one the visitor chose by
// searching for it, then the device's time zone, then an explicit region in
// its language setting, then home. Browser-only; on the server it is home.
export function detectCountry(): string {
  if (typeof window === "undefined") return HOME_COUNTRY
  const saved = loadCountry()
  if (saved) return saved
  let zone: string | undefined
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {}
  const fromZone = countryFromTimeZone(zone)
  if (fromZone) return fromZone
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of tags) {
    const c = countryFromLocale(tag)
    if (c && isCountryCode(c)) return c
  }
  return HOME_COUNTRY
}

export function loadCountry(): string | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v && isCountryCode(v) ? v : null
  } catch {
    return null
  }
}

export function saveCountry(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code)
  } catch {}
}

let displayNames: Intl.DisplayNames | null | undefined
// "Luxembourg" for LU, in English; the code itself where the runtime cannot
// name it.
export function countryName(code: string): string {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(["en"], { type: "region" })
    } catch {
      displayNames = null
    }
  }
  try {
    return displayNames?.of(code) ?? code
  } catch {
    return code
  }
}

export const ALL_COUNTRIES: string[] = Object.keys(TIME_ZONES_BY_COUNTRY).sort()

// Countries whose English name starts with, or has a word starting with, the
// query — what the places list offers when someone types a country rather
// than a hospital.
export function matchCountries(query: string, limit = 4): string[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const starts: string[] = []
  const words: string[] = []
  for (const code of ALL_COUNTRIES) {
    const name = countryName(code).toLowerCase()
    if (name.startsWith(q)) starts.push(code)
    else if (name.split(/[\s(,-]+/).some((w) => w.startsWith(q))) words.push(code)
  }
  return [...starts, ...words].slice(0, limit)
}
