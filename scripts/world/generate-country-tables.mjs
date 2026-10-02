// Writes src/lib/data/timezone-countries.ts: which country a device is in, from
// the time zone its browser reports.
//
// The app shows a visitor the hospitals of the country they are in without
// asking (src/lib/country.ts). The IANA time zone is the one location signal
// every browser gives for free, before any GPS permission, and it maps to a
// country well: Europe/Luxembourg is Luxembourg. The table comes from
// moment-timezone's zone metadata (itself from the IANA zone1970.tab), where a
// zone shared by several countries since the 2022 merges lists the country it
// is named for first — Europe/Brussels is Belgium before Luxembourg.
//
// Run: node scripts/world/generate-country-tables.mjs [--from meta.json]
// Without --from, the metadata is fetched from unpkg.
import { readFileSync, writeFileSync } from "node:fs"

const i = process.argv.indexOf("--from")
const meta = i > -1
  ? JSON.parse(readFileSync(process.argv[i + 1], "utf8"))
  : await (await fetch("https://unpkg.com/moment-timezone/data/meta/latest.json")).json()

// Zone names older browsers and some phones still report, which the metadata
// no longer lists.
const LEGACY = {
  "Asia/Calcutta": "IN", "Asia/Katmandu": "NP", "Asia/Dacca": "BD", "Asia/Rangoon": "MM", "Asia/Saigon": "VN",
  "Asia/Istanbul": "TR", "Asia/Macao": "MO", "Asia/Thimbu": "BT", "Asia/Ulan_Bator": "MN", "Asia/Ashkhabad": "TM",
  "Asia/Ujung_Pandang": "ID", "Asia/Chongqing": "CN", "Asia/Harbin": "CN", "Asia/Kashgar": "CN", "Asia/Tel_Aviv": "IL",
  "Europe/Kiev": "UA", "Europe/Uzhgorod": "UA", "Europe/Zaporozhye": "UA", "Europe/Nicosia": "CY", "Europe/Belfast": "GB",
  "Europe/Tiraspol": "MD", "America/Buenos_Aires": "AR", "America/Catamarca": "AR", "America/Cordoba": "AR",
  "America/Jujuy": "AR", "America/Mendoza": "AR", "America/Rosario": "AR", "America/Indianapolis": "US",
  "America/Fort_Wayne": "US", "America/Knox_IN": "US", "America/Louisville": "US", "America/Atka": "US",
  "America/Shiprock": "US", "America/Montreal": "CA", "America/Godthab": "GL", "America/Porto_Acre": "BR",
  "America/Virgin": "VI", "America/Santa_Isabel": "MX", "America/Ensenada": "MX", "Atlantic/Faeroe": "FO",
  "Atlantic/Jan_Mayen": "SJ", "Africa/Asmera": "ER", "Africa/Timbuktu": "ML", "Pacific/Ponape": "FM",
  "Pacific/Truk": "FM", "Pacific/Yap": "FM", "Pacific/Samoa": "AS", "Pacific/Enderbury": "KI", "Pacific/Johnston": "UM",
  "Australia/ACT": "AU", "Australia/Canberra": "AU", "Australia/NSW": "AU", "Australia/North": "AU",
  "Australia/Queensland": "AU", "Australia/South": "AU", "Australia/Tasmania": "AU", "Australia/Victoria": "AU",
  "Australia/West": "AU", "Australia/Yancowinna": "AU", "Australia/LHI": "AU", "Canada/Atlantic": "CA",
  "Canada/Central": "CA", "Canada/Eastern": "CA", "Canada/Mountain": "CA", "Canada/Newfoundland": "CA",
  "Canada/Pacific": "CA", "Canada/Saskatchewan": "CA", "Canada/Yukon": "CA", "Brazil/East": "BR", "Brazil/West": "BR",
  "Chile/Continental": "CL", "Mexico/General": "MX", "Mexico/BajaNorte": "MX", "Mexico/BajaSur": "MX", "Cuba": "CU",
  "Egypt": "EG", "Eire": "IE", "GB": "GB", "GB-Eire": "GB", "Hongkong": "HK", "Iceland": "IS", "Iran": "IR",
  "Israel": "IL", "Jamaica": "JM", "Japan": "JP", "Libya": "LY", "NZ": "NZ", "PRC": "CN", "Poland": "PL",
  "Portugal": "PT", "ROC": "TW", "ROK": "KR", "Singapore": "SG", "Turkey": "TR", "US/Alaska": "US", "US/Aleutian": "US",
  "US/Arizona": "US", "US/Central": "US", "US/Eastern": "US", "US/Hawaii": "US", "US/Indiana-Starke": "US",
  "US/Michigan": "US", "US/Mountain": "US", "US/Pacific": "US", "US/Samoa": "AS",
}

const byCountry = new Map()
const add = (code, zone) => {
  if (!byCountry.has(code)) byCountry.set(code, [])
  byCountry.get(code).push(zone)
}
for (const zone of Object.values(meta.zones)) {
  const primary = zone.countries?.[0]
  if (!primary) continue
  add(primary, zone.name)
}
for (const [zone, code] of Object.entries(LEGACY)) if (!meta.zones[zone]) add(code, zone)

const rows = [...byCountry.entries()].sort(([a], [b]) => a.localeCompare(b))
  .map(([code, zones]) => `  ${code}: ${JSON.stringify(zones.sort().join(" "))},`)

writeFileSync("src/lib/data/timezone-countries.ts", [
  "// GENERATED FILE — do not edit by hand.",
  "//",
  "// Written by scripts/world/generate-country-tables.mjs from the IANA zone",
  "// table (via moment-timezone's metadata): each country's IANA time zones, a",
  "// zone listed once, under the country it is named for. src/lib/country.ts",
  "// reads it backwards to tell which country a device is in.",
  "",
  "export const TIME_ZONES_BY_COUNTRY: Record<string, string> = {",
  ...rows,
  "}",
  "",
].join("\n"))
console.log(`wrote ${rows.length} countries, ${[...byCountry.values()].reduce((n, z) => n + z.length, 0)} zones`)
