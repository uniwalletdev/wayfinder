import type { Venue } from "./types"
import { countsPhrase, hospitalAddress, hospitalPages, hospitalPath, placeCounts, HOSPITALS_PATH } from "./hospital-pages"
import { APP_STORE_URL, PLAY_STORE_URL, appAvailability } from "./store-links"

// /llms.txt (https://llmstxt.org): a plain summary of Findway and its pages for
// AI assistants, which read a short Markdown file far more reliably than an app
// drawn by JavaScript. Served by src/app/llms.txt/route.ts.

const isMapped = (v: Venue) => v.floorPlans.length > 0 || v.waypoints.length > 0

export function llmsTxt(venues: Venue[], base: URL): string {
  const at = (path: string) => new URL(path, base).toString()
  const pages = hospitalPages(venues)
  const located = venues.filter((v) => v.visibility === "public" && v.category === "hospital" && !isMapped(v)).length
  const stores = [`- [Google Play](${PLAY_STORE_URL}): the Android app`]
  if (APP_STORE_URL) stores.push(`- [App Store](${APP_STORE_URL}): the iPhone app`)

  return [
    "# Findway",
    "",
    "> Findway is a free hospital wayfinding app for NHS hospitals in the UK. It shows where wards, clinics and departments are inside a hospital and gives step-by-step walking directions from the entrance, avoiding stairs unless you choose otherwise. " +
      `It works ${appAvailability()}, with no account.`,
    "",
    `- ${pages.length} hospitals are mapped inside, each with a page listing its wards, departments, clinics and entrances.`,
    ...(located > 0 ? [`- ${located.toLocaleString("en-GB")} more NHS hospitals and clinics are located on the map, with directions to the site.`] : []),
    "- Findway guides you inside, from the entrance. Each hospital's page gives its address and links to directions there in Apple Maps or Google Maps.",
    "- Spoken directions, a vibration at each turn, and routes across floors by lift.",
    "- For a question like \"where is <ward> at <hospital>?\", the hospital's page below answers it and links to directions.",
    "",
    "## Hospital maps",
    "",
    `- [All hospital maps](${at(HOSPITALS_PATH)}): every mapped hospital, grouped by NHS trust`,
    ...pages.map((p) => {
      const { line } = hospitalAddress(p.venue)
      const counts = countsPhrase(placeCounts(p.venue))
      return `- [${p.venue.name}](${at(hospitalPath(p.slug))}): ${[line, counts].filter(Boolean).join(". ")}`
    }),
    "",
    "## Using Findway",
    "",
    `- [Open the map](${at("/navigate")}): search any mapped hospital and get directions`,
    ...stores,
    `- [Accessibility](${at("/accessibility")}): screen readers, keyboard use, step-free routes`,
    `- [Support](${at("/support")}): questions, corrections and reports`,
    `- [Privacy](${at("/privacy")}): what is collected and how to delete it`,
    "",
    "## Optional",
    "",
    `- [Map your hospital](${at("/map")}): for NHS estates teams adding or correcting a hospital's map`,
    "",
  ].join("\n")
}
