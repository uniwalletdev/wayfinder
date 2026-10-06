// Checks the street map's tile addresses (src/lib/basemap.ts): which paths
// name a tile, the Mapbox address each becomes, and how long a tile is cached.
//
// Run: node scripts/lib-test/basemap.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const B = await import(fileURLToPath(new URL("basemap.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

group("reading a tile address")
{
  const t = B.parseTile("light", "16", "32741", "21789")
  check("a plain tile is read", t && t.style === "light" && t.z === 16 && t.x === 32741 && t.y === 21789 && t.retina === false)
  check("Leaflet's @2x marks a high-density tile", B.parseTile("dark", "16", "32741", "21789@2x")?.retina === true)
  check("only the two styles are accepted", B.parseTile("satellite", "1", "0", "0") === null && B.parseTile("", "1", "0", "0") === null)
  check("zoom 0 has one tile", B.parseTile("light", "0", "0", "0") !== null && B.parseTile("light", "0", "1", "0") === null && B.parseTile("light", "0", "0", "1") === null)
  check("x and y stay inside the zoom's grid", B.parseTile("light", "3", "7", "7") !== null && B.parseTile("light", "3", "8", "0") === null && B.parseTile("light", "3", "0", "8") === null)
  check("zoom stops at the deepest the map uses", B.parseTile("light", String(B.MAX_TILE_ZOOM), "0", "0") !== null && B.parseTile("light", "23", "0", "0") === null)
  check("anything but whole numbers is refused", ["-1", "1.5", "a", "", "1e3", " 1"].every((v) => B.parseTile("light", v, "0", "0") === null && B.parseTile("light", "2", v, "0") === null))
  check("a stray suffix on y is refused", ["0@3x", "0.png", "0@2x.png", "@2x"].every((y) => B.parseTile("light", "2", "0", y) === null))
}

group("the Mapbox address")
{
  const url = B.mapboxTileUrl({ style: "light", z: 16, x: 32741, y: 21789, retina: true }, "pk.abc/def")
  check("light is Mapbox Streets, in 256-pixel tiles, @2x kept", url.startsWith("https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/16/32741/21789@2x?"))
  check("the token is encoded into the query", url.endsWith("?access_token=pk.abc%2Fdef"))
  check("dark is Mapbox Dark", B.mapboxTileUrl({ style: "dark", z: 1, x: 0, y: 1, retina: false }, "t").includes("/mapbox/dark-v11/tiles/256/1/0/1?"))
  check("every style has a Mapbox style and a CARTO fallback", B.BASEMAP_STYLES.every((s) => B.MAPBOX_STYLES[s] && B.CARTO_TILES[s].includes("{z}/{x}/{y}")))
  check("each source's credit names it and OpenStreetMap", B.BASEMAP_ATTRIBUTION.mapbox.includes("Mapbox") && B.BASEMAP_ATTRIBUTION.mapbox.includes("OpenStreetMap") && B.BASEMAP_ATTRIBUTION.carto.includes("CARTO"))
}

group("how long a tile is cached")
{
  check("Mapbox's max-age is kept", B.tileCacheSeconds("max-age=43200,s-maxage=300") === 43200)
  check("a day when Mapbox says nothing", B.tileCacheSeconds(null) === 86400 && B.tileCacheSeconds("no-transform") === 86400)
  check("never more than a week", B.tileCacheSeconds("public, max-age=99999999") === 604800)
  check("s-maxage alone is not mistaken for max-age", B.tileCacheSeconds("s-maxage=10") === 86400)
}

report()
