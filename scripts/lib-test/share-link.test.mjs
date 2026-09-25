// Checks the one parser behind shared links, printed QR posters and in-app
// scans (src/lib/share-link.ts).
//
// The share link used to point at a domain the app does not own, and the QR
// payload was a bare string only the in-app scanner could read; a phone camera
// scanning a poster got nothing. Both now carry a real URL, and a malformed
// value (a poster typed by hand, a QR of something else entirely) must come
// back as "no link" rather than NaN coordinates that poison the position
// pipeline.
//
// Run: node scripts/lib-test/share-link.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { buildNavigateUrl, parseWayfinderLink, linkFromSearchParams, displayUrl } = await import(
  fileURLToPath(new URL("share-link.ts", SRC))
)
const { group, check, report } = await import("../nhs/test/harness.mjs")

const ORIGIN = "https://wayfinder.example"

group("building a link")
{
  const url = buildNavigateUrl(ORIGIN, { venueId: "gosh", destinationId: "pharmacy" })
  check("is a real URL on this origin", url === `${ORIGIN}/navigate?venue=gosh&to=pharmacy`)
  check("a trailing slash on the origin is not doubled", buildNavigateUrl(`${ORIGIN}/`, { venueId: "gosh" }) === `${ORIGIN}/navigate?venue=gosh`)
  const full = buildNavigateUrl(ORIGIN, {
    venueId: "gosh",
    destinationId: "kangaroo-ward",
    anchor: { floor: 0, lat: 51.5225571, lng: -0.1202191 },
    stepFree: true,
  })
  check("carries the anchor and the step-free flag", full === `${ORIGIN}/navigate?venue=gosh&to=kangaroo-ward&floor=0&lat=51.522557&lng=-0.120219&stepfree=1`)
  check("with nothing set it is just the map", buildNavigateUrl(ORIGIN, {}) === `${ORIGIN}/navigate`)
  check("the display form drops the scheme", displayUrl(url) === "wayfinder.example/navigate?venue=gosh&to=pharmacy")
}

group("reading a link back")
{
  const link = { venueId: "gosh", destinationId: "kangaroo-ward", anchor: { floor: 3, lat: 51.5, lng: -0.12 }, stepFree: true }
  const back = parseWayfinderLink(buildNavigateUrl(ORIGIN, link))
  check("round-trips every field", JSON.stringify(back) === JSON.stringify(link))
  check("from another deployment's origin too", JSON.stringify(parseWayfinderLink(buildNavigateUrl("http://localhost:3000", link))) === JSON.stringify(link))
  check("from a bare query string", parseWayfinderLink("?venue=gosh&to=x")?.destinationId === "x")
  check("from a path", parseWayfinderLink("/navigate?venue=gosh")?.venueId === "gosh")
  const params = linkFromSearchParams(new URLSearchParams("venue=gosh&stepfree=true"))
  check("stepfree=true is also accepted", params?.stepFree === true)
  check("stepfree=0 is not", linkFromSearchParams(new URLSearchParams("venue=gosh&stepfree=0"))?.stepFree === undefined)
}

group("the legacy poster payload")
{
  const link = parseWayfinderLink("floor:0:lat:51.522557:lng:-0.120219:dest:pharmacy")
  check("still anchors the walker", link?.anchor?.floor === 0 && link?.anchor?.lat === 51.522557 && link?.anchor?.lng === -0.120219)
  check("and picks the destination", link?.destinationId === "pharmacy")
  check("a plain position fix, no destination, still parses", parseWayfinderLink("floor:2:lat:51.5:lng:-0.1")?.anchor?.floor === 2)
  check("a destination id containing colons survives", parseWayfinderLink("floor:0:lat:51.5:lng:-0.1:dest:a:b")?.destinationId === "a:b")
}

group("bad input never yields a bad position")
{
  check("a QR of something else is not a link", parseWayfinderLink("WIFI:T:WPA;S:guest;;") === null)
  check("nor is an empty string", parseWayfinderLink("") === null)
  check("nor a URL with no wayfinder fields", parseWayfinderLink("https://example.com/?utm=1") === null)
  const nan = parseWayfinderLink("floor:abc:lat:x:lng:y:dest:pharmacy")
  check("unparseable numbers drop the anchor, not the destination", nan?.anchor === undefined && nan?.destinationId === "pharmacy")
  check("a fractional floor is rejected", parseWayfinderLink("?floor=1.5&lat=51.5&lng=-0.1") === null)
  check("an out-of-range latitude is rejected", parseWayfinderLink("?floor=0&lat=95&lng=-0.1") === null)
  check("an incomplete anchor is rejected", parseWayfinderLink("?floor=0&lat=51.5") === null)
  check("a very long id is truncated rather than kept whole", (parseWayfinderLink(`?to=${"a".repeat(500)}`)?.destinationId?.length ?? 0) === 200)
}

report()
