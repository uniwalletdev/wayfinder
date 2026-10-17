import type { Venue, Waypoint, WaypointType } from "./types"
import { floorLabel } from "./waypoint-meta"
import { venueBuildings } from "./buildings"

// A page on the website for each mapped hospital (src/app/hospitals/), for
// people and for the search engines and AI assistants that answer "where is
// Kangaroo Ward at Great Ormond Street?". The map is drawn by JavaScript, which
// crawlers mostly do not run, so without these pages a hospital's wards and
// clinics exist nowhere they can read. Everything here is read off the same
// venue data the app uses.

export const HOSPITALS_PATH = "/hospitals"

export interface HospitalPage {
  slug: string
  venue: Venue
}

// Public hospitals with a real map inside. A placeholder drawing would put
// wards where the drawing put them, and a directory pin has nothing to say
// beyond its postcode.
export function hasHospitalPage(v: Venue): boolean {
  return v.visibility === "public" && v.category === "hospital" && !v.illustrative && v.waypoints.length > 0
}

// "St George's Hospital, Tooting" -> "st-georges-hospital-tooting".
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Every page, its address taken from the hospital's name: the venue ids of the
// generated maps are the file names of the trusts' PDFs. Two hospitals with
// the same name keep the first one's address and the later one adds its id.
export function hospitalPages(venues: Venue[]): HospitalPage[] {
  const taken = new Set<string>()
  const pages: HospitalPage[] = []
  for (const venue of venues) {
    if (!hasHospitalPage(venue)) continue
    let slug = slugify(venue.name) || slugify(venue.id)
    if (taken.has(slug)) slug = `${slug}-${slugify(venue.id)}`
    taken.add(slug)
    pages.push({ slug, venue })
  }
  return pages
}

export const hospitalPath = (slug: string) => `${HOSPITALS_PATH}/${slug}`

// The app opened on the hospital, or on directions to one place in it.
export function navigatePath(venue: Venue, place?: Waypoint): string {
  const q = new URLSearchParams({ venue: venue.id })
  if (place) q.set("to", place.id)
  return `/navigate?${q}`
}

export interface HospitalAddress {
  trust?: string
  // The whole address on one line, as the venue gives it.
  line?: string
  street?: string
  locality?: string
  postcode?: string
}

const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i

// The trust and address. Venues built from a trust's site map carry them in
// the subtitle, "<Trust> · <address>"; a venue with its own address fields
// uses those.
export function hospitalAddress(v: Venue): HospitalAddress {
  const [first, ...rest] = (v.subtitle ?? "").split(" · ").map((s) => s.trim())
  let trust: string | undefined = first || undefined
  let line = rest.join(", ") || undefined
  if (!line && trust && POSTCODE.test(trust)) {
    line = trust
    trust = undefined
  }
  if (v.address?.length) line = [...v.address, v.postcode].filter(Boolean).join(", ")
  if (!line) return { trust }
  const postcode = line.match(POSTCODE)?.[1]?.toUpperCase()
  const parts = line
    .replace(POSTCODE, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const locality = parts.pop()
  return { trust, line, street: parts.join(", ") || undefined, locality, postcode }
}

export interface PlaceGroup {
  key: string
  title: string
  places: Waypoint[]
}

// What the page lists, in this order. Lifts and stairs are how you get
// somewhere, not where anyone is going.
const GROUPS: { key: string; title: string; types: WaypointType[] }[] = [
  { key: "entrances", title: "Entrances", types: ["exit"] },
  { key: "wards", title: "Wards", types: ["ward"] },
  { key: "departments", title: "Departments and clinics", types: ["department"] },
  { key: "facilities", title: "Reception, pharmacy, food and toilets", types: ["reception", "pharmacy", "canteen", "toilet"] },
  { key: "other", title: "Other places", types: ["other"] },
]

const byName = (a: Waypoint, b: Waypoint) => a.name.localeCompare(b.name, "en-GB", { numeric: true, sensitivity: "base" })

// The places in each group, alphabetical ("Ward 2" before "Ward 10"), each
// name and location once. Empty groups are left out.
export function placeGroups(v: Venue): PlaceGroup[] {
  const multiFloor = hasFloors(v)
  return GROUPS.map(({ key, title, types }) => {
    const seen = new Set<string>()
    const places = v.waypoints
      .filter((w) => types.includes(w.type) && w.name.trim())
      .filter((w) => {
        const k = `${w.name.trim().toLowerCase()}|${placeWhere(w, v, multiFloor).toLowerCase()}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .sort(byName)
    return { key, title, places }
  }).filter((g) => g.places.length > 0)
}

// A site map draws the whole site on one sheet, so every place on it is on
// "floor 0", which says nothing about which storey it is on inside.
export function hasFloors(v: Venue): boolean {
  return new Set(v.waypoints.map((w) => w.floor)).size > 1
}

const NAMES_A_STOREY = /\b(level|levels|floor|floors|ground|basement)\b/i

// Where a place is, in words: its building, its floor (when the map has
// floors and the description does not already say), and the description.
export function placeWhere(w: Waypoint, v: Venue, multiFloor = hasFloors(v)): string {
  const desc = w.description?.trim() ?? ""
  const building = w.building?.trim() && !desc.includes(w.building.trim()) ? w.building.trim() : ""
  const floor = multiFloor && !NAMES_A_STOREY.test(desc) ? floorLabel(w.floor, v.floorNaming) : ""
  return [building, floor, desc].filter(Boolean).join(" · ")
}

export interface BuildingSummary {
  name: string
  floors: string
}

// The buildings on a multi-building site and the storeys each one has.
export function buildingSummaries(v: Venue): BuildingSummary[] {
  const plain = (f: number) => floorLabel(f, v.floorNaming).replace(/ \(ground floor\)$/, "")
  return venueBuildings(v.waypoints).map((b) => {
    const lo = b.floors[0]
    const hi = b.floors[b.floors.length - 1]
    return { name: b.name, floors: lo === hi ? plain(lo) : `${plain(lo)} to ${plain(hi)}` }
  })
}

export interface PlaceCounts {
  wards: number
  departments: number
  entrances: number
}

export function placeCounts(v: Venue): PlaceCounts {
  const groups = placeGroups(v)
  const size = (key: string) => groups.find((g) => g.key === key)?.places.length ?? 0
  return { wards: size("wards"), departments: size("departments"), entrances: size("entrances") }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// With a comma before the last of three, since "departments and clinics" has
// an "and" of its own.
function andList(items: string[]): string {
  if (items.length <= 1) return items.join("")
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

// "29 wards, 68 departments and clinics, and 4 entrances", or "" when the map
// has none of those.
export function countsPhrase(c: PlaceCounts): string {
  return andList(
    [
      c.wards ? plural(c.wards, "ward", "wards") : "",
      c.departments ? plural(c.departments, "department or clinic", "departments and clinics") : "",
      c.entrances ? plural(c.entrances, "entrance", "entrances") : "",
    ].filter(Boolean),
  )
}

// The page's search-result description.
export function hospitalDescription(v: Venue): string {
  const { line } = hospitalAddress(v)
  const counts = countsPhrase(placeCounts(v))
  return (
    `Find your way around ${v.name}${line ? `, ${line}` : ""}` +
    `${counts ? `: ${counts}` : ""}, with step-by-step directions from the entrance in Findway.`
  )
}

export interface Question {
  question: string
  answer: string
}

// The places people most often look for at this hospital: the venue's own
// shortcuts, else its first wards and departments.
export function popularPlaces(v: Venue, max = 4): Waypoint[] {
  const wanted = (w: Waypoint) => w.type !== "exit" && w.type !== "lift" && w.type !== "stairs"
  const named = (v.quickAccess ?? [])
    .map((name) => v.waypoints.find((w) => w.name === name))
    .filter((w): w is Waypoint => !!w && wanted(w))
  const fallback = v.waypoints.filter((w) => w.type === "ward" || w.type === "department").sort(byName)
  const out: Waypoint[] = []
  for (const w of [...named, ...fallback]) {
    if (out.length >= max) break
    if (!out.some((o) => o.name === w.name)) out.push(w)
  }
  return out
}

// Questions people ask about the hospital, answered from the map. `availability`
// says where Findway runs ("on the web and Android").
export function hospitalQuestions(v: Venue, availability: string): Question[] {
  const { line } = hospitalAddress(v)
  const counts = countsPhrase(placeCounts(v))
  const out: Question[] = [
    {
      question: `Is there a map of ${v.name}?`,
      answer:
        `Yes. Findway has a map of ${v.name}${counts ? ` showing ${counts}` : ""}. ` +
        `Search for a ward, clinic or department and it walks you there from the entrance, one step at a time, ` +
        `avoiding stairs unless you choose otherwise. It is free ${availability}.`,
    },
  ]
  if (line) {
    out.push({
      question: `How do I get to ${v.name}?`,
      answer:
        `${v.name} is at ${line}. Apple Maps or Google Maps will take you there, ` +
        `and once you arrive Findway guides you inside from the entrance to the ward or clinic you need.`,
    })
  }
  for (const w of popularPlaces(v)) {
    const where = placeWhere(w, v)
    out.push({
      question: `Where is ${w.name} at ${v.name}?`,
      answer: `${where ? `${w.name}: ${where}. ` : ""}Findway shows it on the hospital map and gives step-by-step directions to it from the entrance.`,
    })
  }
  return out
}

// Directions to the hospital in the phone's maps app, by name and address
// rather than coordinates: the maps apps know where a hospital's way in is,
// and a generated venue's centre is placed only to within some metres.
export function directionsLinks(v: Venue): { apple: string; google: string } {
  const { line } = hospitalAddress(v)
  const to = line ? `${v.name}, ${line}` : `${v.center.lat.toFixed(6)},${v.center.lng.toFixed(6)}`
  return {
    apple: `https://maps.apple.com/?daddr=${encodeURIComponent(to)}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(to)}`,
  }
}

// Other mapped hospitals run by the same trust, for the page's further reading.
export function sameTrust(page: HospitalPage, pages: HospitalPage[]): HospitalPage[] {
  const trust = hospitalAddress(page.venue).trust
  if (!trust) return []
  return pages.filter((p) => p !== page && hospitalAddress(p.venue).trust === trust)
}
