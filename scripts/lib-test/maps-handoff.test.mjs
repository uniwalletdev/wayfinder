// Checks the hand-off of journeys out of the building to the phone's maps app
// (src/lib/maps-handoff.ts) and the place name directions use for them.
//
// Run: node scripts/lib-test/maps-handoff.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const M = await import(fileURLToPath(new URL("maps-handoff.ts", SRC)))
const R = await import(fileURLToPath(new URL("routing.ts", SRC)))
const S = await import(fileURLToPath(new URL("site-destination.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
const HOSPITAL = { lat: 54.98765432, lng: -1.6054321 }

group("which maps app")
{
  check("an iPhone gets Apple Maps", M.preferredMapsProvider(IPHONE) === "apple")
  check("an iPad (which says Macintosh) gets Apple Maps", M.preferredMapsProvider(IPAD) === "apple")
  check("Android gets Google Maps", M.preferredMapsProvider(ANDROID) === "google")
  check("a Windows browser gets Google Maps", M.preferredMapsProvider(WINDOWS) === "google")
  check("an unknown agent gets Google Maps", M.preferredMapsProvider("") === "google")
}

group("the links")
{
  check("Apple Maps, walking", M.mapsDirectionsUrl("apple", HOSPITAL, "walking") === "https://maps.apple.com/?daddr=54.987654,-1.605432&dirflg=w")
  check("Apple Maps, driving", M.mapsDirectionsUrl("apple", HOSPITAL, "driving").endsWith("&dirflg=d"))
  check("Apple Maps has no cycling flag, so none is sent", !M.mapsDirectionsUrl("apple", HOSPITAL, "cycling").includes("dirflg"))
  check("Google Maps, walking", M.mapsDirectionsUrl("google", HOSPITAL, "walking") === "https://www.google.com/maps/dir/?api=1&destination=54.987654,-1.605432&travelmode=walking")
  check("Google Maps calls cycling 'bicycling'", M.mapsDirectionsUrl("google", HOSPITAL, "cycling").endsWith("&travelmode=bicycling"))
  check("both name each provider", M.MAPS_PROVIDER_NAMES.apple === "Apple Maps" && M.MAPS_PROVIDER_NAMES.google === "Google Maps")
}

group("place names in directions")
{
  const venue = { id: "rtf-st-nicholas", name: "St Nicholas Hospital", center: HOSPITAL, postcode: "NE3 3XT", waypoints: [], floorPlans: [] }
  const dest = S.siteDestination(venue)
  check("the hospital button keeps its label", dest.name === "Directions to the hospital")
  check("but directions name the hospital", R.placeName(dest) === "St Nicholas Hospital")
  check("it is a journey out of the building", R.isOutdoorDestination(dest))
  const route = R.buildRoute({ lat: 54.99, lng: -1.61 }, 0, dest, [], "walking", [], "fastest")
  check("the instruction says the hospital, not the button", route.steps.every((s) => !s.instruction.includes("Directions to the hospital")) && route.steps.some((s) => s.instruction.includes("St Nicholas Hospital")))
  check("an ordinary place is named as itself", R.placeName({ name: "Kangaroo Ward" }) === "Kangaroo Ward")
}

report()
